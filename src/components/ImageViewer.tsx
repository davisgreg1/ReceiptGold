import React from 'react';
import {
  View,
  Image,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ImageViewerProps {
  imageUrl: string;
  visible: boolean;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const ImageViewer: React.FC<ImageViewerProps> = ({
  imageUrl,
  visible,
  onClose,
}) => {

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.9)" barStyle="light-content" />
      <View style={styles.container}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>

        {/* Zoomable image */}
        <ScrollView
          maximumZoomScale={5}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
          centerContent
        >
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="contain"
          />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: screenWidth,
    height: screenHeight,
  },
});