import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Text,
  TouchableOpacity,
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

import { NavigationProp } from '@react-navigation/native';
import type { ReceiptsStackParamList } from '../navigation/AppNavigator';
import { Receipt } from '../services/firebaseService';

type Props = {
  route: RouteProp<ReceiptDetailParams, 'ReceiptDetail'>;
  navigation: NavigationProp<ReceiptsStackParamList>;
};

export const ReceiptDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  console.log("🚀 ~ ReceiptDetailScreen ~ route:", route)
  const { theme } = useTheme();
  const { receiptId } = route.params;
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  console.log("🚀 ~ ReceiptDetailScreen ~ receipt:", receipt)
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const receiptRef = doc(db, 'receipts', receiptId);
        const receiptSnap = await getDoc(receiptRef);
        
        if (receiptSnap.exists()) {
          const data = receiptSnap.data();
          setReceipt({
            ...data,
            receiptId,
            date: data.date.toDate(),
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate(),
            extractedData: data.extractedData ? {
              ...data.extractedData,
              amount: data.extractedData.amount || 0,
              confidence: data.extractedData.confidence || 1,
              items: (data.extractedData.items || []).map((item: { description: string; amount: number; quantity: number; tax?: number }) => ({
                description: item.description,
                amount: item.amount,
                quantity: item.quantity,
                tax: item.tax || 0,
                price: item.amount / (item.quantity || 1)
              }))
            } : undefined
          } as unknown as Receipt);
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

  useEffect(() => {
    if (receipt) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity 
            onPress={() => navigation.navigate('EditReceipt', { receipt: receipt as any })}
            style={styles.editButton}
          >
            <Text style={{ color: theme.gold.primary }}>Edit</Text>
          </TouchableOpacity>
        ),
      });
    }
  }, [receipt, navigation, theme]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <View style={styles.imageContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.gold.primary} />
        ) : error ? (
          <Text style={[styles.errorText, { color: theme.status.error }]}>{error}</Text>
        ) : receipt?.images?.[0]?.url ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('EditReceipt', { receipt: receipt as any })}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: receipt.images[0].url }}
              style={styles.image}
              resizeMode="contain"
            />
          </TouchableOpacity>
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
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
