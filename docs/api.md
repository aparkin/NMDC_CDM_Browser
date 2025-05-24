# Statistics API Documentation

## Overview
The Statistics API provides endpoints for retrieving various statistical analyses of the NMDC data. All endpoints are prefixed with `/api/statistics/`.

## Endpoints

### Timeline Data
- **Endpoint**: `/timeline`
- **Method**: GET
- **Description**: Returns timeline data for samples and studies
- **Response**: 
  ```json
  {
    "study_timelines": [
      {
        "study_id": "string",
        "start_date": "ISO date string",
        "end_date": "ISO date string",
        "sample_count": number
      }
    ],
    "sample_timeline": [
      {
        "sample_id": "string",
        "date": "ISO date string",
        "study_id": "string"
      }
    ]
  }
  ```

### Ecosystem Statistics
- **Endpoint**: `/ecosystem/{variable}`
- **Method**: GET
- **Description**: Returns statistics for ecosystem variables
- **Parameters**:
  - `variable`: One of: ecosystem, ecosystem_category, ecosystem_subtype, ecosystem_type, env_broad_scale_label, env_local_scale_label, specific_ecosystem, env_medium_label, soil_horizon, soil_type
- **Response**:
  ```json
  {
    "variable": "string",
    "value_counts": { "category": count },
    "total_samples": number,
    "unique_values": number
  }
  ```

### Physical Variable Statistics
- **Endpoint**: `/physical/{variable}`
- **Method**: GET
- **Description**: Returns statistics for physical variables
- **Parameters**:
  - `variable`: One of: avg_temp, ph, depth, etc. (see valid_variables list in code)
- **Response**:
  ```json
  {
    "variable": "string",
    "mean": number,
    "std": number,
    "min": number,
    "max": number,
    "count": number,
    "histogram": {
      "values": [number],
      "bin_edges": [number]
    }
  }
  ```

### Omics Statistics
- **Endpoint**: `/omics/{omics_type}`
- **Method**: GET
- **Description**: Returns statistics for omics data
- **Parameters**:
  - `omics_type`: One of: metabolomics, lipidomics, proteomics
- **Response**: Array of top 10 entries with their statistics
  ```json
  [
    {
      // Varies by omics type
      "mean_abundance": number,
      "std_abundance": number,
      // Additional fields specific to each type
    }
  ]
  ```

### Taxonomic Statistics
- **Endpoint**: `/taxonomic/{analysis_type}`
- **Method**: GET
- **Description**: Returns statistics for taxonomic analysis data
- **Parameters**:
  - `analysis_type`: One of: contigs, centrifuge, kraken, gottcha
- **Response**: Dictionary of results by taxonomic rank
  ```json
  {
    "superkingdom": [
      {
        "rank": "string",
        "lineage": "string",
        "mean_abundance": number,
        "std_abundance": number,
        // Additional fields specific to each analysis type
      }
    ],
    // Other ranks...
  }
  ```

## Error Handling
- 400 Bad Request: Invalid parameter values or missing required data
- 500 Internal Server Error: Server-side processing error

## Rate Limiting
Currently no rate limiting is implemented.

## Authentication
Currently no authentication is required. 