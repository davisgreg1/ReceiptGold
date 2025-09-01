import { useEffect, useState } from 'react';
import { onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './useAuth';
import { ReportData } from '../types';

export const useReports = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setReports([]);
      setLoading(false);
      return;
    }

    // Set up real-time listener for reports
    const reportsQuery = query(
      collection(db, 'reports'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const reportsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ReportData[];
        setReports(reportsList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching reports:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [user]);

  return { reports, loading, error };
};
