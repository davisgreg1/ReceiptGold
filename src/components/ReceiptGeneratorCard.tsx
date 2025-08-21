import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { PlaidTransaction } from '../services/PlaidService';
import { ReceiptGenerator, ReceiptGenerationOptions } from '../utils/ReceiptGenerator';
import { MerchantLogoService, MerchantInfo } from '../services/MerchantLogoService';
import { useAuth } from '../context/AuthContext';

interface ReceiptGeneratorCardProps {
  transaction: PlaidTransaction;
  onReceiptGenerated?: (receiptNumber: string, filePath: string, firestoreId?: string) => void;
}

export const ReceiptGeneratorCard: React.FC<ReceiptGeneratorCardProps> = ({
  transaction,
  onReceiptGenerated,
}) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [merchantInfo, setMerchantInfo] = useState<MerchantInfo | null>(null);
  const [isLoadingMerchant, setIsLoadingMerchant] = useState(false);

  React.useEffect(() => {
    loadMerchantInfo();
  }, [transaction]);

  const loadMerchantInfo = async () => {
    setIsLoadingMerchant(true);
    try {
      const merchantService = MerchantLogoService.getInstance();
      const info = await merchantService.getMerchantInfo(transaction);
      setMerchantInfo(info);
    } catch (error) {
      console.error('Failed to load merchant info:', error);
    } finally {
      setIsLoadingMerchant(false);
    }
  };

  const generateReceipt = async (options: Partial<ReceiptGenerationOptions> = {}) => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to generate receipts.');
      return;
    }

    setIsGenerating(true);

    try {
      const receiptGenerator = ReceiptGenerator.getInstance();
      const result = await receiptGenerator.generateFromTransaction(transaction, {
        format: 'pdf',
        save: true,
        saveToFirestore: true, // Always save to Firestore so it appears in receipts list
        userId: user.uid,
        ...options,
      });

      if (result.success && result.filePath && result.receiptNumber) {
        // Alert.alert(
        //   'Receipt Generated! 📄',
        //   `Receipt ${result.receiptNumber} has been generated and saved to your receipts.`,
        //   [
        //     { text: 'OK' }
        //   ]
        // );
        
        onReceiptGenerated?.(result.receiptNumber, result.filePath, result.firestoreReceiptId);
      } else {
        Alert.alert(
          'Generation Failed',
          result.error || 'Failed to generate receipt. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Receipt generation error:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred while generating the receipt.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAndShare = async () => {
    await generateReceipt({ share: true });
  };

  const handleGenerateOnly = async () => {
    await generateReceipt({ share: false });
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderMerchantLogo = () => {
    if (isLoadingMerchant) {
      return (
        <View style={styles.logoContainer}>
          <ActivityIndicator size="small" color="#667eea" />
        </View>
      );
    }

    if (merchantInfo?.logoUrl && merchantInfo.source !== 'generic') {
      return (
        <View style={styles.logoContainer}>
          <Image 
            source={{ uri: merchantInfo.logoUrl }}
            style={styles.logoImage}
            onError={() => console.log('Logo failed to load')}
          />
        </View>
      );
    } else if (merchantInfo?.source === 'generic') {
      return (
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>{merchantInfo.logoUrl}</Text>
        </View>
      );
    } else {
      // Fallback to first letter
      const firstLetter = (transaction.merchant_name || transaction.name || 'M').charAt(0).toUpperCase();
      return (
        <View style={[styles.logoContainer, styles.logoFallback]}>
          <Text style={styles.logoFallbackText}>{firstLetter}</Text>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {renderMerchantLogo()}
        <View style={styles.transactionInfo}>
          <Text style={styles.merchantName} numberOfLines={1}>
            {merchantInfo?.name || transaction.merchant_name || transaction.name}
          </Text>
          <Text style={styles.transactionAmount}>
            {formatAmount(transaction.amount)}
          </Text>
          <Text style={styles.transactionDate}>
            {formatDate(transaction.date)}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.generateButton]}
          onPress={handleGenerateOnly}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text style={styles.generateButtonText}>Generate Receipt</Text>
              <Text style={styles.buttonIcon}>📄</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.shareButton]}
          onPress={handleGenerateAndShare}
          disabled={isGenerating}
        >
          <Text style={styles.shareButtonText}>Generate & Share</Text>
          <Text style={styles.buttonIcon}>📤</Text>
        </TouchableOpacity>
      </View>

      {merchantInfo && (
        <View style={styles.footer}>
          <Text style={styles.sourceInfo}>
            Logo from {merchantInfo.source === 'plaid' ? 'Plaid' : 
                      merchantInfo.source === 'clearbit' ? 'Clearbit' : 'Generic'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  logoEmoji: {
    fontSize: 32,
  },
  logoFallback: {
    backgroundColor: '#667eea',
  },
  logoFallbackText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  transactionInfo: {
    flex: 1,
  },
  merchantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  transactionAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 50,
  },
  generateButton: {
    backgroundColor: '#667eea',
  },
  shareButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  shareButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonIcon: {
    fontSize: 16,
  },
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  sourceInfo: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});
