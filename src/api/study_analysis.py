"""
API endpoints for study-specific analysis in NMDC CDM Browser.
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Optional
from src.data_processing.study_analysis_processor import StudyAnalysisProcessor

router = APIRouter()
processor = StudyAnalysisProcessor()

@router.get("/study/{study_id}/analysis")
async def get_study_analysis(study_id: str) -> Dict:
    """Get complete analysis for a specific study."""
    try:
        return processor.get_study_analysis(study_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/study/{study_id}/analysis/{component}")
async def get_study_component(study_id: str, component: str) -> Dict:
    """Get specific component of study analysis."""
    try:
        analysis = processor.get_study_analysis(study_id)
        if component not in analysis:
            raise HTTPException(
                status_code=404,
                detail=f"Component {component} not found in study analysis"
            )
        return analysis[component]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 