# 🖥️ Docker Desktop Guide for ReceiptGold

## Overview

Docker Desktop provides a user-friendly GUI for managing your ReceiptGold containers. Here's how to use it effectively with your ReceiptGold application.

## Getting Started with Docker Desktop

### 1. Install Docker Desktop
- Download from: https://www.docker.com/products/docker-desktop/
- Install and start Docker Desktop
- Ensure it's running (Docker whale icon in system tray)

### 2. Open ReceiptGold in Docker Desktop

**Method 1: From Docker Desktop**
1. Open Docker Desktop
2. Go to the "Compose" tab
3. Click "Create" or "Import"
4. Navigate to your ReceiptGold project folder
5. Select `docker-compose.yml`

**Method 2: From Terminal**
```bash
# Navigate to project and start
cd /path/to/ReceiptGold
docker-compose up -d
```

**Method 3: Drag & Drop**
- Drag `docker-compose.yml` into Docker Desktop window

## Using Docker Desktop GUI

### 🚀 Starting Services

1. **Find Your Stack**: Look for "receiptgold" in the Compose section
2. **Start All Services**: Click the main ▶️ button 
3. **Start Individual Services**: Expand the stack and click individual ▶️ buttons

### 📊 Monitoring Services

#### **Container Overview**
- **Green dot** = Running and healthy
- **Yellow dot** = Starting up
- **Red dot** = Stopped or error
- **Orange dot** = Unhealthy

#### **Service Details**
Click on any service to see:
- **Logs**: Real-time application logs
- **Inspect**: Container configuration and environment
- **Stats**: CPU, memory, network usage
- **Files**: Browse container filesystem

### 🔍 Viewing Logs

**Real-time Logs:**
1. Click on service name (e.g., "receiptgold-backend")
2. Go to "Logs" tab
3. Logs auto-refresh and can be filtered

**All Services Logs:**
1. Click on the stack name "receiptgold"  
2. View combined logs from all services
3. Color-coded by service

### 🔗 Accessing Applications

Docker Desktop shows clickable links for:
- **Backend API**: http://localhost:3000
- **HTML Service**: http://localhost:3001  
- **Expo DevTools**: http://localhost:19000
- **Production Gateway**: http://localhost (when nginx running)

### 🛠️ Managing Services

#### **Individual Service Actions**
Right-click on any service for:
- **Start/Stop/Restart**
- **View Logs**
- **Open in Terminal** 
- **Delete Container**

#### **Stack Actions**  
Right-click on stack for:
- **Start/Stop All**
- **Pull Latest Images**
- **Remove Stack**
- **Edit Compose File**

### 📱 Terminal Access

**Access Container Shell:**
1. Click on running container
2. Go to "Terminal" or "Exec" tab
3. Run commands inside container:

```bash
# Backend container
npm run migrate
node -v

# HTML Service container  
chromium-browser --version
ls -la

# Expo container
expo --version
npm start
```

## Development Workflow

### 🔄 Daily Development

1. **Start Services**: Click ▶️ on receiptgold stack
2. **Check Health**: Verify all services show green dots
3. **Open Apps**: 
   - Expo DevTools: http://localhost:19000
   - API Health: http://localhost:3000/health
4. **Monitor Logs**: Keep logs tab open for debugging
5. **Stop When Done**: Click ⏹️ to stop all services

### 🐛 Debugging Issues

**Service Won't Start:**
1. Click on failed service
2. Check "Logs" tab for errors
3. Verify environment variables in "Inspect" tab
4. Check port conflicts in "Ports" section

**Performance Issues:**
1. Go to "Stats" tab
2. Monitor CPU/memory usage
3. Check network traffic
4. Restart high-resource services if needed

## Environment Management

### 🔧 Environment Variables

**View Current Environment:**
1. Click on service
2. Go to "Inspect" tab  
3. Scroll to "Environment" section

**Edit Environment:**
1. Stop the service
2. Edit `docker-compose.yml` or `.env` file
3. Restart service (Docker Desktop auto-detects changes)

### 🔄 Configuration Changes

When you modify:
- `docker-compose.yml`
- `.env` files
- Dockerfiles

Docker Desktop will show a "Restart Required" indicator. Click to apply changes.

## Production Management

### 🏭 Production Mode

**Start Production Stack:**
1. Edit docker-compose.yml to enable production profile:
```yaml
services:
  nginx:
    profiles:
      # - production  # Remove comment
```
2. Restart stack in Docker Desktop
3. Nginx gateway will start automatically

**Production Monitoring:**
- Monitor all services in Docker Desktop
- Check nginx logs for request patterns
- Monitor resource usage across all services

### 📈 Scaling Services

**Scale HTML Service:**
1. Right-click on html-service
2. Select "Scale"
3. Choose number of replicas
4. Docker Desktop handles load balancing

## Tips & Tricks

### 🚀 Productivity Tips

**Keyboard Shortcuts:**
- `Cmd/Ctrl + R`: Refresh view
- `Cmd/Ctrl + F`: Search logs
- `Cmd/Ctrl + K`: Clear logs

**Quick Actions:**
- **Bookmark URLs**: Save localhost links for quick access
- **Pin Containers**: Keep frequently used containers at top
- **Custom Tags**: Add tags to identify container purposes

### 🔍 Troubleshooting

**Common Issues:**

1. **Port Already in Use**
   - Check "Ports" section in Docker Desktop
   - Kill conflicting processes or change ports

2. **Image Build Fails**
   - Check build logs in Docker Desktop
   - Clear build cache: Settings → Docker Engine → Reset

3. **Service Dependencies**
   - Start services in order using Docker Desktop
   - Check "depends_on" relationships in compose file

### 📊 Resource Management

**Free Up Space:**
1. Go to Settings → Resources → Advanced
2. Set appropriate limits for CPU/Memory
3. Use "Clean / Purge Data" to remove unused containers/images

**Monitor Usage:**
- Dashboard shows real-time resource usage
- Set alerts for high resource consumption
- Scale services based on load

## Integration with VS Code

### 🔗 Docker Extension

Install Docker Extension for VS Code:
1. Install "Docker" extension
2. View containers in sidebar
3. Right-click containers for quick actions
4. Edit compose files with IntelliSense

### 🔄 Dev Containers

For advanced development:
1. Create `.devcontainer/devcontainer.json`
2. Open project in dev container
3. Full VS Code environment inside Docker

## Conclusion

Docker Desktop makes managing your ReceiptGold application much easier with:
- ✅ Visual service management
- ✅ Real-time monitoring and logs  
- ✅ Easy environment configuration
- ✅ One-click start/stop operations
- ✅ Built-in troubleshooting tools

The combination of command-line tools (`./docker-start.sh`) and Docker Desktop GUI gives you the best of both worlds for development and production management!
