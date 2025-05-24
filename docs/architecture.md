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