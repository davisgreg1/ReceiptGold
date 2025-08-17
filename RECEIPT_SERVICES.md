# Receipt Generation Services

ReceiptGold now supports two different receipt generation services that you can switch between using environment variables:

## Service Types

### 🤖 AI Service (OpenAI)
- Uses OpenAI's DALL-E to generate photorealistic receipt images
- Requires OpenAI API key
- More realistic looking receipts
- Consumes OpenAI API credits

### 📄 HTML Service (HTML-to-Image)
- Generates HTML receipts and converts them to images
- Can run completely offline (with fallback)
- Faster generation
- No external API dependencies for basic functionality

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Choose your receipt service: 'ai' or 'html'
RECEIPT_SERVICE_TYPE=html

# Required for AI service
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_key

# Optional for HTML service (has fallback)
HTML_TO_IMAGE_SERVER_URL=http://localhost:3001

# For Docker setup
HTML_TO_IMAGE_SERVER_URL=http://html-service:3001
```

## Quick Start with Docker 🐳

The fastest way to get everything running:

```bash
# Start all services with one command
./docker-start.sh dev

# Or for production
./docker-start.sh prod
```

This starts:
- **Backend API** → `http://localhost:3000`
- **HTML Service** → `http://localhost:3001` 
- **Expo Dev Server** → `http://localhost:19000`

### Service Switching

The app automatically detects which service to use based on `RECEIPT_SERVICE_TYPE`:

- `ai` - Uses OpenAI service (requires API key)
- `html` - Uses HTML service (recommended default)

## HTML-to-Image Server Setup

### 🐳 Docker Setup (Recommended)

```bash
# Start entire application including HTML service
./docker-start.sh dev

# View service status
./docker-start.sh status

# View logs
./docker-start.sh logs

# Stop all services
./docker-start.sh stop
```

### Manual Setup

For the best HTML receipt experience, run the included server:

### Quick Setup
```bash
./setup-html-server.sh
```

### Manual Setup
```bash
# Create server directory
mkdir html-server
cp html-to-image-server.js html-server/
cp server-package.json html-server/package.json

# Install and start
cd html-server
npm install
npm start
```

### Server Endpoints
- **Health Check**: `GET http://localhost:3001/health`
- **Convert HTML**: `POST http://localhost:3001/convert-html-to-image`

## Service Detection

The app displays the currently active service in the UI:
- 🤖 AI - OpenAI service is active
- 📄 HTML - HTML service is active

## Fallback Behavior

### HTML Service
- If server is unavailable: Uses placeholder image
- No external dependencies required for basic functionality

### AI Service  
- If API key is invalid: Falls back to error state
- Requires valid OpenAI API key and credits

## Choosing the Right Service

### Use HTML Service When:
- ✅ You want consistent, fast generation
- ✅ You prefer no external API dependencies
- ✅ You want to avoid per-generation costs
- ✅ You need offline capability

### Use AI Service When:
- ✅ You want photorealistic receipt images
- ✅ You have OpenAI API credits available
- ✅ Image realism is more important than speed
- ✅ You don't mind external API dependency

## Implementation Details

The service switching is implemented using the Factory Pattern:

```typescript
// Automatically chooses service based on environment
const receiptService = ReceiptServiceFactory.getReceiptService();

// Generate receipt (same interface for both services)
const receipt = await receiptService.generateReceiptFromTransaction(transaction);
```

Both services implement the same `ReceiptService` interface, so switching between them is seamless and requires no code changes.
