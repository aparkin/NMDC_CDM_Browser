"""
Sample-specific AI summarizer that generates detailed summaries for individual samples.
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
from ..data_processing.sample_analysis_processor import SampleAnalysisProcessor
from ..data_processing.study_analysis_processor import StudyAnalysisProcessor

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
GENERATION_MODEL = os.getenv("GENERATION_MODEL", "gpt-4-turbo-preview")

@dataclass
class LLMConfig:
    """Configuration for LLM service."""
    model_name: str = GENERATION_MODEL
    temperature: float = 0.4
    max_tokens: int = 4000
    context_window: int = 128000  # GPT-4 Turbo context window

class SampleDetailSummarizer:
    """Generates detailed AI summaries for individual samples."""
    
    def __init__(self):
        """Initialize the summarizer with the sample analysis processor."""
        self.sample_processor = SampleAnalysisProcessor()
        self.study_processor = StudyAnalysisProcessor()
        self.config = LLMConfig()
        
        self._client = openai.OpenAI(
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL
        )
        self._encoding = tiktoken.encoding_for_model(self.config.model_name)
        
    def _count_tokens(self, text: str) -> int:
        """Count the number of tokens in a text string."""
        return len(self._encoding.encode(text))
        
    def _load_sample_data(self, sample_id: str) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
        """Load sample-specific data, study data, and study summary."""
        try:
            # Get sample-specific analysis
            sample_data = self.sample_processor.get_sample_analysis(sample_id)
            if not sample_data:
                raise ValueError(f"No sample data found for {sample_id}")
            
            # Get study data
            study_id = sample_data.get('study_id')
            if not study_id:
                raise ValueError(f"No study ID found for sample {sample_id}")
            study_data = self.study_processor.get_study_analysis(study_id)
            if not study_data:
                raise ValueError(f"No study data found for {study_id}")
            
            # Load study summary
            study_summary_path = Path(__file__).parent.parent.parent / "processed_data" / "study_analysis_cache" / f"{study_id}_ai_summary.json"
            if not study_summary_path.exists():
                raise FileNotFoundError(f"Study summary not found at {study_summary_path}")
            
            with open(study_summary_path, "r") as f:
                study_summary = json.load(f)
            
            return sample_data, study_data, study_summary
            
        except Exception as e:
            logger.error(f"Error loading sample data: {str(e)}")
            raise
            
    def _prepare_sample_prompt(self, sample_data: Dict, study_data: Dict, study_summary: Dict) -> Tuple[str, int]:
        """Prepare the prompt for sample-specific summary generation."""
        # Extract sample information
        sample_id = sample_data.get('id')
        sample_name = sample_data.get('name', 'Unnamed Sample')
        collection_date = sample_data.get('collection_date')
        ecosystem = sample_data.get('ecosystem', 'Unknown')
        
        # Extract physical variables
        physical_vars = sample_data.get('physical', {})
        
        # Extract omics data
        omics_data = sample_data.get('omics', {}).get('top10', {})
        
        # Extract taxonomic data
        taxonomic_data = sample_data.get('taxonomic', {}).get('top10', {})
        
        # Extract functional analysis data
        functional_data = sample_data.get('functional_analysis', {})
        
        # Get study context from summary
        study_context = study_summary.get('summary', '')
        
        # Format physical variables section
        physical_section = []
        if physical_vars:
            physical_section.append("\nPhysical Variables:")
            # Group variables by type
            numeric_vars = {}
            ecosystem_vars = {}
            for var, data in physical_vars.items():
                if var.endswith('_numeric') or var in ['depth', 'latitude', 'longitude', 'ph']:
                    if data.get('status') == 'ok':
                        numeric_vars[var] = data
                elif var in ['ecosystem', 'ecosystem_category', 'ecosystem_subtype', 'ecosystem_type', 
                           'env_broad_scale_label', 'env_local_scale_label', 'specific_ecosystem', 
                           'env_medium_label', 'soil_horizon', 'soil_type']:
                    ecosystem_vars[var] = data
            
            # Add numeric variables
            if numeric_vars:
                physical_section.append("\nNumeric Measurements:")
                for var, data in numeric_vars.items():
                    physical_section.append(f"\n{var.replace('_', ' ').title()}:")
                    value = data.get('value')
                    if value is not None:
                        physical_section.append(f"- Value: {value}")
                    if 'compendium' in data:
                        comp_mean = data['compendium'].get('mean')
                        comp_std = data['compendium'].get('std')
                        if comp_mean is not None:
                            physical_section.append(f"- Compendium mean: {comp_mean}")
                        if comp_std is not None:
                            physical_section.append(f"- Compendium std: {comp_std}")
                    if 'z_score' in data:
                        z_score = data.get('z_score')
                        if z_score is not None:
                            physical_section.append(f"- Z-score: {z_score}")
            
            # Add ecosystem variables
            if ecosystem_vars:
                physical_section.append("\nEcosystem Classification:")
                for var, data in ecosystem_vars.items():
                    physical_section.append(f"\n{var.replace('_', ' ').title()}:")
                    value = data.get('value')
                    if value is not None:
                        physical_section.append(f"- Value: {value}")
                    if 'study_frequency' in data:
                        study_freq = data.get('study_frequency')
                        if study_freq is not None:
                            physical_section.append(f"- Study frequency: {study_freq}%")
        
        # Format omics section
        omics_section = []
        if omics_data:
            omics_section.append("\nChemical Composition:")
            for omics_type, compounds in omics_data.items():
                if compounds:
                    omics_section.append(f"\n{omics_type.title()}:")
                    for compound in compounds:
                        name = compound.get('id') or compound.get('name', 'Unknown')
                        abundance = compound.get('abundance')
                        if abundance is not None:
                            omics_section.append(f"\n{name}:")
                            omics_section.append(f"- Sample abundance: {abundance:.4f}")
                            mean_abundance = compound.get('mean_abundance')
                            if mean_abundance is not None:
                                omics_section.append(f"- Study mean: {mean_abundance:.4f}")
                            std_abundance = compound.get('std_abundance')
                            if std_abundance is not None:
                                omics_section.append(f"- Study std: {std_abundance:.4f}")
                            z_score = compound.get('z_score')
                            if z_score is not None:
                                omics_section.append(f"- Z-score: {z_score:.2f}")
                            metadata = compound.get('metadata', {})
                            if metadata:
                                for key, value in metadata.items():
                                    if value is not None:
                                        omics_section.append(f"- {key}: {value}")
        
        # Format taxonomic section
        taxonomic_section = []
        if taxonomic_data:
            taxonomic_section.append("\nTaxonomic Profile:")
            for tool in ['contigs', 'centrifuge', 'kraken', 'gottcha']:
                if tool in taxonomic_data:
                    taxonomic_section.append(f"\n{tool.title()} Analysis:")
                    for rank in ['superkingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species']:
                        if rank in taxonomic_data[tool]:
                            taxonomic_section.append(f"\n{rank.title()}:")
                            for item in taxonomic_data[tool][rank]:
                                name = item.get('name', 'Unknown')
                                abundance = item.get('abundance')
                                if abundance is not None:
                                    taxonomic_section.append(f"\n{name}:")
                                    taxonomic_section.append(f"- Sample abundance: {abundance:.4f}")
                                    mean_abundance = item.get('mean_abundance')
                                    if mean_abundance is not None:
                                        taxonomic_section.append(f"- Study mean: {mean_abundance:.4f}")
                                    std_abundance = item.get('std_abundance')
                                    if std_abundance is not None:
                                        taxonomic_section.append(f"- Study std: {std_abundance:.4f}")
                                    z_score = item.get('z_score')
                                    if z_score is not None:
                                        taxonomic_section.append(f"- Z-score: {z_score:.2f}")
                                    metadata = item.get('metadata', {})
                                    if metadata:
                                        for key, value in metadata.items():
                                            if value is not None:
                                                taxonomic_section.append(f"- {key}: {value}")
        
        # Format functional analysis section
        functional_section = []
        if functional_data:
            functional_section.append("\nFunctional Analysis:")
            for class_name, annotations in functional_data.items():
                if annotations:
                    functional_section.append(f"\n{class_name.replace('_', ' ').title()}:")
                    for label, abundance in annotations.items():
                        if abundance is not None:
                            functional_section.append(f"- {label}: {abundance:.4f}")
        
        # Construct the prompt
        prompt = f"""Analyze the following sample data and provide a comprehensive summary. Focus on:

1. Environmental Context
- Physical variables and their significance
- Ecosystem classification and characteristics
- Compare values to study and compendium averages
- Highlight any extreme values (z-scores > 2 or < -2)

2. Chemical Composition
- For each compound:
  * Name the specific compound and its abundance
  * Compare to study and compendium averages
  * Explain biological significance
  * Include any available metadata (formula, mass, etc.)

3. Taxonomic Profile
- For each taxon:
  * Name the specific taxon and its abundance
  * Compare to study and compendium averages
  * Describe potential interactions between specific taxa
  * Include any available metadata (GC content, coverage, etc.)
  * Compare results from different analysis tools (contigs, centrifuge, kraken, gottcha)

4. Functional Analysis
- For each functional annotation:
  * Name the specific function and its abundance
  * Explain the biological significance of each function
  * Link specific functions to observed taxa and compounds
  * Discuss the implications of highly abundant functions

5. Integrated Analysis
- Synthesize the relationships between:
  * Specific physical variables and their effects on biological processes
  * Specific compounds and their roles in metabolic pathways
  * Specific taxa and their functional capabilities
  * Specific functions and their ecological significance

Data for analysis:

{chr(10).join(physical_section)}
{chr(10).join(omics_section)}
{chr(10).join(taxonomic_section)}
{chr(10).join(functional_section)}

Remember: Every statement must be supported by specific data points from the provided information. Use exact names, values, and measurements in your analysis."""
        
        token_count = self._count_tokens(prompt)
        logger.info(f"Generated prompt with {token_count} tokens")
        return prompt, token_count

    def generate_summary(self, sample_id: str, force: bool = False) -> Dict[str, Any]:
        """Generate a comprehensive summary for a sample."""
        try:
            # Check cache first if not forcing regeneration
            if not force:
                cache_path = Path(__file__).parent.parent.parent / "processed_data" / "sample_analysis_cache" / f"{sample_id}_ai_summary.json"
                if cache_path.exists():
                    try:
                        with open(cache_path, "r") as f:
                            cached_data = json.load(f)
                            logger.info(f"Using cached AI summary for sample {sample_id}")
                            return cached_data
                    except Exception as e:
                        logger.warning(f"Error checking cache for sample {sample_id}: {str(e)}")
            
            # Generate new summary
            sample_data, study_data, study_summary = self._load_sample_data(sample_id)
            prompt, token_count = self._prepare_sample_prompt(sample_data, study_data, study_summary)
            
            response = self._client.chat.completions.create(
                model=self.config.model_name,
                messages=[
                    {"role": "system", "content": "You are an expert in microbial biology and environmental biology."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens
            )
            
            summary = response.choices[0].message.content
            result = {
                "summary": summary,
                "last_updated": datetime.now().isoformat(),
                "sample_id": sample_id,
                "token_count": token_count
            }
            
            # Cache the result
            try:
                cache_path = Path(__file__).parent.parent.parent / "processed_data" / "sample_analysis_cache" / f"{sample_id}_ai_summary.json"
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                with open(cache_path, "w") as f:
                    json.dump(result, f, indent=2)
                logger.info(f"Cached AI summary for sample {sample_id}")
            except Exception as e:
                logger.error(f"Error caching AI summary for sample {sample_id}: {str(e)}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating sample summary: {str(e)}")
            raise 