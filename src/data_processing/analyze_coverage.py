"""
Script to analyze data coverage across studies.
"""
import sys
from pathlib import Path

# Add the src directory to the Python path
src_dir = Path(__file__).parent.parent
sys.path.append(str(src_dir.parent))

from src.data_processing.study_analysis_processor import StudyAnalysisProcessor

def main():
    processor = StudyAnalysisProcessor()
    coverage = processor.analyze_data_coverage()
    
    print('Total studies:', coverage['total_studies'])
    print('\nStudies with good coverage:', coverage['studies_with_good_coverage'])
    
    print('\nCoverage summary:')
    print('\nOmics and Taxonomic Data:')
    for data_type, count in coverage['coverage_summary'].items():
        if data_type != 'physical_variables':
            print(f'- {data_type}: {count} studies')
    
    print('\nPhysical Variables:')
    for var, count in coverage['coverage_summary']['physical_variables'].items():
        print(f'- {var}: {count} studies')
    
    print('\nTop 3 studies with best coverage:')
    for study in coverage['good_coverage_studies'][:3]:
        print(f'\nStudy {study["study_id"]}:')
        print('Omics and Taxonomic Data:')
        for data_type in ['metabolomics', 'lipidomics', 'proteomics', 'gottcha', 'kraken', 'centrifuge', 'contigs']:
            print(f'- {data_type}: {study["coverage"][data_type]} samples ({study["coverage"][f"{data_type}_coverage"]*100:.1f}%)')
        
        print('\nPhysical Variables:')
        physical_vars = [k for k in study["coverage"].keys() if k.startswith('physical_') and not k.endswith('_coverage')]
        for var in physical_vars:
            var_name = var.replace('physical_', '')
            print(f'- {var_name}: {study["coverage"][var]} samples ({study["coverage"][f"{var}_coverage"]*100:.1f}%)')

if __name__ == "__main__":
    main() 