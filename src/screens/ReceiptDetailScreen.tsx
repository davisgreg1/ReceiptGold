import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { RouteProp } from '@react-navigation/native';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

type ReceiptDetailParams = {
  ReceiptDetail: {
    imageUrl?: string;
    receiptId: string;
  };
};

type Props = {
  route: RouteProp<ReceiptDetailParams, 'ReceiptDetail'>;
};

export const ReceiptDetailScreen: React.FC<Props> = ({ route }) => {
  console.log("🚀 ~ ReceiptDetailScreen ~ route:", route)
  const { theme } = useTheme();
  const { receiptId } = route.params;
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<any>(null);
  console.log("🚀 ~ ReceiptDetailScreen ~ receipt:", receipt)
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const receiptRef = doc(db, 'receipts', receiptId);
        const receiptSnap = await getDoc(receiptRef);
        
        if (receiptSnap.exists()) {
          setReceipt(receiptSnap.data());
        } else {
          setError('Receipt not found');
        }
      } catch (err) {
        console.error('Error fetching receipt:', err);
        setError('Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [receiptId]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <View style={styles.imageContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.gold.primary} />
        ) : error ? (
          <Text style={[styles.errorText, { color: theme.status.error }]}>{error}</Text>
        ) : receipt?.images?.[0]?.url ? (
          <Image
            source={{ uri: receipt.images[0].url }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <Text style={[styles.errorText, { color: theme.status.error }]}>No image available</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.7,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
});
