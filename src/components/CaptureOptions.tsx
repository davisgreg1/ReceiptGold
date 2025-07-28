import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface CaptureOptionsProps {
  onSelectCamera: () => void;
  onSelectGallery: () => void;
  isLoading?: boolean;
  ocrStatus?: string;
}

export const CaptureOptions = ({ onSelectCamera, onSelectGallery, isLoading, ocrStatus }: CaptureOptionsProps) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <Text style={[styles.title, { color: theme.text.primary }]}>
        Add Receipt
      </Text>
      <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
        Choose how you want to add your receipt
      </Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.gold.primary }]}
          onPress={onSelectCamera}
          disabled={isLoading}
        >
          <Text style={styles.buttonIcon}>📸</Text>
          <Text style={styles.buttonText}>Take Photo</Text>
          <Text style={styles.buttonSubtext}>Use your camera to capture the receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.gold.primary }]}
          onPress={onSelectGallery}
          disabled={isLoading}
        >
          <Text style={styles.buttonIcon}>🖼️</Text>
          <Text style={styles.buttonText}>Choose from Gallery</Text>
          <Text style={styles.buttonSubtext}>Select an existing photo</Text>
        </TouchableOpacity>
      </View>

      {ocrStatus && (
        <Text style={[styles.status, { color: theme.text.secondary }]}>
          {ocrStatus}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  button: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  buttonSubtext: {
    color: 'white',
    opacity: 0.8,
    fontSize: 14,
  },
  status: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
});
