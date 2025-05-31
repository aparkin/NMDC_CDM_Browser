# NMDC CDM Browser Deployment Guide

This guide explains how to deploy the NMDC CDM Browser using Podman on remote servers, with specific attention to path handling and nginx configuration.

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
5. Nginx proxy configured for HTTPS (if using genomics.lbl.gov)

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

## Nginx and URL Configuration

The application is served through nginx with the following configuration:
- Frontend: `https://genomics.lbl.gov/cdm-browser`
- Backend API: `https://genomics.lbl.gov/cdm-browser-api`

This setup requires specific configuration in both frontend and backend containers.

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

# Create a non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

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
  -v ./processed_data:/app/processed_data \
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

2. **Processed Data Directory** (`./processed_data:/app/processed_data`)
   - Mounted read-write
   - Contains processed data and cache files
   - Created by backend during processing
   - Persists between container restarts

### Environment Variables

1. **Backend Environment Variables**
   - `PYTHONUNBUFFERED=1`: Ensures Python output is not buffered
   - `ENVIRONMENT=production`: Sets the environment mode
   - `BASE_PATH=/cdm-browser`: Sets the base path for the API

2. **Frontend Environment Variables**
   - `VITE_BACKEND_URL=https://genomics.lbl.gov/cdm-browser-api`: Sets the backend API URL

## Troubleshooting

### Common Issues

1. **Path Issues**
   - If processed_data is created in the wrong location, check the volume mount
   - Ensure the host directory exists and has correct permissions
   - Verify the container can write to the mounted directory

2. **API Connection Issues**
   - Verify the frontend can reach the backend URL
   - Check nginx configuration for proper routing
   - Ensure HTTPS is properly configured

3. **Container Startup Issues**
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
   ```bash
   # Backup data directory
   tar -czf data_backup.tar.gz data/
   tar -czf processed_data_backup.tar.gz processed_data/
   ```

2. **Restore Data**
   ```bash
   # Restore from backup
   tar -xzf data_backup.tar.gz
   tar -xzf processed_data_backup.tar.gz
   ```

## Additional Configuration

### Custom Domain Setup
1. Update `BACKEND_URL` in `.env`
2. Configure reverse proxy (nginx/apache)
3. Update SSL certificates if using HTTPS

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

## Nginx Proxy Configuration

### Backend Proxy Configuration
```nginx
# Backend API proxy
location /cdm-browser/ {
    proxy_pass http://localhost:9000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket support (if needed)
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

# OpenAPI documentation
location /cdm-browser/docs {
    proxy_pass http://localhost:9000/docs;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /cdm-browser/openapi.json {
    proxy_pass http://localhost:9000/openapi.json;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Frontend Proxy Configuration
```nginx
# Frontend application
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket support (if needed)
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

### SSL Configuration
```nginx
server {
    listen 443 ssl;
    server_name genomics.lbl.gov;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Include the location blocks from above
    include /etc/nginx/conf.d/nmdc-locations.conf;
}
```

### Troubleshooting Nginx

1. **Check Nginx Configuration**
   ```bash
   # Test configuration syntax
   sudo nginx -t
   
   # Reload configuration
   sudo systemctl reload nginx
   ```

2. **Common Issues**
   - 502 Bad Gateway: Check if backend/frontend containers are running
   - 504 Gateway Timeout: Check proxy timeouts and container response times
   - SSL errors: Verify certificate paths and permissions
   - 404 Not Found: Check location block paths and proxy_pass URLs

3. **Logs**
   ```bash
   # Access logs
   sudo tail -f /var/log/nginx/access.log
   
   # Error logs
   sudo tail -f /var/log/nginx/error.log
   ```

4. **Security Considerations**
   - Keep SSL certificates up to date
   - Use strong SSL configuration
   - Implement rate limiting if needed
   - Consider adding security headers
   - Regular security audits

## Support

For issues or questions:
1. Check the logs
2. Review the documentation
3. Contact the development team 