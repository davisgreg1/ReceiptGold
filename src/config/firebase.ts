import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import * as firebaseAuth from 'firebase/auth';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase config
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Validate that all required environment variables are present
const requiredEnvVars = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const { getReactNativePersistence } = firebaseAuth as any;

// Initialize Firestore
const db = getFirestore(app);

// Initialize Firebase services
const functions = getFunctions(app);
// connectFunctionsEmulator(functions, "localhost", 5001); // Connect to local emulator
 
// Initialize Auth with error handling for already-initialized case
let auth: firebaseAuth.Auth;
try {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
    });
} catch (error: any) {
    // If auth is already initialized, get the existing instance
    if (error.code === 'auth/already-initialized') {
        console.log('Auth already initialized, using existing instance');
        auth = getAuth(app);
    } else {
        // Re-throw any other errors
        throw error;
    }
}

let analytics: ReturnType<typeof getAnalytics> | undefined;

// Initialize Analytics only if supported in the current environment
const initializeAnalytics = async () => {
    try {
        const supported = await isSupported();
        if (supported && typeof window !== 'undefined') {
            analytics = getAnalytics(app);
            console.log('Firebase Analytics initialized successfully');
        } else {
            console.log('Firebase Analytics not supported in this environment');
        }
    } catch (error) {
        console.log('Failed to check Analytics support:', error);
    }
};

// Initialize analytics asynchronously
initializeAnalytics();

// Initialize Storage
const storage = getStorage(app);

export { auth, analytics, db, functions, storage };
export default app;
