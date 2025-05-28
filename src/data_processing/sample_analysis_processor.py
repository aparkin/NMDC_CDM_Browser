import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
import pandas as pd
from .statistics_processor import StatisticsProcessor

logger = logging.getLogger(__name__)

class TimestampEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle pandas Timestamp objects."""
    def default(self, obj):
        if isinstance(obj, pd.Timestamp):
            return obj.isoformat() if pd.notna(obj) else None
        if pd.isna(obj):  # Handle NaT and NaN
            return None
        return super().default(obj)

class SampleAnalysisProcessor(StatisticsProcessor):
    """Processor for sample-specific analysis with caching."""
    
    def __init__(self):
        super().__init__()
        self.cache_dir = Path("processed_data/sample_analysis_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Define table paths
        data_dir = Path("data")
        self.sample_table_path = data_dir / "sample_table_snappy.parquet"
        self.study_table_path = data_dir / "study_table_snappy.parquet"
        self.contigs_table_path = data_dir / "contigs_rollup_table_snappy.parquet"
        self.centrifuge_table_path = data_dir / "centrifuge_rollup_table_snappy.parquet"
        self.kraken_table_path = data_dir / "kraken_table_snappy.parquet"
        self.gottcha_table_path = data_dir / "gottcha_table_snappy.parquet"
        self.metabolites_table_path = data_dir / "metabolite_table_snappy.parquet"
        self.lipidomics_table_path = data_dir / "lipidomics_table_snappy.parquet"
        self.proteomics_table_path = data_dir / "proteomics_table_snappy.parquet"
        self.taxonomy_table_path = data_dir / "taxonomy_table_snappy.parquet"
        
        # Log available files
        for path in [
            self.sample_table_path,
            self.study_table_path,
            self.contigs_table_path,
            self.centrifuge_table_path,
            self.kraken_table_path,
            self.gottcha_table_path,
            self.metabolites_table_path,
            self.lipidomics_table_path,
            self.proteomics_table_path,
            self.taxonomy_table_path
        ]:
            if path.exists():
                logger.info(f"Found data file: {path}")
            else:
                logger.warning(f"Data file not found: {path}")
        
    def _get_cache_path(self, sample_id: str) -> Path:
        """Get the cache file path for a sample."""
        return self.cache_dir / f"{sample_id}.json"
        
    def _load_from_cache(self, sample_id: str) -> Optional[Dict]:
        """Load sample analysis from cache if available and valid."""
        cache_path = self._get_cache_path(sample_id)
        if not cache_path.exists():
            return None
            
        try:
            with open(cache_path, 'r') as f:
                cached_data = json.load(f)
                
            # Check if source data has changed
            if self._has_data_changed(cached_data.get('last_modified')):
                logger.info(f"Cache invalid for sample {sample_id} - source data changed")
                return None
                
            return cached_data
        except Exception as e:
            logger.warning(f"Error loading cache for sample {sample_id}: {str(e)}")
            return None
            
    def _save_to_cache(self, sample_id: str, data: Dict):
        """Save sample analysis to cache."""
        cache_path = self._get_cache_path(sample_id)
        try:
            logger.info(f"Attempting to save cache for sample {sample_id} to {cache_path}")
            # Ensure parent directory exists
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            with open(cache_path, 'w') as f:
                json.dump(data, f, indent=2, cls=TimestampEncoder)
            logger.info(f"Successfully saved cache for sample {sample_id}")
        except Exception as e:
            logger.error(f"Error saving cache for sample {sample_id}: {str(e)}", exc_info=True)
            
    def _has_data_changed(self, last_modified: Optional[str]) -> bool:
        """Check if source data files have changed since last analysis."""
        if not last_modified:
            return True
            
        try:
            last_modified_time = pd.Timestamp(last_modified)
            data_files = [
                self.sample_table_path,
                self.study_table_path,
                self.contigs_table_path,
                self.centrifuge_table_path,
                self.kraken_table_path,
                self.gottcha_table_path,
                self.metabolites_table_path,
                self.lipidomics_table_path,
                self.proteomics_table_path,
                self.taxonomy_table_path
            ]
            
            # Check data files
            for file_path in data_files:
                if file_path.exists() and pd.Timestamp(file_path.stat().st_mtime) > last_modified_time:
                    logger.info(f"Cache invalidated due to changes in {file_path}")
                    return True
            
            # Check study analysis cache
            study_cache_dir = Path("processed_data/study_analysis_cache")
            if study_cache_dir.exists():
                for cache_file in study_cache_dir.glob("*.json"):
                    if pd.Timestamp(cache_file.stat().st_mtime) > last_modified_time:
                        logger.info(f"Cache invalidated due to changes in study analysis cache")
                        return True
                    
            return False
        except Exception as e:
            logger.warning(f"Error checking data changes: {str(e)}")
            return True
            
    def get_sample_analysis(self, sample_id: str, force_refresh: bool = False) -> Dict:
        """Get complete analysis for a sample with caching."""
        logger.info(f"Getting sample analysis for {sample_id} (force_refresh={force_refresh})")
        
        # Try to load from cache first if not forcing refresh
        if not force_refresh:
            cached_data = self._load_from_cache(sample_id)
            if cached_data:
                logger.info(f"Using cached data for sample {sample_id}")
                return cached_data
            
        try:
            logger.info(f"Calculating new analysis for sample {sample_id}")
            # Get sample data
            sample_data = self._get_sample_data(sample_id)
            if sample_data.empty:
                raise ValueError(f"Sample {sample_id} not found")
                
            # Get study ID and load study analysis
            study_id = sample_data.iloc[0]["study_id"]
            study_cache_path = Path("processed_data/study_analysis_cache") / f"{study_id}.json"
            
            if study_cache_path.exists():
                try:
                    with open(study_cache_path, 'r') as f:
                        study_data = json.load(f)
                    logger.info(f"Successfully loaded study cache for {study_id}")
                    
                    # Get the analysis data
                    analysis_data = study_data.get('analysis', {})
                    
                    # Log summary of what we'll process
                    logger.info("=== Processing Targets Summary ===")
                    
                    # Physical Variables
                    physical_vars = analysis_data.get("physical", {})
                    if physical_vars:
                        valid_vars = [var for var, data in physical_vars.items() if data.get("status") == "ok"]
                        logger.info(f"Physical Variables to process: {valid_vars}")
                        
                    # OMICS Data
                    omics_data = analysis_data.get("omics", {}).get("top10", {})
                    if omics_data:
                        for omics_type in ["metabolomics", "lipidomics", "proteomics"]:
                            if omics_type in omics_data:
                                logger.info(f"Found {len(omics_data[omics_type])} {omics_type} compounds to process")
                                
                    # Taxonomic Data
                    taxonomy_data = analysis_data.get("taxonomic", {}).get("top10", {})
                    if taxonomy_data:
                        for tool in ["contigs", "centrifuge", "kraken", "gottcha"]:
                            if tool in taxonomy_data:
                                logger.info(f"Found taxonomic data for {tool}")
                                
                    logger.info("=== End Processing Targets Summary ===")
                except Exception as e:
                    logger.error(f"Error loading study cache: {str(e)}", exc_info=True)
            else:
                logger.warning(f"No study analysis found for {study_id} at {study_cache_path}")
                
            # Process physical variables
            physical_vars = self._process_sample_physical_variables(sample_data)
            
            # Process omics data
            omics_data = self._process_sample_omics(sample_data)
            
            # Process taxonomic data
            taxonomic_data = self._process_sample_taxonomy(sample_data)
            
            # Convert collection date/time to string or None
            collection_date = sample_data.iloc[0].get("collection_date")
            collection_time = sample_data.iloc[0].get("collection_time")
            
            # Handle location data
            lat = sample_data.iloc[0].get("latitude")
            lon = sample_data.iloc[0].get("longitude")
            location: Dict[str, Optional[float]] = {
                "latitude": None,
                "longitude": None
            }
            try:
                if pd.notna(lat) and isinstance(lat, (int, float)):
                    location["latitude"] = float(lat)
                if pd.notna(lon) and isinstance(lon, (int, float)):
                    location["longitude"] = float(lon)
            except (ValueError, TypeError):
                pass
            
            # Compile results
            analysis = {
                "id": sample_id,
                "study_id": sample_data.iloc[0]["study_id"],
                "name": sample_data.iloc[0].get("sample_name", "Unnamed Sample"),
                "collection_date": collection_date.isoformat() if pd.notna(collection_date) else None,
                "collection_time": collection_time.isoformat() if pd.notna(collection_time) else None,
                "ecosystem": sample_data.iloc[0].get("ecosystem"),
                "physical": physical_vars,
                "omics": {
                    "top10": {
                        "metabolomics": self._get_top_compounds(sample_data, "metabolites"),
                        "lipidomics": self._get_top_compounds(sample_data, "lipids"),
                        "proteomics": self._get_top_compounds(sample_data, "proteins")
                    }
                },
                "taxonomic": taxonomic_data,
                "location": location,
                "last_modified": pd.Timestamp.now().isoformat()
            }
            
            # Save to cache
            self._save_to_cache(sample_id, analysis)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing sample {sample_id}: {str(e)}")
            raise
            
    def _get_sample_data(self, sample_id: str) -> pd.DataFrame:
        """Get data for a specific sample."""
        try:
            sample_df = pd.read_parquet(self.sample_table_path)
            return sample_df[sample_df["id"] == sample_id]
        except Exception as e:
            logger.error(f"Error loading sample data: {str(e)}")
            raise
            
    def _process_sample_physical_variables(self, sample_data: pd.DataFrame) -> Dict:
        """Process physical variables for a sample."""
        try:
            # Get study ID
            study_id = sample_data.iloc[0]["study_id"]
            
            # Process physical variables
            physical_vars = {}
            for col in sample_data.columns:
                if col.endswith('_numeric') or col in ['depth', 'latitude', 'longitude', 'ph']:
                    value = sample_data.iloc[0][col]
                    if pd.notna(value):
                        # Get compendium stats for this variable
                        stats = self._get_compendium_stats(col)
                        if stats:
                            z_score = self._calculate_z_score(value, stats)
                            physical_vars[col] = {
                                'value': value,
                                'z_score': z_score,
                                'mean': stats['mean'],
                                'std': stats['std']
                            }
            
            # Add ecosystem variables
            ecosystem_vars = [
                'ecosystem', 'ecosystem_category', 'ecosystem_subtype',
                'ecosystem_type', 'env_broad_scale_label', 'env_local_scale_label',
                'specific_ecosystem', 'env_medium_label', 'soil_horizon', 'soil_type'
            ]
            
            # Load the full sample table for compendium calculations
            full_sample_df = pd.read_parquet(self.sample_table_path)
            
            # Get study samples
            study_samples_df = full_sample_df[full_sample_df['study_id'] == study_id]
            study_total = len(study_samples_df)
            
            # Get compendium total
            compendium_total = len(full_sample_df)
            
            for var in ecosystem_vars:
                if var in sample_data.columns:
                    value = sample_data.iloc[0][var]
                    
                    if pd.notna(value):
                        # Calculate study frequency
                        study_matches = len(study_samples_df[study_samples_df[var] == value])
                        study_frequency = (study_matches / study_total * 100) if study_total > 0 else 0
                        
                        # Calculate compendium frequency
                        compendium_matches = len(full_sample_df[full_sample_df[var] == value])
                        compendium_frequency = (compendium_matches / compendium_total * 100) if compendium_total > 0 else 0
                        
                        physical_vars[var] = {
                            'value': value,
                            'study_frequency': study_frequency,
                            'compendium_frequency': compendium_frequency
                        }
                    else:
                        # Handle null values
                        physical_vars[var] = {
                            'value': 'No data',
                            'study_frequency': 0,
                            'compendium_frequency': 0
                        }
                else:
                    physical_vars[var] = {
                        'value': 'No data',
                        'study_frequency': 0,
                        'compendium_frequency': 0
                    }
            
            return physical_vars
        except Exception as e:
            logger.error(f"Error processing physical variables: {str(e)}")
            return {}
        
    def _process_sample_omics(self, sample_data: pd.DataFrame) -> Dict:
        """Process omics data for a sample."""
        # Get study ID to look up the top compounds
        study_id = sample_data.iloc[0]["study_id"]
        study_cache_path = Path("processed_data/study_analysis_cache") / f"{study_id}.json"
        
        if not study_cache_path.exists():
            logger.warning(f"No study analysis found for {study_id}")
            return {"top10": {}}
            
        try:
            with open(study_cache_path, 'r') as f:
                study_data = json.load(f)
                
            # Get the top compounds from study analysis
            analysis_data = study_data.get('analysis', {})
            omics_data = analysis_data.get("omics", {}).get("top10", {})
            
            if not omics_data:
                logger.warning(f"No omics data found in study analysis for {study_id}")
                return {"top10": {}}
                
            # Log study targets for metabolomics only
            if "metabolomics" in omics_data:
                logger.info(f"\nStudy {study_id} metabolomics targets:")
                target_compounds = [compound.get("id") or compound.get("name") for compound in omics_data["metabolomics"]]
                logger.info(f"Looking for compounds: {', '.join(target_compounds)}")
            elif "proteomics" in omics_data:
                logger.info(f"\nStudy {study_id} proteomics targets:")
                target_compounds = [compound.get("id") or compound.get("name") for compound in omics_data["proteomics"]]
                logger.info(f"Looking for proteins: {', '.join(target_compounds)}")
            
            # Map our expected keys to the actual keys in the cache
            omics_type_map = {
                "metabolites": "metabolomics",
                "lipids": "lipidomics",
                "proteins": "proteomics"
            }
            
            results = {}
            for our_type, cache_type in omics_type_map.items():
                if cache_type in omics_data:
                    results[our_type] = self._get_top_compounds(sample_data, our_type)
                else:
                    logger.info(f"No {our_type} data found in study cache")
                    results[our_type] = []
            
            return {
                "top10": results
            }
            
        except Exception as e:
            logger.error(f"Error processing omics data: {str(e)}")
            return {"top10": {}}
            
    def _process_sample_taxonomy(self, sample_data: pd.DataFrame) -> Dict:
        """Process taxonomic data for a sample."""
        # Get study ID to look up the top taxa
        study_id = sample_data.iloc[0]["study_id"]
        study_cache_path = Path("processed_data/study_analysis_cache") / f"{study_id}.json"
        
        if not study_cache_path.exists():
            logger.warning(f"No study analysis found for {study_id}")
            return {"top10": {}}
            
        try:
            with open(study_cache_path, 'r') as f:
                study_data = json.load(f)
                
            # Get the top taxa from study analysis
            analysis_data = study_data.get('analysis', {})
            taxonomy_data = analysis_data.get("taxonomic", {}).get("top10", {})
            
            if not taxonomy_data:
                logger.warning(f"No taxonomy data found in study analysis for {study_id}")
                return {"top10": {}}
                
            # Get sample ID for logging
            sample_id = sample_data.iloc[0]["id"]
                
            # Log GOTTCHA study targets
            if "gottcha" in taxonomy_data:
                logger.info("Processing GOTTCHA data...")
            
            results = {
                "contigs": self._get_top_taxa(sample_data, "contigs"),
                "centrifuge": self._get_top_taxa(sample_data, "centrifuge"),
                "kraken": self._get_top_taxa(sample_data, "kraken"),
                "gottcha": self._get_top_taxa(sample_data, "gottcha")
            }
            
            # Log GOTTCHA sample matches
            if "gottcha" in results:
                logger.info("GOTTCHA data processed successfully")
            
            return {
                "top10": results
            }
            
        except Exception as e:
            logger.error(f"Error processing taxonomy data: {str(e)}")
            return {"top10": {}}
        
    def _get_top_compounds(self, sample_data: pd.DataFrame, compound_type: str) -> List[Dict]:
        """Get top 10 most abundant compounds of a specific type."""
        try:
            # Map our expected keys to the actual keys in the cache
            omics_type_map = {
                "metabolites": "metabolomics",
                "lipids": "lipidomics",
                "proteins": "proteomics"
            }
            
            # Get the cache type for this compound type
            cache_type = omics_type_map.get(compound_type)
            if not cache_type:
                logger.warning(f"Unknown compound type: {compound_type}")
                return []
                
            # Get study ID to look up the top compounds
            study_id = sample_data.iloc[0]["study_id"]
            study_cache_path = Path("processed_data/study_analysis_cache") / f"{study_id}.json"
            
            if not study_cache_path.exists():
                logger.warning(f"No study analysis found for {study_id}")
                return []
                
            with open(study_cache_path, 'r') as f:
                study_data = json.load(f)
                
            # Get the top compounds from study analysis
            analysis_data = study_data.get('analysis', {})
            omics_data = analysis_data.get("omics", {}).get("top10", {})
            
            if cache_type not in omics_data:
                logger.warning(f"No {cache_type} data found in study analysis")
                return []
                
            # Get the top compounds from the study
            top_compounds = omics_data[cache_type]
            
            # Get the sample's compound data
            sample_id = sample_data.iloc[0]["id"]
            compound_data = {}
            
            # Load the appropriate compound table
            table_path = None
            value_col = None
            id_col = None
            if compound_type == "metabolites":
                table_path = self.metabolites_table_path
                value_col = "Peak Area"
                id_col = "Compound Name"
            elif compound_type == "lipids":
                table_path = self.lipidomics_table_path
                value_col = "Area"
                id_col = "Lipid Molecular Species"
            elif compound_type == "proteins":
                table_path = self.proteomics_table_path
                value_col = "SummedPeptideMASICAbundances"
                id_col = "Product"
                
            if table_path and table_path.exists():
                try:
                    df = pd.read_parquet(table_path)
                    sample_df = df[df["sample_id"] == sample_id]
                    if not sample_df.empty:
                        missing_compound_warned = False
                        for _, row in sample_df.iterrows():
                            compound_name = row.get(id_col)
                            if compound_name is None:
                                if not missing_compound_warned:
                                    logger.warning(f"Found rows without {id_col} for sample {sample_id} in {compound_type}")
                                    missing_compound_warned = True
                                continue
                            compound_data[compound_name] = row[value_col]
                except Exception as e:
                    logger.error(f"Error loading {compound_type} data: {str(e)}", exc_info=True)
            else:
                logger.warning(f"Table path does not exist: {table_path}")
            
            # Map the sample's compound data to the study's top compounds
            results = []
            if compound_type == "metabolites":
                found_compounds = set()
                for compound in top_compounds:
                    # Try both id and name fields
                    name = compound.get("id") or compound.get("name")
                    if name:
                        sample_abundance = compound_data.get(name, 0)
                        if name in compound_data:
                            found_compounds.add(name)
                        results.append({
                            "id": name,
                            "abundance": float(sample_abundance) if pd.notna(sample_abundance) else None,
                            "std_abundance": float(compound.get("std_abundance", 0)) if pd.notna(compound.get("std_abundance")) else None,
                            "sample_count": int(compound.get("sample_count", 0)) if pd.notna(compound.get("sample_count")) else None
                        })
            elif compound_type == "proteins":
                found_proteins = set()
                for protein in top_compounds:
                    name = protein.get("id") or protein.get("name")
                    if name:
                        sample_abundance = compound_data.get(name, 0)
                        if name in compound_data:
                            found_proteins.add(name)
                        results.append({
                            "id": name,
                            "abundance": float(sample_abundance) if pd.notna(sample_abundance) else None,
                            "std_abundance": float(protein.get("std_abundance", 0)) if pd.notna(protein.get("std_abundance")) else None,
                            "sample_count": int(protein.get("sample_count", 0)) if pd.notna(protein.get("sample_count")) else None
                        })
            else:
                # For other types, just show count
                found_count = sum(1 for compound in top_compounds if (compound.get("id") or compound.get("name")) in compound_data)
                # Add results for lipids
                for compound in top_compounds:
                    name = compound.get("id") or compound.get("name")
                    if name:
                        sample_abundance = compound_data.get(name, 0)
                        results.append({
                            "id": name,
                            "abundance": float(sample_abundance) if pd.notna(sample_abundance) else None,
                            "std_abundance": float(compound.get("std_abundance", 0)) if pd.notna(compound.get("std_abundance")) else None,
                            "sample_count": int(compound.get("sample_count", 0)) if pd.notna(compound.get("sample_count")) else None
                        })
            
            return results
            
        except Exception as e:
            logger.error(f"Error getting top compounds: {str(e)}")
            return []
            
    def _get_top_taxa(self, sample_data: pd.DataFrame, tool: str) -> Dict[str, List[Dict]]:
        """Get top 10 most abundant taxa for each rank using a specific tool."""
        try:
            # Get study ID to look up the top taxa
            study_id = sample_data.iloc[0]["study_id"]
            study_cache_path = Path("processed_data/study_analysis_cache") / f"{study_id}.json"
            
            if not study_cache_path.exists():
                logger.warning(f"No study analysis found for {study_id}")
                return {}
                
            with open(study_cache_path, 'r') as f:
                study_data = json.load(f)
                
            # Get the top taxa from study analysis
            analysis_data = study_data.get('analysis', {})
            taxonomy_data = analysis_data.get("taxonomic", {}).get("top10", {})
            
            if tool not in taxonomy_data:
                logger.warning(f"No {tool} data found in study analysis")
                return {}
                
            # Get the top taxa from the study
            study_taxa = taxonomy_data[tool]
            
            # Get the sample's taxonomic data
            sample_id = sample_data.iloc[0]["id"]
            taxa_data = {}
            
            # Load the appropriate taxonomic table
            table_path = None
            id_col = None
            if tool == "contigs":
                table_path = self.contigs_table_path
                id_col = "lineage"
            elif tool == "centrifuge":
                table_path = self.centrifuge_table_path
                id_col = "lineage"
            elif tool == "kraken":
                table_path = self.kraken_table_path
                id_col = "name"
            elif tool == "gottcha":
                table_path = self.gottcha_table_path
                id_col = "label"
                
            if table_path and table_path.exists():
                try:
                    df = pd.read_parquet(table_path)
                    sample_df = df[df["sample_id"] == sample_id]
                    if not sample_df.empty:
                        for _, row in sample_df.iterrows():
                            rank = row.get("rank")
                            name = row.get(id_col)
                            if rank is None or name is None:
                                continue
                            if rank not in taxa_data:
                                taxa_data[rank] = {}
                            taxa_data[rank][name] = row.get("abundance", 0)
                except Exception as e:
                    logger.error(f"Error loading {tool} data: {str(e)}")
            else:
                logger.warning(f"Table path does not exist: {table_path}")
            
            # Map the sample's taxonomic data to the study's top taxa
            results = {}
            for rank, rank_taxa in study_taxa.items():
                results[rank] = []
                for taxon in rank_taxa:
                    taxon_id = taxon.get("id")
                    if taxon_id:
                        # Get the last part of the taxonomic ID for display
                        display_name = taxon_id.split(";")[-1].strip() if ";" in taxon_id else taxon_id
                        sample_abundance = taxa_data.get(rank, {}).get(taxon_id, 0)
                        mean_abundance = taxon.get("mean_abundance", 0)
                        std_abundance = taxon.get("std_abundance", 0)
                        sample_count = taxon.get("sample_count", 0)
                        
                        results[rank].append({
                            "id": taxon_id,
                            "name": display_name,
                            "abundance": float(sample_abundance) if pd.notna(sample_abundance) else None,
                            "mean_abundance": float(mean_abundance) if pd.notna(mean_abundance) else None,
                            "std_abundance": float(std_abundance) if pd.notna(std_abundance) else None,
                            "sample_count": int(sample_count) if pd.notna(sample_count) else None
                        })
            
            return results
            
        except Exception as e:
            logger.error(f"Error getting top taxa for {tool}: {str(e)}")
            return {}
            
    def _get_compendium_stats(self, variable: str) -> Dict[str, float]:
        """Get compendium statistics for a variable."""
        try:
            sample_df = pd.read_parquet(self.sample_table_path)
            if variable in sample_df.columns:
                values = sample_df[variable].dropna()
                return {
                    "mean": float(values.mean()),
                    "std": float(values.std())
                }
            return {"mean": 0.0, "std": 1.0}
        except Exception as e:
            logger.error(f"Error calculating compendium stats for {variable}: {str(e)}")
            return {"mean": 0.0, "std": 1.0}
            
    def _calculate_z_score(self, value: float, stats: Dict[str, float]) -> float:
        """Calculate z-score for a value given mean and standard deviation."""
        try:
            if stats["std"] == 0:
                return 0.0
            return (value - stats["mean"]) / stats["std"]
        except Exception as e:
            logger.error(f"Error calculating z-score: {str(e)}")
            return 0.0 