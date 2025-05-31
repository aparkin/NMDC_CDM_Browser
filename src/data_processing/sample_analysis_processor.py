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
        # Get the project root directory (2 levels up from this file)
        project_root = Path(__file__).parent.parent.parent
        self.cache_dir = project_root / "processed_data" / "sample_analysis_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Define table paths
        data_dir = project_root / "data"
        self.sample_table_path = data_dir / "sample_table_snappy.parquet"
        self.study_table_path = data_dir / "study_table_snappy.parquet"
        self.contigs_table_path = data_dir / "contigs_table_snappy.parquet"
        self.centrifuge_table_path = data_dir / "centrifuge_rollup_table_snappy.parquet"
        self.kraken_table_path = data_dir / "kraken_table_snappy.parquet"
        self.gottcha_table_path = data_dir / "gottcha_table_snappy.parquet"
        self.metabolites_table_path = data_dir / "metabolite_table_snappy.parquet"
        self.lipidomics_table_path = data_dir / "lipidomics_table_snappy.parquet"
        self.proteomics_table_path = data_dir / "proteomics_table_snappy.parquet"
        self.taxonomy_table_path = data_dir / "taxonomy_table_snappy.parquet"
        self.annotations_table_path = data_dir / "annotations_table_snappy.parquet"
        
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
            self.taxonomy_table_path,
            self.annotations_table_path
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
                self.taxonomy_table_path,
                self.annotations_table_path
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
            
            # Process functional analysis
            functional_analysis = self._process_functional_analysis(sample_data)
            
            # Process taxonomic treemap
            taxonomic_treemap = self._process_taxonomic_treemap(sample_id)
            
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
                "functional_analysis": functional_analysis,
                "taxonomic_treemap": taxonomic_treemap,
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
        """Process physical variables for a sample using cached study analysis."""
        try:
            # Get study ID
            study_id = sample_data.iloc[0]["study_id"]
            study_cache_path = Path("processed_data/study_analysis_cache") / f"{study_id}.json"
            
            if not study_cache_path.exists():
                logger.warning(f"No study analysis found for {study_id}")
                return {}
                
            with open(study_cache_path, 'r') as f:
                study_data = json.load(f)
                
            # Get physical variables from study analysis
            analysis_data = study_data.get('analysis', {})
            study_physical_vars = analysis_data.get("physical", {})
            
            # Get sample's physical variables
            physical_vars = {}
            for col in sample_data.columns:
                if col.endswith('_numeric') or col in ['depth', 'latitude', 'longitude', 'ph']:
                    value = sample_data.iloc[0][col]
                    if pd.notna(value):
                        # Use cached statistics if available
                        if col in study_physical_vars:
                            physical_vars[col] = {
                                'value': value,
                                'z_score': study_physical_vars[col].get('z_score'),
                                'mean': study_physical_vars[col].get('mean'),
                                'std': study_physical_vars[col].get('std')
                            }
                        else:
                            # Fallback to compendium stats only if not in study cache
                            stats = self._get_compendium_stats(col)
                            if stats:
                                z_score = self._calculate_z_score(value, stats)
                                physical_vars[col] = {
                                    'value': value,
                                    'z_score': z_score,
                                    'mean': stats['mean'],
                                    'std': stats['std']
                                }
            
            # Add ecosystem variables from study cache
            ecosystem_vars = [
                'ecosystem', 'ecosystem_category', 'ecosystem_subtype',
                'ecosystem_type', 'env_broad_scale_label', 'env_local_scale_label',
                'specific_ecosystem', 'env_medium_label', 'soil_horizon', 'soil_type'
            ]
            
            for var in ecosystem_vars:
                if var in sample_data.columns:
                    value = sample_data.iloc[0][var]
                    if pd.notna(value):
                        # Use cached ecosystem data if available
                        if var in study_physical_vars:
                            physical_vars[var] = study_physical_vars[var]
                        else:
                            physical_vars[var] = {
                                'value': value,
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
        """Process omics data for a sample using cached study analysis."""
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
            
            # Get sample's compound data
            sample_id = sample_data.iloc[0]["id"]
            results = {}
            
            # Map our expected keys to the actual keys in the cache
            omics_type_map = {
                "metabolites": "metabolomics",
                "lipids": "lipidomics",
                "proteins": "proteomics"
            }
            
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
        """Process taxonomic data for a sample using cached study analysis."""
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
            
            results = {
                "contigs": self._get_top_taxa(sample_data, "contigs"),
                "centrifuge": self._get_top_taxa(sample_data, "centrifuge"),
                "kraken": self._get_top_taxa(sample_data, "kraken"),
                "gottcha": self._get_top_taxa(sample_data, "gottcha")
            }
            
            return {
                "top10": results
            }
            
        except Exception as e:
            logger.error(f"Error processing taxonomy data: {str(e)}")
            return {"top10": {}}
        
    def _get_top_compounds(self, sample_data: pd.DataFrame, compound_type: str) -> List[Dict]:
        """Get top compounds of a specific type with detailed metadata."""
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
            compound_metadata = {}
            
            # Load the appropriate compound table
            table_path = None
            value_col = None
            id_col = None
            metadata_cols = []
            
            if compound_type == "metabolites":
                table_path = self.metabolites_table_path
                value_col = "Peak Area"
                id_col = "Compound Name"
                metadata_cols = ["Formula", "Mass", "Retention Time", "Pathway", "Class"]
            elif compound_type == "lipids":
                table_path = self.lipidomics_table_path
                value_col = "Area"
                id_col = "Lipid Molecular Species"
                metadata_cols = ["Lipid Class", "Fatty Acid Composition", "Total Carbon", "Total Double Bonds"]
            elif compound_type == "proteins":
                table_path = self.proteomics_table_path
                value_col = "SummedPeptideMASICAbundances"
                id_col = "Product"
                metadata_cols = ["Gene Name", "Protein Name", "Molecular Weight", "Function", "Pathway"]
                
            if table_path and table_path.exists():
                try:
                    df = pd.read_parquet(table_path)
                    sample_df = df[df["sample_id"] == sample_id]
                    if not sample_df.empty:
                        for _, row in sample_df.iterrows():
                            compound_name = row.get(id_col)
                            if compound_name is None:
                                continue
                            compound_data[compound_name] = row[value_col]
                            # Store metadata
                            compound_metadata[compound_name] = {
                                col: row.get(col) for col in metadata_cols if col in row
                            }
                except Exception as e:
                    logger.error(f"Error loading {compound_type} data: {str(e)}", exc_info=True)
            else:
                logger.warning(f"Table path does not exist: {table_path}")
            
            # Map the sample's compound data to the study's top compounds
            results = []
            for compound in top_compounds:
                name = compound.get("id") or compound.get("name")
                if name:
                    sample_abundance = compound_data.get(name, 0)
                    metadata = compound_metadata.get(name, {})
                    
                    result = {
                        "id": name,
                        "abundance": float(sample_abundance) if pd.notna(sample_abundance) else None,
                        "std_abundance": float(compound.get("std_abundance", 0)) if pd.notna(compound.get("std_abundance")) else None,
                        "sample_count": int(compound.get("sample_count", 0)) if pd.notna(compound.get("sample_count")) else None,
                        "metadata": metadata
                    }
                    
                    # Add z-score if we have mean and std
                    if pd.notna(sample_abundance) and pd.notna(compound.get("std_abundance")) and compound.get("std_abundance") != 0:
                        z_score = (sample_abundance - compound.get("mean_abundance", 0)) / compound.get("std_abundance")
                        result["z_score"] = float(z_score)
                    
                    results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Error getting top compounds: {str(e)}")
            return []
            
    def _get_top_taxa(self, sample_data: pd.DataFrame, tool: str) -> Dict[str, List[Dict]]:
        """Get top taxa for each rank using a specific tool with detailed metadata."""
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
            taxa_metadata = {}
            
            # Load the appropriate taxonomic table
            table_path = None
            id_col = None
            metadata_cols = []
            
            if tool == "contigs":
                table_path = self.contigs_table_path
                id_col = "lineage"
                metadata_cols = ["gc_content", "length", "coverage", "taxonomy"]
            elif tool == "centrifuge":
                table_path = self.centrifuge_table_path
                id_col = "lineage"
                metadata_cols = ["score", "length", "coverage"]
            elif tool == "kraken":
                table_path = self.kraken_table_path
                id_col = "name"
                metadata_cols = ["taxonomy_id", "rank", "parent_taxonomy_id"]
            elif tool == "gottcha":
                table_path = self.gottcha_table_path
                id_col = "label"
                metadata_cols = ["score", "coverage", "taxonomy"]
                
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
                                taxa_metadata[rank] = {}
                            taxa_data[rank][name] = row.get("abundance", 0)
                            # Store metadata
                            taxa_metadata[rank][name] = {
                                col: row.get(col) for col in metadata_cols if col in row
                            }
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
                        metadata = taxa_metadata.get(rank, {}).get(taxon_id, {})
                        
                        result = {
                            "id": taxon_id,
                            "name": display_name,
                            "abundance": float(sample_abundance) if pd.notna(sample_abundance) else None,
                            "mean_abundance": float(mean_abundance) if pd.notna(mean_abundance) else None,
                            "std_abundance": float(std_abundance) if pd.notna(std_abundance) else None,
                            "sample_count": int(sample_count) if pd.notna(sample_count) else None,
                            "metadata": metadata
                        }
                        
                        # Add z-score if we have mean and std
                        if pd.notna(sample_abundance) and pd.notna(std_abundance) and std_abundance != 0:
                            z_score = (sample_abundance - mean_abundance) / std_abundance
                            result["z_score"] = float(z_score)
                        
                        results[rank].append(result)
            
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
            
    def _process_functional_analysis(self, sample_data: pd.DataFrame) -> Dict:
        """Process functional analysis data for a sample."""
        try:
            sample_id = sample_data.iloc[0]["id"]
            logger.info(f"Processing functional analysis for sample {sample_id}")
            
            # Load annotations and contigs tables
            logger.info("Loading annotations and contigs tables...")
            annotations_df = pd.read_parquet(self.annotations_table_path)
            contigs_df = pd.read_parquet(self.contigs_table_path)
            logger.info(f"Loaded {len(annotations_df)} annotations and {len(contigs_df)} contigs")
            
            # Filter for this sample
            sample_contigs = contigs_df[contigs_df["sample_id"] == sample_id]
            logger.info(f"Found {len(sample_contigs)} contigs for sample {sample_id}")
            
            # Join annotations with contigs using correct column names
            sample_annotations = annotations_df[annotations_df["contigs_id"].isin(sample_contigs["id"])]
            logger.info(f"Found {len(sample_annotations)} annotations for sample {sample_id}")
            
            # Join annotations with contigs to get abundances
            merged_df = pd.merge(
                sample_annotations,
                sample_contigs[["id", "scaffold_rel_abundance"]],
                left_on="contigs_id",
                right_on="id"
            )
            logger.info(f"Merged data has {len(merged_df)} rows")
            
            # Process each annotation class
            annotation_classes = [
                'product', 'pfam', 'superfamily', 'cath_funfam', 'cog',
                'ko', 'ec_number', 'smart', 'tigrfam', 'ncRNA_class', 'regulatory_class'
            ]
            
            results = {}
            for class_name in annotation_classes:
                if class_name in merged_df.columns:
                    logger.info(f"Processing {class_name} annotations...")
                    # Group by annotation label and sum abundances
                    class_abundances = merged_df.groupby(class_name)["scaffold_rel_abundance"].sum()
                    
                    # Filter for labels with total abundance >= 0.1%
                    significant_labels = class_abundances[class_abundances >= 0.001]
                    logger.info(f"Found {len(significant_labels)} significant {class_name} labels")
                    
                    # Sort by abundance (descending)
                    sorted_labels = significant_labels.sort_values(ascending=False)
                    
                    # Convert to dictionary
                    results[class_name] = {
                        label: float(abundance) 
                        for label, abundance in sorted_labels.items()
                    }
                else:
                    logger.info(f"No {class_name} column found in annotations")
            
            logger.info(f"Functional analysis complete. Found data for {len(results)} annotation classes")
            return results
            
        except Exception as e:
            logger.error(f"Error processing functional analysis: {str(e)}", exc_info=True)
            return {}

    def _process_taxonomic_treemap(self, sample_id: str) -> Dict[str, Dict[str, Any]]:
        """
        Process taxonomic treemap data for a sample from both Kraken and Contigs data.
        Returns a dictionary with treemap data for each source.
        """
        try:
            logger.info(f"Processing taxonomic treemap for sample: {sample_id}")
            result = {}

            # Process Kraken data
            kraken_df = pd.read_parquet(self.kraken_table_path)
            kraken_sample = kraken_df[kraken_df['sample_id'] == sample_id].copy()
            
            if not kraken_sample.empty:
                # Remove unclassified and empty lineages
                kraken_sample = kraken_sample[
                    (kraken_sample['lineage'] != 'Unclassified') & 
                    (kraken_sample['lineage'] != '') & 
                    (kraken_sample['lineage'].notna())
                ]
                
                if not kraken_sample.empty:
                    treemap_data = []
                    for _, row in kraken_sample.iterrows():
                        lineage_str = row['lineage']
                        abundance = row['abundance']
                        
                        # Split lineage
                        parts = [part.strip() for part in lineage_str.split(';') if part.strip()]
                        
                        # Create hierarchy entries
                        for i in range(len(parts)):
                            current_level = parts[:i+1]
                            parent_level = parts[:i] if i > 0 else []
                            
                            treemap_data.append({
                                'ids': ' > '.join(current_level),
                                'labels': parts[i],
                                'parents': ' > '.join(parent_level) if parent_level else '',
                                'values': float(abundance),
                                'level': i
                            })
                    
                    # Convert to DataFrame and aggregate
                    treemap_df = pd.DataFrame(treemap_data)
                    treemap_agg = treemap_df.groupby(['ids', 'labels', 'parents', 'level']).agg({
                        'values': 'sum'
                    }).reset_index()
                    
                    result['kraken'] = treemap_agg.to_dict(orient='records')
                    logger.info(f"Processed {len(treemap_agg)} Kraken treemap entries")

            # Process Contigs data
            contigs_df = pd.read_parquet(self.contigs_table_path)
            contigs_sample = contigs_df[contigs_df['sample_id'] == sample_id].copy()
            
            if not contigs_sample.empty:
                # Remove unclassified and empty lineages
                contigs_sample = contigs_sample[
                    (contigs_sample['lineage'] != 'Unclassified') & 
                    (contigs_sample['lineage'] != '') & 
                    (contigs_sample['lineage'].notna())
                ]
                
                if not contigs_sample.empty:
                    treemap_data = []
                    for _, row in contigs_sample.iterrows():
                        lineage_str = row['lineage']
                        abundance = row['scaffold_rel_abundance']
                        
                        # Split lineage
                        parts = [part.strip() for part in lineage_str.split(';') if part.strip()]
                        
                        # Create hierarchy entries
                        for i in range(len(parts)):
                            current_level = parts[:i+1]
                            parent_level = parts[:i] if i > 0 else []
                            
                            treemap_data.append({
                                'ids': ' > '.join(current_level),
                                'labels': parts[i],
                                'parents': ' > '.join(parent_level) if parent_level else '',
                                'values': float(abundance),
                                'level': i
                            })
                    
                    # Convert to DataFrame and aggregate
                    treemap_df = pd.DataFrame(treemap_data)
                    treemap_agg = treemap_df.groupby(['ids', 'labels', 'parents', 'level']).agg({
                        'values': 'sum'
                    }).reset_index()
                    
                    result['contigs'] = treemap_agg.to_dict(orient='records')
                    logger.info(f"Processed {len(treemap_agg)} Contigs treemap entries")

            return result

        except Exception as e:
            logger.error(f"Error processing taxonomic treemap for sample {sample_id}: {str(e)}")
            return {} 