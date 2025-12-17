import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging, isSupported } from 'firebase/messaging';

// Firebase configuration - add these to your .env.local file
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase App
let app: FirebaseApp;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Get Firebase Messaging instance (client-side only)
let messaging: Messaging | null = null;

export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined') return null;
  
  const supported = await isSupported();
  if (!supported) {
    console.warn('Firebase Messaging is not supported in this browser');
    return null;
  }
  
  if (!messaging) {
    messaging = getMessaging(app);
  }
  
  return messaging;
};

// Request notification permission and get FCM token
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    if (typeof window === 'undefined') return null;
    
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }
    
    const messagingInstance = await getFirebaseMessaging();
    if (!messagingInstance) return null;
    
    // Get FCM token
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    
    const token = await getToken(messagingInstance, {
      vapidKey: vapidKey,
    });
    
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};

// Listen for foreground messages
export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (typeof window === 'undefined') return () => {};
  
  getFirebaseMessaging().then((messagingInstance) => {
    if (messagingInstance) {
      onMessage(messagingInstance, (payload) => {
        console.log('Foreground message received:', payload);
        callback(payload);
      });
    }
  });
};

export { app };

