# NMDC CDM Browser API Documentation

## Overview
The NMDC CDM Browser API provides access to study metadata, statistics, and analysis results for the National Microbiome Data Collaborative (NMDC) Common Data Model (CDM) Browser.

## Base URL
```
http://localhost:8000/api
```

## Authentication
Currently, the API does not require authentication. In production, this will be updated to use appropriate authentication mechanisms.

## Endpoints

### Studies

#### Get Study Details
```http
GET /studies/{study_id}
```

Retrieves detailed information about a specific study.

**Parameters:**
- `study_id` (path parameter): The unique identifier of the study

**Response:**
```json
{
    "id": "nmdc:sty-11-34xj1150",
    "name": "Example Study",
    "description": "Study description",
    "sample_count": 100,
    "measurement_types": ["metagenomics"],
    "ecosystem": "soil",
    "latitude": 37.7749,
    "longitude": -122.4194
}
```

#### Get Geographic Distribution
```http
GET /studies/geographic
```

Retrieves the geographic distribution of all samples across studies.

**Response:**
```json
[
    {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "study_id": "nmdc:sty-11-34xj1150",
        "sample_count": 10
    }
]
```

### Statistics

#### Get Ecosystem Statistics
```http
GET /statistics/ecosystem/{variable}
```

Retrieves statistics for a specific ecosystem variable.

**Parameters:**
- `variable` (path parameter): The ecosystem variable to analyze (e.g., 'ecosystem', 'ecosystem_category')

**Response:**
```json
{
    "variable": "ecosystem",
    "value_counts": {
        "soil": 100,
        "water": 50
    },
    "total_samples": 150,
    "unique_values": 2
}
```

#### Get Physical Variable Statistics
```http
GET /statistics/physical/{variable}
```

Retrieves statistics for a specific physical variable.

**Parameters:**
- `variable` (path parameter): The physical variable to analyze

**Response:**
```json
{
    "variable": "temperature",
    "mean": 25.5,
    "std": 2.1,
    "min": 20.0,
    "max": 30.0,
    "count": 100,
    "histogram": {
        "values": [10, 20, 30, 25, 15],
        "bin_edges": [20.0, 22.0, 24.0, 26.0, 28.0, 30.0]
    }
}
```

#### Get Omics Statistics
```http
GET /statistics/omics
```

Retrieves statistics about omics data across studies.

**Response:**
```json
{
    "metagenomics": {
        "study_count": 50,
        "sample_count": 1000
    },
    "metatranscriptomics": {
        "study_count": 30,
        "sample_count": 600
    }
}
```

#### Get Taxonomic Statistics
```http
GET /statistics/taxonomic/{type}
```

Retrieves taxonomic statistics for a specific type.

**Parameters:**
- `type` (path parameter): The taxonomic type to analyze (e.g., 'genus', 'species')

**Response:**
```json
{
    "type": "genus",
    "top_taxa": [
        {
            "name": "Pseudomonas",
            "count": 100,
            "percentage": 25.5
        }
    ]
}
```

### AI Summary

#### Get AI-Generated Summary
```http
GET /summary/ai
```

Retrieves an AI-generated summary of the compendium, including analysis of studies, geographic distribution, environmental variables, and biological trends.

**Query Parameters:**
- `force` (optional): If true, forces regeneration of the summary (default: false)

**Response:**
```json
{
    "summary": "Comprehensive AI-generated summary in markdown format...",
    "last_updated": "2024-02-20T12:00:00Z",
    "data_version": "1.0.0",
    "token_count": 1500
}
```

The summary includes:
- General scope of studies
- Geographic analysis
- Environmental variables analysis
- Biological trends analysis
- Statistical distributions of physical variables
- Omics and taxonomic patterns

## Error Handling

The API uses standard HTTP status codes:

- 200: Success
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error

Error responses include a message explaining the error:

```json
{
    "detail": "Study not found"
}
```

## Rate Limiting

Currently, there are no rate limits implemented. This will be updated in production.

## Best Practices

1. Always check the response status code
2. Handle errors gracefully
3. Cache responses when appropriate
4. Use appropriate content types in requests

## Support

For API support or to report issues, please contact the NMDC team. 