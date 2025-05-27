"""
Study-specific AI summarizer that generates detailed summaries for individual studies.
"""
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
import tiktoken
from dataclasses import dataclass
import os
import json
from dotenv import load_dotenv
from pathlib import Path
import openai
from ..data_processing.study_analysis_processor import StudyAnalysisProcessor
import pandas as pd

logger = logging.getLogger(__name__)

# Load environment variables
try:
    # First try the current working directory
    project_root = Path.cwd()
    dotenv_path = project_root / '.env'
    
    # If not found, try going up to 3 levels from the current file
    if not dotenv_path.exists():
        project_root = Path(__file__).parent.parent.parent
        dotenv_path = project_root / '.env'
    
    # If still not found, try the environment variable
    if not dotenv_path.exists():
        project_root_env = os.getenv('PROJECT_ROOT')
        if project_root_env:
            project_root = Path(project_root_env)
            dotenv_path = project_root / '.env'
    
    logger.info(f"Attempting to load environment from: {dotenv_path}")
    logger.info(f"Path exists: {dotenv_path.exists()}")
    logger.info(f"Path is absolute: {dotenv_path.is_absolute()}")
    logger.info(f"Path is file: {dotenv_path.is_file()}")
    
    if dotenv_path.exists():
        load_dotenv(dotenv_path=dotenv_path)
        logger.info("Successfully loaded .env file")
        
        # Log environment file contents (masking sensitive values)
        with open(dotenv_path, 'r') as f:
            env_contents = f.read()
            logger.info("Environment file contents (masking sensitive values):")
            for line in env_contents.splitlines():
                if '=' in line:
                    key, value = line.split('=', 1)
                    if 'KEY' in key:
                        logger.info(f"  {key}=[MASKED]")
                    else:
                        logger.info(f"  {key}={value}")
    else:
        logger.warning(f"No .env file found at {dotenv_path}")
        logger.info("Falling back to system environment variables")
        
except Exception as e:
    logger.error(f"Error loading environment: {str(e)}")
    logger.info("Falling back to system environment variables")

# OpenAI Settings
CBORG = os.getenv('USE_CBORG', 'false').lower() == 'true'
OPENAI_BASE_URL = os.getenv('CBORG_BASE_URL' if CBORG else 'OPENAI_BASE_URL', 
                           "https://api.cborg.lbl.gov" if CBORG else "https://api.openai.com/v1")
OPENAI_API_KEY = os.getenv('CBORG_API_KEY' if CBORG else 'OPENAI_API_KEY', '')
GENERATION_MODEL = os.getenv('CBORG_GENERATION_MODEL' if CBORG else 'OPENAI_GENERATION_MODEL',
                           "gpt-4" if CBORG else "gpt-4-turbo-preview")

if not OPENAI_API_KEY:
    raise ValueError("API key environment variable must be set")

def _log_openai_config():
    """Log OpenAI configuration once during initialization."""
    logger.info("OpenAI Configuration:")
    logger.info(f"  Using CBORG: {CBORG}")
    logger.info(f"  Base URL: {OPENAI_BASE_URL}")
    logger.info(f"  Model: {GENERATION_MODEL}")
    logger.info(f"  API Key: {'Set' if OPENAI_API_KEY else 'Not set'}")

@dataclass
class LLMConfig:
    """Configuration for LLM service."""
    model_name: str = GENERATION_MODEL  # Use environment-specific model
    temperature: float = 0.4
    max_tokens: int = 4000
    context_window: int = 128000  # GPT-4 Turbo context window

class StudyDetailSummarizer:
    """Generates detailed AI summaries for individual studies."""
    
    def __init__(self):
        """Initialize the summarizer with the study analysis processor."""
        self.processor = StudyAnalysisProcessor()
        self.config = LLMConfig()
        
        # Log LLM configuration once
        _log_openai_config()
        
        self._client = openai.OpenAI(
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL
        )
        # Use cl100k_base encoding for Claude models
        if "claude" in self.config.model_name.lower():
            self._encoding = tiktoken.get_encoding("cl100k_base")
        else:
            self._encoding = tiktoken.encoding_for_model(self.config.model_name)
        print(OPENAI_BASE_URL,'********')
        
    def _count_tokens(self, text: str) -> int:
        """Count the number of tokens in a text string."""
        return len(self._encoding.encode(text))
        
    def _load_study_data(self, study_id: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Load study-specific data and compendium data."""
        try:
            # Get study-specific analysis from cache
            study_data = self.processor.get_study_analysis(study_id)
            if not study_data:
                raise ValueError(f"No study data found for {study_id}")
            
            logger.info(f"Loaded study data for {study_id}:")
            logger.info(f"  Name: {study_data.get('name')}")
            logger.info(f"  Description: {study_data.get('description')}")
            logger.info(f"  Sample count: {study_data.get('sample_count')}")
            
            # Load compendium data
            compendium_path = project_root / "processed_data" / "study_summary.json"
            if not compendium_path.exists():
                raise FileNotFoundError(f"Compendium data not found at {compendium_path}")
            
            with open(compendium_path, "r") as f:
                compendium_data = json.load(f)
            logger.info("Loaded compendium data")
            
            return study_data, compendium_data
            
        except Exception as e:
            logger.error(f"Error loading study data: {str(e)}")
            raise
            
    def _prepare_study_prompt(self, study_data: Dict, compendium_data: Dict) -> Tuple[str, int]:
        # This is adapted from LLMService._prepare_study_prompt
        study_id = study_data.get('id')
        analysis = study_data.get('analysis', study_data)  # fallback if not nested
        
        # Get study metadata from compendium first
        study_cards = compendium_data.get('study_cards', [])
        study_info = next((card for card in study_cards if card.get('id') == study_id), None)
        
        # Set defaults from compendium
        study_name = study_info.get('name', 'Unnamed Study') if study_info else 'Unnamed Study'
        study_desc = study_info.get('description', 'No description available') if study_info else 'No description available'
        ecosystem = study_info.get('ecosystem', 'Unknown') if study_info else 'Unknown'
        study_sample_count = study_info.get('sample_count', 0) if study_info else 0
        
        # Get compendium statistics for comparison
        compendium_stats = compendium_data.get('summary_stats', {})
        total_studies = compendium_stats.get('total_studies', 0)
        total_samples = compendium_stats.get('total_samples', 0)
        avg_samples_per_study = total_samples / total_studies if total_studies > 0 else 0
        
        # Override with study-specific data if available
        if 'name' in analysis:
            study_name = analysis['name']
        if 'description' in analysis:
            study_desc = analysis['description']
        if 'ecosystem' in analysis:
            ecosystem = analysis['ecosystem']
        if 'sample_count' in analysis:
            study_sample_count = analysis['sample_count']
            
        # Get analysis components
        physical_vars = analysis.get('physical', {})
        omics_data = analysis.get('omics', {})
        taxonomic_data = analysis.get('taxonomic', {})
        
        logger.info(f"Processing study: {study_name} ({study_id})")
        logger.info(f"Study metadata: name='{study_name}', desc='{study_desc[:100]}...'")
        logger.info(f"Sample count: {study_sample_count}")
        logger.info(f"Physical vars: {list(physical_vars.keys())}")
        logger.info(f"Omics data: {list(omics_data.keys())}")
        logger.info(f"Taxonomic data: {list(taxonomic_data.keys())}")
        
        # Physical section
        physical_section = []
        if physical_vars:
            physical_section.append("\nPhysical Variables:")
            for var, stats in physical_vars.items():
                comp_stats = compendium_data.get('summary_stats', {}).get('physical_variable_stats', {}).get(var, {})
                physical_section.append(f"\n{var.replace('_', ' ').title()}:")
                physical_section.append(f"- Study mean: {stats.get('mean', 0)}")
                if comp_stats:
                    physical_section.append(f"- Compendium mean: {comp_stats.get('mean', 0)}")
                    if abs(stats.get('mean', 0) - comp_stats.get('mean', 0)) > comp_stats.get('std', 0):
                        physical_section.append("- Note: This value differs significantly from the compendium average")
                physical_section.append(f"- Study range: {stats.get('min', 0)} to {stats.get('max', 0)}")
                physical_section.append(f"- Sample count: {stats.get('count', 0)}")
        
        # Omics section
        omics_section = []
        if omics_data:
            omics_section.append("\nOmics Data:")
            # Log the overall omics structure
            logger.info(f"Omics data structure: {list(omics_data.keys())}")
            
            # Get top10 data for each omics type
            top10_data = omics_data.get('top10', {})
            for omics_type in ['metabolomics', 'lipidomics', 'proteomics']:
                if omics_type in top10_data:
                    omics_section.append(f"\n{omics_type.title()}:")
                    top10 = top10_data[omics_type]
                    if top10:
                        omics_section.append("Most abundant features:")
                        for item in top10[:5]:
                            omics_section.append(f"- {item.get('id', 'Unknown')}: {item.get('mean_abundance', 0):.2f}")
            
            # Get outliers data for each omics type
            outliers_data = omics_data.get('outliers', {})
            for omics_type in ['metabolomics', 'lipidomics', 'proteomics']:
                if omics_type in outliers_data:
                    outliers = outliers_data[omics_type]
                    if outliers:
                        omics_section.append(f"\n{omics_type.title()} - Significantly different features:")
                        for item in outliers[:5]:
                            direction = item.get('direction', 'different')
                            effect_size = item.get('effect_size', 0)
                            omics_section.append(f"- {item.get('id', 'Unknown')}: {direction} (effect size: {effect_size:.2f})")
        
        # Taxonomic section
        taxonomic_section = []
        if taxonomic_data:
            taxonomic_section.append("\nTaxonomic Information:")
            for tax_type in ['gottcha', 'kraken', 'centrifuge', 'contigs']:
                if tax_type in taxonomic_data.get('top10', {}):
                    taxonomic_section.append(f"\n{tax_type.title()} Analysis:")
                    # Process each rank
                    for rank in ['superkingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species']:
                        top10 = taxonomic_data['top10'][tax_type].get(rank, [])
                        if top10:
                            taxonomic_section.append(f"\n{rank.title()}:")
                            taxonomic_section.append("Most abundant taxa:")
                            for item in top10[:5]:
                                taxonomic_section.append(f"- {item.get('id', 'Unknown')}: {item.get('mean_abundance', 0):.2f}")
                    
                    # Add outliers if present
                    outliers = taxonomic_data.get('outliers', {}).get(tax_type, {})
                    if outliers:
                        taxonomic_section.append("\nSignificantly different taxa:")
                        for rank in ['superkingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species']:
                            rank_outliers = outliers.get(rank, [])
                            if rank_outliers:
                                taxonomic_section.append(f"\n{rank.title()}:")
                                for item in rank_outliers[:3]:
                                    direction = item.get('direction', 'different')
                                    effect_size = item.get('effect_size', 0)
                                    taxonomic_section.append(f"- {item.get('id', 'Unknown')}: {direction} (effect size: {effect_size:.2f})")
        
        # Get similar studies from compendium for comparison
        similar_studies = []
        if study_cards:
            # Find studies in the same ecosystem
            ecosystem_studies = [card for card in study_cards if card.get('ecosystem') == ecosystem and card.get('id') != study_id]
            if ecosystem_studies:
                similar_studies = ecosystem_studies[:3]  # Get up to 3 similar studies
        
        similar_studies_section = []
        if similar_studies:
            similar_studies_section.append("\nSimilar Studies in Compendium:")
            for study in similar_studies:
                similar_studies_section.append(f"\nStudy: {study.get('name', 'Unnamed')}")
                similar_studies_section.append(f"Description: {study.get('description', 'No description')}")
                similar_studies_section.append(f"Sample Count: {study.get('sample_count', 0)}")
        
        prompt = f"""You are an expert in environmental biology and ecology with deep knowledge of microbial ecology, biogeochemistry, and systems biology. Please analyze this study in the context of the broader compendium and provide a structured summary focusing on what makes this study unique and significant.

Study Context:
- Study: {study_name}
- Description: {study_desc}
- Ecosystem: {ecosystem}
- Sample Count: {study_sample_count}
- Compendium Context: {total_studies} total studies, {total_samples} total samples, {avg_samples_per_study:.1f} average samples per study

Please provide a comprehensive analysis in the following sections:

A. Purpose and Geography
- Analyze the study's purpose and geographic context
- Compare its location to other studies in the compendium
- Highlight any unique geographic features
- Consider the ecosystem type and its significance
- Compare sample count to compendium average and discuss implications

B. Physical Features and Environmental Context
- Describe the characteristic physical variables of this study
- Compare these to the compendium averages
- Explain the significance of any notable differences
- Discuss how these physical conditions might influence biological processes
- Consider the implications of the sample count and measurement precision
- Analyze potential environmental stressors or unique conditions

C. Omics Data Analysis
- For each omics type (metabolomics, lipidomics, proteomics):
  * Analyze the most abundant features and their potential biological roles
  * Explain the metabolic pathways and processes these features might be involved in
  * Discuss how these features might interact with the physical environment
  * Interpret the significance of outliers in terms of biological function
  * Consider the implications for ecosystem function and microbial community dynamics
  * Focus on prokaryotic (bacterial and archaeal) metabolism first, then microbial eukaryotes

D. Taxonomic Analysis and Ecological Implications
- For each taxonomic rank (from superkingdom to species):
  * Analyze the most abundant taxa and their ecological roles
  * Explain their potential metabolic capabilities and functional traits
  * Discuss their relationships with the physical environment
  * Interpret the significance of outliers in terms of ecological function
  * Consider how these taxa might interact with each other and their environment
  * Prioritize analysis in this order:
    1. Prokaryotes (Bacteria and Archaea)
    2. Microbial Eukaryotes
    3. Plants
    4. Other Eukaryotes

E. Integrated Analysis
- Synthesize the relationships between physical variables, omics data, and taxonomic composition
- Explain how the observed patterns might reflect ecosystem function
- Discuss potential biogeochemical cycles and microbial processes
- Analyze how the study's findings compare to similar ecosystems
- Identify unique or unexpected patterns that might indicate novel processes
- Compare findings with similar studies in the compendium

Please be specific about the data and their implications for biological processes or environmental conditions. Where data is limited or unavailable, note this limitation. Focus on what makes this study unique or significant compared to the broader compendium. Use your expertise in environmental biology and ecology to provide insights beyond the raw data.

For each significant feature (physical, omics, or taxonomic), please:
1. Explain its potential biological or ecological role
2. Describe how it might interact with other features
3. Consider its implications for ecosystem function
4. Discuss any known or potential adaptations to the observed conditions
5. Analyze how it might respond to environmental changes

Data for analysis:

{chr(10).join(physical_section)}
{chr(10).join(omics_section)}
{chr(10).join(taxonomic_section)}
{chr(10).join(similar_studies_section)}
"""
        token_count = self._count_tokens(prompt)
        logger.info(f"Generated prompt with {token_count} tokens")
        return prompt, token_count

    def generate_summary(self, study_id: str, force: bool = False) -> Dict[str, Any]:
        try:
            # Check cache first if not forcing regeneration
            if not force:
                cache_path = project_root / "processed_data" / "study_analysis_cache" / f"{study_id}_ai_summary.json"
                summary_path = project_root / "processed_data" / "study_summary.json"
                
                if cache_path.exists() and summary_path.exists():
                    try:
                        # Check if source data has been modified
                        cache_mtime = cache_path.stat().st_mtime
                        summary_mtime = summary_path.stat().st_mtime
                        
                        if cache_mtime > summary_mtime:
                            with open(cache_path, "r") as f:
                                cached_data = json.load(f)
                                logger.info(f"Using cached AI summary for study {study_id}")
                                return cached_data
                    except Exception as e:
                        logger.warning(f"Error checking cache for study {study_id}: {str(e)}")
            
            # Generate new summary
            study_data, compendium_data = self._load_study_data(study_id)
            prompt, token_count = self._prepare_study_prompt(study_data, compendium_data)
            
            # Log the study data we're using
            logger.info(f"Study data being used:")
            logger.info(f"  ID: {study_data.get('id')}")
            logger.info(f"  Name: {study_data.get('name')}")
            logger.info(f"  Description: {study_data.get('description')}")
            logger.info(f"  Sample count: {study_data.get('sample_count')}")
            
            response = self._client.chat.completions.create(
                model=self.config.model_name,
                messages=[
                    {"role": "system", "content": "You are an expert in environmental biology and ecology."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens
            )
            summary = response.choices[0].message.content
            result = {
                "summary": summary,
                "last_updated": datetime.now().isoformat(),
                "study_id": study_id,
                "token_count": token_count
            }
            
            # Cache the result
            try:
                cache_path = project_root / "processed_data" / "study_analysis_cache" / f"{study_id}_ai_summary.json"
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                with open(cache_path, "w") as f:
                    json.dump(result, f, indent=2)
                logger.info(f"Cached AI summary for study {study_id}")
            except Exception as e:
                logger.error(f"Error caching AI summary for study {study_id}: {str(e)}")
            
            return result
        except Exception as e:
            logger.error(f"Error generating study summary: {str(e)}")
            raise 

    def _generate_section_summary(self, section: str, data: Dict[str, Any]) -> str:
        """Generate a summary for a specific section using the LLM."""
        try:
            # Construct a detailed prompt for the LLM
            prompt = f"""
            Analyze the following {section} data for the study:
            {json.dumps(data, indent=2)}

            Focus on the following aspects:
            - For omics data: Identify key metabolic pathways, stress responses, and functional proteins.
            - For taxonomy data: Analyze the diversity and abundance of microbial taxa, their ecological roles, and interactions.
            - For physical variables: Consider how depth, geographic location, and other physical factors influence microbial processes.
            - For ecosystem data: Evaluate the impact of environmental and engineered systems on microbial communities.

            Provide a detailed and insightful summary that integrates these aspects.
            """

            # Call the LLM to generate the summary
            response = self._client.chat.completions.create(
                model=self.config.model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that provides detailed analysis of scientific data."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens
            )

            # Ensure the response is not None
            if response.choices[0].message.content is None:
                return f"No summary generated for {section}."

            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error generating {section} summary: {str(e)}")
            return f"Error generating {section} summary: {str(e)}" 