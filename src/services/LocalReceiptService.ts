import AsyncStorage from '@react-native-async-storage/async-storage';
import { Receipt } from '../types/receipt';

const RECEIPT_KEY = 'local_receipts';
const SYNC_QUEUE_KEY = 'receipt_sync_queue';

export const LocalReceiptService = {
  async getReceipts(): Promise<Receipt[]> {
    const data = await AsyncStorage.getItem(RECEIPT_KEY);
    return data ? JSON.parse(data) : [];
  },

  async saveReceipt(receipt: Receipt): Promise<void> {
    const receipts = await LocalReceiptService.getReceipts();
    receipts.push(receipt);
    await AsyncStorage.setItem(RECEIPT_KEY, JSON.stringify(receipts));
    await LocalReceiptService.queueForSync(receipt);
  },

  async updateReceipt(updated: Receipt): Promise<void> {
  let receipts = await LocalReceiptService.getReceipts();
  receipts = receipts.map(r => r.receiptId === updated.receiptId ? updated : r);
  await AsyncStorage.setItem(RECEIPT_KEY, JSON.stringify(receipts));
  await LocalReceiptService.queueForSync(updated);
  },

  async deleteReceipt(id: string): Promise<void> {
  let receipts = await LocalReceiptService.getReceipts();
  receipts = receipts.filter(r => r.receiptId !== id);
  await AsyncStorage.setItem(RECEIPT_KEY, JSON.stringify(receipts));
  await LocalReceiptService.queueForSync({ receiptId: id, deleted: true });
  },

  async queueForSync(receipt: any): Promise<void> {
    const queue = await LocalReceiptService.getSyncQueue();
    queue.push(receipt);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  },

  async getSyncQueue(): Promise<any[]> {
    const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  },

  async clearSyncQueue(): Promise<void> {
    await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
  },
};
