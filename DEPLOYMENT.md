# NMDC CDM Browser Deployment Guide

This guide explains how to deploy the NMDC CDM Browser using Podman on remote servers.

## Prerequisites

1. Podman installed on the server
2. Git installed on the server
3. Sufficient disk space for data and containers
4. Required ports available (default: 8000 for backend, 3000 for frontend)

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
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y build-essential

# Copy requirements first to leverage Docker caching
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy application code and data
COPY src/ ./src/
COPY data/ ./data/
COPY processed_data/ ./processed_data/

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
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

CMD ["serve", "-s", "build", "-l", "3000"]
```

## Dependency Management

### Backend Dependencies
Backend dependencies are managed through `requirements.txt`. To update dependencies:

1. **Update in Development**:
   ```bash
   # Activate virtual environment
   python -m venv venv
   source venv/bin/activate  # or `venv\Scripts\activate` on Windows
   
   # Install/update packages
   pip install <package-name>
   
   # Update requirements.txt
   pip freeze > requirements.txt
   ```

2. **Rebuild Container**:
   ```bash
   podman-compose build backend
   ```

### Frontend Dependencies
Frontend dependencies are managed through `package.json`. To update dependencies:

1. **Update in Development**:
   ```bash
   cd frontend
   
   # Install/update packages
   npm install <package-name>
   
   # Update package.json
   npm install
   ```

2. **Rebuild Container**:
   ```bash
   podman-compose build frontend
   ```

### Version Control
- Backend: Uses exact versions (`==`) in requirements.txt
- Frontend: Uses exact versions (no `^` or `~`) in package.json

### Dependency Updates
To update all dependencies:

1. **Backend**:
   ```bash
   # Update all packages
   pip install --upgrade -r requirements.txt
   
   # Update requirements.txt
   pip freeze > requirements.txt
   ```

2. **Frontend**:
   ```bash
   cd frontend
   
   # Update all packages
   npm update
   
   # Update package.json
   npm install
   ```

## Container Management

### Building Containers
```bash
# Build all containers
podman-compose build

# Build specific container
podman-compose build backend
podman-compose build frontend
```

### Running Containers
```bash
# Start all containers
podman-compose up -d

# Start specific container
podman-compose up -d backend
podman-compose up -d frontend
```

### Viewing Logs
```bash
# Backend logs
podman logs -f nmdc-cdm-browser-backend-1

# Frontend logs
podman logs -f nmdc-cdm-browser-frontend-1
```

### Stopping Containers
```bash
# Stop all containers
podman-compose down

# Stop specific container
podman-compose stop backend
podman-compose stop frontend
```

## Data Persistence

The application uses two volume mounts:
- `./data:/app/data` - Raw data files
- `./processed_data:/app/processed_data` - Processed data and cache

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

### Dependency Issues
1. **Backend**:
   ```bash
   # Check Python version
   python --version
   
   # Verify virtual environment
   which python
   
   # Reinstall dependencies
   pip install -r requirements.txt
   ```

2. **Frontend**:
   ```bash
   # Check Node version
   node --version
   
   # Clear npm cache
   npm cache clean --force
   
   # Reinstall dependencies
   npm install
   ```

### Network Issues
1. Verify port mappings: `podman port <container-name>`
2. Check firewall rules
3. Test connectivity: `curl http://localhost:<port>`

## Security Considerations

1. **Firewall Configuration**
   ```bash
   # Allow required ports
   sudo firewall-cmd --permanent --add-port=8000/tcp
   sudo firewall-cmd --permanent --add-port=3000/tcp
   sudo firewall-cmd --reload
   ```

2. **Container Security**
   - Run containers as non-root user
   - Use read-only volumes where possible
   - Keep containers updated

## Maintenance

1. **Updating the Application**
   ```bash
   # Pull latest changes
   git pull

   # Rebuild and restart containers
   podman-compose down
   podman-compose build
   podman-compose up -d
   ```

2. **Clearing Cache**
   ```bash
   # Remove processed data
   rm -rf processed_data/*
   ```

3. **Monitoring**
   ```bash
   # View resource usage
   podman stats

   # Check container health
   podman inspect <container-name> | grep Health
   ```

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

## Support

For issues or questions:
1. Check the logs
2. Review the documentation
3. Contact the development team 