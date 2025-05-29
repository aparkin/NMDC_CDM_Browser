from fastapi import APIRouter, HTTPException
import logging
from typing import Dict
from ...data_processing.sample_analysis_processor import SampleAnalysisProcessor

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Initialize processor
processor = SampleAnalysisProcessor()

@router.get("/{sample_id}/analysis",
    response_model=Dict,
    summary="Get sample analysis",
    description="Retrieve complete analysis for a specific sample, including physical variables, omics data, and taxonomic analysis",
    responses={
        200: {
            "description": "Sample analysis retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": "nmdc:smp-11-34xj1150-1",
                        "study_id": "nmdc:sty-11-34xj1150",
                        "name": "Sample 1",
                        "collection_date": "2020-01-01",
                        "ecosystem": "soil",
                        "physical": {
                            "temperature": {
                                "status": "ok",
                                "value": 25.5,
                                "compendium": {"mean": 24.0, "std": 2.0},
                                "z_score": 0.75
                            }
                        },
                        "omics": {
                            "top10": {
                                "metabolites": [
                                    {"name": "Glucose", "abundance": 0.5}
                                ]
                            }
                        },
                        "taxonomic": {
                            "top10": {
                                "kraken": {
                                    "genus": [
                                        {"name": "Bacillus", "abundance": 0.3}
                                    ]
                                }
                            }
                        },
                        "location": {
                            "latitude": 37.7749,
                            "longitude": -122.4194
                        },
                        "functional_analysis": {
                            "product": {
                                "hypothetical protein": 0.15,
                                "DNA polymerase": 0.12
                            },
                            "pfam": {
                                "PF00001": 0.08,
                                "PF00002": 0.05
                            }
                        }
                    }
                }
            }
        },
        404: {
            "description": "Sample not found"
        },
        500: {
            "description": "Internal server error"
        }
    }
)
async def get_sample_analysis(sample_id: str, force_refresh: bool = False) -> Dict:
    """
    Get complete analysis for a specific sample.
    
    Args:
        sample_id (str): The unique identifier of the sample
        force_refresh (bool): If True, forces recalculation even if cache is valid
        
    Returns:
        Dict: Sample analysis including metadata, physical variables, omics data, and taxonomic analysis
        
    Raises:
        HTTPException: If sample is not found or analysis fails
    """
    try:
        logger.info(f"Processing analysis for sample {sample_id} (force_refresh={force_refresh})")
        analysis = processor.get_sample_analysis(sample_id, force_refresh=force_refresh)
        return analysis
    except ValueError as e:
        logger.warning(f"Sample not found: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing sample {sample_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 