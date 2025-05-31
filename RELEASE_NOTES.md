# NMDC CDM Browser v0.1.0-beta Release Notes

## Overview
This is the first beta release of the NMDC CDM Browser, providing a web-based interface for exploring and analyzing NMDC Common Data Model (CDM) data. This release focuses on core functionality for study exploration, sample analysis, and data visualization.

## Key Features

### Study Exploration
- Interactive map visualization of study locations
- Detailed study cards with comprehensive metadata
- Search and filtering capabilities
- Ecosystem classification visualization

### Sample Analysis
- Sample location mapping
- Measurement type filtering
- Statistical summaries
- Data quality indicators

### Data Integration
- Support for multiple omics data types:
  - Metagenomics
  - Metatranscriptomics
  - Metabolomics
  - Proteomics
  - Lipidomics
  - MAGs analysis
  - Read-based analysis
  - NOM analysis

### User Interface
- Modern, responsive design
- Interactive maps using Leaflet
- Resizable containers for flexible layout
- Comprehensive data visualization

## Technical Details

### Frontend
- React-based single-page application
- Material-UI components
- Leaflet for map visualization
- Responsive design for various screen sizes

### Backend
- FastAPI-based REST API
- OpenAPI documentation
- Efficient data processing
- Secure data access

## Known Limitations
- Some advanced filtering features are still in development
- Large dataset performance optimizations pending
- Additional visualization types planned for future releases

## Getting Started
1. Access the application at [https://cdmbrowser.genomics.lbl.gov/](https://cdmbrowser.genomics.lbl.gov/)
2. Review the [API documentation](https://genomics.lbl.gov/cdm-browser-api/docs)
3. Check the [user guide](docs/user_guide.md) for detailed usage instructions

## Feedback
We welcome feedback on this beta release. Please report issues or suggestions through:
- GitHub Issues
- Direct contact with the development team
- User feedback forms in the application

## Next Steps
- Performance optimizations for large datasets
- Additional visualization types
- Enhanced filtering capabilities
- User authentication and personalization
- Data export functionality

## Acknowledgments
- NMDC Consortium
- Development team
- Beta testers and early users 