"""
LLM summarizer service for NMDC CDM Browser.
"""
from pathlib import Path
import os
from typing import Dict, List, Optional, Tuple
import json
import logging
from datetime import datetime, timedelta
import openai
from dotenv import load_dotenv
from dataclasses import dataclass
from abc import ABC
import tiktoken
from ..data_processing import StatisticsProcessor
from src.data_processing.study_analysis_processor import StudyAnalysisProcessor

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables
project_root = Path(__file__).parent.parent.parent
dotenv_path = project_root / '.env'
load_dotenv(dotenv_path=dotenv_path)

# OpenAI Settings
CBORG = os.getenv('USE_CBORG', 'false').lower() == 'true'
logger.info(f"Environment variables:")
logger.info(f"  USE_CBORG: {os.getenv('USE_CBORG')}")
logger.info(f"  CBORG_BASE_URL: {os.getenv('CBORG_BASE_URL')}")
logger.info(f"  CBORG_API_KEY: {'Set' if os.getenv('CBORG_API_KEY') else 'Not set'}")
logger.info(f"  CBORG_GENERATION_MODEL: {os.getenv('CBORG_GENERATION_MODEL')}")
logger.info(f"  OPENAI_BASE_URL: {os.getenv('OPENAI_BASE_URL')}")
logger.info(f"  OPENAI_API_KEY: {'Set' if os.getenv('OPENAI_API_KEY') else 'Not set'}")
logger.info(f"  OPENAI_GENERATION_MODEL: {os.getenv('OPENAI_GENERATION_MODEL')}")

OPENAI_BASE_URL = os.getenv('CBORG_BASE_URL' if CBORG else 'OPENAI_BASE_URL', 
                           "https://api.cborg.lbl.gov" if CBORG else "https://api.openai.com/v1")
OPENAI_API_KEY = os.getenv('CBORG_API_KEY' if CBORG else 'OPENAI_API_KEY', '')
GENERATION_MODEL = os.getenv('CBORG_GENERATION_MODEL' if CBORG else 'OPENAI_GENERATION_MODEL',
                           "gpt-4-turbo-preview" if not CBORG else "gpt-4")

if not OPENAI_API_KEY:
    raise ValueError("API key environment variable must be set")

@dataclass
class LLMConfig:
    """Configuration for LLM service."""
    model_name: str = GENERATION_MODEL  # Use environment-specific model
    temperature: float = 0.4
    max_tokens: int = 4000  # Maximum tokens for response
    context_window: int = 128000  # GPT-4 Turbo context window

class LLMService:
    """Service for generating AI summaries using LLM."""
    
    def __init__(self):
        """Initialize LLM service configuration."""
        self.config = LLMConfig()
        self._client = openai.OpenAI(
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL
        )
        # Use cl100k_base encoding for Claude models
        if "claude" in self.config.model_name.lower():
            self._encoding = tiktoken.get_encoding("cl100k_base")
        else:
            self._encoding = tiktoken.encoding_for_model(self.config.model_name)
        
    def _count_tokens(self, text: str) -> int:
        """Count the number of tokens in a text string."""
        return len(self._encoding.encode(text))
        
    def _load_data(self) -> Dict:
        """Load all necessary data for summary generation."""
        try:
            # Load study summary data
            summary_path = project_root / "study_summary.json"
            with open(summary_path, "r") as f:
                data = json.load(f)
            
            # Add physical variable statistics
            stats_processor = StatisticsProcessor()
            physical_stats = {}
            for variable in [
                'ph',
                'temp_has_numeric_value',
                'tot_carb',
                'tot_nitro_numeric',
                'nitrate_nitrogen_numeric',
                'nitrite_nitrogen_numeric',
                'ammonium_nitrogen_numeric',
                'diss_inorg_nitro_has_numeric_value',
                'diss_org_carb_has_numeric_value',
                'diss_inorg_carb_has_numeric_value',
                'tot_org_carb',
                'carb_nitro_ratio',
                'iron_numeric',
                'calcium_numeric',
                'magnesium_numeric',
                'manganese_numeric',
                'zinc_numeric',
                'sodium_has_numeric_value',
                'potassium_numeric'
            ]:
                try:
                    stats = stats_processor.get_physical_variable_statistics(variable)
                    if not stats.get('error'):
                        physical_stats[variable] = stats
                except Exception as e:
                    logger.warning(f"Error getting statistics for {variable}: {str(e)}")
                    continue
            
            data['physical_variable_stats'] = physical_stats

            # Add omics statistics
            omics_stats = {}
            for omics_type in ['metabolomics', 'lipidomics', 'proteomics']:
                try:
                    stats = stats_processor.get_omics_statistics(omics_type)
                    if stats:
                        omics_stats[omics_type] = stats
                except Exception as e:
                    logger.warning(f"Error getting statistics for {omics_type}: {str(e)}")
                    continue
            
            data['omics_stats'] = omics_stats

            # Add taxonomic statistics
            taxonomic_stats = {}
            for analysis_type in ['gottcha', 'kraken', 'centrifuge', 'contigs']:
                try:
                    stats = stats_processor.get_taxonomic_statistics(analysis_type)
                    if stats:
                        taxonomic_stats[analysis_type] = stats
                except Exception as e:
                    logger.warning(f"Error getting statistics for {analysis_type}: {str(e)}")
                    continue
            
            data['taxonomic_stats'] = taxonomic_stats
            
            return data
        except Exception as e:
            logger.error(f"Error loading data: {str(e)}")
            raise

    def _prepare_study_summary(self, studies: List[Dict]) -> str:
        """Prepare a concise summary of studies."""
        summary = []
        for study in studies:
            # Only include essential fields
            summary.append(
                f"Study: {study.get('name', 'Unnamed')}\n"
                f"Description: {study.get('description', 'No description')}\n"
                f"Samples: {study.get('sample_count', 0)}\n"
                f"Ecosystem: {study.get('ecosystem', 'Unknown')}\n"
            )
        return "\n".join(summary)

    def _prepare_geographic_summary(self, locations: List[Dict]) -> str:
        """Prepare a concise summary of geographic distribution."""
        if not locations:
            return "No geographic data available"
            
        # Group locations by region
        regions = {}
        for loc in locations:
            lat, lon = loc.get('latitude', 0), loc.get('longitude', 0)
            region = self._get_region(lat, lon)
            if region not in regions:
                regions[region] = 0
            regions[region] += loc.get('sample_count', 0)
            
        summary = ["Geographic Distribution:"]
        for region, count in regions.items():
            summary.append(f"- {region}: {count} samples")
        return "\n".join(summary)

    def _get_region(self, lat: float, lon: float) -> str:
        """Convert lat/lon to a region name."""
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            if lat > 66.5:
                return "Arctic"
            elif lat < -66.5:
                return "Antarctic"
            elif lat > 23.5:
                return "Northern Temperate"
            elif lat < -23.5:
                return "Southern Temperate"
            else:
                return "Tropical"
        return "Unknown"

    def _prepare_measurement_summary(self, measurements: Dict) -> str:
        """Prepare a concise summary of measurement coverage."""
        if not measurements:
            return "No measurement data available"
            
        summary = ["Measurement Coverage:"]
        for study_id, types in measurements.items():
            summary.append(f"- Study {study_id}: {len(types)} types")
        return "\n".join(summary)

    def _prepare_prompt(self, data: Dict) -> Tuple[str, int]:
        """Prepare the prompt for the LLM based on available data."""
        # Extract and format data
        studies = data.get("study_cards", [])
        geographic = data.get("geographic_distribution", [])
        measurements = data.get("measurement_coverage", {})
        summary_stats = data.get("summary_stats", {})
        physical_stats = data.get("physical_variable_stats", {})
        omics_stats = data.get("omics_stats", {})
        taxonomic_stats = data.get("taxonomic_stats", {})
        
        # Prepare concise summaries
        study_summary = self._prepare_study_summary(studies)
        geo_summary = self._prepare_geographic_summary(geographic)
        measurement_summary = self._prepare_measurement_summary(measurements)
        
        # Prepare statistics summary
        stats_summary = []
        if summary_stats:
            stats_summary.append("\nQuantitative Statistics:")
            stats_summary.append(f"Total Studies: {summary_stats.get('total_studies', 0)}")
            stats_summary.append(f"Total Samples: {summary_stats.get('total_samples', 0)}")
            
            # Sample count statistics
            sample_stats = summary_stats.get('sample_count_stats', {})
            if sample_stats:
                stats_summary.append("\nSample Count Statistics:")
                stats_summary.append(f"- Mean samples per study: {sample_stats.get('mean', 0):.1f}")
                stats_summary.append(f"- Median samples per study: {sample_stats.get('median', 0):.1f}")
                stats_summary.append(f"- Range: {sample_stats.get('min', 0)} to {sample_stats.get('max', 0)} samples")
            
            # Measurement distribution
            measurement_dist = summary_stats.get('measurement_distribution', {})
            if measurement_dist:
                stats_summary.append("\nMeasurement Distribution:")
                for measurement, stats in measurement_dist.items():
                    stats_summary.append(f"\n{measurement.replace('_', ' ').title()}:")
                    stats_summary.append(f"- Total measurements: {stats.get('total', 0)}")
                    stats_summary.append(f"- Studies with this measurement: {stats.get('studies', 0)}")
                    stats_summary.append(f"- Mean measurements per study: {stats.get('mean_per_study', 0):.1f}")
            
            # Ecosystem distribution
            ecosystem_dist = summary_stats.get('ecosystem_distribution', {})
            if ecosystem_dist:
                stats_summary.append("\nEcosystem Distribution:")
                for ecosystem, count in ecosystem_dist.items():
                    stats_summary.append(f"- {ecosystem}: {count} samples")
        
        # Add physical variable statistics
        if physical_stats:
            stats_summary.append("\nPhysical Variable Statistics:")
            for variable, stats in physical_stats.items():
                stats_summary.append(f"\n{variable.replace('_', ' ').title()}:")
                stats_summary.append(f"- Mean: {stats['mean']:.2f}")
                stats_summary.append(f"- Standard Deviation: {stats['std']:.2f}")
                stats_summary.append(f"- Range: {stats['min']:.2f} to {stats['max']:.2f}")
                stats_summary.append(f"- Sample Count: {stats['count']}")
        
        # Add omics statistics
        if omics_stats:
            stats_summary.append("\nOmics Statistics:")
            for omics_type, stats in omics_stats.items():
                stats_summary.append(f"\n{omics_type.title()}:")
                for item in stats[:5]:  # Show top 5 items
                    if 'compound_name' in item:
                        stats_summary.append(f"- {item['compound_name']}: {item['mean_abundance']:.2f} ± {item['std_abundance']:.2f}")
                    elif 'lipid_molecular_species' in item:
                        stats_summary.append(f"- {item['lipid_molecular_species']}: {item['mean_abundance']:.2f} ± {item['std_abundance']:.2f}")
                    elif 'product' in item:
                        stats_summary.append(f"- {item['product']}: {item['mean_abundance']:.2f} ± {item['std_abundance']:.2f}")
        
        # Add taxonomic statistics
        if taxonomic_stats:
            stats_summary.append("\nTaxonomic Statistics:")
            for analysis_type, stats in taxonomic_stats.items():
                stats_summary.append(f"\n{analysis_type.title()}:")
                for rank, items in stats.items():
                    stats_summary.append(f"\n{rank.title()}:")
                    for item in items[:3]:  # Show top 3 items per rank
                        if 'lineage' in item:
                            stats_summary.append(f"- {item['lineage']}: {item['mean_abundance']:.2f} ± {item['std_abundance']:.2f}")
                        elif 'label' in item:
                            stats_summary.append(f"- {item['label']}: {item['mean_abundance']:.2f} ± {item['std_abundance']:.2f}")
        
        # Base prompt
        prompt = """You are an expert in environmental biology and ecology with deep knowledge of microbial ecology, biogeochemistry, and systems biology. Please analyze the following data and provide a comprehensive summary in the following sections:

1. General Scope of Studies:
- Analyze the titles, descriptions, and timelines of the studies
- Identify common themes, questions, and research objectives
- Assess the temporal distribution of studies
- Include quantitative statistics about the number of studies, samples, and measurements

2. Geographic Analysis:
- Evaluate the geographic distribution of studies
- Compare this coverage to global environmental diversity
- Identify any notable gaps or concentrations
- Include statistics about sample distribution across regions

3. Environmental Variables Analysis:
- Assess the range and distribution of physical variables
- Compare these ranges to expected natural ranges
- Identify any notable patterns or anomalies
- Include quantitative statistics about measurement coverage
- Analyze the statistical distributions of physical variables (means, standard deviations, ranges)
- Highlight any unusual or extreme values in the physical measurements

4. Biological Trends:
- Analyze patterns in omics and taxonomic data
- Identify any notable biological trends or relationships
- Assess the interaction between environmental and biological factors
- Include statistics about measurement types and their distribution
- Highlight key compounds, lipids, proteins, and taxa with their abundance patterns
- Discuss potential relationships between environmental conditions and biological responses

Please provide a clear, concise summary that highlights the most important findings and patterns, making sure to incorporate the quantitative statistics provided. Pay special attention to the physical variable statistics and their implications for biological processes.
Where you can be very specific about the data and their implications for biological processes or environmental conditions.

Data for analysis:

"""
        
        # Add formatted data
        prompt += f"\n{study_summary}\n\n{geo_summary}\n\n{measurement_summary}\n\n{chr(10).join(stats_summary)}"
        
        # Count tokens
        token_count = self._count_tokens(prompt)
        
        # If we're over the context window, truncate the data
        max_prompt_tokens = self.config.context_window - self.config.max_tokens - 1000  # Buffer for system message
        if token_count > max_prompt_tokens:
            logger.warning(f"Prompt too long ({token_count} tokens), truncating...")
            # Implement truncation logic here if needed
            # For now, we'll just log a warning
            
        return prompt, token_count

    def generate_summary(self) -> Dict:
        """Generate a comprehensive summary using the LLM."""
        try:
            # Check cache first
            cache_path = project_root / "processed_data" / "ai_summary.json"
            summary_path = project_root / "study_summary.json"
            
            if cache_path.exists() and summary_path.exists():
                try:
                    # Check if source data has been modified
                    cache_mtime = cache_path.stat().st_mtime
                    summary_mtime = summary_path.stat().st_mtime
                    
                    if cache_mtime > summary_mtime:
                        with open(cache_path, "r") as f:
                            cached_data = json.load(f)
                            logger.info("Using cached summary")
                            return cached_data
                except Exception as e:
                    logger.warning(f"Error checking cache: {str(e)}")
            
            # Load data
            data = self._load_data()
            
            # Prepare prompt
            prompt, token_count = self._prepare_prompt(data)
            logger.info(f"Generated prompt with {token_count} tokens")
            
            # Call LLM
            response = self._client.chat.completions.create(
                model=self.config.model_name,
                messages=[
                    {"role": "system", "content": "You are an expert in environmental biology and ecology."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens
            )
            
            # Process response
            summary = response.choices[0].message.content
            
            # Structure the response
            result = {
                "summary": summary,
                "last_updated": datetime.now().isoformat(),
                "data_version": data.get("version", "unknown"),
                "token_count": token_count
            }
            
            # Cache the result
            try:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                with open(cache_path, "w") as f:
                    json.dump(result, f, indent=2)
                logger.info("Cached summary updated")
            except Exception as e:
                logger.error(f"Error caching summary: {str(e)}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            raise

    def _prepare_study_prompt(self, study_data: Dict, compendium_data: Dict) -> Tuple[str, int]:
        """Prepare the prompt for study-specific summary generation."""
        # Validate required data structures
        if not study_data:
            raise ValueError("Study data is empty")
        if not compendium_data:
            raise ValueError("Compendium data is empty")
        
        # Extract study information
        study_id = study_data.get('id')
        if not study_id:
            raise ValueError("Study ID is missing from study data")
        
        study_name = study_data.get('name', 'Unnamed Study')
        study_desc = study_data.get('description', 'No description available')
        
        # Extract analysis section
        analysis = study_data.get('analysis', {})
        if not analysis:
            logger.warning("Analysis section is empty in study data")
        
        # Extract physical variables
        physical_vars = analysis.get('physical', {})
        if not physical_vars:
            logger.warning("No physical variables found in analysis")
        
        # Extract omics data
        omics_data = analysis.get('omics', {})
        if not omics_data:
            logger.warning("No omics data found in analysis")
        
        # Extract taxonomic data
        taxonomic_data = analysis.get('taxonomic', {})
        if not taxonomic_data:
            logger.warning("No taxonomic data found in analysis")
        
        # Log data availability
        logger.info(f"Data availability for study {study_id}:")
        logger.info(f"- Physical variables: {len(physical_vars)}")
        logger.info(f"- Omics data types: {list(omics_data.keys()) if omics_data else 'None'}")
        logger.info(f"- Taxonomic data types: {list(taxonomic_data.keys()) if taxonomic_data else 'None'}")
        
        # Format physical variables section
        physical_section = []
        if physical_vars:
            physical_section.append("\nPhysical Variables:")
            for var, stats in physical_vars.items():
                if var in compendium_data.get('physical_variable_stats', {}):
                    comp_stats = compendium_data['physical_variable_stats'][var]
                    physical_section.append(f"\n{var.replace('_', ' ').title()}:")
                    physical_section.append(f"- Study mean: {stats.get('mean', 0):.2f}")
                    physical_section.append(f"- Compendium mean: {comp_stats.get('mean', 0):.2f}")
                    if abs(stats.get('mean', 0) - comp_stats.get('mean', 0)) > comp_stats.get('std', 0):
                        physical_section.append("- Note: This value differs significantly from the compendium average")
        
        # Format omics section
        omics_section = []
        if omics_data:
            omics_section.append("\nOmics Data:")
            for omics_type, data in omics_data.items():
                if omics_type in ['metabolomics', 'lipidomics', 'proteomics']:
                    omics_section.append(f"\n{omics_type.title()}:")
                    top10 = data.get('top10', [])
                    if top10:
                        omics_section.append("Most abundant features:")
                        for item in top10[:5]:  # Show top 5
                            omics_section.append(f"- {item.get('name', 'Unknown')}: {item.get('mean_abundance', 0):.2f}")
        
        # Format taxonomic section
        taxonomic_section = []
        if taxonomic_data:
            taxonomic_section.append("\nTaxonomic Information:")
            for tax_type, data in taxonomic_data.items():
                if tax_type in ['contigs', 'centrifuge', 'kraken', 'gottcha']:
                    taxonomic_section.append(f"\n{tax_type.title()} Analysis:")
                    top10 = data.get('top10', [])
                    if top10:
                        taxonomic_section.append("Most abundant taxa:")
                        for item in top10[:5]:  # Show top 5
                            taxonomic_section.append(f"- {item.get('name', 'Unknown')}: {item.get('mean_abundance', 0):.2f}")
        
        # Set defaults before the conditional
        study_ecosystem = 'Unknown'
        study_sample_count = 0
        ecosystem = study_ecosystem  # Always defined

        # Overwrite if info is available
        study_cards = compendium_data.get('study_cards', [])
        study_info = next((card for card in study_cards if card.get('id') == study_id), None)
        if study_info:
            study_name = study_info.get('name', study_name)
            study_desc = study_info.get('description', study_desc)
            study_ecosystem = study_info.get('ecosystem', study_ecosystem)
            study_sample_count = study_info.get('sample_count', study_sample_count)
            ecosystem = study_ecosystem

        # Extract analysis section
        analysis = study_data.get('analysis', {})
        # Ecosystem (prefer analysis['ecosystem'] if present)
        ecosystem = analysis.get('ecosystem', ecosystem)

        # Debug logging to check data
        logger.info(f"Study name: {study_name}")
        logger.info(f"Study description: {study_desc}")
        logger.info(f"Ecosystem: {ecosystem}")
        logger.info(f"Sample count: {study_sample_count}")
        logger.info(f"Physical variables count: {len(physical_vars)}")
        logger.info(f"Omics data types: {list(omics_data.keys()) if omics_data else 'None'}")
        logger.info(f"Taxonomic data types: {list(taxonomic_data.keys()) if taxonomic_data else 'None'}")

        # --- Prompt Construction ---
        prompt = f"""You are an expert in environmental biology and ecology with deep knowledge of microbial ecology, biogeochemistry, and systems biology. Please analyze this study in the context of the broader compendium and provide a structured summary focusing on what makes this study unique and significant.\n\nStudy: {study_name}\nDescription: {study_desc}\nEcosystem: {ecosystem}\nSample Count: {study_sample_count}\n\nPlease provide a comprehensive analysis in the following sections:\n\nA. Purpose and Geography\n- Analyze the study's purpose and geographic context\n- Compare its location to other studies in the compendium\n- Highlight any unique geographic features\n- Consider the ecosystem type and its significance\n\nB. Physical Features and Environmental Context\n- Describe the characteristic physical variables of this study\n- Compare these to the compendium averages\n- Explain the significance of any notable differences\n- Discuss how these physical conditions might influence biological processes\n- Consider the implications of the sample count and measurement precision\n- Analyze potential environmental stressors or unique conditions\n\nC. Omics Data Analysis\n- For each omics type (metabolomics, lipidomics, proteomics):\n  * Analyze the most abundant features and their potential biological roles\n  * Explain the metabolic pathways and processes these features might be involved in\n  * Discuss how these features might interact with the physical environment\n  * Interpret the significance of outliers in terms of biological function\n  * Consider the implications for ecosystem function and microbial community dynamics\n\nD. Taxonomic Analysis and Ecological Implications\n- For each taxonomic rank (from superkingdom to species):\n  * Analyze the most abundant taxa and their ecological roles\n  * Explain their potential metabolic capabilities and functional traits\n  * Discuss their relationships with the physical environment\n  * Interpret the significance of outliers in terms of ecological function\n  * Consider how these taxa might interact with each other and their environment\n\nE. Integrated Analysis\n- Synthesize the relationships between physical variables, omics data, and taxonomic composition\n- Explain how the observed patterns might reflect ecosystem function\n- Discuss potential biogeochemical cycles and microbial processes\n- Analyze how the study's findings compare to similar ecosystems\n- Identify unique or unexpected patterns that might indicate novel processes\n\nPlease be specific about the data and their implications for biological processes or environmental conditions. Where data is limited or unavailable, note this limitation. Focus on what makes this study unique or significant compared to the broader compendium. Use your expertise in environmental biology and ecology to provide insights beyond the raw data.\n\nFor each significant feature (physical, omics, or taxonomic), please:\n1. Explain its potential biological or ecological role\n2. Describe how it might interact with other features\n3. Consider its implications for ecosystem function\n4. Discuss any known or potential adaptations to the observed conditions\n5. Analyze how it might respond to environmental changes\n\nData for analysis:\n\n{chr(10).join(physical_section)}\n{chr(10).join(omics_section)}\n{chr(10).join(taxonomic_section)}\n"""
        
        # Count tokens
        token_count = self._count_tokens(prompt)
        
        return prompt, token_count

    def generate_study_summary(self, study_id: str) -> Dict:
        """Generate a study-specific summary using the LLM."""
        try:
            # Use StudyAnalysisProcessor to get analysis data
            processor = StudyAnalysisProcessor()
            study_data = processor.get_study_analysis(study_id)
            logger.info(f"Successfully loaded study data with keys: {list(study_data.keys())}")

            # Load compendium data
            compendium_path = Path(__file__).parent.parent.parent / "study_summary.json"
            logger.info(f"Loading compendium data from: {compendium_path}")
            with open(compendium_path, "r") as f:
                compendium_data = json.load(f)
                logger.info(f"Successfully loaded compendium data with keys: {list(compendium_data.keys())}")

            # Get study information from study_cards
            study_cards = compendium_data.get('study_cards', [])
            study_info = next((card for card in study_cards if card.get('id') == study_id), None)
            if not study_info:
                raise ValueError(f"Study {study_id} not found in compendium data")
            
            study_name = study_info.get('name', 'Unnamed Study')
            study_desc = study_info.get('description', 'No description available')
            study_ecosystem = study_info.get('ecosystem', 'Unknown')
            study_sample_count = study_info.get('sample_count', 0)

            # Extract analysis data
            physical_vars = study_data.get('physical', {})
            omics_data = study_data.get('omics', {})
            taxonomic_data = study_data.get('taxonomic', {})
            ecosystem = study_data.get('ecosystem', study_ecosystem)

            # Debug logging to check data
            logger.info(f"Study name: {study_name}")
            logger.info(f"Study description: {study_desc}")
            logger.info(f"Ecosystem: {ecosystem}")
            logger.info(f"Sample count: {study_sample_count}")
            logger.info(f"Physical variables count: {len(physical_vars)}")
            logger.info(f"Omics data types: {list(omics_data.keys()) if omics_data else 'None'}")
            logger.info(f"Taxonomic data types: {list(taxonomic_data.keys()) if taxonomic_data else 'None'}")

            # --- Physical Variables ---
            physical_section = []
            if physical_vars:
                physical_section.append("\nPhysical Variables:")
                for var, stats in physical_vars.items():
                    if stats.get('status') == 'ok':
                        comp_stats = compendium_data.get('summary_stats', {}).get('physical_variable_stats', {}).get(var, {})
                        physical_section.append(f"\n{var.replace('_', ' ').title()}:")
                        physical_section.append(f"- Study mean: {stats.get('mean', 0)}")
                        if comp_stats:
                            physical_section.append(f"- Compendium mean: {comp_stats.get('mean', 0)}")
                            if abs(stats.get('mean', 0) - comp_stats.get('mean', 0)) > comp_stats.get('std', 0):
                                physical_section.append("- Note: This value differs significantly from the compendium average")
                        physical_section.append(f"- Study range: {stats.get('min', 0)} to {stats.get('max', 0)}")
                        physical_section.append(f"- Sample count: {stats.get('count', 0)}")

            # --- Omics Data ---
            omics_section = []
            if omics_data:
                omics_section.append("\nOmics Data:")
                for omics_type in ['metabolomics', 'lipidomics', 'proteomics']:
                    top10 = omics_data.get('top10', {}).get(omics_type, [])
                    outliers = omics_data.get('outliers', {}).get(omics_type, [])
                    if top10 or outliers:
                        omics_section.append(f"\n{omics_type.title()}:")
                        if top10:
                            omics_section.append("Most abundant features in this study:")
                            for item in top10[:5]:
                                name = item.get('id', item.get('name', 'Unknown'))
                                abundance = item.get('mean_abundance', 0)
                                omics_section.append(f"- {name}: {abundance}")
                        if outliers:
                            omics_section.append("\nNotable outliers:")
                            for item in outliers[:3]:
                                name = item.get('id', item.get('name', 'Unknown'))
                                abundance = item.get('mean_abundance', 0)
                                omics_section.append(f"- {name}: {abundance}")

            # --- Taxonomic Data ---
            taxonomic_section = []
            if taxonomic_data:
                taxonomic_section.append("\nTaxonomic Information:")
                for tax_type in ['gottcha', 'kraken', 'centrifuge', 'contigs']:
                    top10_by_rank = taxonomic_data.get('top10', {}).get(tax_type, {})
                    outliers_by_rank = taxonomic_data.get('outliers', {}).get(tax_type, {})
                    for rank in ['superkingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species']:
                        top10 = top10_by_rank.get(rank, [])
                        outliers = outliers_by_rank.get(rank, [])
                        if top10 or outliers:
                            taxonomic_section.append(f"\n{tax_type.title()} - {rank.title()}:")
                            if top10:
                                taxonomic_section.append("Most abundant taxa in this study:")
                                for item in top10[:5]:
                                    name = item.get('id', item.get('name', 'Unknown'))
                                    abundance = item.get('mean_abundance', 0)
                                    taxonomic_section.append(f"- {name}: {abundance}")
                            if outliers:
                                taxonomic_section.append("\nNotable outliers:")
                                for item in outliers[:3]:
                                    name = item.get('id', item.get('name', 'Unknown'))
                                    abundance = item.get('mean_abundance', 0)
                                    taxonomic_section.append(f"- {name}: {abundance}")

            # --- Prompt Construction ---
            prompt = f"""You are an expert in environmental biology and ecology with deep knowledge of microbial ecology, biogeochemistry, and systems biology. Please analyze this study in the context of the broader compendium and provide a structured summary focusing on what makes this study unique and significant.\n\nStudy: {study_name}\nDescription: {study_desc}\nEcosystem: {ecosystem}\nSample Count: {study_sample_count}\n\nPlease provide a comprehensive analysis in the following sections:\n\nA. Purpose and Geography\n- Analyze the study's purpose and geographic context\n- Compare its location to other studies in the compendium\n- Highlight any unique geographic features\n- Consider the ecosystem type and its significance\n\nB. Physical Features and Environmental Context\n- Describe the characteristic physical variables of this study\n- Compare these to the compendium averages\n- Explain the significance of any notable differences\n- Discuss how these physical conditions might influence biological processes\n- Consider the implications of the sample count and measurement precision\n- Analyze potential environmental stressors or unique conditions\n\nC. Omics Data Analysis\n- For each omics type (metabolomics, lipidomics, proteomics):\n  * Analyze the most abundant features and their potential biological roles\n  * Explain the metabolic pathways and processes these features might be involved in\n  * Discuss how these features might interact with the physical environment\n  * Interpret the significance of outliers in terms of biological function\n  * Consider the implications for ecosystem function and microbial community dynamics\n\nD. Taxonomic Analysis and Ecological Implications\n- For each taxonomic rank (from superkingdom to species):\n  * Analyze the most abundant taxa and their ecological roles\n  * Explain their potential metabolic capabilities and functional traits\n  * Discuss their relationships with the physical environment\n  * Interpret the significance of outliers in terms of ecological function\n  * Consider how these taxa might interact with each other and their environment\n\nE. Integrated Analysis\n- Synthesize the relationships between physical variables, omics data, and taxonomic composition\n- Explain how the observed patterns might reflect ecosystem function\n- Discuss potential biogeochemical cycles and microbial processes\n- Analyze how the study's findings compare to similar ecosystems\n- Identify unique or unexpected patterns that might indicate novel processes\n\nPlease be specific about the data and their implications for biological processes or environmental conditions. Where data is limited or unavailable, note this limitation. Focus on what makes this study unique or significant compared to the broader compendium. Use your expertise in environmental biology and ecology to provide insights beyond the raw data.\n\nFor each significant feature (physical, omics, or taxonomic), please:\n1. Explain its potential biological or ecological role\n2. Describe how it might interact with other features\n3. Consider its implications for ecosystem function\n4. Discuss any known or potential adaptations to the observed conditions\n5. Analyze how it might respond to environmental changes\n\nData for analysis:\n\n{chr(10).join(physical_section)}\n{chr(10).join(omics_section)}\n{chr(10).join(taxonomic_section)}\n"""
            
            # Count tokens
            token_count = self._count_tokens(prompt)

            # Call LLM
            response = self._client.chat.completions.create(
                model=self.config.model_name,
                messages=[
                    {"role": "system", "content": "You are an expert in environmental biology and ecology."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens
            )

            # Process response
            summary = response.choices[0].message.content

            # Structure the response
            result = {
                "summary": summary,
                "last_updated": datetime.now().isoformat(),
                "study_id": study_id,
                "token_count": token_count
            }

            return result

        except Exception as e:
            logger.error(f"Error generating study summary: {str(e)}")
            raise

# Initialize the service
llm_service = LLMService() 