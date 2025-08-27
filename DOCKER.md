# 🐳 Docker Setup for ReceiptGold

## Quick Start

### Command Line
```bash
# Start development environment
./docker-start.sh dev

# Start production environment  
./docker-start.sh prod

# View status
./docker-start.sh status

# View logs
./docker-start.sh logs

# Stop everything
./docker-start.sh stop
```

### Docker Desktop GUI 🖥️

1. **Open Docker Desktop** on your Mac
2. **Open this project** in Docker Desktop:
   - Click "Open in Visual Studio Code" or navigate to project folder
   - Or drag the `docker-compose.yml` file into Docker Desktop

3. **Start Services**:
   - Click the ▶️ button next to the stack name
   - Or click individual service ▶️ buttons

4. **Monitor Services**:
   - View real-time logs in the Logs tab
   - Check resource usage in the Stats tab
   - Access container terminals via the Terminal tab

5. **Access Applications**:
   - Backend API: http://localhost:3000
   - HTML Service: http://localhost:3001  
   - Expo DevTools: http://localhost:19003

## Architecture

ReceiptGold runs 3 main services in Docker:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│                 │    │                  │    │                     │
│  Expo Dev       │    │  Backend API     │    │  HTML-to-Image      │
│  Port: 19003    │    │  Port: 3000      │    │  Port: 3001         │
│                 │    │                  │    │                     │
│  - React Native │    │  - Stripe API    │    │  - Puppeteer        │
│  - Development  │    │  - Firebase      │    │  - Receipt HTML     │
│  - Hot Reload   │    │  - Plaid         │    │  - Image Conversion │
│                 │    │                  │    │                     │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
         │                       │                        │
         └───────────────────────┼────────────────────────┘
                                 │
                      ┌──────────────────┐
                      │                  │
                      │  Nginx Gateway   │
                      │  Port: 80        │
                      │                  │
                      │  - Load Balancer │
                      │  - SSL Termination│
                      │  - Rate Limiting  │
                      │                  │
                      └──────────────────┘
```

## Services

### 1. Backend API (`backend`)
- **Port**: 3000
- **Purpose**: Main API server handling Stripe, Firebase, Plaid
- **Health**: `http://localhost:3000/health`
- **Dockerfile**: `Dockerfile.backend`

### 2. HTML-to-Image Service (`html-service`)  
- **Port**: 3001
- **Purpose**: Converts HTML receipts to images using Puppeteer
- **Health**: `http://localhost:3001/health`
- **Dockerfile**: `Dockerfile.html-service`

### 3. Expo Development (`expo-dev`)
- **Port**: 19003 (DevTools), 8080 (Bundler)
- **Purpose**: React Native development server
- **Access**: `http://localhost:19003`
- **Dockerfile**: `Dockerfile.expo`

### 4. Nginx Gateway (`nginx`) - Production Only
- **Port**: 80, 443
- **Purpose**: Reverse proxy and load balancer
- **Config**: `docker/nginx.conf`

## Commands

### Development
```bash
./docker-start.sh dev      # Start development environment
./docker-start.sh logs     # View all service logs
./docker-start.sh status   # Check service health
```

### Production
```bash
./docker-start.sh prod     # Start production with nginx
./docker-start.sh build    # Rebuild all images
./docker-start.sh clean    # Remove all containers/images
```

### Individual Services
```bash
# Start specific services
docker-compose up backend html-service

# View logs for one service
docker-compose logs -f backend

# Restart a service
docker-compose restart html-service

# Execute commands in a container
docker-compose exec backend npm run migrate
```

## Environment Configuration

### Development (.env)
```bash
RECEIPT_SERVICE_TYPE=html
HTML_TO_IMAGE_SERVER_URL=http://html-service:3001
EXPO_PUBLIC_OPENAI_API_KEY=your_key
```

### Production
Uses same .env but with internal Docker network URLs.

## Networking

All services communicate via the `receiptgold-network` bridge network:

- `backend:3000` - Internal backend URL
- `html-service:3001` - Internal HTML service URL  
- `nginx:80` - External gateway (production)

## Volumes & Data

### Persistent Data
- `expo-cache` - Expo build cache for faster rebuilds
- `web-build` - Production web build artifacts

### Bind Mounts (Development)
- `.:/app` - Live code reload for Expo
- `./server.js:/app/server.js` - Backend hot reload
- `./html-to-image-server.js:/app/html-to-image-server.js` - HTML service reload

## Health Checks

All services include health checks:

```bash
# Check all services
./docker-start.sh status

# Manual health checks
curl http://localhost:3000/health
curl http://localhost:3001/health
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose logs backend

# Rebuild image
docker-compose build backend --no-cache

# Check ports
netstat -tlnp | grep :3000
```

### Environment Issues
```bash
# Verify environment loaded
docker-compose config

# Check service environment
docker-compose exec backend env | grep RECEIPT
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Clean up unused resources
docker system prune -f

# Restart everything
./docker-start.sh stop
./docker-start.sh dev
```

### HTML Service Issues
```bash
# Check Puppeteer/Chromium
docker-compose exec html-service chromium-browser --version

# Test image conversion
curl -X POST http://localhost:3001/convert-html-to-image \
  -H "Content-Type: application/json" \
  -d '{"html": "<html><body>Test</body></html>"}'
```

## Production Deployment

### Docker Compose
```bash
# Production stack
./docker-start.sh prod

# With SSL certificates
cp your-certs/* docker/certs/
docker-compose --profile production up -d
```

### Environment Variables
Ensure production .env has:
- Secure secrets
- Production URLs
- SSL certificates
- Proper CORS origins

### Monitoring
```bash
# Service status
./docker-start.sh status

# Resource usage  
docker stats --no-stream

# Logs
docker-compose logs --since=1h
```
