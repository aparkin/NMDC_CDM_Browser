"""
LLM summarizer service for NMDC CDM Browser.
"""
from pathlib import Path
import os
from typing import Dict, List, Optional, Tuple
import json
import logging
from datetime import datetime
import openai
from dotenv import load_dotenv
from dataclasses import dataclass
from abc import ABC
import tiktoken
from ..data_processing import StatisticsProcessor

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables
project_root = Path(__file__).parent.parent.parent
dotenv_path = project_root / '.env'
load_dotenv(dotenv_path=dotenv_path)

# OpenAI Settings
CBORG = os.getenv('USE_CBORG', 'false').lower() == 'true'
OPENAI_BASE_URL = os.getenv('CBORG_BASE_URL' if CBORG else 'OPENAI_BASE_URL', 
                           "https://api.cborg.lbl.gov" if CBORG else "https://api.openai.com/v1")
OPENAI_API_KEY = os.getenv('CBORG_API_KEY' if CBORG else 'OPENAI_API_KEY', '')

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable must be set")

@dataclass
class LLMConfig:
    """Configuration for LLM service."""
    model_name: str = "gpt-4-turbo-preview"  # Default to GPT-4
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
            for analysis_type in ['gottcha', 'metaphlan']:
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
        prompt = """You are an expert in environmental biology and ecology with specific interests in how environmental parameters impact the abundance and activities of organisms within their environments. Please analyze the following data and provide a comprehensive summary in the following sections:

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
            cache_path = project_root / "processed_data" / "ai_summary.json"
            with open(cache_path, "w") as f:
                json.dump(result, f, indent=2)
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            raise

# Initialize the service
llm_service = LLMService() 