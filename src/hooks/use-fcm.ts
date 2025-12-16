"use client";

import { useState, useEffect, useCallback } from 'react';
import { requestNotificationPermission, onForegroundMessage } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

interface UseFCMOptions {
  onMessage?: (payload: any) => void;
}

interface UseFCMReturn {
  fcmToken: string | null;
  isLoading: boolean;
  error: string | null;
  permissionStatus: NotificationPermission | null;
  requestPermission: () => Promise<string | null>;
  registerToken: () => Promise<boolean>;
}

export function useFCM(options: UseFCMOptions = {}): UseFCMReturn {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);
  const { toast } = useToast();
  const { token: authToken, isAuthenticated } = useAuth();

  // Check current permission status
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Register service worker first
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered:', registration);
      }

      const token = await requestNotificationPermission();
      
      if (token) {
        setFcmToken(token);
        setPermissionStatus('granted');
        
        // Store token in localStorage for persistence
        localStorage.setItem('fcmToken', token);
        
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive push notifications.',
        });
      } else {
        setPermissionStatus(Notification.permission);
        if (Notification.permission === 'denied') {
          setError('Notification permission was denied. Please enable it in your browser settings.');
          toast({
            variant: 'destructive',
            title: 'Notifications Blocked',
            description: 'Please enable notifications in your browser settings.',
          });
        }
      }

      return token;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable notifications';
      setError(errorMessage);
      console.error('FCM permission error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Register FCM token with backend
  const registerToken = useCallback(async (): Promise<boolean> => {
    if (!fcmToken || !authToken) {
      console.log('No FCM token or auth token available');
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ 
          fcmToken,
          platform: 'web',
          deviceInfo: {
            userAgent: navigator.userAgent,
            language: navigator.language,
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register FCM token with server');
      }

      const result = await response.json();
      console.log('FCM token registered with server:', result);
      return true;
    } catch (err) {
      console.error('Failed to register FCM token:', err);
      return false;
    }
  }, [fcmToken, authToken]);

  // Listen for foreground messages
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (payload: any) => {
      console.log('Foreground message received:', payload);

      // Show toast for foreground notifications
      toast({
        title: payload.notification?.title || 'New Notification',
        description: payload.notification?.body || 'You have a new notification',
      });

      // Call custom handler if provided
      if (options.onMessage) {
        options.onMessage(payload);
      }
    };

    onForegroundMessage(handleMessage);
  }, [toast, options.onMessage]);

  // Auto-register token when authenticated
  useEffect(() => {
    if (isAuthenticated && fcmToken) {
      registerToken();
    }
  }, [isAuthenticated, fcmToken, registerToken]);

  // Load stored token on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('fcmToken');
      if (storedToken) {
        setFcmToken(storedToken);
      }
    }
  }, []);

  return {
    fcmToken,
    isLoading,
    error,
    permissionStatus,
    requestPermission,
    registerToken,
  };
}

