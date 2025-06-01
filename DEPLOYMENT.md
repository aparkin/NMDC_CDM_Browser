# NMDC CDM Browser Deployment Guide

This guide explains how to deploy the NMDC CDM Browser using Podman on remote servers, with specific attention to path handling, container configuration, and permissions.

## Current Deployment

The NMDC CDM Browser is currently deployed and accessible at:
- Main Application: [https://cdmbrowser.genomics.lbl.gov/](https://cdmbrowser.genomics.lbl.gov/)
- API Documentation: 
  - [Swagger UI](https://genomics.lbl.gov/cdm-browser-api/docs)
  - [ReDoc](https://genomics.lbl.gov/cdm-browser-api/redoc)

## Prerequisites

1. Podman installed on the server
2. Git installed on the server
3. Sufficient disk space for data and containers
4. Required ports available (default: 9000 for backend, 3000 for frontend)
5. HTTPS proxy configured for secure access
6. Access to `/opt/shared/{$USER}` directory for writable storage

## Project Structure and Path Handling

```
.
├── data/                  # Raw data files (mounted read-only in container)
├── frontend/             # React frontend application
├── processed_data/       # Processed data files (mounted read-write in container)
├── src/                  # Backend code
├── Dockerfile.backend    # Backend container definition
└── Dockerfile.frontend   # Frontend container definition
```

### Path Handling Philosophy

The application is designed to work in two contexts:
1. **Development Environment**: Running directly on the host machine
2. **Container Environment**: Running inside Podman containers

To handle this dual context, we use relative paths from the project root in our code, determined by the location of the source files. This ensures consistent behavior in both environments.

## Application Paths

The application expects to be served with the following paths:
- Frontend: `https://genomics.lbl.gov/cdm-browser`
- Backend API: `https://genomics.lbl.gov/cdm-browser-api`

These paths are used in the application configuration to ensure proper routing between frontend and backend services.

## Container Configuration

### Backend Container (Dockerfile.backend)
```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first to leverage cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the source code needed for the application
COPY src/ src/

# Copy .env file
COPY .env .

# Expose the port the app runs on
EXPOSE 9000

# Command to run the application
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "9000"]
```

### Frontend Container (Dockerfile.frontend)
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the frontend code
COPY frontend/ .

# Build the application
RUN npm run build

# Install serve to run the built application
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
```

## Deployment Process

### Full Update Process
```bash
# 1. Pull latest changes
git pull origin main

# 2. Stop and remove existing containers
podman stop nmdc_backend & podman rm nmdc_backend
podman stop nmdc_frontend & podman rm nmdc_frontend

# 3. Build containers
podman build -t localhost/nmdc_backend:latest -f Dockerfile.backend .
podman build -t localhost/nmdc_frontend:latest -f Dockerfile.frontend .

# 4. Run backend container
podman run -d --name nmdc_backend \
  --network host \
  -v ./data:/app/data:ro \
  -v /opt/shared/$USER/processed_data:/app/processed_data \
  -e PYTHONUNBUFFERED=1 \
  -e ENVIRONMENT=production \
  -e BASE_PATH=/cdm-browser \
  localhost/nmdc_backend:latest

# 5. Run frontend container
podman run -d --name nmdc_frontend \
  -p 3000:3000 \
  -e VITE_BACKEND_URL=https://genomics.lbl.gov/cdm-browser-api \
  localhost/nmdc_frontend:latest
```

### Volume Mounts Explained

1. **Data Directory** (`./data:/app/data:ro`)
   - Mounted read-only
   - Contains raw data files
   - Used by backend for data processing

2. **Processed Data Directory** (`/opt/shared/$USER/processed_data:/app/processed_data`)
   - Mounted read-write
   - Contains processed data and cache files
   - Created by backend during processing
   - Persists between container restarts
   - Must be in `/opt/shared/$USER` to ensure proper permissions

### Environment Variables

1. **Backend Environment Variables**
   - `PYTHONUNBUFFERED=1`: Ensures Python output is not buffered
   - `ENVIRONMENT=production`: Sets the environment mode
   - `BASE_PATH=/cdm-browser`: Sets the base path for the API

2. **Frontend Environment Variables**
   - `VITE_BACKEND_URL=https://genomics.lbl.gov/cdm-browser-api`: Sets the backend API URL

## Troubleshooting

### Common Issues

1. **Permission Issues**
   - If you encounter permission denied errors, ensure processed_data is in `/opt/shared/$USER`
   - The container runs as root by default, which is fine for our use case
   - Avoid using NFS mounts for writable directories

2. **Path Issues**
   - If processed_data is created in the wrong location, check the volume mount
   - Ensure the host directory exists and has correct permissions
   - Verify the container can write to the mounted directory

3. **API Connection Issues**
   - Verify the frontend can reach the backend URL
   - Check if the proxy paths are correctly configured
   - Ensure HTTPS is properly configured
   - Check that API endpoints don't have conflicting v1 prefixes

4. **Container Startup Issues**
   - Check container logs: `podman logs <container-name>`
   - Verify environment variables: `podman exec <container-name> env`
   - Check volume mounts: `podman inspect <container-name>`

## Maintenance

### Regular Updates
1. Pull latest code changes
2. Rebuild containers
3. Restart services
4. Monitor logs for issues

### Backup
1. Regular backups of processed_data directory
2. Document any custom configurations

### Monitoring
1. Check container logs regularly
2. Monitor disk space usage
3. Monitor API response times

## Backup and Recovery

1. **Backup Data**
   - Regularly backup the processed_data directory
   - Keep a copy of the raw data files
   - Document any custom configurations

2. **Recovery Process**
   - Restore from backup
   - Rebuild containers
   - Verify all paths and permissions
   - Test API endpoints

## Additional Configuration

### Resource Limits
Add to docker-compose.yml:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
```

## Support

For issues or questions:
1. Check the logs
2. Review the documentation
3. Contact the development team 