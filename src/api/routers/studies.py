from fastapi import APIRouter, HTTPException
from typing import Dict, List
import json
from pathlib import Path
import logging
from src.data_processing.study_analysis_processor import StudyAnalysisProcessor

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()
processor = StudyAnalysisProcessor()

# Load processed data
def load_summary_data() -> Dict:
    try:
        project_root = Path(__file__).parent.parent.parent.parent
        file_path = project_root / "processed_data" / "study_summary.json"
        with open(file_path, "r") as f:
            data = json.load(f)
            return data
    except FileNotFoundError:
        return {
            "summary_stats": {},
            "geographic_distribution": [],
            "measurement_coverage": {},
            "study_cards": []
        }
    except json.JSONDecodeError:
        return {
            "summary_stats": {},
            "geographic_distribution": [],
            "measurement_coverage": {},
            "study_cards": []
        }

@router.get("/summary")
async def get_study_summary():
    """Get summary statistics for all studies."""
    data = load_summary_data()
    return data["summary_stats"]

@router.get("/geographic")
async def get_geographic_distribution():
    """Get geographic distribution of studies."""
    logger.info("Fetching geographic distribution data")
    data = load_summary_data()
    logger.info(f"Geographic distribution data keys: {list(data.keys())}")
    return data["geographic_distribution"]

@router.get("/measurements")
async def get_measurement_coverage():
    """Get measurement coverage across studies."""
    data = load_summary_data()
    return data["measurement_coverage"]

@router.get("/cards")
async def get_study_cards():
    """Get study cards with basic information."""
    data = load_summary_data()
    return data["study_cards"]

@router.get("/{study_id}")
async def get_study_details(study_id: str):
    """Get detailed information for a specific study."""
    data = load_summary_data()
    for card in data["study_cards"]:
        if card["id"] == study_id:
            return card
    raise HTTPException(status_code=404, detail="Study not found")

@router.get("/{study_id}/statistics")
async def get_study_statistics(study_id: str):
    """Get statistics for a specific study."""
    try:
        analysis = processor.get_study_analysis(study_id)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{study_id}/samples")
async def get_study_samples(study_id: str):
    """Get samples for a specific study."""
    try:
        logger.info(f"Fetching samples for study {study_id}")
        samples = processor.get_study_samples(study_id)
        if not samples:
            logger.warning(f"No samples found for study {study_id}")
            return []
        logger.info(f"Found {len(samples)} samples for study {study_id}")
        return samples
    except Exception as e:
        logger.error(f"Error getting samples for study {study_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting samples: {str(e)}") 