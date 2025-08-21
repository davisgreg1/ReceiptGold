import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, ViewStyle, StyleSheet, Dimensions, TouchableOpacity, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import { Text } from './Text';

interface PDFViewerProps {
  pdfUri?: string;
  pdfFilePath?: string;
  style?: ViewStyle;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUri, pdfFilePath, style }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfSource, setPdfSource] = useState<any>(null);

  console.log('📄 PDFViewer - Component rendered with:', { pdfUri, pdfFilePath });

  useEffect(() => {
    console.log('📄 PDFViewer - useEffect triggered');
    const setupPDF = async () => {
      try {
        setLoading(true);
        setError(null);

        // Determine which PDF source to use
        const filePath = pdfUri || pdfFilePath;
        
        if (!filePath) {
          throw new Error('No PDF path provided');
        }

        console.log('📄 PDFViewer - Setting up PDF with path:', filePath);

        // Check if file exists
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        console.log('📄 PDFViewer - File info:', fileInfo);

        if (!fileInfo.exists) {
          throw new Error('PDF file does not exist at path: ' + filePath);
        }

        // Set the PDF source in the format expected by react-native-pdf
        const source = {
          uri: filePath,
          cache: true
        };
        
        console.log('📄 PDFViewer - PDF source set:', source);
        setPdfSource(source);
        
      } catch (error) {
        console.error('📄 PDFViewer - Error setting up PDF:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        // Provide user-friendly error messages
        if (errorMessage.includes('PDF file does not exist') && (pdfUri || pdfFilePath)) {
          setError(`PDF file is no longer available. This may be an old receipt - try regenerating it from the bank transactions screen.`);
        } else {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };

    setupPDF();
  }, [pdfUri, pdfFilePath]);

  if (loading) {
    console.log('📄 PDFViewer - Rendering loading state');
    return (
      <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }, style]}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={{ marginTop: 10, color: '#666' }}>Loading PDF...</Text>
      </View>
    );
  }

  if (error) {
    console.log('📄 PDFViewer - Rendering error state:', error);
    return (
      <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 20 }, style]}>
        <Text style={{ color: 'red', textAlign: 'center', fontSize: 14 }}>
          Error loading PDF: {error}
        </Text>
      </View>
    );
  }

  if (!pdfSource) {
    return (
      <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }, style]}>
        <Text style={{ color: '#666' }}>No PDF to display</Text>
      </View>
    );
  }

  console.log('📄 PDFViewer - Rendering PDF with source:', pdfSource);
  
  return (
    <View style={[{ flex: 1, backgroundColor: '#f0f0f0' }, style]}>
      <Pdf
        source={pdfSource}
        onLoadComplete={(numberOfPages: number, filePath: string) => {
          console.log('📄 PDFViewer - PDF loaded successfully');
          console.log(`📄 Number of pages: ${numberOfPages}`);
          console.log(`📄 File path: ${filePath}`);
          setLoading(false);
        }}
        onPageChanged={(page: number, numberOfPages: number) => {
          console.log(`📄 Current page: ${page} of ${numberOfPages}`);
        }}
        onError={(error: any) => {
          console.error('📄 PDFViewer - PDF loading error:', error);
          setError(error?.message || 'Failed to load PDF');
          setLoading(false);
        }}
        onPressLink={(uri: string) => {
          console.log(`📄 Link pressed: ${uri}`);
        }}
        style={styles.pdf}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  }
});
