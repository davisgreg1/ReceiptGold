# Docker Mobile Development Guide

This guide covers mobile development with ReceiptGold using Docker for Android and iOS platforms.

## Quick Start

```bash
# Start Android development
./docker-start.sh android

# Start iOS development (macOS only)
./docker-start.sh ios

# Start both Android and iOS
./docker-start.sh mobile

# Start everything (web + mobile)
./docker-start.sh all
```

## Android Development

### Prerequisites

- USB Debugging enabled on Android device
- Android device connected via USB
- Docker with privileged mode support

### Setup

1. **Enable Developer Options** on your Android device:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings → Developer Options
   - Enable "USB Debugging"

2. **Connect Device**:
   ```bash
   # Check if device is detected (after connecting USB)
   docker-compose exec expo-android adb devices
   ```

3. **Development Workflow (Recommended)**:
   ```bash
   # Method 1: Expo Go App (Recommended for Docker)
   # 1. Install Expo Go from Google Play Store on your device
   # 2. Connect device to same WiFi as your computer
   # 3. Open http://localhost:19010 in browser
   # 4. Scan QR code with Expo Go app
   
   # Method 2: USB Development (may have compatibility issues)
   docker-compose exec expo-android adb devices
   docker-compose exec expo-android npx expo run:android --device
   ```

4. **Architecture Note**:
   - Docker on Apple Silicon (M1/M2) may have ADB compatibility issues
   - **Recommended**: Use Expo Go app with QR code scanning
   - **Alternative**: Use host ADB if Docker ADB fails

### Android Troubleshooting

#### Architecture Compatibility Issues (Apple Silicon)
```bash
# Error: "rosetta error: failed to open elf at /lib64/ld-linux-x86-64.so.2"
# This happens when running x86_64 Android tools on ARM64 Docker

# Solution 1: Use Expo Go App (Recommended)
# 1. Install Expo Go from Google Play Store
# 2. Connect to same WiFi network
# 3. Scan QR code from http://localhost:19010

# Solution 2: Use Host ADB
# On macOS host:
adb devices  # Check if device is detected on host
# Then use network tunnel to container

# Solution 3: Force x86_64 Docker Build
docker build --platform linux/amd64 -f Dockerfile.android .
```

#### Build Errors
```bash
# Clean build
docker-compose exec expo-android npx expo run:android --device --clear

# Check Android SDK
docker-compose exec expo-android which android
docker-compose exec expo-android android list sdk
```

#### USB Permissions (Linux)
If running on Linux, you may need to configure USB permissions:
```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Create udev rules for Android devices
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="18d1", MODE="0666", GROUP="plugdev"' | sudo tee /etc/udev/rules.d/51-android.rules

# Reload udev rules
sudo udevadm control --reload-rules
```

## iOS Development

### Prerequisites

- **macOS host system** (iOS development requires macOS)
- Xcode installed on host
- Apple Developer account (for physical devices)

### Setup

1. **Start iOS Development**:
   ```bash
   ./docker-start.sh ios
   ```

2. **Important: iOS Development Workflow**:
   - The Docker container runs the Metro bundler (JavaScript packager)
   - iOS Simulator and Xcode must run on your macOS host (not in Docker)
   - The container serves the development server at `http://localhost:19020`

3. **Run on Simulator**:
   ```bash
   # On your macOS host (outside Docker):
   # 1. Open Xcode and launch iOS Simulator
   # 2. In your project directory, run:
   npx expo run:ios
   
   # Or connect to the containerized Metro bundler:
   # Open http://localhost:19020 in your browser
   ```

4. **Run on Physical Device**:
   ```bash
   # On your macOS host:
   npx expo run:ios --device
   ```

### iOS Troubleshooting

#### Container vs Host Development
- **Metro Bundler**: Runs in Docker container on port 19020
- **iOS Simulator/Xcode**: Must run on macOS host (cannot run in Docker)
- **Connection**: Simulator connects to `http://localhost:19020`

#### Simulator Not Found
```bash
# On macOS host (not in container):
# Check Xcode installation
xcode-select --print-path

# Launch iOS Simulator manually
open -a Simulator

# Run Expo from host to connect to containerized Metro
npx expo start --ios
```

#### Container Connection Issues
```bash
# Check if iOS container is running
docker-compose ps expo-ios

# View iOS container logs
docker-compose logs expo-ios

# Test Metro bundler connection
curl http://localhost:19020
```

#### Physical Device Issues
```bash
# On macOS host (device development requires host Xcode):
# Check connected devices
xcrun devicectl list devices

# Trust computer on iOS device (prompt appears on device)
```

#### Xcode/Docker Integration
- **Reality**: iOS Simulator cannot run inside Linux Docker containers
- **Solution**: Use Docker for Metro bundler + macOS host for Xcode/Simulator
- **Workflow**: Container serves JavaScript, host runs iOS tools

## Multi-Platform Development

### Run Both Platforms
```bash
# Start both Android and iOS development
./docker-start.sh mobile

# Check both platforms
docker-compose exec expo-android adb devices
docker-compose exec expo-ios xcrun simctl list devices
```

### Platform-Specific Commands
```bash
# Android specific
docker-compose exec expo-android npx expo run:android --device
docker-compose exec expo-android adb logcat

# iOS specific  
docker-compose exec expo-ios npx expo run:ios --device
docker-compose exec expo-ios xcrun simctl logverbose enable
```

## Development Workflow

### Hot Reload
Both Android and iOS containers support Expo's hot reload:
- Code changes are automatically reflected
- Metro bundler runs inside containers
- Device/simulator connects to container server

### Debugging
```bash
# View container logs
docker-compose logs expo-android
docker-compose logs expo-ios

# Access development servers
# Android: http://localhost:19010
# iOS: http://localhost:19020

# Device logs
docker-compose exec expo-android adb logcat | grep ReactNative
docker-compose exec expo-ios xcrun simctl spawn booted log stream --predicate 'process == "ReceiptGold"'
```

### Building for Production
```bash
# Android APK
docker-compose exec expo-android npx expo build:android

# iOS App Store
docker-compose exec expo-ios npx expo build:ios
```

## Performance Tips

### Container Resources
Ensure Docker has adequate resources:
- Memory: 4GB+ recommended
- CPU: 2+ cores
- Storage: 10GB+ for Android SDK

### USB Performance
For best USB device performance:
- Use USB 3.0 ports
- Avoid USB hubs when possible
- Keep USB cables short

### Build Speed
```bash
# Use build cache
docker-compose exec expo-android npx expo run:android --no-build-cache false

# Parallel builds
docker-compose exec expo-android export GRADLE_OPTS="-Dorg.gradle.parallel=true"
```

## Advanced Configuration

### Custom Android SDK
Modify `Dockerfile.android` to add additional SDK components:
```dockerfile
RUN sdkmanager "system-images;android-30;google_apis;x86_64" \
               "emulator" \
               "platform-tools"
```

### iOS Simulator Configuration
```bash
# Custom iOS simulator setup in container
docker-compose exec expo-ios xcrun simctl create "MyDevice" "iPhone 14" "iOS16.0"
docker-compose exec expo-ios xcrun simctl boot "MyDevice"
```

### Environment Variables
Set platform-specific environment variables in `docker-compose.yml`:
```yaml
expo-android:
  environment:
    - ANDROID_HOME=/opt/android-sdk
    - ANDROID_AVD_HOME=/root/.android/avd
    
expo-ios:
  environment:
    - IOS_SIMULATOR_UDID=auto
```

## Troubleshooting Guide

### Common Issues

1. **Container Won't Start**
   ```bash
   # Check Docker daemon
   docker info
   
   # Check compose file
   docker-compose config
   
   # View startup logs
   docker-compose logs expo-android
   ```

2. **Device Not Connecting**
   ```bash
   # Reset USB debugging
   # Android: Turn off/on USB debugging
   # iOS: Trust/untrust computer
   
   # Restart containers
   docker-compose restart expo-android expo-ios
   ```

3. **Build Failures**
   ```bash
   # Clean everything
   docker-compose down
   docker system prune -f
   ./docker-start.sh mobile
   ```

4. **Network Issues**
   ```bash
   # Check port availability
   lsof -i :19010  # Android
   lsof -i :19020  # iOS
   
   # Reset network
   docker network prune
   ```

### Getting Help

- Check container logs: `docker-compose logs [service]`
- Verify device connections: `adb devices` / `xcrun devicectl list`
- Test with simple Expo project first
- Consult Expo documentation for platform-specific issues

## Integration with Docker Desktop

All mobile services appear in Docker Desktop with helpful labels:
- `receiptgold-expo-android`: Android development
- `receiptgold-expo-ios`: iOS development
- Easy start/stop from GUI
- View logs and stats

Use Docker Desktop for visual management while keeping CLI for development commands.
