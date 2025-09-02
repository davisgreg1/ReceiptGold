import { useEffect, useState, useRef } from 'react';
import { useConnectivity } from '../hooks/useConnectivity';
import { LocalReceiptService } from './LocalReceiptService';
import { receiptService } from './firebaseService';

export function useReceiptSync() {
  const isConnected = useConnectivity();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastSyncAttempt = useRef<number>(0);
  const syncInProgress = useRef<boolean>(false);

  useEffect(() => {
    if (!isConnected || syncInProgress.current) return;
    
    // Debounce sync attempts to prevent rapid re-syncing
    const now = Date.now();
    if (now - lastSyncAttempt.current < 5000) { // 5 second debounce
      return;
    }
    
    (async () => {
      const queue = await LocalReceiptService.getSyncQueue();
      if (queue.length === 0) return;
      
      syncInProgress.current = true;
      lastSyncAttempt.current = now;
      setSyncing(true);
      setSyncError(null);
      
      try {
        for (const item of queue) {
          try {
            if (item.deleted) {
              await receiptService.deleteReceipt(item.receiptId, item.userId);
            } else if (item.receiptId) {
              await receiptService.updateReceipt(item.receiptId, item);
            } else {
              await receiptService.createReceipt(item);
            }
          } catch (err) {
            setSyncError('Failed to sync some receipts.');
            // Optionally log error
            continue;
          }
        }
        await LocalReceiptService.clearSyncQueue();
      } catch (err) {
        setSyncError('Sync failed.');
      } finally {
        setSyncing(false);
        syncInProgress.current = false;
      }
    })();
  }, [isConnected]);

  return { syncing, syncError };
}
