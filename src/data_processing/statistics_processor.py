import pandas as pd
import dask.dataframe as dd
from pathlib import Path
from typing import Dict, List, Optional
import json
from datetime import datetime
import logging
import numpy as np
from functools import lru_cache

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StatisticsProcessor:
    def __init__(self, data_dir: Optional[str] = None):
        # Get the project root directory (2 levels up from this file)
        project_root = Path(__file__).parent.parent.parent
        self.data_dir = Path(data_dir) if data_dir else project_root / "data"
        logger.info(f"Initialized StatisticsProcessor with data directory: {self.data_dir.absolute()}")
        self._cache = {}
        
    def _load_parquet(self, filename: str) -> pd.DataFrame:
        """Lazy load parquet data with caching"""
        if filename not in self._cache:
            logger.debug(f"Loading {filename}...")
            file_path = self.data_dir / filename
            df = pd.read_parquet(file_path)
            logger.debug(f"Loaded {len(df)} rows from {filename}")
            self._cache[filename] = df
        return self._cache[filename]
    
    def get_timeline_data(self) -> Dict:
        """Get timeline data for samples and studies"""
        logger.info("Generating timeline data...")
        try:
            samples_df = self._load_parquet("sample_table_snappy.parquet")
            
            # Process sample timeline
            samples_df['collection_date'] = pd.to_datetime(samples_df['collection_date'], errors='coerce')
            valid_dates = samples_df[samples_df['collection_date'].notna()]
            no_dates = samples_df[samples_df['collection_date'].isna()]
            logger.info(f"Valid dates count: {len(valid_dates)}, No dates count: {len(no_dates)}")
            
            # Create sample timeline
            sample_timeline = []
            current_date = pd.Timestamp.now()
            
            if len(valid_dates) > 0:
                earliest_date = valid_dates['collection_date'].min()
                
                for _, row in valid_dates.iterrows():
                    try:
                        sample_data = {
                            'sample_id': str(row['id']),
                            'date': row['collection_date'].isoformat(),
                            'study_id': str(row['study_id'])
                        }
                        sample_timeline.append(sample_data)
                    except Exception as e:
                        logger.warning(f"Error processing sample {row.get('id', 'unknown')}: {str(e)}")
                        continue
            
            # Process study timelines
            study_timelines = []
            for study_id, study_group in samples_df.groupby('study_id'):
                try:
                    valid_dates = study_group['collection_date'].dropna()
                    if len(valid_dates) > 0:
                        study_data = {
                            'study_id': str(study_id),
                            'start_date': valid_dates.min().isoformat(),
                            'end_date': valid_dates.max().isoformat(),
                            'sample_count': len(valid_dates)
                        }
                        study_timelines.append(study_data)
                    else:
                        study_data = {
                            'study_id': str(study_id),
                            'start_date': current_date.isoformat(),
                            'end_date': current_date.isoformat(),
                            'sample_count': len(study_group)
                        }
                        study_timelines.append(study_data)
                except Exception as e:
                    logger.warning(f"Error processing study {study_id}: {str(e)}")
                    continue
            
            return {
                'study_timelines': study_timelines,
                'sample_timeline': sample_timeline
            }
        except Exception as e:
            logger.error(f"Error in get_timeline_data: {str(e)}")
            raise
    
    def get_ecosystem_statistics(self, variable: str) -> Dict:
        """Get statistics for a specific ecosystem variable"""
        logger.info(f"Processing ecosystem statistics for {variable}")
        samples_df = self._load_parquet("sample_table_snappy.parquet")
        
        valid_variables = [
            'ecosystem', 'ecosystem_category', 'ecosystem_subtype',
            'ecosystem_type', 'env_broad_scale_label', 'env_local_scale_label',
            'specific_ecosystem', 'env_medium_label', 'soil_horizon', 'soil_type'
        ]
        
        if variable not in valid_variables:
            logger.warning(f"Invalid ecosystem variable requested: {variable}")
            return {
                'variable': variable,
                'value_counts': {},
                'total_samples': len(samples_df),
                'unique_values': 0,
                'error': f"Invalid ecosystem variable: {variable}"
            }
        
        # Check if column exists
        if variable not in samples_df.columns:
            logger.warning(f"Column {variable} not found in sample table")
            return {
                'variable': variable,
                'value_counts': {},
                'total_samples': len(samples_df),
                'unique_values': 0,
                'error': f"Column {variable} not found in sample table"
            }
        
        # Handle null values by replacing them with "Unknown"
        value_counts = samples_df[variable].fillna("Unknown").value_counts().to_dict()
        total_samples = len(samples_df)
        
        # Log the value counts at debug level
        logger.debug(f"Value counts for {variable}: {value_counts}")
        
        return {
            'variable': variable,
            'value_counts': value_counts,
            'total_samples': total_samples,
            'unique_values': len(value_counts)
        }
    
    def get_physical_variable_statistics(self, variable: str) -> Dict:
        """Get statistics for a specific physical variable"""
        logger.info(f"Generating physical variable statistics for {variable}...")
        samples_df = self._load_parquet("sample_table_snappy.parquet")
        
        valid_variables = [
            'ammonium_nitrogen_numeric',
            'calcium_numeric',
            'carb_nitro_ratio',
            'chlorophyll_has_numeric_value',
            'conduc_has_numeric_value',
            'depth',
            'diss_inorg_carb_has_numeric_value',
            'diss_inorg_nitro_has_numeric_value',
            'diss_iron_has_numeric_value',
            'diss_org_carb_has_numeric_value',
            'diss_oxygen_has_numeric_value',
            'host_age_numeric',
            'magnesium_numeric',
            'manganese_numeric',
            'nitrate_nitrogen_numeric',
            'nitrite_nitrogen_numeric',
            'org_carb_has_numeric_value',
            'potassium_numeric',
            'samp_size_numeric',
            'sodium_has_numeric_value',
            'soluble_react_phosp_has_numeric_value',
            'sulfate_has_numeric_value',
            'temp_has_numeric_value',
            'tot_nitro_numeric',
            'tot_org_carb',
            'tot_phosp_numeric',
            'water_content_numeric',
            'zinc_numeric',
            'abs_air_humidity',
            'avg_temp',
            'gravidity',
            'humidity',
            'latitude',
            'longitude',
            'ph',
            'photon_flux',
            'solar_irradiance',
            'tot_carb',
            'wind_speed'
        ]
        
        if variable not in valid_variables:
            logger.warning(f"Invalid physical variable: {variable}")
            return {
                'variable': variable,
                'error': f"Invalid physical variable: {variable}"
            }
        
        # Check if column exists
        if variable not in samples_df.columns:
            logger.warning(f"Column {variable} not found in sample table. Available columns: {samples_df.columns.tolist()}")
            return {
                'variable': variable,
                'error': f"Column {variable} not found in sample table"
            }
        
        # Calculate distribution statistics
        values = samples_df[variable].dropna()
        if len(values) == 0:
            logger.warning(f"No valid numeric values found for {variable}")
            return {
                'variable': variable,
                'error': 'No valid numeric values found'
            }
        
        # Log the value range for debugging
        logger.info(f"Value range for {variable}: min={values.min()}, max={values.max()}")
        
        # Calculate histogram
        hist, bin_edges = np.histogram(values, bins=50)
        
        return {
            'variable': variable,
            'mean': float(values.mean()),
            'std': float(values.std()),
            'min': float(values.min()),
            'max': float(values.max()),
            'count': int(len(values)),
            'histogram': {
                'values': hist.tolist(),
                'bin_edges': bin_edges.tolist()
            }
        }
    
    def get_omics_statistics(self, omics_type: str) -> List[Dict]:
        """Get statistics for omics data"""
        logger.info(f"Generating {omics_type} statistics...")
        
        try:
            if omics_type == 'metabolomics':
                df = self._load_parquet("metabolite_table_snappy.parquet")
                if 'Compound Name' not in df.columns:
                    raise ValueError("Required column 'Compound Name' not found in metabolomics data")
                if 'Peak Area' not in df.columns:
                    raise ValueError("Required column 'Peak Area' not found in metabolomics data")
                return self._process_metabolomics(df)
            elif omics_type == 'lipidomics':
                df = self._load_parquet("lipidomics_table_snappy.parquet")
                if 'Lipid Molecular Species' not in df.columns:
                    raise ValueError("Required column 'Lipid Molecular Species' not found in lipidomics data")
                if 'Area' not in df.columns:
                    raise ValueError("Required column 'Area' not found in lipidomics data")
                return self._process_lipidomics(df)
            elif omics_type == 'proteomics':
                df = self._load_parquet("proteomics_table_snappy.parquet")
                if 'Product' not in df.columns:
                    raise ValueError("Required column 'Product' not found in proteomics data")
                if 'SummedPeptideMASICAbundances' not in df.columns:
                    raise ValueError("Required column 'SummedPeptideMASICAbundances' not found in proteomics data")
                return self._process_proteomics(df)
            else:
                raise ValueError(f"Invalid omics type: {omics_type}")
        except Exception as e:
            logger.error(f"Error in get_omics_statistics: {str(e)}")
            raise ValueError(f"Error processing {omics_type} data: {str(e)}")
    
    def _process_metabolomics(self, df: pd.DataFrame) -> List[Dict]:
        """Process metabolomics data with robust NaN handling"""
        logger.info("Processing metabolomics data...")
        logger.info(f"Metabolomics columns: {df.columns.tolist()}")
        logger.info(f"Metabolomics dtypes:\n{df.dtypes}")
        
        # Ensure we have the required columns
        required_columns = [
            'Compound Name', 'Common Name', 'IUPAC Name', 'Traditional Name',
            'Molecular Formula', 'Smiles', 'Chebi ID', 'Kegg Compound ID',
            'Inchi', 'Inchi Key', 'Peak Area'
        ]
        
        # Add missing columns with NaN values
        for col in required_columns:
            if col not in df.columns:
                logger.warning(f"Missing required column: {col}")
                df[col] = np.nan
        
        # Ensure Peak Area is numeric
        df['Peak Area'] = pd.to_numeric(df['Peak Area'], errors='coerce')
        
        # Group by compound and calculate statistics
        compound_stats = df.groupby('Compound Name', dropna=False).agg({
            'Peak Area': ['mean', 'std'],
            'Common Name': 'first',
            'IUPAC Name': 'first',
            'Traditional Name': 'first',
            'Molecular Formula': 'first',
            'Smiles': 'first',
            'Chebi ID': 'first',
            'Kegg Compound ID': 'first',
            'Inchi': 'first',
            'Inchi Key': 'first'
        })
        
        # Flatten the MultiIndex columns
        compound_stats.columns = ['_'.join(col).strip() for col in compound_stats.columns.values]
        compound_stats = compound_stats.reset_index()
        
        # Sort by mean peak area and get top 10
        top_compounds = compound_stats.sort_values('Peak Area_mean', ascending=False).head(10)
        logger.info(f"Top compounds:\n{top_compounds}")
        
        # Format results
        results = []
        for _, row in top_compounds.iterrows():
            try:
                result_dict = {
                    'compound_name': str(row['Compound Name']) if pd.notna(row['Compound Name']) else 'Unnamed',
                    'common_name': str(row['Common Name_first']) if pd.notna(row['Common Name_first']) else '',
                    'iupac_name': str(row['IUPAC Name_first']) if pd.notna(row['IUPAC Name_first']) else '',
                    'traditional_name': str(row['Traditional Name_first']) if pd.notna(row['Traditional Name_first']) else '',
                    'molecular_formula': str(row['Molecular Formula_first']) if pd.notna(row['Molecular Formula_first']) else '',
                    'smiles': str(row['Smiles_first']) if pd.notna(row['Smiles_first']) else '',
                    'chebi_id': str(row['Chebi ID_first']) if pd.notna(row['Chebi ID_first']) else '',
                    'kegg_id': str(row['Kegg Compound ID_first']) if pd.notna(row['Kegg Compound ID_first']) else '',
                    'inchi': str(row['Inchi_first']) if pd.notna(row['Inchi_first']) else '',
                    'inchi_key': str(row['Inchi Key_first']) if pd.notna(row['Inchi Key_first']) else '',
                    'mean_abundance': float(row['Peak Area_mean']),
                    'std_abundance': float(row['Peak Area_std'])
                }
                results.append(result_dict)
            except Exception as e:
                logger.warning(f"Error processing compound {row['Compound Name']}: {str(e)}")
                logger.warning(f"Row data: {row.to_dict()}")
                continue
        
        return results
    
    def _process_lipidomics(self, df: pd.DataFrame) -> List[Dict]:
        """Process lipidomics data with robust NaN handling"""
        # Ensure we have the required columns
        required_columns = [
            'Ion Formula', 'Ion Type', 'Molecular Formula',
            'Lipid Annotation Level', 'Lipid Molecular Species',
            'Lipid Species', 'Lipid Subclass', 'Lipid Class',
            'Lipid Category', 'Area'
        ]
        
        for col in required_columns:
            if col not in df.columns:
                df[col] = np.nan
        
        # Ensure Area is numeric
        df['Area'] = pd.to_numeric(df['Area'], errors='coerce')
        
        # Group by lipid identifiers and calculate statistics
        df['lipid_key'] = df.apply(
            lambda row: '|'.join([
                str(row.get(col, '')) for col in [
                    'Lipid Molecular Species', 'Lipid Species',
                    'Lipid Subclass', 'Lipid Class'
                ]
            ]),
            axis=1
        )
        
        # Calculate statistics
        stats = df.groupby('lipid_key', dropna=False).agg({
            'Area': ['mean', 'std']
        })
        
        # Flatten the MultiIndex columns
        stats.columns = ['_'.join(col).strip() for col in stats.columns.values]
        stats = stats.reset_index()
        
        # Sort by mean area and get top 10
        top_10 = stats.sort_values('Area_mean', ascending=False).head(10)
        
        # Get additional lipid information
        result = []
        for _, row in top_10.iterrows():
            try:
                lipid_info = df[df['lipid_key'] == row['lipid_key']].iloc[0]
                result.append({
                    'lipid_molecular_species': str(lipid_info.get('Lipid Molecular Species', '')) if pd.notna(lipid_info.get('Lipid Molecular Species')) else 'Unnamed',
                    'lipid_class': str(lipid_info.get('Lipid Class', '')) if pd.notna(lipid_info.get('Lipid Class')) else '',
                    'lipid_category': str(lipid_info.get('Lipid Category', '')) if pd.notna(lipid_info.get('Lipid Category')) else '',
                    'mean_abundance': float(row['Area_mean']),
                    'std_abundance': float(row['Area_std'])
                })
            except Exception as e:
                continue
        
        return result
    
    def _process_proteomics(self, df: pd.DataFrame) -> List[Dict]:
        """Process proteomics data with robust NaN handling"""
        logger.info("Processing proteomics data...")
        logger.info(f"Proteomics columns: {df.columns.tolist()}")
        logger.info(f"Proteomics dtypes:\n{df.dtypes}")
        
        # Ensure we have the required columns
        required_columns = [
            'Product', 'EC_Number', 'pfam', 'KO', 'COG',
            'GeneCount', 'SummedPeptideMASICAbundances', 'UniquePeptideCount'
        ]
        
        for col in required_columns:
            if col not in df.columns:
                logger.warning(f"Missing required column: {col}")
                df[col] = np.nan
        
        # Ensure numeric columns are properly typed
        df['GeneCount'] = pd.to_numeric(df['GeneCount'], errors='coerce')
        df['SummedPeptideMASICAbundances'] = pd.to_numeric(df['SummedPeptideMASICAbundances'], errors='coerce')
        df['UniquePeptideCount'] = pd.to_numeric(df['UniquePeptideCount'], errors='coerce')
        
        # Group by protein identifiers and calculate statistics
        stats = df.groupby('Product', dropna=False).agg({
            'SummedPeptideMASICAbundances': ['mean', 'std'],
            'GeneCount': 'first',
            'UniquePeptideCount': 'first',
            'EC_Number': 'first',
            'pfam': 'first',
            'KO': 'first',
            'COG': 'first'
        })
        
        # Flatten the MultiIndex columns
        stats.columns = ['_'.join(col).strip() for col in stats.columns.values]
        stats = stats.reset_index()
        
        # Sort by mean abundance and get top 10
        top_10 = stats.sort_values('SummedPeptideMASICAbundances_mean', ascending=False).head(10)
        
        # Get additional protein information
        result = []
        for _, row in top_10.iterrows():
            try:
                result.append({
                    'product': str(row['Product']) if pd.notna(row['Product']) else 'Unnamed',
                    'ec_number': str(row['EC_Number_first']) if pd.notna(row['EC_Number_first']) else '',
                    'pfam': str(row['pfam_first']) if pd.notna(row['pfam_first']) else '',
                    'ko': str(row['KO_first']) if pd.notna(row['KO_first']) else '',
                    'cog': str(row['COG_first']) if pd.notna(row['COG_first']) else '',
                    'gene_count': int(row['GeneCount_first']) if pd.notna(row['GeneCount_first']) else 0,
                    'unique_peptide_count': int(row['UniquePeptideCount_first']) if pd.notna(row['UniquePeptideCount_first']) else 0,
                    'mean_abundance': float(row['SummedPeptideMASICAbundances_mean']),
                    'std_abundance': float(row['SummedPeptideMASICAbundances_std'])
                })
            except Exception as e:
                logger.warning(f"Error processing protein {row['Product']}: {str(e)}")
                logger.warning(f"Row data: {row.to_dict()}")
                continue
        
        logger.info(f"Final result count: {len(result)}")
        return result
    
    def get_taxonomic_statistics(self, analysis_type: str) -> Dict[str, List[Dict]]:
        """Get statistics for taxonomic analysis data"""
        logger.info(f"Generating {analysis_type} taxonomic statistics...")
        
        valid_ranks = ['superkingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species']
        
        try:
            if analysis_type == 'contigs':
                df = self._load_parquet("contigs_rollup_table_snappy.parquet")
                return self._process_taxonomic_data(df, valid_ranks, ['rank', 'lineage', 'abundance', 'species_count'], analysis_type)
            elif analysis_type == 'centrifuge':
                df = self._load_parquet("centrifuge_rollup_table_snappy.parquet")
                return self._process_taxonomic_data(df, valid_ranks, ['rank', 'lineage', 'label', 'numReads', 'abundance', 'species_count'], analysis_type)
            elif analysis_type == 'kraken':
                df = self._load_parquet("kraken_table_snappy.parquet")
                return self._process_taxonomic_data(df, valid_ranks, ['rank', 'lineage', 'name', 'abundance'], analysis_type)
            elif analysis_type == 'gottcha':
                df = self._load_parquet("gottcha_table_snappy.parquet")
                logger.info(f"Gottcha columns: {df.columns.tolist()}")
                logger.info(f"Gottcha dtypes:\n{df.dtypes}")
                
                # For gottcha, we need to handle the rank column differently
                if 'rank' not in df.columns:
                    logger.warning("No rank column found in gottcha table, using 'species' as default")
                    df['rank'] = 'species'
                
                # Ensure numeric columns are properly typed
                numeric_columns = ['read_count', 'abundance']
                for col in numeric_columns:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors='coerce')
                
                # Group by rank and label
                result = {}
                for rank in valid_ranks:
                    rank_df = df[df['rank'] == rank].copy()
                    if len(rank_df) == 0:
                        logger.warning(f"No data found for rank: {rank}")
                        result[rank] = []
                        continue
                    
                    # Calculate statistics
                    stats = rank_df.groupby('label').agg({
                        'read_count': ['mean', 'std'],
                        'abundance': ['mean', 'std']
                    })
                    
                    # Flatten the MultiIndex columns
                    stats.columns = ['_'.join(col).strip() for col in stats.columns.values]
                    stats = stats.reset_index()
                    
                    # Sort by mean abundance and get top 10
                    top_10 = stats.sort_values('abundance_mean', ascending=False).head(10)
                    
                    # Format results
                    rank_results = []
                    for _, row in top_10.iterrows():
                        try:
                            result_dict = {
                                'rank': rank,
                                'label': str(row['label']),
                                'mean_read_count': float(row['read_count_mean']),
                                'std_read_count': float(row['read_count_std']),
                                'mean_abundance': float(row['abundance_mean']),
                                'std_abundance': float(row['abundance_std'])
                            }
                            
                            # Replace NaN values with 0 for numeric fields
                            for key, value in result_dict.items():
                                if pd.isna(value):
                                    result_dict[key] = 0
                            
                            rank_results.append(result_dict)
                        except Exception as e:
                            logger.warning(f"Error processing gottcha entry {row['label']}: {str(e)}")
                            logger.warning(f"Row data: {row.to_dict()}")
                            continue
                    
                    result[rank] = rank_results
                
                return result
            else:
                raise ValueError(f"Invalid analysis type: {analysis_type}")
        except Exception as e:
            logger.error(f"Error in get_taxonomic_statistics: {str(e)}")
            raise

    def _process_taxonomic_data(self, df: pd.DataFrame, valid_ranks: List[str], columns: List[str], analysis_type: str) -> Dict[str, List[Dict]]:
        """Process taxonomic data with robust NaN handling"""
        result = {}
        
        for rank in valid_ranks:
            # Filter for current rank
            rank_df = df[df['rank'] == rank].copy()
            
            if len(rank_df) == 0:
                logger.warning(f"No data found for rank: {rank}")
                result[rank] = []
                continue
            
            # Ensure all required columns exist
            for col in columns:
                if col not in rank_df.columns:
                    logger.warning(f"Missing required column: {col}")
                    rank_df[col] = np.nan
            
            # Ensure numeric columns are properly typed
            numeric_columns = ['abundance', 'species_count', 'read_count']
            for col in numeric_columns:
                if col in rank_df.columns:
                    rank_df[col] = pd.to_numeric(rank_df[col], errors='coerce')
            
            # Group by lineage and calculate statistics
            # Calculate mean and std for each column separately
            mean_stats = rank_df.groupby('lineage').agg({
                'abundance': 'mean',
                **({'species_count': 'mean'} if 'species_count' in columns and analysis_type in ['contigs', 'centrifuge'] else {}),
                **({'read_count': 'mean'} if 'read_count' in columns else {})
            })
            
            std_stats = rank_df.groupby('lineage').agg({
                'abundance': 'std',
                **({'species_count': 'std'} if 'species_count' in columns and analysis_type in ['contigs', 'centrifuge'] else {}),
                **({'read_count': 'std'} if 'read_count' in columns else {})
            })
            
            # Combine the statistics
            stats = pd.concat([
                mean_stats.add_suffix('_mean'),
                std_stats.add_suffix('_std')
            ], axis=1).reset_index()
            
            # Sort by mean abundance and get top 10
            top_10 = stats.sort_values('abundance_mean', ascending=False).head(10)
            
            # Format results
            rank_results = []
            for _, row in top_10.iterrows():
                taxon_info = rank_df[rank_df['lineage'] == row['lineage']].iloc[0]
                result_dict = {
                    'rank': rank,
                    'lineage': str(row['lineage']),
                    'mean_abundance': float(row['abundance_mean']),
                    'std_abundance': float(row['abundance_std'])
                }
                
                if 'species_count' in columns and analysis_type in ['contigs', 'centrifuge']:
                    result_dict.update({
                        'mean_species_count': float(row.get('species_count_mean', 0)),
                        'std_species_count': float(row.get('species_count_std', 0))
                    })
                
                if 'read_count' in columns:
                    result_dict.update({
                        'mean_read_count': float(row.get('read_count_mean', 0)),
                        'std_read_count': float(row.get('read_count_std', 0))
                    })
                
                if 'label' in columns:
                    result_dict['label'] = str(taxon_info.get('label', ''))
                
                if 'name' in columns:
                    result_dict['name'] = str(taxon_info.get('name', ''))
                
                # Replace NaN values with empty strings for string fields
                for key, value in result_dict.items():
                    if pd.isna(value):
                        result_dict[key] = '' if isinstance(value, str) else 0
                
                rank_results.append(result_dict)
            
            result[rank] = rank_results
        
        return result 