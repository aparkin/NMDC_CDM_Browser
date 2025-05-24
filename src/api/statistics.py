from fastapi import APIRouter, HTTPException
from typing import Dict, List
from src.data_processing import StatisticsProcessor

router = APIRouter()
stats_processor = StatisticsProcessor()

@router.get("/timeline")
async def get_timeline_data() -> Dict:
    """Get timeline data for samples and studies"""
    try:
        return stats_processor.get_timeline_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ecosystem/{variable}")
async def get_ecosystem_statistics(variable: str) -> Dict:
    """Get statistics for a specific ecosystem variable"""
    try:
        return stats_processor.get_ecosystem_statistics(variable)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/physical/{variable}")
async def get_physical_variable_statistics(variable: str) -> Dict:
    """Get statistics for a specific physical variable"""
    try:
        return stats_processor.get_physical_variable_statistics(variable)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/omics/{omics_type}")
async def get_omics_statistics(omics_type: str) -> List[Dict]:
    """Get statistics for omics data"""
    try:
        return stats_processor.get_omics_statistics(omics_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/taxonomic/{analysis_type}")
async def get_taxonomic_statistics(analysis_type: str) -> Dict[str, List[Dict]]:
    """Get statistics for taxonomic analysis data"""
    try:
        return stats_processor.get_taxonomic_statistics(analysis_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 