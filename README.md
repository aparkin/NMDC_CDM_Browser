# NMDC CDM Browser

A web application for browsing and analyzing data from the National Microbiome Data Collaborative (NMDC) Common Data Model (CDM).

## Features

- Interactive map visualization of study locations
- Detailed study information and metadata
- Statistical analysis of omics data
- Timeline visualization of data collection
- Ecosystem distribution analysis
- Physical variable statistics
- Omics data analysis (metabolomics, lipidomics, proteomics)
- Taxonomic analysis
- AI-generated compendium summary with comprehensive analysis

## Project Structure

```
.
├── data/                  # Raw data files
├── frontend/             # React frontend application
├── processed_data/       # Processed data files
├── src/                  # Backend code
│   ├── api/             # API endpoints
│   ├── data_processing/ # Data processing modules
│   └── utils/           # Utility functions
└── docs/                # Documentation
    ├── api.md          # API documentation
    └── architecture.md # System architecture
```

## Documentation

- [API Documentation](docs/api.md)
- [System Architecture](docs/architecture.md)

## Dependencies

### Frontend Dependencies

#### Core
- React 18.2.0
- TypeScript 5.3.3
- Material-UI (MUI) 7.0.0
- React Router 7.0.0
- React Query (TanStack Query) 5.0.0

#### Visualization
- Leaflet.js 1.9.4
- Leaflet.MarkerCluster 1.5.3
- Plotly.js 2.29.0
- Recharts 2.15.3

#### Development
- Vite 5.0.0
- ESLint 8.56.0
- TypeScript ESLint 7.0.0
- Prettier 3.2.0

### Backend Dependencies

#### Core
- FastAPI 0.109.0
- Uvicorn 0.27.0
- Python 3.11+

#### Data Processing
- Pandas 2.2.0
- Dask 2024.1.0
- NumPy 1.26.0
- PyArrow 15.0.0

#### Development
- Black 24.1.0
- isort 5.13.0
- mypy 1.8.0
- pytest 8.0.0

## Setup

### Backend Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the backend server:
   ```bash
   uvicorn src.api.main:app --reload
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Access the application at `http://localhost:5173`
2. Use the map interface to explore study locations
3. Click on markers to view study details
4. Use the statistics view to analyze omics data
5. Filter and search studies using the study list
6. View the AI-generated summary for a comprehensive analysis of the compendium

## API Endpoints

See [API Documentation](docs/api.md) for detailed endpoint information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 