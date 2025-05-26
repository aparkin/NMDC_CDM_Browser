"""
Study-specific analysis processor for NMDC CDM Browser.
Extends the base StatisticsProcessor to provide study-specific statistics
with comparisons to the overall compendium.
"""
import logging
from typing import Dict, List, Optional, Tuple, Union, Any
import numpy as np
from scipy.stats import mannwhitneyu
import pandas as pd
import os
from pathlib import Path
from datetime import datetime
from src.data_processing.statistics_processor import StatisticsProcessor
from tqdm import tqdm
import time
import json
from .study_summary_processor import convert_numpy_types

# Configure logging
logger = logging.getLogger(__name__)

class StudyAnalysisProcessor(StatisticsProcessor):
    """Processor for study-specific statistics with compendium comparisons."""
    
    def __init__(self, data_dir: Optional[str] = None):
        """Initialize the processor with optional data directory."""
        # Get the project root directory (2 levels up from this file)
        project_root = Path(__file__).parent.parent.parent
        self.data_dir = Path(data_dir) if data_dir else project_root / "data"
        self.cache_dir = project_root / "processed_data" / "study_analysis_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Using data directory: {self.data_dir.absolute()}")
        logger.info(f"Using cache directory: {self.cache_dir.absolute()}")
        self._study_df = None
        self._sample_df = None
        self.cache = {}
        self.last_file_modification = self._get_latest_file_modification()
        self.show_progress = True  # Flag to control progress bar display
        
    def _get_cache_path(self, study_id: str) -> Path:
        """Get the cache file path for a study."""
        return self.cache_dir / f"{study_id}.json"
        
    def _load_from_cache(self, study_id: str) -> Optional[Dict]:
        """Load analysis results from cache file."""
        cache_path = self._get_cache_path(study_id)
        if cache_path.exists():
            try:
                with open(cache_path, 'r') as f:
                    cached_data = json.load(f)
                # Check if cache is still valid
                if cached_data.get('last_file_modification', 0) >= self.last_file_modification:
                    logger.info(f"Using cached analysis for study {study_id}")
                    return cached_data.get('analysis')
            except Exception as e:
                logger.warning(f"Error loading cache for study {study_id}: {str(e)}")
        return None
        
    def _save_to_cache(self, study_id: str, analysis: Dict) -> None:
        """Save analysis results to cache file."""
        cache_path = self._get_cache_path(study_id)
        try:
            with open(cache_path, 'w') as f:
                json.dump({
                    'analysis': analysis,
                    'last_file_modification': self.last_file_modification,
                    'cached_at': datetime.now().isoformat()
                }, f)
            logger.info(f"Saved analysis to cache for study {study_id}")
        except Exception as e:
            logger.warning(f"Error saving cache for study {study_id}: {str(e)}")
        
    def _get_latest_file_modification(self) -> float:
        """Get the latest modification time of any source data file."""
        data_files = [
            'sample_table_snappy.parquet',
            'study_table_snappy.parquet',
            'metabolite_table_snappy.parquet',
            'lipidomics_table_snappy.parquet',
            'proteomics_table_snappy.parquet',
            'gottcha_table_snappy.parquet',
            'kraken_table_snappy.parquet',
            'centrifuge_rollup_table_snappy.parquet',
            'contigs_rollup_table_snappy.parquet'
        ]
        
        try:
            return max(os.path.getmtime(self.data_dir / f) for f in data_files)
        except Exception as e:
            logger.error(f"Error getting file modification times: {str(e)}")
            return 0.0
            
    def _check_data_changes(self) -> None:
        """Check if any source data files have changed since last analysis."""
        current_modification = self._get_latest_file_modification()
        if current_modification > self.last_file_modification:
            logger.info("Source data files have changed, clearing cache")
            self.cache = {}
            # Add a small delay to ensure timestamp difference
            time.sleep(0.1)
            self.last_file_modification = self._get_latest_file_modification()
            # Force reload of data by setting to None
            self._study_df = None
            self._sample_df = None
            
    def _get_study_samples(self, study_id: str) -> pd.DataFrame:
        """Get all samples for a specific study."""
        sample_df = pd.read_parquet(self.data_dir / "sample_table_snappy.parquet")
        return sample_df[sample_df['study_id'] == study_id]
        
    def get_study_samples(self, study_id: str) -> List[Dict]:
        """Get all samples for a specific study."""
        try:
            logger.info(f"Loading sample data for study {study_id}")
            # Load sample data if not already loaded
            if self._sample_df is None:
                sample_file = self.data_dir / "sample_table_snappy.parquet"
                logger.info(f"Reading sample data from {sample_file}")
                if not sample_file.exists():
                    raise FileNotFoundError(f"Sample data file not found: {sample_file}")
                self._sample_df = pd.read_parquet(sample_file)
                logger.info(f"Loaded sample data with {len(self._sample_df)} samples")
            
            # Filter samples for the study
            study_samples = self._sample_df[self._sample_df['study_id'] == study_id]
            logger.info(f"Found {len(study_samples)} samples for study {study_id}")
            
            if len(study_samples) == 0:
                logger.warning(f"No samples found for study {study_id}")
                return []
            
            # Convert to list of dictionaries
            samples = []
            for _, sample in study_samples.iterrows():
                try:
                    sample_dict = sample.to_dict()
                    # Convert numpy types to Python native types and handle out of range values
                    for key, value in sample_dict.items():
                        if pd.isna(value):
                            sample_dict[key] = None
                        elif isinstance(value, (np.floating, float)):
                            if value in (np.inf, -np.inf, float('inf'), float('-inf')):
                                sample_dict[key] = None
                            else:
                                sample_dict[key] = float(value)
                        elif isinstance(value, (np.integer, int)):
                            sample_dict[key] = int(value)
                        elif isinstance(value, (np.bool_, bool)):
                            sample_dict[key] = bool(value)
                    
                    samples.append(sample_dict)
                except Exception as e:
                    logger.error(f"Error processing sample {sample.get('id', 'unknown')}: {str(e)}")
                    continue
            
            logger.info(f"Successfully processed {len(samples)} samples for study {study_id}")
            return samples
        except Exception as e:
            logger.error(f"Error getting samples for study {study_id}: {str(e)}")
            raise
        
    def get_study_analysis(self, study_id: str) -> Dict:
        """Get complete analysis for a specific study."""
        # Check if we need to recalculate everything
        self._check_data_changes()
        
        # Check memory cache first
        if study_id in self.cache:
            return self.cache[study_id]
            
        # Check disk cache
        cached_analysis = self._load_from_cache(study_id)
        if cached_analysis:
            self.cache[study_id] = cached_analysis
            return cached_analysis
            
        try:
            # Get study samples
            study_samples = self._get_study_samples(study_id)
            
            # Verify study exists
            if len(study_samples) == 0:
                raise ValueError(f"No samples found for study {study_id}")
            
            # Process all components
            analysis = {
                'physical': self._process_physical_variables(study_id, study_samples),
                'omics': {
                    'top10': self._process_omics_top10(study_id, study_samples),
                    'outliers': self._process_omics_outliers(study_id, study_samples)
                },
                'taxonomic': {
                    'top10': self._process_taxonomic_top10(study_id, study_samples),
                    'outliers': self._process_taxonomic_outliers(study_id, study_samples)
                },
                'timeline': self._process_timeline(study_id, study_samples),
                'ecosystem': self._process_ecosystem(study_id, study_samples),
                'map_data': self._process_map_data(study_id, study_samples)
            }
            
            # Log summary of map data
            logger.info(f"Map data for study {study_id}: {len(analysis['map_data']['locations'])} locations")
            
            # Cache the results in memory and on disk
            self.cache[study_id] = analysis
            self._save_to_cache(study_id, analysis)
            return convert_numpy_types(analysis)
            
        except Exception as e:
            logger.error(f"Error processing study {study_id}: {str(e)}")
            raise ValueError(f"Error processing study {study_id}: {str(e)}")
            
    def _process_physical_variables(self, study_id: str, study_samples: pd.DataFrame) -> Dict:
        """Process physical variables for a study."""
        logger.info(f"Processing physical variables for study {study_id}")
        
        # Get all samples for compendium comparison
        all_samples = pd.read_parquet(self.data_dir / "sample_table_snappy.parquet")
        
        # Exclude study samples from compendium and ensure we have study_id
        if 'study_id' not in all_samples.columns:
            raise ValueError("study_id column not found in sample table")
            
        compendium_samples = all_samples[all_samples['study_id'] != study_id]
        
        # Log compendium statistics for debugging
        logger.info(f"Total samples in compendium: {len(compendium_samples)}")
        logger.info(f"Number of studies in compendium: {compendium_samples['study_id'].nunique()}")
        
        # Define physical variables to check
        physical_variables = [
            # Nitrogen-related variables
            'ammonium_has_numeric_value',
            'ammonium_nitrogen_has_numeric_value',
            'ammonium_nitrogen_numeric',
            'nitrate_nitrogen_numeric',
            'nitrite_nitrogen_numeric',
            'nitro_has_numeric_value',
            'tot_nitro_content_has_numeric_value',
            'tot_nitro_numeric',
            'diss_inorg_nitro_has_numeric_value',
            
            # Carbon-related variables
            'tot_carb',
            'diss_inorg_carb_has_numeric_value',
            'diss_org_carb_has_numeric_value',
            'org_carb_has_numeric_value',
            'carb_nitro_ratio',
            'carb_nitro_ratio_has_numeric_value',
            
            # Mineral and metal variables
            'calcium_has_numeric_value',
            'calcium_numeric',
            'magnesium_has_numeric_value',
            'magnesium_numeric',
            'manganese_has_numeric_value',
            'manganese_numeric',
            'zinc_numeric',
            'diss_iron_has_numeric_value',
            'potassium_has_numeric_value',
            'potassium_numeric',
            'sodium_has_numeric_value',
            'chloride_has_numeric_value',
            'sulfate_has_numeric_value',
            
            # Phosphorus-related variables
            'tot_phosp_has_numeric_value',
            'tot_phosp_numeric',
            'soluble_react_phosp_has_numeric_value',
            
            # Physical parameters
            'ph',
            'temp_has_numeric_value',
            'conduc_has_numeric_value',
            'diss_oxygen_has_numeric_value',
            'chlorophyll_has_numeric_value',
            'water_content_numeric',
            
            # Depth and size measurements
            'depth',
            'depth_has_numeric_value',
            'depth_has_maximum_numeric_value',
            'depth_has_minimum_numeric_value',
            'samp_size_numeric',
            'samp_size_has_numeric_value',
            
            # Environmental measurements
            'abs_air_humidity',
            'avg_temp',
            'humidity',
            'latitude',
            'longitude',
            'photon_flux',
            'solar_irradiance',
            'wind_speed',
            
            # Other measurements
            'host_age_numeric',
            'lbc_thirty_numeric',
            'lbceq_numeric'
        ]
        
        results = {}
        for variable in physical_variables:
            try:
                # Skip if variable not in columns
                if variable not in study_samples.columns:
                    continue
                    
                # Convert to numeric, coercing errors to NaN
                study_values = pd.to_numeric(study_samples[variable], errors='coerce').dropna()
                if len(study_values) == 0:
                    continue
                    
                # Convert compendium values to numeric and calculate per-study means first
                compendium_values = pd.to_numeric(compendium_samples[variable], errors='coerce')
                
                # Calculate mean per study in compendium
                study_means = compendium_values.groupby(compendium_samples['study_id']).mean()
                study_means = study_means.dropna()  # Remove studies with no valid values
                
                if len(study_means) == 0:
                    logger.warning(f"No valid compendium data for {variable}")
                    continue
                
                # Calculate study statistics
                study_mean = float(study_values.mean())
                study_std = float(study_values.std())
                study_min = float(study_values.min())
                study_max = float(study_values.max())
                study_count = int(len(study_values))
                
                # Calculate compendium statistics using study means
                compendium_mean = float(study_means.mean())  # Mean of study means
                compendium_std = float(study_means.std())    # Std of study means
                
                # Log detailed statistics for debugging
                logger.info(f"\nVariable: {variable}")
                logger.info(f"Study stats: mean={study_mean:.3f}, std={study_std:.3f}, n={study_count}")
                logger.info(f"Compendium stats: mean={compendium_mean:.3f}, std={compendium_std:.3f}, n_studies={len(study_means)}")
                
                # Perform Mann-Whitney U test
                try:
                    stat, p_value = mannwhitneyu(study_values, compendium_values, alternative='two-sided')
                    significant = bool(p_value < 0.05)  # Convert numpy.bool_ to Python bool
                except Exception as e:
                    logger.warning(f"Error in Mann-Whitney U test for {variable}: {str(e)}")
                    p_value = 1.0
                    significant = False
                
                # Calculate effect size (Cliff's delta)
                effect_size = self._calculate_cliffs_delta(study_values, compendium_values)
                
                results[variable] = {
                    'status': 'ok',
                    'mean': study_mean,
                    'std': study_std,
                    'min': study_min,
                    'max': study_max,
                    'count': study_count,
                    'compendium_mean': compendium_mean,
                    'compendium_std': compendium_std,
                    'compendium_study_count': len(study_means),
                    'p_value': float(p_value),
                    'significant': significant,
                    'effect_size': effect_size
                }
                
            except Exception as e:
                logger.warning(f"Error processing {variable}: {str(e)}")
                results[variable] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        return results
    
    def _calculate_cliffs_delta(self, group1: pd.Series, group2: pd.Series) -> float:
        """Calculate Cliff's delta effect size between two groups."""
        n1, n2 = len(group1), len(group2)
        if n1 == 0 or n2 == 0:
            return 0.0
            
        # Count how many times values in group1 are greater than values in group2
        greater = 0
        for x in group1:
            greater += sum(x > y for y in group2)
            
        # Calculate delta
        delta = (2 * greater - n1 * n2) / (n1 * n2)
        return float(delta)
        
    def _process_omics_top10(self, study_id: str, study_samples: pd.DataFrame) -> Dict:
        """Process top 10 most abundant omics for a study."""
        logger.info(f"Processing top 10 omics for study {study_id}")
        results = {}
        
        # Get study sample IDs from the sample table
        study_sample_ids = study_samples['id'].tolist()
        logger.info(f"Found {len(study_sample_ids)} sample IDs for study {study_id}")
        
        # Process each omics type
        for omics_type in ['metabolomics', 'lipidomics', 'proteomics']:
            try:
                # Load omics data
                if omics_type == 'metabolomics':
                    df = pd.read_parquet(self.data_dir / "metabolite_table_snappy.parquet")
                    id_col = 'Compound Name'
                    value_col = 'Peak Area'
                    # Define additional fields for metabolomics
                    additional_fields = {
                        'Common Name': 'common_name',
                        'IUPAC Name': 'iupac_name',
                        'Traditional Name': 'traditional_name',
                        'Molecular Formula': 'molecular_formula',
                        'ChEBI ID': 'chebi_id',
                        'KEGG Compound ID': 'kegg_compound_id'
                    }
                elif omics_type == 'lipidomics':
                    df = pd.read_parquet(self.data_dir / "lipidomics_table_snappy.parquet")
                    id_col = 'Lipid Molecular Species'
                    value_col = 'Area'
                    # Define additional fields for lipidomics
                    additional_fields = {
                        'Lipid Class': 'lipid_class',
                        'Lipid Category': 'lipid_category'
                    }
                else:  # proteomics
                    df = pd.read_parquet(self.data_dir / "proteomics_table_snappy.parquet")
                    id_col = 'Product'
                    value_col = 'SummedPeptideMASICAbundances'
                    # Define additional fields for proteomics
                    additional_fields = {
                        'EC_Number': 'ec_number',
                        'pfam': 'pfam',
                        'KO': 'ko',
                        'COG': 'cog',
                        'GeneCount': 'gene_count',
                        'UniquePeptideCount': 'unique_peptide_count'
                    }
                
                # Filter for study samples using exact sample IDs
                study_df = df[df['sample_id'].isin(study_sample_ids)]
                logger.info(f"Found {len(study_df)} {omics_type} records for study {study_id}")
                if len(study_df) == 0:
                    logger.warning(f"No {omics_type} data found for study {study_id}")
                    results[omics_type] = []
                    continue
                
                # Prepare aggregation dictionary
                agg_dict = {}
                # Add value column aggregations
                agg_dict[value_col] = ['mean', 'std', 'count']
                # Add additional fields to aggregation
                for field, _ in additional_fields.items():
                    if field in study_df.columns:
                        agg_dict[field] = 'first'  # Use string directly for single aggregation
                
                # Calculate statistics per compound
                compound_stats = study_df.groupby(id_col).agg(agg_dict)
                # Flatten column names
                compound_stats.columns = [f"{col[0]}_{col[1]}" if isinstance(col, tuple) else col for col in compound_stats.columns]
                compound_stats = compound_stats.sort_values(f'{value_col}_mean', ascending=False)
                
                # Get top 10 compounds
                top10 = []
                for compound, stats in compound_stats.head(10).iterrows():
                    item = {
                        'id': str(compound),
                        'mean_abundance': float(stats[f'{value_col}_mean']),
                        'std_abundance': float(stats[f'{value_col}_std']),
                        'sample_count': int(stats[f'{value_col}_count'])
                    }
                    
                    # Add additional fields
                    for field, key in additional_fields.items():
                        if f'{field}_first' in stats:
                            value = stats[f'{field}_first']
                            if pd.isna(value):
                                item[key] = '' if isinstance(value, str) else 0
                            else:
                                item[key] = str(value) if isinstance(value, str) else int(value)
                    
                    top10.append(item)
                
                results[omics_type] = top10
                
            except Exception as e:
                logger.error(f"Error processing {omics_type} top 10: {str(e)}")
                results[omics_type] = []
        
        return results
        
    def _process_omics_outliers(self, study_id: str, study_samples: pd.DataFrame) -> Dict:
        """Process all omics that are significantly different from compendium."""
        logger.info(f"Processing omics differences for study {study_id}")
        results = {}
        
        # Get study sample IDs from the sample table
        study_sample_ids = study_samples['id'].tolist()
        
        # Process each omics type
        for omics_type in ['metabolomics', 'lipidomics', 'proteomics']:
            try:
                # Load omics data
                if omics_type == 'metabolomics':
                    df = pd.read_parquet(self.data_dir / "metabolite_table_snappy.parquet")
                    id_col = 'Compound Name'
                    value_col = 'Peak Area'
                    # Define additional fields for metabolomics
                    additional_fields = {
                        'Common Name': 'common_name',
                        'IUPAC Name': 'iupac_name',
                        'Traditional Name': 'traditional_name',
                        'Molecular Formula': 'molecular_formula',
                        'ChEBI ID': 'chebi_id',
                        'KEGG Compound ID': 'kegg_compound_id'
                    }
                elif omics_type == 'lipidomics':
                    df = pd.read_parquet(self.data_dir / "lipidomics_table_snappy.parquet")
                    id_col = 'Lipid Molecular Species'
                    value_col = 'Area'
                    # Define additional fields for lipidomics
                    additional_fields = {
                        'Lipid Class': 'lipid_class',
                        'Lipid Category': 'lipid_category'
                    }
                else:  # proteomics
                    df = pd.read_parquet(self.data_dir / "proteomics_table_snappy.parquet")
                    id_col = 'Product'
                    value_col = 'SummedPeptideMASICAbundances'
                    # Define additional fields for proteomics
                    additional_fields = {
                        'EC_Number': 'ec_number',
                        'pfam': 'pfam',
                        'KO': 'ko',
                        'COG': 'cog',
                        'GeneCount': 'gene_count',
                        'UniquePeptideCount': 'unique_peptide_count'
                    }
                
                # Filter for study samples and compendium samples
                study_df = df[df['sample_id'].isin(study_sample_ids)]
                compendium_df = df[~df['sample_id'].isin(study_sample_ids)]
                
                if len(study_df) == 0:
                    logger.warning(f"No {omics_type} data found for study {study_id}")
                    results[omics_type] = []
                    continue
                
                # Calculate statistics per compound
                significant_differences = []
                unique_compounds = study_df[id_col].unique()
                logger.info(f"Analyzing {len(unique_compounds)} {omics_type} compounds for significant differences")
                
                for compound in unique_compounds:
                    # Get study values
                    study_values = study_df[study_df[id_col] == compound][value_col]
                    if len(study_values) == 0:
                        continue
                        
                    # Get compendium values
                    compendium_values = compendium_df[compendium_df[id_col] == compound][value_col]
                    if len(compendium_values) == 0:
                        continue
                    
                    # Calculate study statistics
                    study_mean = float(study_values.mean())
                    study_std = float(study_values.std())
                    study_count = int(len(study_values))
                    
                    # Calculate compendium statistics
                    compendium_mean = float(compendium_values.mean())
                    compendium_std = float(compendium_values.std())
                    compendium_count = int(len(compendium_values))
                    
                    # Perform Mann-Whitney U test
                    try:
                        stat, p_value = mannwhitneyu(study_values, compendium_values, alternative='two-sided')
                        significant = bool(p_value < 0.05)
                    except Exception as e:
                        logger.warning(f"Error in Mann-Whitney U test for {compound}: {str(e)}")
                        p_value = 1.0
                        significant = False
                    
                    # Calculate effect size
                    effect_size = self._calculate_cliffs_delta(study_values, compendium_values)
                    
                    # Include if significant
                    if significant:
                        item = {
                            'id': str(compound),
                            'mean_abundance': study_mean,
                            'std_abundance': study_std,
                            'sample_count': study_count,
                            'compendium_mean': compendium_mean,
                            'compendium_std': compendium_std,
                            'compendium_count': compendium_count,
                            'p_value': float(p_value),
                            'effect_size': effect_size,
                            'direction': 'higher' if effect_size > 0 else 'lower'
                        }
                        
                        # Add additional fields from the first occurrence in study data
                        compound_data = study_df[study_df[id_col] == compound].iloc[0]
                        for field, key in additional_fields.items():
                            if field in compound_data:
                                value = compound_data[field]
                                if pd.isna(value):
                                    item[key] = '' if isinstance(value, str) else 0
                                else:
                                    item[key] = str(value) if isinstance(value, str) else int(value)
                        
                        significant_differences.append(item)
                
                # Sort by effect size magnitude
                significant_differences.sort(key=lambda x: abs(x['effect_size']), reverse=True)
                logger.info(f"Found {len(significant_differences)} significant differences in {omics_type}")
                if significant_differences:
                    top_effects = [f"{d['id']} ({d['effect_size']:.2f})" for d in significant_differences[:3]]
                    logger.info(f"Top effect sizes: {top_effects}")
                results[omics_type] = significant_differences
                
            except Exception as e:
                logger.error(f"Error processing {omics_type} differences: {str(e)}")
                results[omics_type] = []
        
        return results
        
    def _process_taxonomic_top10(self, study_id: str, study_samples: pd.DataFrame) -> Dict:
        """Process top 10 most abundant taxonomic data for a study."""
        logger.info(f"Processing top 10 taxonomic data for study {study_id}")
        results = {}
        
        # Get study sample IDs
        study_sample_ids = study_samples['id'].tolist()
        
        # Process each taxonomic type with progress bar
        tax_types = ['gottcha', 'kraken', 'centrifuge', 'contigs']
        for tax_type in tqdm(tax_types, desc="Processing taxonomic data", disable=not self.show_progress):
            try:
                # Load taxonomic data
                if tax_type == 'gottcha':
                    df = pd.read_parquet(self.data_dir / "gottcha_table_snappy.parquet")
                    id_col = 'label'
                    value_col = 'abundance'
                    rank_col = 'rank'
                elif tax_type == 'kraken':
                    df = pd.read_parquet(self.data_dir / "kraken_table_snappy.parquet")
                    id_col = 'name'
                    value_col = 'abundance'
                    rank_col = 'rank'
                elif tax_type == 'centrifuge':
                    df = pd.read_parquet(self.data_dir / "centrifuge_rollup_table_snappy.parquet")
                    id_col = 'lineage'
                    value_col = 'abundance'
                    rank_col = 'rank'
                else:  # contigs
                    df = pd.read_parquet(self.data_dir / "contigs_rollup_table_snappy.parquet")
                    id_col = 'lineage'
                    value_col = 'abundance'
                    rank_col = 'rank'
                
                # Filter for study samples
                study_df = df[df['sample_id'].isin(study_sample_ids)]
                if len(study_df) == 0:
                    logger.warning(f"No {tax_type} data found for study {study_id}")
                    results[tax_type] = {}
                    continue
                
                # Initialize results dictionary for this taxonomic type
                results[tax_type] = {}
                
                # Process each rank
                valid_ranks = ['superkingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species']
                for rank in valid_ranks:
                    # Filter data for this rank
                    rank_study_df = study_df[study_df[rank_col] == rank]
                    
                    if len(rank_study_df) == 0:
                        results[tax_type][rank] = []
                        continue
                    
                    # Calculate mean abundance per taxon
                    taxon_stats = rank_study_df.groupby(id_col)[value_col].agg(['mean', 'std', 'count'])
                    taxon_stats = taxon_stats.sort_values('mean', ascending=False)
                    
                    # Get top 10 taxa
                    top10 = []
                    for taxon, stats in taxon_stats.head(10).iterrows():
                        item = {
                            'id': str(taxon),
                            'mean_abundance': float(stats['mean']),
                            'std_abundance': float(stats['std']),
                            'sample_count': int(stats['count']),
                            'rank': rank  # Add rank to each item
                        }
                        
                        # Calculate species count statistics for this taxon
                        if rank != 'species' and tax_type in ['contigs', 'centrifuge']:
                            # Get all species-level lineages for this study
                            species_df = study_df[study_df[rank_col] == 'species']
                            if not species_df.empty:
                                # Count species that contain this taxon in their lineage
                                taxon_str = str(taxon)
                                species_count = species_df[species_df[id_col].str.contains(taxon_str, regex=False)].shape[0]
                                item.update({
                                    'mean_species_count': float(species_count),
                                    'std_species_count': 0.0  # Single value, so std is 0
                                })
                        
                        top10.append(item)
                    
                    results[tax_type][rank] = top10
                
            except Exception as e:
                logger.error(f"Error processing {tax_type} top 10: {str(e)}")
                results[tax_type] = {}
        
        return results
        
    def _process_taxonomic_outliers(self, study_id: str, study_samples: pd.DataFrame) -> Dict:
        """Process all taxa that are significantly different from compendium."""
        logger.info(f"Processing taxonomic differences for study {study_id}")
        results = {}
        
        # Get study sample IDs
        study_sample_ids = study_samples['id'].tolist()
        
        # Process each taxonomic type with progress bar
        tax_types = ['gottcha', 'kraken', 'centrifuge', 'contigs']
        for tax_type in tqdm(tax_types, desc="Processing taxonomic outliers", disable=not self.show_progress):
            try:
                # Load taxonomic data
                if tax_type == 'gottcha':
                    df = pd.read_parquet(self.data_dir / "gottcha_table_snappy.parquet")
                    id_col = 'label'
                    value_col = 'abundance'
                    rank_col = 'rank'
                elif tax_type == 'kraken':
                    df = pd.read_parquet(self.data_dir / "kraken_table_snappy.parquet")
                    id_col = 'name'
                    value_col = 'abundance'
                    rank_col = 'rank'
                elif tax_type == 'centrifuge':
                    df = pd.read_parquet(self.data_dir / "centrifuge_rollup_table_snappy.parquet")
                    id_col = 'lineage'
                    value_col = 'abundance'
                    rank_col = 'rank'
                else:  # contigs
                    df = pd.read_parquet(self.data_dir / "contigs_rollup_table_snappy.parquet")
                    id_col = 'lineage'
                    value_col = 'abundance'
                    rank_col = 'rank'
                
                # Filter for study samples and compendium samples
                study_df = df[df['sample_id'].isin(study_sample_ids)]
                compendium_df = df[~df['sample_id'].isin(study_sample_ids)]
                
                if len(study_df) == 0:
                    logger.warning(f"No {tax_type} data found for study {study_id}")
                    results[tax_type] = {}
                    continue
                
                # Initialize results dictionary for this taxonomic type
                results[tax_type] = {}
                
                # Process each rank
                valid_ranks = ['superkingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species']
                for rank in valid_ranks:
                    # Filter data for this rank
                    rank_study_df = study_df[study_df[rank_col] == rank]
                    rank_compendium_df = compendium_df[compendium_df[rank_col] == rank]
                    
                    if len(rank_study_df) == 0:
                        results[tax_type][rank] = []
                        continue
                    
                    # Calculate statistics per taxon with progress bar
                    significant_differences = []
                    unique_taxa = rank_study_df[id_col].unique()
                    for taxon in tqdm(unique_taxa, desc=f"Processing {tax_type} {rank} taxa", disable=not self.show_progress):
                        # Get study values
                        study_values = rank_study_df[rank_study_df[id_col] == taxon][value_col]
                        if len(study_values) == 0:
                            continue
                            
                        # Get compendium values
                        compendium_values = rank_compendium_df[rank_compendium_df[id_col] == taxon][value_col]
                        if len(compendium_values) == 0:
                            continue
                        
                        # Calculate study statistics
                        study_mean = float(study_values.mean())
                        study_std = float(study_values.std())
                        study_count = int(len(study_values))
                        
                        # Calculate compendium statistics
                        compendium_mean = float(compendium_values.mean())
                        compendium_std = float(compendium_values.std())
                        compendium_count = int(len(compendium_values))
                        
                        # Perform Mann-Whitney U test
                        try:
                            stat, p_value = mannwhitneyu(study_values, compendium_values, alternative='two-sided')
                            significant = bool(p_value < 0.05)  # Convert numpy.bool_ to Python bool
                        except Exception as e:
                            logger.warning(f"Error in Mann-Whitney U test for {taxon}: {str(e)}")
                            p_value = 1.0
                            significant = False
                        
                        # Calculate effect size
                        effect_size = self._calculate_cliffs_delta(study_values, compendium_values)
                        
                        # Include if significant
                        if significant:
                            significant_differences.append({
                                'id': str(taxon),
                                'mean_abundance': study_mean,
                                'std_abundance': study_std,
                                'sample_count': study_count,
                                'compendium_mean': compendium_mean,
                                'compendium_std': compendium_std,
                                'compendium_count': compendium_count,
                                'p_value': float(p_value),
                                'effect_size': effect_size,
                                'direction': 'higher' if effect_size > 0 else 'lower'
                            })
                    
                    # Sort by effect size magnitude
                    significant_differences.sort(key=lambda x: abs(x['effect_size']), reverse=True)
                    logger.info(f"Found {len(significant_differences)} significant differences in {tax_type} {rank}")
                    if significant_differences:
                        top_effects = [f"{d['id']} ({d['effect_size']:.2f})" for d in significant_differences[:3]]
                        logger.info(f"Top effect sizes: {top_effects}")
                    results[tax_type][rank] = significant_differences
                
            except Exception as e:
                logger.error(f"Error processing {tax_type} differences: {str(e)}")
                results[tax_type] = {}
        
        return results
        
    def _process_timeline(self, study_id: str, study_samples: pd.DataFrame) -> Dict:
        """Process timeline data for a study."""
        # Placeholder for now - will implement in Stage 2
        return {}
        
    def _process_ecosystem(self, study_id: str, study_samples: pd.DataFrame) -> Dict[str, Any]:
        """Process ecosystem data for a study."""
        try:
            # Get unique ecosystem values
            ecosystem_data: Dict[str, List[str]] = {
                'ecosystem': study_samples['ecosystem'].unique().tolist() if 'ecosystem' in study_samples.columns else [],
                'ecosystem_category': study_samples['ecosystem_category'].unique().tolist() if 'ecosystem_category' in study_samples.columns else [],
                'ecosystem_type': study_samples['ecosystem_type'].unique().tolist() if 'ecosystem_type' in study_samples.columns else [],
                'ecosystem_subtype': study_samples['ecosystem_subtype'].unique().tolist() if 'ecosystem_subtype' in study_samples.columns else [],
                'specific_ecosystem': study_samples['specific_ecosystem'].unique().tolist() if 'specific_ecosystem' in study_samples.columns else []
            }
            
            # Remove empty lists and None values
            ecosystem_data = {k: [v for v in vals if v is not None] for k, vals in ecosystem_data.items() if vals}
            
            # Get the most common value for each ecosystem type
            most_common: Dict[str, str] = {}
            for col in ['ecosystem', 'ecosystem_category', 'ecosystem_type', 'ecosystem_subtype', 'specific_ecosystem']:
                if col in study_samples.columns:
                    value_counts = study_samples[col].value_counts()
                    if not value_counts.empty:
                        most_common[col] = str(value_counts.index[0])
            
            # Get sample counts for each ecosystem type
            sample_counts: Dict[str, Dict[str, int]] = {}
            for col in ['ecosystem', 'ecosystem_category', 'ecosystem_type', 'ecosystem_subtype', 'specific_ecosystem']:
                if col in study_samples.columns:
                    sample_counts[col] = {str(k): int(v) for k, v in study_samples[col].value_counts().to_dict().items()}
            
            return {
                'ecosystem_data': ecosystem_data,
                'most_common': most_common,
                'sample_counts': sample_counts
            }
            
        except Exception as e:
            logger.error(f"Error processing ecosystem data for study {study_id}: {str(e)}")
            return {}
        
    def _process_map_data(self, study_id: str, study_samples: pd.DataFrame) -> Dict:
        """Process map data for a study using individual sample locations."""
        logger.info(f"Processing map data for study {study_id}")
        
        # Filter samples with valid coordinates
        geo_samples = study_samples[
            study_samples["latitude"].notna() & 
            study_samples["longitude"].notna()
        ]
        
        # Convert coordinates to float
        geo_samples["latitude"] = pd.to_numeric(geo_samples["latitude"], errors='coerce')
        geo_samples["longitude"] = pd.to_numeric(geo_samples["longitude"], errors='coerce')
        
        # Filter out any invalid coordinates after conversion
        geo_samples = geo_samples[
            geo_samples["latitude"].notna() & 
            geo_samples["longitude"].notna()
        ]
        
        logger.info(f"Found {len(geo_samples)} samples with valid coordinates")
        
        # Create a list of individual sample locations
        locations = []
        for _, sample in geo_samples.iterrows():
            # Convert all values to strings and handle NaN values
            sample_dict = {}
            for key, value in sample.items():
                if pd.isna(value):
                    sample_dict[key] = None
                elif isinstance(value, (np.floating, float)):
                    if value in (np.inf, -np.inf, float('inf'), float('-inf')):
                        sample_dict[key] = None
                    else:
                        sample_dict[key] = float(value)
                elif isinstance(value, (np.integer, int)):
                    sample_dict[key] = int(value)
                elif isinstance(value, (np.bool_, bool)):
                    sample_dict[key] = bool(value)
                else:
                    sample_dict[key] = str(value)
            
            location = {
                'latitude': float(sample['latitude']),
                'longitude': float(sample['longitude']),
                'sample_count': 1,  # Each location represents one sample
                'ecosystem': sample_dict.get('ecosystem'),
                'ecosystem_type': sample_dict.get('ecosystem_type'),
                'ecosystem_subtype': sample_dict.get('ecosystem_subtype'),
                'specific_ecosystem': sample_dict.get('specific_ecosystem'),
                'samples': [{
                    'id': sample_dict.get('id', ''),
                    'sample_name': sample_dict.get('sample_name', ''),
                    'collection_date': sample_dict.get('collection_date', ''),
                    'collection_time': sample_dict.get('collection_time', ''),
                    'ecosystem': sample_dict.get('ecosystem', ''),
                    'ecosystem_type': sample_dict.get('ecosystem_type', ''),
                    'ecosystem_subtype': sample_dict.get('ecosystem_subtype', ''),
                    'specific_ecosystem': sample_dict.get('specific_ecosystem', ''),
                    'depth': sample_dict.get('depth'),
                    'temperature': sample_dict.get('temp_has_numeric_value'),
                    'ph': sample_dict.get('ph'),
                    'salinity': sample_dict.get('salinity')
                }]
            }
            locations.append(location)
        
        logger.info(f"Returning {len(locations)} locations")
        return {'locations': locations}
        
    def analyze_data_coverage(self) -> Dict:
        """Analyze data coverage across studies for omics, taxonomic, and physical data."""
        logger.info("Analyzing data coverage across studies...")
        
        # Load all necessary data
        sample_df = pd.read_parquet(self.data_dir / "sample_table_snappy.parquet")
        metabolite_df = pd.read_parquet(self.data_dir / "metabolite_table_snappy.parquet")
        lipidomics_df = pd.read_parquet(self.data_dir / "lipidomics_table_snappy.parquet")
        proteomics_df = pd.read_parquet(self.data_dir / "proteomics_table_snappy.parquet")
        gottcha_df = pd.read_parquet(self.data_dir / "gottcha_table_snappy.parquet")
        kraken_df = pd.read_parquet(self.data_dir / "kraken_table_snappy.parquet")
        centrifuge_df = pd.read_parquet(self.data_dir / "centrifuge_rollup_table_snappy.parquet")
        contigs_df = pd.read_parquet(self.data_dir / "contigs_rollup_table_snappy.parquet")
        
        # Define physical variables to check
        physical_variables = [
            # Nitrogen-related variables
            'ammonium_has_numeric_value',
            'ammonium_nitrogen_has_numeric_value',
            'ammonium_nitrogen_numeric',
            'nitrate_nitrogen_numeric',
            'nitrite_nitrogen_numeric',
            'nitro_has_numeric_value',
            'tot_nitro_content_has_numeric_value',
            'tot_nitro_numeric',
            'diss_inorg_nitro_has_numeric_value',
            
            # Carbon-related variables
            'tot_carb',
            'diss_inorg_carb_has_numeric_value',
            'diss_org_carb_has_numeric_value',
            'org_carb_has_numeric_value',
            'carb_nitro_ratio',
            'carb_nitro_ratio_has_numeric_value',
            
            # Mineral and metal variables
            'calcium_has_numeric_value',
            'calcium_numeric',
            'magnesium_has_numeric_value',
            'magnesium_numeric',
            'manganese_has_numeric_value',
            'manganese_numeric',
            'zinc_numeric',
            'diss_iron_has_numeric_value',
            'potassium_has_numeric_value',
            'potassium_numeric',
            'sodium_has_numeric_value',
            'chloride_has_numeric_value',
            'sulfate_has_numeric_value',
            
            # Phosphorus-related variables
            'tot_phosp_has_numeric_value',
            'tot_phosp_numeric',
            'soluble_react_phosp_has_numeric_value',
            
            # Physical parameters
            'ph',
            'temp_has_numeric_value',
            'conduc_has_numeric_value',
            'diss_oxygen_has_numeric_value',
            'chlorophyll_has_numeric_value',
            'water_content_numeric',
            
            # Depth and size measurements
            'depth',
            'depth_has_numeric_value',
            'depth_has_maximum_numeric_value',
            'depth_has_minimum_numeric_value',
            'samp_size_numeric',
            'samp_size_has_numeric_value',
            
            # Environmental measurements
            'abs_air_humidity',
            'avg_temp',
            'humidity',
            'latitude',
            'longitude',
            'photon_flux',
            'solar_irradiance',
            'wind_speed',
            
            # Other measurements
            'host_age_numeric',
            'lbc_thirty_numeric',
            'lbceq_numeric'
        ]
        
        # Get unique sample IDs with each data type
        metabolite_samples = set(metabolite_df['sample_id'].unique())
        lipidomics_samples = set(lipidomics_df['sample_id'].unique())
        proteomics_samples = set(proteomics_df['sample_id'].unique())
        gottcha_samples = set(gottcha_df['sample_id'].unique())
        kraken_samples = set(kraken_df['sample_id'].unique())
        centrifuge_samples = set(centrifuge_df['sample_id'].unique())
        contigs_samples = set(contigs_df['sample_id'].unique())
        
        # Create a mapping of sample IDs to study IDs
        sample_to_study = dict(zip(sample_df['id'], sample_df['study_id']))
        
        # Analyze coverage for each study
        coverage = {}
        for study_id in sample_df['study_id'].unique():
            # Get all samples for this study
            study_samples = sample_df[sample_df['study_id'] == study_id]
            study_sample_ids = set(study_samples['id'])
            
            # Count samples with each data type
            study_coverage = {
                'metabolomics': len(study_sample_ids & metabolite_samples),
                'lipidomics': len(study_sample_ids & lipidomics_samples),
                'proteomics': len(study_sample_ids & proteomics_samples),
                'gottcha': len(study_sample_ids & gottcha_samples),
                'kraken': len(study_sample_ids & kraken_samples),
                'centrifuge': len(study_sample_ids & centrifuge_samples),
                'contigs': len(study_sample_ids & contigs_samples),
                'total_samples': len(study_sample_ids)
            }
            
            # Add physical variable coverage
            for var in physical_variables:
                if var in study_samples.columns:
                    # All columns are treated as numeric - just check for non-null values
                    valid_values = study_samples[var].notna()
                    study_coverage[f'physical_{var}'] = int(valid_values.sum())
                else:
                    study_coverage[f'physical_{var}'] = 0
            
            coverage[study_id] = study_coverage
        
        # Calculate summary statistics
        summary = {
            'metabolomics': sum(1 for c in coverage.values() if c['metabolomics'] > 0),
            'lipidomics': sum(1 for c in coverage.values() if c['lipidomics'] > 0),
            'proteomics': sum(1 for c in coverage.values() if c['proteomics'] > 0),
            'gottcha': sum(1 for c in coverage.values() if c['gottcha'] > 0),
            'kraken': sum(1 for c in coverage.values() if c['kraken'] > 0),
            'centrifuge': sum(1 for c in coverage.values() if c['centrifuge'] > 0),
            'contigs': sum(1 for c in coverage.values() if c['contigs'] > 0),
            'physical_variables': {
                var: sum(1 for c in coverage.values() if c[f'physical_{var}'] > 0)
                for var in physical_variables
            }
        }
        
        # Find studies with good coverage
        good_coverage_studies = []
        all_studies = []
        for study_id, study_coverage in coverage.items():
            # Calculate total coverage score
            omics_score = sum(study_coverage[t] for t in ['metabolomics', 'lipidomics', 'proteomics'])
            taxonomy_score = sum(study_coverage[t] for t in ['gottcha', 'kraken', 'centrifuge', 'contigs'])
            physical_score = sum(1 for var in physical_variables if study_coverage[f'physical_{var}'] > 0)
            total_score = omics_score + taxonomy_score + physical_score
            
            study_info = {
                'study_id': study_id,
                'coverage': study_coverage,
                'physical_variable_count': physical_score,
                'total_score': total_score
            }
            all_studies.append(study_info)
            
            # Check if study meets good coverage criteria
            has_omics = any(study_coverage[t] > 0 for t in ['metabolomics', 'lipidomics', 'proteomics'])
            has_taxonomy = any(study_coverage[t] > 0 for t in ['gottcha', 'kraken', 'centrifuge', 'contigs'])
            
            if has_omics and has_taxonomy and physical_score >= 5:
                good_coverage_studies.append(study_info)
        
        # Sort all studies by total score
        all_studies.sort(key=lambda x: x['total_score'], reverse=True)
        
        # Print top 3 studies
        print("\nTop 3 studies with best coverage:")
        for i, study in enumerate(all_studies[:3], 1):
            print(f"\n{i}. Study: {study['study_id']}")
            print(f"   Total score: {study['total_score']}")
            print(f"   Physical variables: {study['physical_variable_count']}")
            print("   Coverage:")
            for data_type in ['metabolomics', 'lipidomics', 'proteomics', 'gottcha', 'kraken', 'centrifuge', 'contigs']:
                if study['coverage'][data_type] > 0:
                    print(f"   - {data_type}: {study['coverage'][data_type]} samples")
            print("   Physical variables with data:")
            for var in physical_variables:
                if study['coverage'][f'physical_{var}'] > 0:
                    print(f"   - {var}: {study['coverage'][f'physical_{var}']} samples")
        
        result = {
            'total_studies': len(coverage),
            'studies_with_good_coverage': len(good_coverage_studies),
            'good_coverage_studies': good_coverage_studies[:10],  # Return top 10 studies
            'coverage_summary': coverage  # Return the full coverage data
        }
        
        return convert_numpy_types(result) 