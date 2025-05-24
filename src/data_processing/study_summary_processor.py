import pandas as pd
import dask.dataframe as dd
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import json
from datetime import datetime
import logging
import numpy as np

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StudySummaryProcessor:
    def __init__(self, data_dir: Optional[str] = None):
        # Get the project root directory (2 levels up from this file)
        project_root = Path(__file__).parent.parent.parent
        self.data_dir = Path(data_dir) if data_dir else project_root / "data"
        logger.info(f"Using data directory: {self.data_dir.absolute()}")
        self._study_df = None
        self._sample_df = None
        
    @property
    def study_df(self) -> pd.DataFrame:
        """Lazy load study data"""
        if self._study_df is None:
            logger.info("Loading study data...")
            study_file = self.data_dir / "study_table_snappy.parquet"
            logger.info(f"Looking for study data at: {study_file.absolute()}")
            self._study_df = pd.read_parquet(study_file)
            # Convert add_date to datetime if it's not already
            if 'add_date' in self._study_df.columns:
                self._study_df['add_date'] = pd.to_datetime(self._study_df['add_date'], errors='coerce')
            logger.info(f"Loaded {len(self._study_df)} studies")
        return self._study_df
    
    @property
    def sample_df(self) -> pd.DataFrame:
        """Lazy load sample data"""
        if self._sample_df is None:
            logger.info("Loading sample data...")
            sample_file = self.data_dir / "sample_table_snappy.parquet"
            logger.info(f"Looking for sample data at: {sample_file.absolute()}")
            self._sample_df = pd.read_parquet(sample_file)
            # Clean up ecosystem data
            self._sample_df['ecosystem'] = self._sample_df['ecosystem'].replace('', 'Unknown')
            logger.info(f"Loaded {len(self._sample_df)} samples")
        return self._sample_df
    
    def get_measurement_types(self, study_id: str) -> List[str]:
        """Get all measurement types available for a study"""
        measurement_types = []
        
        # Check study table for processed flags
        study = self.study_df[self.study_df['id'] == study_id].iloc[0]
        
        if study.get('proteomics_processed'):
            measurement_types.append('proteomics')
        if study.get('metabolomics_processed'):
            measurement_types.append('metabolomics')
        if study.get('lipidomics_processed'):
            measurement_types.append('lipidomics')
        if study.get('metagenome_processed'):
            measurement_types.append('metagenomics')
        if study.get('metatranscriptome_processed'):
            measurement_types.append('metatranscriptomics')
            
        return measurement_types
    
    def get_study_summary_stats(self) -> Dict:
        """Generate summary statistics for all studies"""
        logger.info("Generating study summary stats...")
        
        # Get unique sample locations
        geo_samples = self.sample_df[
            self.sample_df["latitude"].notna() & 
            self.sample_df["longitude"].notna()
        ]
        unique_locations = geo_samples.groupby(["latitude", "longitude"]).size().sum()
        
        # Basic statistics
        stats = {
            "total_studies": len(self.study_df),
            "total_samples": unique_locations,  # Count unique locations instead of all samples
            "date_range": {
                "start": self.study_df["add_date"].min().isoformat() if pd.notnull(self.study_df["add_date"].min()) else None,
                "end": self.study_df["add_date"].max().isoformat() if pd.notnull(self.study_df["add_date"].max()) else None
            }
        }
        
        # Ecosystem distribution
        ecosystem_counts = self.sample_df["ecosystem"].value_counts().to_dict()
        stats["ecosystem_distribution"] = ecosystem_counts
        
        # Measurement type coverage
        measurement_coverage = {}
        for _, study in self.study_df.iterrows():
            measurement_coverage[study['id']] = self.get_measurement_types(study['id'])
        stats["measurement_coverage"] = measurement_coverage

        # Time series data for samples over time
        if 'add_date' in self.study_df.columns:
            # Filter out NaT values before grouping
            valid_dates = self.study_df[self.study_df['add_date'].notna()]
            if not valid_dates.empty:
                time_series = valid_dates.groupby(
                    pd.Grouper(key='add_date', freq='ME')
                ).size().reset_index().rename(columns={0: 'count'})
                stats["time_series"] = {
                    "dates": time_series['add_date'].dt.strftime('%Y-%m-%d').tolist(),
                    "counts": time_series['count'].tolist()
                }
        
        # Measurement type distribution
        measurement_distribution = {}
        for measurement in ['metagenome_processed', 'metatranscriptome_processed', 
                          'proteomics_processed', 'metabolomics_processed', 
                          'lipidomics_processed', 'mags_analysis']:
            if measurement in self.study_df.columns:
                measurement_distribution[measurement] = {
                    "total": int(self.study_df[measurement].sum()),
                    "studies": int((self.study_df[measurement] > 0).sum()),
                    "mean_per_study": float(self.study_df[measurement].mean())
                }
        stats["measurement_distribution"] = measurement_distribution

        # Ecosystem type distribution
        ecosystem_type_distribution = {}
        for col in ['ecosystem_category', 'ecosystem_type', 'ecosystem_subtype']:
            if col in self.sample_df.columns:
                ecosystem_type_distribution[col] = self.sample_df[col].value_counts().to_dict()
        stats["ecosystem_type_distribution"] = ecosystem_type_distribution

        # Sample count statistics
        if "sample_count" not in self.study_df.columns:
            # Calculate sample counts from sample_df
            sample_counts = self.sample_df.groupby("study_id").size().to_dict()
            self.study_df["sample_count"] = self.study_df["id"].map(lambda x: sample_counts.get(str(x), 0))
            logger.info(f"Calculated sample counts for {len(sample_counts)} studies")
        
        sample_counts = self.study_df["sample_count"].fillna(0)
        stats["sample_count_stats"] = {
            "mean": float(sample_counts.mean()),
            "median": float(sample_counts.median()),
            "min": int(sample_counts.min()),
            "max": int(sample_counts.max()),
            "std": float(sample_counts.std())
        }
        logger.info(f"Generated sample count stats: {stats['sample_count_stats']}")
        
        logger.info("Study summary stats generated")
        return stats
    
    def get_geographic_distribution(self) -> List[Dict]:
        """Generate geographic distribution data for mapping"""
        logger.info("Generating geographic distribution...")
        
        # Filter samples with valid coordinates
        geo_samples = self.sample_df[
            self.sample_df["latitude"].notna() & 
            self.sample_df["longitude"].notna()
        ]
        
        # Convert coordinates to float
        geo_samples["latitude"] = pd.to_numeric(geo_samples["latitude"], errors='coerce')
        geo_samples["longitude"] = pd.to_numeric(geo_samples["longitude"], errors='coerce')
        
        # Filter out any invalid coordinates after conversion
        geo_samples = geo_samples[
            geo_samples["latitude"].notna() & 
            geo_samples["longitude"].notna()
        ]
        
        # Group by coordinates and study_id, then count samples
        geo_distribution = geo_samples.groupby(
            ["latitude", "longitude", "study_id"]
        ).size().reset_index().rename(columns={0: "sample_count"})
        
        # Convert to list of dictionaries with proper numeric types
        result = []
        for _, row in geo_distribution.iterrows():
            result.append({
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "study_id": str(row["study_id"]),
                "sample_count": int(row["sample_count"])
            })
        
        logger.info(f"Generated distribution for {len(result)} locations")
        return result
    
    def get_study_distinguishing_features(self, study_id: str) -> Dict:
        """Identify unique characteristics of a study"""
        study = self.study_df[self.study_df['id'] == study_id].iloc[0]
        study_samples = self.sample_df[self.sample_df['study_id'] == study_id]
        
        features = {
            "ecosystem": study.get('ecosystem'),
            "ecosystem_category": study.get('ecosystem_category'),
            "ecosystem_subtype": study.get('ecosystem_subtype'),
            "ecosystem_type": study.get('ecosystem_type'),
            "measurement_types": self.get_measurement_types(study_id),
            "sample_count": len(study_samples),
            "environmental_features": {}
        }
        
        # Get unique environmental features
        for col in ['depth', 'temperature', 'ph', 'salinity']:
            if col in study_samples.columns and study_samples[col].notna().any():
                features["environmental_features"][col] = {
                    "min": float(study_samples[col].min()),
                    "max": float(study_samples[col].max()),
                    "mean": float(study_samples[col].mean())
                }
        
        return features
    
    def generate_study_cards(self) -> List[Dict]:
        """Generate data for study cards"""
        logger.info("Generating study cards...")
        
        study_cards = []
        
        for _, study in self.study_df.iterrows():
            study_id = str(study["id"])  # Ensure study_id is a string
            # Get samples for this study
            study_samples = self.sample_df[self.sample_df["study_id"] == study_id]
            
            # Get primary ecosystem
            primary_ecosystem = study_samples["ecosystem"].mode().iloc[0] if not study_samples["ecosystem"].empty else None
            
            # Get quantitative measurements
            quantitative_measurements = {}
            for col in self.sample_df.columns:
                if col.startswith("has_") and col.endswith("_measurement"):
                    measurement_type = col[4:-12]  # Remove 'has_' prefix and '_measurement' suffix
                    count = study_samples[col].sum()
                    if count > 0:
                        quantitative_measurements[measurement_type] = int(count)
            
            # Get geographic data
            geo_samples = study_samples[
                study_samples["latitude"].notna() & 
                study_samples["longitude"].notna()
            ]
            
            # Calculate average coordinates if available
            latitude = geo_samples["latitude"].mean() if not geo_samples.empty else None
            longitude = geo_samples["longitude"].mean() if not geo_samples.empty else None
            
            # Get unique sample locations
            unique_locations = geo_samples.groupby(["latitude", "longitude"]).size().reset_index()
            sample_locations = []
            for _, location in unique_locations.iterrows():
                sample_locations.append({
                    "latitude": float(location["latitude"]),
                    "longitude": float(location["longitude"])
                })
            
            # Helper function to safely convert measurement counts
            def safe_int_convert(value, default=0):
                try:
                    if pd.isna(value):
                        return default
                    return int(float(value))
                except (ValueError, TypeError):
                    return default
            
            card = {
                "id": study_id,
                "name": study["name"],
                "description": study.get("description", ""),
                "sample_count": len(unique_locations),  # Count unique locations instead of all samples
                "measurement_types": self.get_measurement_types(study_id),
                "primary_ecosystem": primary_ecosystem,
                "add_date": study["add_date"].isoformat() if pd.notnull(study["add_date"]) else None,
                # Add new fields with safe conversion
                "lipidomics_processed": safe_int_convert(study.get("lipidomics_processed")),
                "mags_analysis": safe_int_convert(study.get("mags_analysis")),
                "metabolomics_processed": safe_int_convert(study.get("metabolomics_processed")),
                "metagenome_processed": safe_int_convert(study.get("metagenome_processed")),
                "metatranscriptome_processed": safe_int_convert(study.get("metatranscriptome_processed")),
                "nom_analysis": safe_int_convert(study.get("nom_analysis")),
                "proteomics_processed": safe_int_convert(study.get("proteomics_processed")),
                "read_based_analysis": safe_int_convert(study.get("read_based_analysis")),
                "reads_qc": safe_int_convert(study.get("reads_qc")),
                "ecosystem": study.get("ecosystem"),
                "ecosystem_category": study.get("ecosystem_category"),
                "ecosystem_subtype": study.get("ecosystem_subtype"),
                "ecosystem_type": study.get("ecosystem_type"),
                "quantitative_measurements": quantitative_measurements,
                # Add geographic data
                "latitude": float(latitude) if latitude is not None else None,
                "longitude": float(longitude) if longitude is not None else None,
                "sample_locations": sample_locations
            }
            study_cards.append(card)
        
        logger.info(f"Generated {len(study_cards)} study cards")
        return study_cards
    
    def process_all(self) -> Dict:
        """Process all data and return complete summary"""
        logger.info("Starting data processing...")
        result = {
            "summary_stats": self.get_study_summary_stats(),
            "geographic_distribution": self.get_geographic_distribution(),
            "study_cards": self.generate_study_cards()
        }
        logger.info(f"Final output keys: {list(result.keys())}")
        logger.info(f"Summary stats keys: {list(result['summary_stats'].keys())}")
        logger.info("Data processing completed")
        return result

if __name__ == "__main__":
    try:
        logger.info("Starting main execution...")
        processor = StudySummaryProcessor()
        logger.info("Created processor instance")
        
        summary_data = processor.process_all()
        logger.info("Got summary data, size: %d bytes", len(str(summary_data)))
        
        # Create processed_data directory if it doesn't exist
        output_dir = Path("processed_data")
        try:
            output_dir.mkdir(exist_ok=True)
            logger.info(f"Created/verified output directory: {output_dir.absolute()}")
        except Exception as e:
            logger.error(f"Failed to create output directory: {str(e)}")
            raise
        
        # Save processed data
        output_file = output_dir / "study_summary.json"
        logger.info(f"Attempting to write data to {output_file.absolute()}")
        try:
            with open(output_file, "w") as f:
                json.dump(summary_data, f, indent=2)
            logger.info(f"Successfully wrote {output_file.stat().st_size} bytes to {output_file}")
        except Exception as e:
            logger.error(f"Failed to write output file: {str(e)}")
            raise
        
        logger.info("Main execution completed successfully")
        
    except Exception as e:
        logger.error(f"Error in main execution: {str(e)}", exc_info=True)
        raise 