# NMDC CDM Browser Architecture

## System Overview

The NMDC CDM Browser is a full-stack web application designed to visualize and analyze data from the National Microbiome Data Collaborative (NMDC) Common Data Model (CDM). The application consists of a React frontend and a FastAPI backend, with data processing capabilities for various omics and environmental data types.

## Architecture Components

### Frontend (React + TypeScript)

#### Core Components
- `StudyMap`: Interactive map visualization using Leaflet.js
- `StatisticsView`: Statistical analysis and visualization
- `StudyList`: Study browsing and filtering interface
- `Layout`: Application layout and navigation

#### Key Dependencies
- **UI Framework**: Material-UI (MUI) v7
- **Map Visualization**: 
  - Leaflet.js v1.9.4
  - Leaflet.MarkerCluster v1.5.3
- **Data Visualization**:
  - Plotly.js v2.29.0
  - Recharts v2.15.3
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router v7
- **HTTP Client**: Axios v1.9.0

### Backend (Python + FastAPI)

#### Core Components
- `StatisticsProcessor`: Handles statistical analysis of omics data
- `StudySummaryProcessor`: Processes study metadata and summaries
- `DataLoader`: Manages data loading and caching

#### Key Dependencies
- **Web Framework**: FastAPI
- **Data Processing**: 
  - Pandas
  - Dask
- **Data Storage**: Parquet files
- **API Documentation**: OpenAPI/Swagger

## Data Flow

1. **Data Ingestion**
   - Raw data is stored in Parquet format
   - Data is processed and cached for quick access
   - Metadata is extracted and indexed

2. **API Layer**
   - RESTful endpoints for data access
   - Statistical analysis endpoints
   - Study metadata endpoints

3. **Frontend Processing**
   - Data fetching and caching using React Query
   - Client-side data processing for visualizations
   - Real-time updates and filtering

## Key Features

### Map Visualization
- Interactive study location mapping
- Sample point clustering
- Study information popups
- Color-coded study markers

### Statistical Analysis
- Timeline visualization
- Ecosystem distribution analysis
- Physical variable statistics
- Omics data analysis (metabolomics, lipidomics, proteomics)
- Taxonomic analysis

### Data Management
- Efficient data loading and caching
- Progressive data loading
- Error handling and recovery
- Data validation and sanitization

### Data Processing and Cache Management

#### Cache Locations
- `processed_data/study_analysis_cache/`: Contains individual study analysis results
- `processed_data/study_summary.json`: Contains overall study summary data

#### Cache Clearing Procedures
When making changes to data processing logic (e.g., species count calculations, taxonomic analysis), follow these steps:

1. Clear the cache files:
   ```bash
   rm -rf processed_data/study_analysis_cache/* processed_data/study_summary.json
   ```

2. Regenerate the data:
   ```bash
   python src/data_processing/process_data.py
   ```

This ensures that:
- Individual study analyses are recalculated with updated logic
- Study-wide statistics are regenerated
- All data tables and visualizations reflect the latest processing methods

Note: The preprocessing script handles:
- Loading and processing sample data
- Generating study summaries
- Creating geographic distributions
- Calculating statistical measures

### Application Startup Procedures

#### Development Environment Setup
1. **Data Processing**
   - Ensure all raw data files are in the `data/` directory
   - Run preprocessing to generate initial cache:
     ```bash
     python src/data_processing/process_data.py
     ```
   - Verify `processed_data/study_summary.json` and `processed_data/study_analysis_cache/` are populated

2. **Backend Startup**
   - Activate Python virtual environment:
     ```bash
     source venv/bin/activate  # Unix/MacOS
     # or
     .\venv\Scripts\activate  # Windows
     ```
   - Install dependencies:
     ```bash
     pip install -r requirements.txt
     ```
   - Start the FastAPI backend:
     ```bash
     uvicorn src.main:app --reload
     ```
   - Verify backend is running at `http://localhost:8000`

3. **Frontend Startup**
   - Install Node.js dependencies:
     ```bash
     cd frontend
     npm install
     ```
   - Start the development server:
     ```bash
     npm start
     ```
   - Verify frontend is running at `http://localhost:3000`

#### Production Deployment
1. **Data Processing**
   - Run preprocessing script on the server
   - Ensure cache directories are properly populated
   - Verify file permissions for the web server

2. **Backend Deployment**
   - Build and deploy the FastAPI application
   - Configure environment variables
   - Set up proper logging and monitoring

3. **Frontend Deployment**
   - Build the React application:
     ```bash
     cd frontend
     npm run build
     ```
   - Deploy the built files to the web server
   - Configure reverse proxy settings

Note: Always ensure data processing is complete and caches are properly generated before starting the backend service. The frontend depends on the backend being available and properly configured.

## Performance Considerations

### Frontend
- Component lazy loading
- Marker clustering for map performance
- Data pagination and virtualization
- Efficient state management

### Backend
- Data caching
- Parallel processing for statistics
- Efficient data storage using Parquet
- API response optimization

## Security

- Input validation
- Error handling
- CORS configuration
- Rate limiting (planned)

## Future Improvements

1. **Performance**
   - Implement server-side caching
   - Add data compression
   - Optimize large dataset handling

2. **Features**
   - Add user authentication
   - Implement data export
   - Add more visualization types
   - Support for additional data formats

3. **Infrastructure**
   - Containerization
   - CI/CD pipeline
   - Automated testing
   - Monitoring and logging 