import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, ViewStyle, StyleSheet, TouchableOpacity, Alert, Modal } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Pdf from 'react-native-pdf';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { useTheme } from '../theme/ThemeProvider';

interface PDFViewerProps {
  pdfUri?: string;
  pdfFilePath?: string;
  style?: ViewStyle;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUri, pdfFilePath, style }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfSource, setPdfSource] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

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

  // Handle share PDF functionality
  const handleSharePDF = async () => {
    try {
      const filePath = pdfUri || pdfFilePath;
      if (filePath && await Sharing.isAvailableAsync()) {
        // Share with general sharing dialog
        await Sharing.shareAsync(filePath, {
          dialogTitle: 'Share PDF Receipt'
        });
      } else {
        Alert.alert('Error', 'Cannot share PDF - sharing not available');
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert('Error', 'Failed to share PDF');
    }
  };

  if (loading) {
    console.log('📄 PDFViewer - Rendering loading state');
    return (
      <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background.secondary }, style]}>
        <ActivityIndicator size="large" color={theme.gold.primary} />
        <Text style={{ marginTop: 10, color: theme.text.secondary }}>Loading PDF...</Text>
      </View>
    );
  }

  if (error) {
    console.log('📄 PDFViewer - Rendering error state:', error);
    return (
      <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background.secondary, padding: 20 }, style]}>
        <Text style={{ color: theme.status.error, textAlign: 'center', fontSize: 14 }}>
          Error loading PDF: {error}
        </Text>
      </View>
    );
  }

  if (!pdfSource) {
    return (
      <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background.secondary }, style]}>
        <Text style={{ color: theme.text.secondary }}>No PDF to display</Text>
      </View>
    );
  }

  console.log('📄 PDFViewer - Rendering PDF preview with modal');
  
  // Create styles based on current theme
  const styles = StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.background.elevated,
      borderBottomWidth: 1,
      borderBottomColor: theme.border.primary,
    },
    headerText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text.primary,
    },
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.gold.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
    },
    shareButtonText: {
      color: theme.text.inverse,
      fontWeight: '600',
      marginLeft: 6,
    },
    pdfPreviewContainer: {
      flex: 1,
      margin: 16,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: theme.background.elevated,
      shadowColor: theme.gold.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    pdfPreview: {
      flex: 1,
      position: 'relative',
    },
    pdfPreviewViewer: {
      flex: 1,
    },
    previewOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.background.overlay,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    tapHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tapHintText: {
      color: theme.text.inverse,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    pdfLoading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background.secondary,
    },
    loadingText: {
      marginTop: 8,
      color: theme.text.secondary,
      fontSize: 14,
    },
    // Modal Styles
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background.primary,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border.primary,
      backgroundColor: theme.background.elevated,
      shadowColor: theme.gold.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text.primary,
    },
    modalActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    modalShareButton: {
      padding: 8,
      marginRight: 12,
    },
    modalCloseButton: {
      padding: 8,
    },
    modalContent: {
      flex: 1,
      backgroundColor: theme.background.primary,
    },
    pdfViewer: {
      flex: 1,
      backgroundColor: theme.background.primary,
    },
  });
  
  return (
    <View style={[{ flex: 1, backgroundColor: theme.background.primary }, style]}>
      {/* Header with Share Button */}
      <View style={styles.header}>
        <Text style={styles.headerText}>PDF Receipt</Text>
        <TouchableOpacity
          onPress={handleSharePDF}
          style={styles.shareButton}
        >
          <Ionicons name="share" size={20} color="#fff" />
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* PDF Preview - Clickable to open modal */}
      <TouchableOpacity 
        style={styles.pdfPreviewContainer}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <View style={styles.pdfPreview}>
          {pdfSource ? (
            <Pdf
              source={pdfSource}
              style={[styles.pdfPreviewViewer, { backgroundColor: theme.background.elevated }]}
              enablePaging={false}
              enableRTL={false}
              enableAnnotationRendering={true}
              password=""
              spacing={0}
              enableDoubleTapZoom={false}
              maxScale={1}
              minScale={1}
              scale={1.0}
              horizontal={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              onError={(error) => {
                console.error('PDF preview error:', error);
              }}
            />
          ) : (
            <View style={styles.pdfLoading}>
              <ActivityIndicator size="large" color={theme.gold.primary} />
              <Text style={styles.loadingText}>Loading PDF...</Text>
            </View>
          )}
          
          {/* Overlay with tap hint */}
          <View style={styles.previewOverlay}>
            <View style={styles.tapHint}>
              <Ionicons name="expand" size={24} color={theme.text.inverse} />
              <Text style={styles.tapHintText}>Tap to view full PDF</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Full PDF Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>PDF Receipt</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={handleSharePDF}
                style={styles.modalShareButton}
              >
                <Ionicons name="share" size={24} color={theme.gold.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Full Interactive PDF */}
          <View style={styles.modalContent}>
            {pdfSource ? (
              <View style={{ flex: 1, backgroundColor: theme.background.primary }}>
                <Pdf
                  source={pdfSource}
                  style={[styles.pdfViewer, { backgroundColor: theme.background.primary }]}
                  onLoadComplete={(numberOfPages, filePath) => {
                    console.log(`PDF loaded in modal: ${numberOfPages} pages at ${filePath}`);
                  }}
                  onPageChanged={(page, numberOfPages) => {
                    console.log(`Current page: ${page}/${numberOfPages}`);
                  }}
                  onError={(error) => {
                    console.error('PDF modal error:', error);
                    Alert.alert('Error', 'Failed to load PDF');
                  }}
                  onPressLink={(uri) => {
                    console.log(`Link pressed: ${uri}`);
                  }}
                  enablePaging={true}
                  enableRTL={false}
                  enableAnnotationRendering={true}
                  password=""
                  spacing={0}
                  enableDoubleTapZoom={true}
                  maxScale={3}
                  minScale={0.5}
                  scale={1.0}
                  horizontal={false}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={true}
                />
              </View>
            ) : (
              <View style={styles.pdfLoading}>
                <ActivityIndicator size="large" color={theme.gold.primary} />
                <Text style={styles.loadingText}>Loading PDF...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};
