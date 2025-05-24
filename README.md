# NMDC CDM Browser

A web application for browsing and visualizing data from the National Microbiome Data Collaborative (NMDC) Common Data Model (CDM).

## Features

- Interactive map visualization of study locations
- Study cards with detailed information
- Statistical summaries of studies and samples
- Search and filter capabilities
- Detailed study information pages

## Project Structure

```
.
├── data/                  # Raw data files (parquet format)
├── frontend/             # React frontend application
├── processed_data/       # Processed data files
└── src/                  # Python backend code
    ├── api/             # FastAPI backend
    └── data_processing/ # Data processing scripts
```

## Setup

### Backend Setup

1. Create a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Process the data:
   ```bash
   cd src/data_processing
   python process_data.py
   ```

4. Start the backend server:
   ```bash
   cd src/api
   python main.py
   ```

### Frontend Setup

1. Install Node.js dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

## Usage

1. The backend API will be available at `http://localhost:8000`
2. The frontend application will be available at `http://localhost:3000`

## API Endpoints

- `/api/studies/summary` - Get summary statistics
- `/api/studies/geographic` - Get geographic distribution data
- `/api/studies/cards` - Get study card data
- `/api/studies/{study_id}` - Get detailed study information

## Development

- Backend code is in Python using FastAPI
- Frontend code is in TypeScript using React
- Data processing is done using pandas and dask
- Map visualization uses Leaflet.js 