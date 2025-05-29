# NMDC CDM Browser Deployment Guide

This guide explains how to deploy the NMDC CDM Browser using Podman on remote servers.

## Prerequisites

1. Podman installed on the server
2. Git installed on the server
3. Sufficient disk space for data and containers
4. Required ports available (default: 9000 for backend, 3000 for frontend)
5. Nginx proxy configured for HTTPS (if using genomics.lbl.gov)

## Project Structure

```
.
├── data/                  # Raw data files
├── frontend/             # React frontend application
├── processed_data/       # Processed data files
├── src/                  # Backend code
├── Dockerfile.backend    # Backend container definition
├── Dockerfile.frontend   # Frontend container definition
└── docker-compose.yml    # Container orchestration
```

## Docker Setup

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
RUN npm install

# Copy the rest of the frontend code
COPY frontend/ .

# Build the application
RUN npm run build

# Install serve to run the built application
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
```

## Environment Configuration

### Environment Variables
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

### Environment File Handling
1. The `.env` file is copied into the container during build
2. The `.dockerignore` file is configured to allow copying the `.env` file
3. Environment variables are loaded at runtime using python-dotenv

## Container Management

### Building Containers
```bash
# Build backend
podman build -t localhost/nmdc_backend:latest -f Dockerfile.backend .

# Build frontend
podman build -t localhost/nmdc_frontend:latest -f Dockerfile.frontend .
```

### Running Containers
```bash
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

### Viewing Logs
```bash
# Backend logs
podman logs -f nmdc_backend

# Frontend logs
podman logs -f nmdc_frontend
```

### Stopping Containers
```bash
# Stop containers
podman stop nmdc_backend nmdc_frontend
podman rm nmdc_backend nmdc_frontend
```

## Data Persistence

The application uses two volume mounts:
- `./data:/app/data:ro` - Raw data files (read-only)
- `./processed_data:/app/processed_data:ro` - Processed data and cache (read-only)

Ensure these directories exist and have proper permissions:
```bash
mkdir -p data processed_data
chmod 755 data processed_data
```

## Troubleshooting

### Container Won't Start
1. Check logs: `podman logs <container-name>`
2. Verify port availability: `netstat -tulpn | grep <port>`
3. Check disk space: `df -h`
4. Verify environment variables: `podman exec <container-name> env`

### Network Issues
1. Verify port mappings: `podman port <container-name>`
2. Check firewall rules
3. Test connectivity: `curl https://genomics.lbl.gov:9000/api/health`

### Environment Variable Issues
1. Check if .env file is copied: `podman exec <container-name> ls -la /app/.env`
2. Verify environment variables: `podman exec <container-name> env`
3. Check application logs for environment loading messages

## Security Considerations

1. **Firewall Configuration**
   ```bash
   # Allow required ports
   sudo firewall-cmd --permanent --add-port=9000/tcp
   sudo firewall-cmd --permanent --add-port=3000/tcp
   sudo firewall-cmd --reload
   ```

2. **Container Security**
   - Run containers as non-root user
   - Use read-only volumes where possible
   - Keep containers updated
   - Secure environment variables
   - Use HTTPS through nginx proxy

## Maintenance

### Regular Updates
1. Pull latest code changes
2. Rebuild containers
3. Restart services
4. Monitor logs for issues

### Backup
1. Regular backups of processed_data directory
2. Backup of .env file
3. Document any custom configurations

### Monitoring
1. Check container logs regularly
2. Monitor disk space usage
3. Monitor API response times
4. Check for any security updates

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