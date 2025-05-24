from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from typing import Dict, List
import logging
from . import statistics

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NMDC CDM Browser API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the statistics router
app.include_router(statistics.router, prefix="/api/statistics", tags=["statistics"])

# Load processed data
def load_summary_data() -> Dict:
    try:
        project_root = Path(__file__).parent.parent.parent
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

@app.get("/")
async def root():
    return {"message": "Welcome to NMDC CDM Browser API"}

@app.get("/api/studies/summary")
async def get_study_summary():
    data = load_summary_data()
    return data["summary_stats"]

@app.get("/api/studies/geographic")
async def get_geographic_distribution():
    logger.info("Fetching geographic distribution data")
    data = load_summary_data()
    logger.info(f"Geographic distribution data keys: {list(data.keys())}")
    return data["geographic_distribution"]

@app.get("/api/studies/measurements")
async def get_measurement_coverage():
    data = load_summary_data()
    return data["measurement_coverage"]

@app.get("/api/studies/cards")
async def get_study_cards():
    data = load_summary_data()
    return data["study_cards"]

@app.get("/api/studies/{study_id}")
async def get_study_details(study_id: str):
    data = load_summary_data()
    for card in data["study_cards"]:
        if card["id"] == study_id:
            return card
    raise HTTPException(status_code=404, detail="Study not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 