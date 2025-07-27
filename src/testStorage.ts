import { testStorageConnection } from './utils/testStorage';

const runTest = async () => {
    console.log('Starting storage connection test...');
    const result = await testStorageConnection();
    console.log('Test result:', result);
};

runTest();
