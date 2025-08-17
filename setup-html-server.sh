#!/bin/bash

# ReceiptGold HTML-to-Image Server Setup Script

echo "🚀 Setting up HTML-to-Image Server for ReceiptGold..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Create server directory if it doesn't exist
if [ ! -d "html-server" ]; then
    echo "📁 Creating server directory..."
    mkdir html-server
fi

# Copy server files
echo "📋 Copying server files..."
cp html-to-image-server.js html-server/
cp server-package.json html-server/package.json

# Navigate to server directory
cd html-server

# Install dependencies
echo "📦 Installing server dependencies..."
npm install

echo ""
echo "✅ HTML-to-Image Server setup complete!"
echo ""
echo "🔧 To start the server:"
echo "   cd html-server"
echo "   npm start"
echo ""
echo "🔧 For development with auto-reload:"
echo "   cd html-server" 
echo "   npm run dev"
echo ""
echo "🌐 Server will be available at: http://localhost:3001"
echo "📄 Health check endpoint: http://localhost:3001/health"
echo ""
echo "💡 Make sure to set RECEIPT_SERVICE_TYPE=html in your .env file"
echo "💡 Optionally set HTML_TO_IMAGE_SERVER_URL=http://localhost:3001"
