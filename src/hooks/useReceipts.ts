import { useEffect, useState } from 'react';
import { onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';
import { ReceiptData } from '../types';

export const useReceipts = () => {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setReceipts([]);
      setLoading(false);
      return;
    }

    // Set up real-time listener for receipts
    const receiptsQuery = query(
      collection(db, 'receipts'),
      where('userId', '==', user.uid),
      where('status', '!=', 'deleted'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      receiptsQuery,
      (snapshot) => {
        const receiptsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ReceiptData[];
        setReceipts(receiptsList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching receipts:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [user]);

  return { receipts, loading, error };
};
