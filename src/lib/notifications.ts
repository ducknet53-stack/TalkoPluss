import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app, db } from './firebase';
import { collection, doc, setDoc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { User } from '../types';
import toast from 'react-hot-toast';

export interface NotificationSettings {
  messages: boolean;
  groups: boolean;
  events: boolean;
}

// Default VAPID key (Users can set VITE_FCM_VAPID_KEY in environment variables or replace it here)
export const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY || "BHzZz_Replace_With_Your_Actual_VAPID_Key_From_Firebase_Console";

let messaging: any = null;

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  isSupported().then((supported) => {
    if (supported) {
      try {
        messaging = getMessaging(app);
      } catch (err) {
        console.warn("Firebase Cloud Messaging initialization failed:", err);
      }
    } else {
      console.log("Firebase Cloud Messaging is not supported in this browser/iframe context.");
    }
  }).catch((err) => {
    console.warn("FCM isSupported check failed:", err);
  });
}

/**
 * Play a standard notification sound
 */
export function playNotificationSound() {
  try {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {
    console.error("Failed to play notification sound:", e);
  }
}

/**
 * Trigger an instant native HTML5 web notification
 */
export function showLocalNotification(title: string, options: NotificationOptions & { chatId?: string } = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  
  if (Notification.permission !== 'granted') return;

  const defaultOptions: any = {
    icon: 'https://api.dicebear.com/7.x/identicon/svg?seed=Talko',
    badge: 'https://api.dicebear.com/7.x/identicon/svg?seed=Talko',
    tag: 'talko-message',
    renotify: true,
    silent: false,
    ...options
  };

  try {
    const notification = new Notification(title, defaultOptions as NotificationOptions);
    playNotificationSound();

    notification.onclick = (e) => {
      e.preventDefault();
      window.focus();
      notification.close();
      
      if (options.chatId) {
        // Dispatch custom event to let the app open the chat automatically
        const event = new CustomEvent('open-chat', { detail: { chatId: options.chatId } });
        window.dispatchEvent(event);
      }
    };
  } catch (err) {
    // Falls back to service worker display if constructor is restricted
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, defaultOptions);
      }).catch(e => console.error("SW notification fallback failed:", e));
    }
  }
}

/**
 * Request notification permission first via custom UI and then via browser prompt
 */
export async function requestNotificationPermission(userId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    toast.error("Tarayıcınız bildirim sistemini desteklemiyor.");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    console.log("Notification permission requested. Result:", permission);
    if (permission === 'granted') {
      toast.success("Bildirimler başarıyla açıldı! 🎉");
      console.log("Notification permission GRANTED");
      
      // Register FCM Token if messaging is available
      if (messaging) {
        try {
          console.log("Registering Service Worker: /service-worker.js");
          // Register the Service Worker explicitly first
          const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/'
          });
          console.log("Service Worker registered successfully! Scope:", registration.scope);
          
          console.log("Fetching FCM Token from Firebase Messaging using VAPID Key...");
          const token = await getToken(messaging, {
            serviceWorkerRegistration: registration,
            vapidKey: VAPID_KEY
          });

          if (token) {
            console.log("FCM Token successfully generated:", token);
            console.log("Registering FCM Token in Firestore for user:", userId);
            await registerDeviceToken(userId, token);
            console.log("FCM Token registered in Firestore successfully.");
          } else {
            console.warn("FCM Token is empty or null");
          }
        } catch (fcmErr: any) {
          console.error("FCM Token fetch or Service Worker registration failed:", fcmErr);
          console.warn("FCM Token fetch failed, falling back to local notifications. VAPID key may need to be updated. Error:", fcmErr.message);
        }
      } else {
        console.warn("Firebase Messaging is not initialized or not supported in this context.");
      }
      return true;
    } else {
      console.warn("Notification permission was denied.");
      toast.error("Bildirim izni reddedildi.");
      return false;
    }
  } catch (err: any) {
    console.error("Error requesting permission:", err);
    return false;
  }
}

/**
 * Save FCM token to Firestore
 */
export async function registerDeviceToken(userId: string, token: string) {
  if (!userId || !token) return;
  try {
    const tokenRef = doc(db, `users/${userId}/tokens`, token);
    await setDoc(tokenRef, {
      token,
      userId,
      platform: navigator.platform || 'Unknown',
      userAgent: navigator.userAgent,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error("Error registering token in Firestore:", err);
  }
}

/**
 * Remove FCM token from Firestore (on logout)
 */
export async function unregisterDeviceToken(userId: string, token: string) {
  if (!userId || !token) return;
  try {
    const tokenRef = doc(db, `users/${userId}/tokens`, token);
    await deleteDoc(tokenRef);
  } catch (err) {
    console.error("Error unregistering token:", err);
  }
}

/**
 * Clear all tokens of a user from Firestore (useful for absolute logout)
 */
export async function clearAllUserTokens(userId: string) {
  // Optional client-side utility
  console.log(`Clearing FCM tokens for user ${userId}`);
}

/**
 * Setup default notification settings for user profile if not exists
 */
export function getDefaultSettings(): NotificationSettings {
  return {
    messages: true,
    groups: true,
    events: true
  };
}

/**
 * Update user's notification settings in Firestore
 */
export async function updateNotificationSettingsInDb(userId: string, settings: Partial<NotificationSettings>) {
  if (!userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data() as User;
      const currentSettings = data.notificationSettings || getDefaultSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await updateDoc(userRef, {
        notificationSettings: updatedSettings
      });
      toast.success("Bildirim ayarları kaydedildi!");
    }
  } catch (err) {
    console.error("Failed to update notification settings:", err);
    toast.error("Ayarlar kaydedilirken bir hata oluştu.");
  }
}

/**
 * Listens for foreground FCM messages
 */
export function listenToForegroundMessages(onMessageReceived: (payload: any) => void) {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    onMessageReceived(payload);
  });
}
