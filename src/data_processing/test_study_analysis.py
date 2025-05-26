"""
Test script for StudyAnalysisProcessor.
"""
import logging
from pathlib import Path
import pandas as pd
from src.data_processing.study_analysis_processor import StudyAnalysisProcessor
import unittest
import time
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def analyze_study_data_coverage(processor: StudyAnalysisProcessor) -> pd.DataFrame:
    """Analyze which studies have what types of data."""
    logger.info("\nAnalyzing study data coverage...")
    
    # Load study and sample data
    study_df = pd.read_parquet(processor.data_dir / "study_table_snappy.parquet")
    sample_df = pd.read_parquet(processor.data_dir / "sample_table_snappy.parquet")
    
    # Define variables to check
    physical_vars = [
        'depth', 'latitude', 'longitude', 'ph', 'temp_has_numeric_value',
        'tot_carb', 'tot_nitro_numeric', 'nitrate_nitrogen_numeric',
        'nitrite_nitrogen_numeric', 'ammonium_nitrogen_numeric',
        'diss_inorg_nitro_has_numeric_value', 'diss_org_carb_has_numeric_value',
        'diss_inorg_carb_has_numeric_value', 'tot_org_carb', 'carb_nitro_ratio',
        'iron_numeric', 'calcium_numeric', 'magnesium_numeric', 'manganese_numeric',
        'zinc_numeric', 'sodium_has_numeric_value', 'potassium_numeric'
    ]
    
    omics_vars = ['metabolomics', 'lipidomics', 'proteomics']
    taxonomic_vars = ['gottcha', 'kraken', 'centrifuge', 'contigs']
    
    # Initialize results DataFrame
    results = []
    
    for _, study in study_df.iterrows():
        study_id = study['id']
        study_samples = sample_df[sample_df['study_id'] == study_id]
        
        # Count physical variables with data
        physical_count = sum(
            1 for var in physical_vars 
            if var in study_samples.columns and study_samples[var].notna().any()
        )
        
        # Count omics types
        omics_count = sum(
            1 for var in omics_vars
            if study.get(f'{var}_processed', 0) > 0
        )
        
        # Count taxonomic types
        taxonomic_count = sum(
            1 for var in taxonomic_vars
            if study.get(f'{var}_processed', 0) > 0
        )
        
        results.append({
            'study_id': study_id,
            'name': study['name'],
            'physical_vars': physical_count,
            'omics_types': omics_count,
            'taxonomic_types': taxonomic_count,
            'sample_count': len(study_samples)
        })
    
    return pd.DataFrame(results)

def test_study_analysis():
    """Test the StudyAnalysisProcessor with multiple studies."""
    processor = StudyAnalysisProcessor()
    
    # Get study coverage analysis
    coverage_df = analyze_study_data_coverage(processor)
    
    # Sort by total data coverage
    coverage_df['total_coverage'] = (
        coverage_df['physical_vars'] + 
        coverage_df['omics_types'] + 
        coverage_df['taxonomic_types']
    )
    coverage_df = coverage_df.sort_values('total_coverage', ascending=False)
    
    # Select top 5 studies with good coverage
    top_studies = coverage_df.head(5)
    
    logger.info("\nTesting multiple studies with good data coverage:")
    for _, study in top_studies.iterrows():
        study_id = study['study_id']
        logger.info(f"\n{'='*80}")
        logger.info(f"Testing study: {study['name']} ({study_id})")
        logger.info(f"Sample count: {study['sample_count']}")
        logger.info(f"Physical variables: {study['physical_vars']}")
        logger.info(f"Omics types: {study['omics_types']}")
        logger.info(f"Taxonomic types: {study['taxonomic_types']}")
        
        try:
            # Get analysis
            analysis = processor.get_study_analysis(study_id)
            
            # Test physical variables
            logger.info("\nPhysical Variables Analysis:")
            for var, stats in analysis['physical'].items():
                if stats.get('status') == 'ok':
                    logger.info(f"\n{var} statistics:")
                    logger.info(f"Study mean: {stats['mean']}")
                    logger.info(f"Compendium mean: {stats['compendium_mean']}")
                    logger.info(f"P-value: {stats['p_value']}")
                    logger.info(f"Significant: {stats['significant']}")
                    logger.info(f"Effect size: {stats['effect_size']}")
                    logger.info(f"Study count: {stats['count']}")
                    logger.info(f"Compendium study count: {stats['compendium_study_count']}")
            
            # Test omics data
            logger.info("\nOmics Analysis:")
            for omics_type in ['metabolomics', 'lipidomics', 'proteomics']:
                logger.info(f"\nProcessing {omics_type}...")
                top10 = analysis['omics']['top10'].get(omics_type, [])
                outliers = analysis['omics']['outliers'].get(omics_type, [])
                logger.info(f"Top 10 items: {len(top10)}")
                logger.info(f"Outlier items: {len(outliers)}")
            
            # Test taxonomic data
            logger.info("\nTaxonomic Analysis:")
            for tax_type in ['gottcha', 'kraken', 'centrifuge', 'contigs']:
                logger.info(f"\nProcessing {tax_type}...")
                top10 = analysis['taxonomic']['top10'].get(tax_type, [])
                outliers = analysis['taxonomic']['outliers'].get(tax_type, [])
                logger.info(f"Top 10 items: {len(top10)}")
                logger.info(f"Outlier items: {len(outliers)}")
                
        except Exception as e:
            logger.error(f"Error processing study {study_id}: {str(e)}")

class TestStudyAnalysisProcessor(unittest.TestCase):
    def setUp(self):
        self.processor = StudyAnalysisProcessor()
        
    def test_initial_processing(self):
        """Test initial processing of all studies"""
        # Get coverage analysis
        coverage = self.processor.analyze_data_coverage()
        
        # Verify basic structure
        self.assertIn('total_studies', coverage)
        self.assertIn('coverage_summary', coverage)
        self.assertIn('good_coverage_studies', coverage)
        
        # Verify we have data
        self.assertGreater(coverage['total_studies'], 0)
        # Check that we have at least one study with physical variable data
        has_physical_data = any(
            any(key.startswith('physical_') and value > 0 
                for key, value in study_data.items())
            for study_data in coverage['coverage_summary'].values()
        )
        self.assertTrue(has_physical_data)
        
    def test_cache_behavior(self):
        """Test caching behavior and invalidation"""
        # First run
        start_time = time.time()
        coverage1 = self.processor.analyze_data_coverage()
        first_run_time = time.time() - start_time
        
        # Second run (should use cache)
        start_time = time.time()
        coverage2 = self.processor.analyze_data_coverage()
        second_run_time = time.time() - start_time
        
        # Verify cache is working (second run should be faster)
        self.assertLess(second_run_time, first_run_time)
        
        # Verify results are consistent
        self.assertEqual(coverage1['total_studies'], coverage2['total_studies'])
        
    def test_study_specific_analysis(self):
        """Test analysis for specific studies"""
        # Get coverage analysis
        coverage = self.processor.analyze_data_coverage()
        
        # Get the study with the highest total score
        all_studies = []
        for study_id, study_coverage in coverage['coverage_summary'].items():
            # Calculate total score from coverage data
            total_score = (
                study_coverage.get('metabolomics', 0) +
                study_coverage.get('lipidomics', 0) +
                study_coverage.get('proteomics', 0) +
                study_coverage.get('gottcha', 0) +
                study_coverage.get('kraken', 0) +
                study_coverage.get('centrifuge', 0) +
                study_coverage.get('contigs', 0)
            )
            all_studies.append((study_id, total_score))
        
        # Sort by total score and get the top study
        all_studies.sort(key=lambda x: x[1], reverse=True)
        if not all_studies:
            self.skipTest("No studies found with data coverage")
        study_id = all_studies[0][0]
        
        # Get detailed analysis
        analysis = self.processor.get_study_analysis(study_id)
        
        # Verify analysis structure
        self.assertIn('physical', analysis)
        self.assertIn('omics', analysis)
        self.assertIn('taxonomic', analysis)
        
    def test_error_handling(self):
        """Test error handling with invalid study ID"""
        with self.assertRaises(ValueError):
            self.processor.get_study_analysis('invalid_study_id')
            
    def test_data_modification_detection(self):
        """Test that cache is cleared when data files are modified"""
        # Initial run
        coverage1 = self.processor.analyze_data_coverage()
        
        # Create a temporary file to modify
        temp_file = self.processor.data_dir / "temp_test_file.txt"
        with open(temp_file, 'w') as f:
            f.write("test")
        
        # Get the modification time before updating the processor
        temp_file_mtime = os.path.getmtime(temp_file)
        
        # Update the processor's last_file_modification to be older than the temp file
        self.processor.last_file_modification = temp_file_mtime - 5  # Use 5 seconds difference
        
        # Run again - should detect the newer temp file and clear cache
        coverage2 = self.processor.analyze_data_coverage()
        
        # Clean up
        os.remove(temp_file)
        
        # Verify cache was cleared by checking if the processor's last_file_modification
        # was updated to be newer than our old timestamp
        self.assertGreater(
            self.processor.last_file_modification,
            temp_file_mtime - 5,
            "Cache was not cleared - last_file_modification was not updated"
        )
        
        # Additional verification that cache was actually cleared
        self.assertEqual(
            len(self.processor.cache),
            0,
            "Cache was not cleared - cache dictionary is not empty"
        )

if __name__ == "__main__":
    unittest.main() 