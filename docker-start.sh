#!/bin/bash

# ReceiptGold Docker Startup Script
# Usage: ./docker-start.sh [dev|prod|stop|logs|build]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "  ____               _       _    ____       _     _ "
    echo " |  _ \ ___  ___ ___(_)_ __ | |_ / ___| ___ | | __| |"
    echo " | |_) / _ \/ __/ _ \ | '_ \| __| |  _ / _ \| |/ _\` |"
    echo " |  _ <  __/ (_|  __/ | |_) | |_| |_| | (_) | | (_| |"
    echo " |_| \_\___|\___\___|_| .__/ \__|\____|\___/|_|\__,_|"
    echo "                     |_|                            "
    echo -e "${NC}"
    echo -e "${PURPLE}🐳 Docker Management Script${NC}"
    echo ""
}

check_env() {
    if [ ! -f .env ]; then
        echo -e "${RED}❌ .env file not found!${NC}"
        echo "Please create a .env file with your configuration."
        echo "Copy .env.example to .env and fill in your values."
        exit 1
    fi
    
    echo -e "${GREEN}✅ Environment file found${NC}"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found!${NC}"
        echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker is not running!${NC}"
        echo "Please start Docker Desktop and try again."
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker is running${NC}"
}

check_docker_desktop() {
    # Check if Docker Desktop is available (macOS/Windows)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if [ -d "/Applications/Docker.app" ]; then
            echo -e "${BLUE}💡 Docker Desktop detected!${NC}"
            echo "   You can also manage services via Docker Desktop GUI"
            echo "   Open Docker Desktop and look for 'receiptgold' stack"
            echo ""
        fi
    fi
}

show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Development Commands:"
    echo "  dev        Start development environment (web-only)"
    echo "  android    Start development with Android support"
    echo "  ios        Start development with iOS support (macOS only)"
    echo "  mobile     Start development with both iOS and Android"
    echo "  all        Start all services including mobile development"
    echo ""
    echo "Production Commands:"
    echo "  prod       Start production environment with nginx"
    echo ""
    echo "Management Commands:"
    echo "  stop       Stop all services"
    echo "  logs       Show logs for all services"
    echo "  build      Rebuild all Docker images"
    echo "  clean      Remove all containers and images"
    echo "  status     Show status of all services"
    echo "  help       Show this help message"
    echo ""
    echo "💡 Docker Desktop Users:"
    echo "  You can also manage services via Docker Desktop GUI"
    echo "  Look for 'receiptgold' stack in the Compose section"
    echo ""
    echo "📖 Documentation:"
    echo "  Command Line: DOCKER.md"
    echo "  Docker Desktop: DOCKER_DESKTOP.md"
    echo "  Mobile Development: DOCKER_MOBILE.md"
    echo ""
}

start_dev() {
    echo -e "${YELLOW}🚀 Starting ReceiptGold Development Environment...${NC}"
    echo ""
    
    echo -e "${BLUE}📋 Services starting:${NC}"
    echo "  • Backend API        → http://localhost:3000"
    echo "  • HTML Service       → http://localhost:3001"  
    echo "  • Expo Dev Server    → http://localhost:19000"
    echo ""
    
    docker-compose up -d backend html-service expo-dev
    
    echo ""
    echo -e "${GREEN}✅ Development environment started!${NC}"
    echo ""
    echo -e "${YELLOW}📱 Next steps:${NC}"
    echo "  1. Open Expo Developer Tools: http://localhost:19000"
    echo "  2. Scan QR code with Expo Go app"
    echo "  3. Backend API health: http://localhost:3000/health"
    echo "  4. HTML Service health: http://localhost:3001/health"
    echo ""
    echo -e "${BLUE}💡 For mobile development:${NC}"
    echo "  Android: ./docker-start.sh android"
    echo "  iOS: ./docker-start.sh ios" 
    echo "  Both: ./docker-start.sh mobile"
    echo ""
    echo -e "${BLUE}💡 Useful commands:${NC}"
    echo "  View logs: ./docker-start.sh logs"
    echo "  Stop all: ./docker-start.sh stop"
    echo "  Docker Desktop: Open and look for 'receiptgold' stack"
    echo ""
}

start_android() {
    echo -e "${YELLOW}🤖 Starting ReceiptGold Android Development...${NC}"
    echo ""
    
    echo -e "${BLUE}📋 Services starting:${NC}"
    echo "  • Backend API        → http://localhost:3000"
    echo "  • HTML Service       → http://localhost:3001"  
    echo "  • Android Dev Server → http://localhost:19010"
    echo ""
    
    docker-compose --profile android up -d backend html-service expo-android
    
    echo ""
    echo -e "${GREEN}✅ Android development environment started!${NC}"
    echo ""
    echo -e "${YELLOW}📱 Next steps:${NC}"
    echo "  1. Open Android DevTools: http://localhost:19010"
    echo "  2. Connect Android device via USB or start emulator"
    echo "  3. Run: docker-compose exec expo-android npx expo run:android --device"
    echo ""
    echo -e "${BLUE}🔌 USB Device Setup:${NC}"
    echo "  • Enable Developer Options on Android device"
    echo "  • Enable USB Debugging"
    echo "  • Connect device and accept debugging prompt"
    echo ""
}

start_ios() {
    echo -e "${YELLOW}🍎 Starting ReceiptGold iOS Development...${NC}"
    echo ""
    
    # Check if running on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo -e "${RED}⚠️  iOS development requires macOS host${NC}"
        echo "iOS Simulator and device features may not work properly on non-macOS systems."
        echo ""
    fi
    
    echo -e "${BLUE}📋 Services starting:${NC}"
    echo "  • Backend API        → http://localhost:3000"
    echo "  • HTML Service       → http://localhost:3001"  
    echo "  • iOS Dev Server     → http://localhost:19020"
    echo ""
    
    docker-compose --profile ios up -d backend html-service expo-ios
    
    echo ""
    echo -e "${GREEN}✅ iOS development environment started!${NC}"
    echo ""
    echo -e "${YELLOW}📱 Next steps:${NC}"
    echo "  1. Open iOS DevTools: http://localhost:19020"
    echo "  2. Open iOS Simulator or connect iOS device"
    echo "  3. Run: docker-compose exec expo-ios npx expo run:ios --device"
    echo ""
    echo -e "${BLUE}📱 iOS Setup:${NC}"
    echo "  • Xcode must be installed on host macOS"
    echo "  • iOS Simulator available through Xcode"
    echo "  • Physical devices require Apple Developer account"
    echo ""
}

start_mobile() {
    echo -e "${YELLOW}📱 Starting ReceiptGold Mobile Development (iOS + Android)...${NC}"
    echo ""
    
    echo -e "${BLUE}📋 Services starting:${NC}"
    echo "  • Backend API        → http://localhost:3000"
    echo "  • HTML Service       → http://localhost:3001"  
    echo "  • Android Dev Server → http://localhost:19010"
    echo "  • iOS Dev Server     → http://localhost:19020"
    echo ""
    
    docker-compose --profile mobile up -d backend html-service expo-android expo-ios
    
    echo ""
    echo -e "${GREEN}✅ Mobile development environment started!${NC}"
    echo ""
    echo -e "${YELLOW}📱 Next steps:${NC}"
    echo "  Android DevTools: http://localhost:19010"
    echo "  iOS DevTools: http://localhost:19020"
    echo ""
    echo -e "${BLUE}🤖 Android commands:${NC}"
    echo "  docker-compose exec expo-android npx expo run:android --device"
    echo "  docker-compose exec expo-android adb devices"
    echo ""
    echo -e "${BLUE}🍎 iOS commands:${NC}"
    echo "  docker-compose exec expo-ios npx expo run:ios --device"
    echo "  docker-compose exec expo-ios xcrun simctl list devices"
    echo ""
}

start_all() {
    echo -e "${YELLOW}🚀 Starting ALL ReceiptGold Services...${NC}"
    echo ""
    
    echo -e "${BLUE}📋 All services starting:${NC}"
    echo "  • Backend API        → http://localhost:3000"
    echo "  • HTML Service       → http://localhost:3001"  
    echo "  • Web Dev Server     → http://localhost:19000"
    echo "  • Android Dev Server → http://localhost:19010"
    echo "  • iOS Dev Server     → http://localhost:19020"
    echo ""
    
    docker-compose --profile mobile up -d backend html-service expo-dev expo-android expo-ios
    
    echo ""
    echo -e "${GREEN}✅ ALL services started!${NC}"
    echo "You can now develop for web, Android, and iOS simultaneously!"
    echo ""
}

start_prod() {
    echo -e "${YELLOW}🏭 Starting ReceiptGold Production Environment...${NC}"
    echo ""
    
    docker-compose --profile production up -d
    
    echo ""
    echo -e "${GREEN}✅ Production environment started!${NC}"
    echo ""
    echo "🌐 Services available:"
    echo "  • Main Gateway       → http://localhost"
    echo "  • API Endpoints      → http://localhost/api/"
    echo "  • HTML Service       → http://localhost/html-service/"
    echo "  • Health Check       → http://localhost/health"
}

stop_services() {
    echo -e "${YELLOW}🛑 Stopping all ReceiptGold services...${NC}"
    
    docker-compose --profile production down
    
    echo -e "${GREEN}✅ All services stopped${NC}"
}

show_logs() {
    echo -e "${YELLOW}📋 Showing logs for all services...${NC}"
    echo -e "${BLUE}Press Ctrl+C to exit${NC}"
    echo ""
    
    docker-compose logs -f
}

rebuild_images() {
    echo -e "${YELLOW}🔨 Rebuilding all Docker images...${NC}"
    
    docker-compose build --no-cache
    
    echo -e "${GREEN}✅ All images rebuilt${NC}"
}

clean_docker() {
    echo -e "${RED}🧹 Cleaning up Docker resources...${NC}"
    echo "This will remove all ReceiptGold containers and images."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose --profile production down --rmi all --volumes --remove-orphans
        docker system prune -f
        echo -e "${GREEN}✅ Cleanup complete${NC}"
    else
        echo "Cleanup cancelled"
    fi
}

show_status() {
    echo -e "${YELLOW}📊 Service Status:${NC}"
    echo ""
    
    docker-compose ps
    
    echo ""
    echo -e "${YELLOW}🏥 Health Checks:${NC}"
    
    # Check backend
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "  • Backend API:       ${GREEN}✅ Healthy${NC}"
    else
        echo -e "  • Backend API:       ${RED}❌ Unhealthy${NC}"
    fi
    
    # Check HTML service
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "  • HTML Service:      ${GREEN}✅ Healthy${NC}"
    else
        echo -e "  • HTML Service:      ${RED}❌ Unhealthy${NC}"
    fi
    
    # Check Expo
    if curl -s http://localhost:19000 > /dev/null 2>&1; then
        echo -e "  • Expo Dev Server:   ${GREEN}✅ Running${NC}"
    else
        echo -e "  • Expo Dev Server:   ${RED}❌ Not Running${NC}"
    fi
}

# Main script logic
main() {
    print_header
    check_docker
    check_env
    check_docker_desktop
    
    COMMAND=${1:-dev}
    
    case $COMMAND in
        dev)
            start_dev
            ;;
        prod)
            start_prod
            ;;
        android)
            start_android
            ;;
        ios)
            start_ios
            ;;
        mobile)
            start_mobile
            ;;
        all)
            start_all
            ;;
        stop)
            stop_services
            ;;
        logs)
            show_logs
            ;;
        build)
            rebuild_images
            ;;
        clean)
            clean_docker
            ;;
        status)
            show_status
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
