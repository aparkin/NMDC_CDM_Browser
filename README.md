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
│   ├── sample_table_snappy.parquet
│   ├── study_table_snappy.parquet
│   ├── contigs_rollup_table_snappy.parquet
│   ├── centrifuge_rollup_table_snappy.parquet
│   ├── kraken_rollup_table_snappy.parquet
│   ├── gottcha_rollup_table_snappy.parquet
│   ├── metabolites_table_snappy.parquet
│   ├── lipidomics_table_snappy.parquet
│   └── proteomics_table_snappy.parquet
├── frontend/             # React frontend application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── types/      # TypeScript type definitions
│   │   └── utils/      # Frontend utilities
│   ├── public/         # Static assets
│   └── package.json    # Frontend dependencies
├── processed_data/      # Processed data files
│   ├── study_analysis_cache/  # Individual study analysis results
│   │   ├── study_id_1.json   # Analysis results for study 1
│   │   ├── study_id_2.json   # Analysis results for study 2
│   │   └── ...              # Additional study results
│   └── study_summary.json    # Overall study summary data
├── src/                 # Backend code
│   ├── api/            # API endpoints
│   │   ├── routes/     # API route definitions
│   │   └── main.py     # FastAPI application
│   ├── data_processing/ # Data processing modules
│   │   ├── processors/ # Data processors
│   │   └── utils/      # Processing utilities
│   └── utils/          # General utilities
├── docs/               # Documentation
│   ├── api.md         # API documentation
│   ├── architecture.md # System architecture
│   └── deployment.md  # Deployment documentation
├── Dockerfile.frontend # Frontend Docker configuration
├── Dockerfile.backend  # Backend Docker configuration
└── docker-compose.yml  # Docker Compose configuration
```

## Documentation

- [API Documentation](docs/api.md)
- [System Architecture](docs/architecture.md)
- [Deployment Guide](DEPLOYMENT.md)

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
- Python 3.10+

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

### Development Setup

#### Backend Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Process initial data:
   ```bash
   python src/data_processing/process_data.py
   ```

4. Start the backend server:
   ```bash
   uvicorn src.api.main:app --reload --port 9000
   ```

#### Frontend Setup

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

### Docker Deployment

1. Build and start the containers:
   ```bash
   # Build backend
   podman build -t localhost/nmdc_backend:latest -f Dockerfile.backend .
   
   # Build frontend
   podman build -t localhost/nmdc_frontend:latest -f Dockerfile.frontend .
   
   # Run backend
   podman run -d --name nmdc_backend \
     --network host \
     -v ./data:/app/data:ro \
     -v ./processed_data:/app/processed_data:ro \
     -e PYTHONUNBUFFERED=1 \
     -e ENVIRONMENT=production \
     -e BASE_PATH=/cdm-browser \
     localhost/nmdc_backend:latest
   
   # Run frontend
   podman run -d --name nmdc_frontend \
     --network host \
     localhost/nmdc_frontend:latest
   ```

2. Access the application:
   - Frontend: https://genomics.lbl.gov:3000
   - Backend API: https://genomics.lbl.gov:9000
   - API Documentation: https://genomics.lbl.gov:9000/docs

## Environment Configuration

The application requires several environment variables to be set. These are managed through a `.env` file:

```bash
# API Configuration
USE_CBORG=true
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
CBORG_API_KEY=your_key_here
CBORG_BASE_URL=https://api.cborg.lbl.gov
CBORG_GENERATION_MODEL=anthropic/claude-sonnet
OPENAI_GENERATION_MODEL=gpt-4-turbo-preview

# Weaviate Configuration
WEAVIATE_HOST=weaviate.kbase.us
WEAVIATE_HTTP_PORT=443
WEAVIATE_GRPC_HOST=weaviate-grpc.kbase.us
WEAVIATE_GRPC_PORT=443

# NMDC Authentication
NMDC_REFRESH_TOKEN=your_token_here

# Application Configuration
ENVIRONMENT=production
BACKEND_PORT=9000
FRONTEND_PORT=3000
BACKEND_URL=http://genomics.lbl.gov:9000
```

## Cache Management

The application uses caching to improve performance. Cache files are stored in:
- `processed_data/study_analysis_cache/`: Individual study analysis results
- `processed_data/study_summary.json`: Overall study summary data

### Clearing Cache

When making changes to data processing logic (e.g., species count calculations), clear the cache:

```bash
# Clear all cache files
rm -rf processed_data/study_analysis_cache/* processed_data/sample_analysis_cache/* processed_data/study_summary.json

# Regenerate study summary data (metadata, sample counts, etc.)
python src/data_processing/study_summary_processor.py

# Regenerate detailed analysis data
python src/data_processing/process_data.py
```

The application uses two main data processing scripts:
- `study_summary_processor.py`: Generates study metadata, sample counts, and geographic distributions
- `process_data.py`: Handles detailed analysis including omics data, taxonomic analysis, and statistical measures

## Troubleshooting

### Common Issues

1. **Missing Data Files**
   Required data files in `data/`:
   - `sample_table_snappy.parquet`: Sample metadata
   - `study_table_snappy.parquet`: Study metadata
   - `contigs_rollup_table_snappy.parquet`: Contigs analysis data
   - `centrifuge_rollup_table_snappy.parquet`: Centrifuge analysis data
   - `kraken_rollup_table_snappy.parquet`: Kraken analysis data
   - `gottcha_rollup_table_snappy.parquet`: GOTTCHA analysis data
   - `metabolites_table_snappy.parquet`: Metabolomics data
   - `lipidomics_table_snappy.parquet`: Lipidomics data
   - `proteomics_table_snappy.parquet`: Proteomics data

   If any of these files are missing:
   - Ensure all data files are present in the `data/` directory
   - Run `python src/data_processing/process_data.py` to generate required processed data

2. **Cache Issues**
   - Clear cache files if data appears incorrect:
     ```bash
     rm -rf processed_data/study_analysis_cache/* processed_data/study_summary.json
     ```
   - Regenerate cache using the process_data.py script:
     ```bash
     python src/data_processing/process_data.py
     ```
   - Verify cache structure:
     - `processed_data/study_analysis_cache/` should contain JSON files for each study
     - `processed_data/study_summary.json` should contain overall statistics

3. **Docker Issues**
   - Ensure ports 9000 and 3000 are available
   - Check Docker logs: `podman logs <container-name>`
   - Verify environment variables: `podman exec <container-name> env`

4. **Frontend Build Issues**
   - Clear node_modules: `rm -rf frontend/node_modules`
   - Reinstall dependencies: `npm install`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 