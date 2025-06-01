from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from typing import Dict, List, Optional
import logging
from . import statistics
from . import llm_summarizer
from .study_analysis import router as study_analysis_router
from .routers import studies, samples
from ..data_processing.study_analysis_processor import StudyAnalysisProcessor
from src.api.study_detail_summarizer import StudyDetailSummarizer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="NMDC CDM Browser API",
    description="""
    API for the NMDC CDM Browser application. This API provides access to study metadata,
    statistics, and analysis results for the National Microbiome Data Collaborative (NMDC)
    Common Data Model (CDM) Browser.
    
    ## Features
    * Study metadata and summaries
    * Geographic distribution of samples
    * Statistical analysis of ecosystem and physical variables
    * Omics data analysis
    * Taxonomic analysis
    * AI-generated summaries
    """,
    version="1.0.0",
    root_path="/cdm-browser-api",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    servers=[{"url": "https://genomics.lbl.gov/cdm-browser-api", "description": "Production server"}]
)

# Add CORS middleware with more specific configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Include the statistics router
app.include_router(statistics.router, prefix="/api/statistics", tags=["statistics"])

# Include the study analysis router
app.include_router(study_analysis_router, prefix="/api", tags=["study-analysis"])

# Include the studies router
app.include_router(studies.router, prefix="/api/study", tags=["studies"])

# Include the samples router
app.include_router(samples.router, prefix="/api/sample", tags=["samples"])

# Load processed data
def load_summary_data() -> Dict:
    """
    Load the processed study summary data from JSON file.
    
    Returns:
        Dict: A dictionary containing:
            - summary_stats: Overall statistics about studies
            - geographic_distribution: Sample locations and counts
            - measurement_coverage: Coverage of different measurement types
            - study_cards: Detailed information about each study
    """
    try:
        project_root = Path(__file__).parent.parent.parent
        file_path = project_root / "processed_data" / "study_summary.json"
        with open(file_path, "r") as f:
            data = json.load(f)
            return data
    except FileNotFoundError:
        logger.warning("Study summary file not found, returning empty data")
        return {
            "summary_stats": {},
            "geographic_distribution": [],
            "measurement_coverage": {},
            "study_cards": []
        }
    except json.JSONDecodeError:
        logger.error("Error decoding study summary JSON")
        return {
            "summary_stats": {},
            "geographic_distribution": [],
            "measurement_coverage": {},
            "study_cards": []
        }

# Initialize processors
processor = StudyAnalysisProcessor()
summarizer = StudyDetailSummarizer()

@app.get("/")
async def root():
    return {
        "name": "NMDC CDM Browser API",
        "version": "1.0.0",
        "description": "API for browsing and analyzing NMDC Common Data Model data"
    }

@app.get("/api/studies/summary")
async def get_study_summary():
    data = load_summary_data()
    return data["summary_stats"]

@app.get("/api/studies/geographic",
    response_model=List[Dict],
    summary="Get geographic distribution",
    description="Retrieve the geographic distribution of all samples across studies",
    responses={
        200: {
            "description": "Geographic distribution retrieved successfully",
            "content": {
                "application/json": {
                    "example": [{
                        "latitude": 37.7749,
                        "longitude": -122.4194,
                        "study_id": "nmdc:sty-11-34xj1150",
                        "sample_count": 10
                    }]
                }
            }
        }
    }
)
async def get_geographic_distribution():
    """
    Get the geographic distribution of all samples.
    
    Returns:
        List[Dict]: List of locations with sample counts
    """
    logger.info("Fetching geographic distribution data")
    data = load_summary_data()
    return data["geographic_distribution"]

@app.get("/api/studies/measurements")
async def get_measurement_coverage():
    data = load_summary_data()
    return data["measurement_coverage"]

@app.get("/api/studies/cards")
async def get_study_cards():
    data = load_summary_data()
    return data["study_cards"]

@app.get("/api/studies/{study_id}", 
    response_model=Dict,
    summary="Get study details",
    description="Retrieve detailed information about a specific study by its ID",
    responses={
        200: {
            "description": "Study details retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": "nmdc:sty-11-34xj1150",
                        "name": "Example Study",
                        "description": "Study description",
                        "sample_count": 100
                    }
                }
            }
        },
        404: {
            "description": "Study not found"
        }
    }
)
async def get_study(study_id: str):
    """
    Get detailed information about a specific study.
    
    Args:
        study_id (str): The unique identifier of the study
        
    Returns:
        Dict: Study details including metadata and statistics
        
    Raises:
        HTTPException: If study is not found
    """
    logger.info(f"Fetching study details for {study_id}")
    data = load_summary_data()
    study = next((s for s in data["study_cards"] if s["id"] == study_id), None)
    
    if not study:
        logger.warning(f"Study not found: {study_id}")
        raise HTTPException(status_code=404, detail=f"Study {study_id} not found")
        
    return study

@app.get("/api/summary/ai",
    response_model=Dict,
    summary="Get AI-generated summary",
    description="Retrieve an AI-generated summary of the compendium's scope and findings",
    responses={
        200: {
            "description": "AI summary retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "summary": "Comprehensive analysis of the compendium...",
                        "last_updated": "2024-03-21T12:00:00Z",
                        "data_version": "1.0.0",
                        "token_count": 1000
                    }
                }
            }
        }
    }
)
async def get_ai_summary(force: bool = False):
    """
    Get an AI-generated summary of the compendium.
    
    Args:
        force (bool): If True, force generation of a new summary even if cached
        
    Returns:
        Dict: AI-generated summary with metadata
        
    Raises:
        HTTPException: If summary generation fails
    """
    try:
        # Check for cached summary first, unless force refresh is requested
        if not force:
            cache_path = Path(__file__).parent.parent.parent / "processed_data" / "ai_summary.json"
            if cache_path.exists():
                with open(cache_path, "r") as f:
                    cached = json.load(f)
                    return cached
        
        # Generate new summary
        return llm_summarizer.llm_service.generate_summary()
        
    except Exception as e:
        logger.error(f"Error generating AI summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/test/physical-variable/{study_id}/{variable}")
async def test_physical_variable(study_id: str, variable: str):
    """Test endpoint for processing a single physical variable."""
    try:
        processor = StudyAnalysisProcessor()
        study_samples = processor._get_study_samples(study_id)
        result = processor._process_physical_variables(study_id, study_samples)
        if variable in result:
            return result[variable]
        else:
            return {"error": f"Variable {variable} not found in study {study_id}"}
    except Exception as e:
        logger.error(f"Error processing variable {variable} for study {study_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/studies/{study_id}/summary/ai")
async def get_study_ai_summary(study_id: str, force: bool = False):
    """
    Get AI-generated summary for a specific study.
    
    Args:
        study_id (str): The unique identifier of the study
        force (bool): If true, forces regeneration of the summary
        
    Returns:
        Dict: AI-generated summary with sections and metadata
        
    Raises:
        HTTPException: If study is not found or summary generation fails
    """
    try:
        logger.info(f"Generating AI summary for study {study_id} (force={force})")
        summary = summarizer.generate_summary(study_id, force=force)
        return summary
    except Exception as e:
        logger.error(f"Error generating AI summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 