#!/bin/bash

# Copy GoogleService-Info.plist to the correct location
echo "Copying GoogleService-Info.plist to ios directory..."

# Ensure the ios/ReceiptGold directory exists
mkdir -p ios/ReceiptGold

# Copy the GoogleService-Info.plist file if it exists at the root
if [ -f "GoogleService-Info.plist" ]; then
    cp GoogleService-Info.plist ios/ReceiptGold/GoogleService-Info.plist
    echo "GoogleService-Info.plist copied successfully"
else
    echo "WARNING: GoogleService-Info.plist not found at project root"
fi