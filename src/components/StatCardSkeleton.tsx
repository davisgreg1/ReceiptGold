import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, SkeletonCard } from './Skeleton';

export const StatCardSkeleton: React.FC = () => {
  return (
    <SkeletonCard style={styles.statCard}>
      {/* Header with icon and label */}
      <View style={styles.statHeader}>
        <Skeleton width={20} height={20} borderRadius={10} />
        <Skeleton width={80} height={14} />
      </View>
      
      {/* Main value */}
      <Skeleton width="70%" height={32} style={styles.statValue} />
      
      {/* Footer with trend */}
      <View style={styles.statFooter}>
        <Skeleton width={14} height={14} borderRadius={7} />
        <Skeleton width={120} height={12} style={{ marginLeft: 4 }} />
      </View>
    </SkeletonCard>
  );
};

const styles = StyleSheet.create({
  statCard: {
    flex: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statValue: {
    marginBottom: 8,
  },
  statFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});