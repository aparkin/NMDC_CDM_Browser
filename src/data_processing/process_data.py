import logging
from study_summary_processor import StudySummaryProcessor
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    try:
        # Get project root and set up paths
        project_root = Path(__file__).parent.parent.parent
        data_dir = project_root / "data"
        processed_data_dir = project_root / "processed_data"
        
        # Initialize processor with correct paths
        processor = StudySummaryProcessor(data_dir=str(data_dir))
        
        # Generate summary data
        summary_stats = processor.get_study_summary_stats()
        geographic_distribution = processor.get_geographic_distribution()
        study_cards = processor.generate_study_cards()
        
        # Combine all data
        summary_data = {
            "summary_stats": summary_stats,
            "geographic_distribution": geographic_distribution,
            "study_cards": study_cards
        }
        
        # Log the structure of the data
        logger.info(f"Summary stats keys: {list(summary_stats.keys())}")
        logger.info(f"Sample count stats: {summary_stats.get('sample_count_stats')}")
        
        # Create processed_data directory if it doesn't exist
        processed_data_dir.mkdir(exist_ok=True)
        
        # Save to JSON file
        import json
        output_file = processed_data_dir / "study_summary.json"
        logger.info(f"Writing output to: {output_file.absolute()}")
        with open(output_file, "w") as f:
            json.dump(summary_data, f, indent=2)
            
        logger.info("Data processing completed successfully")
        
    except Exception as e:
        logger.error(f"Error processing data: {str(e)}")
        raise

if __name__ == "__main__":
    main() 