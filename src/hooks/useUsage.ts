import { useEffect, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './useAuth';
import { UsageDocument } from '../types';

export const useUsage = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setUsage(null);
      setLoading(false);
      return;
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const usageDocId = `${user.uid}_${currentMonth}`;

    // Set up real-time listener for usage
    const unsubscribe = onSnapshot(
      doc(db, 'usage', usageDocId),
      (doc) => {
        if (doc.exists()) {
          setUsage(doc.data() as UsageDocument);
        } else {
          setUsage(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching usage:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [user]);

  return { usage, loading, error };
};
