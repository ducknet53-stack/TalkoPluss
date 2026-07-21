import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';
import { ensureSystemAccount, sendWelcomeMessageIfNeeded } from '../lib/systemAccount';
import { UAParser } from 'ua-parser-js';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  deviceId: string | null;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  deviceId: null,
});

export const useAuth = () => useContext(AuthContext);

// Generate a random device ID
const generateDeviceId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Get or create device ID
const getDeviceId = () => {
  let id = localStorage.getItem('talko_device_id');
  if (!id) {
    id = generateDeviceId();
    localStorage.setItem('talko_device_id', id);
  }
  return id;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const userProfileRef = useRef<User | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeDevice: (() => void) | null = null;
    let cleanupEvents: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous user listeners and event handlers if any exist
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      if (unsubscribeDevice) {
        unsubscribeDevice();
        unsubscribeDevice = null;
      }
      if (cleanupEvents) {
        cleanupEvents();
        cleanupEvents = null;
      }

      setCurrentUser(user);
      
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const currentDeviceId = getDeviceId();
        setDeviceId(currentDeviceId);

        // Auto-elevate developer email as admin in Firestore database
        if (user.email === 'ducknet53@gmail.com') {
          await setDoc(userRef, { isAdmin: true }, { merge: true })
            .catch(err => console.error("Could not auto-elevate admin status:", err));
        }
        
        // Register device
        const parser = new UAParser();
        const result = parser.getResult();
        const deviceName = result.device.model || result.os.name || 'Bilinmeyen Cihaz';
        const browser = result.browser.name || 'Bilinmeyen Tarayıcı';
        const platform = result.os.name || 'Bilinmeyen Platform';

        const deviceRef = doc(db, 'users', user.uid, 'devices', currentDeviceId);
        await setDoc(deviceRef, {
          deviceName,
          browser,
          platform,
          lastActive: serverTimestamp(),
          isRevoked: false,
          userAgent: navigator.userAgent
        }, { merge: true }).catch(err => console.error("Device registration error:", err));

        // Listen for device revocation
        unsubscribeDevice = onSnapshot(deviceRef, (docSnap) => {
          if (docSnap.exists() && docSnap.data().isRevoked === true) {
            // Device revoked, sign out
            auth.signOut().then(() => {
              window.location.href = '/';
            });
          }
        });

        let welcomeChecked = false;
        let isInitialLoad = true;
        // Listen to profile updates
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as User;
            userProfileRef.current = data;
            setUserProfile(data);
            
            // If user is banned, ensure they are offline and do not check welcome messages
            if (data.isBanned) {
              updateDoc(userRef, {
                isOnline: false,
                online: false
              }).catch(() => {});
              return;
            }

            // Ensure system account and welcome message are set up exactly once per login session
            if (!welcomeChecked) {
              welcomeChecked = true;
              ensureSystemAccount().then(() => {
                sendWelcomeMessageIfNeeded(user.uid, data.username, data.photoURL);
              }).catch(e => console.error("Error setting up system account or welcome message:", e));
            }
          }
          if (isInitialLoad) {
            isInitialLoad = false;
            setLoading(false);
          }
        }, (err) => {
          console.error("Profile snapshot error:", err);
          if (isInitialLoad) {
            isInitialLoad = false;
            setLoading(false);
          }
        });

        // Set online status to true on startup only if not banned
        getDoc(userRef).then((docSnap) => {
          const isBanned = docSnap.exists() ? docSnap.data()?.isBanned : false;
          if (!isBanned) {
            updateDoc(userRef, {
              isOnline: true,
              online: true,
              lastSeen: serverTimestamp()
            }).catch(err => console.error("Error setting online status:", err));
          } else {
            updateDoc(userRef, {
              isOnline: false,
              online: false
            }).catch(() => {});
          }
        }).catch(() => {
          updateDoc(userRef, {
            isOnline: true,
            online: true,
            lastSeen: serverTimestamp()
          }).catch(() => {});
        });

        // Define event handlers
        const setOffline = () => {
          if (auth.currentUser) {
            updateDoc(userRef, {
              isOnline: false,
              online: false,
              lastSeen: serverTimestamp()
            }).catch(() => {});
          }
        };

        const setOnline = () => {
          if (auth.currentUser) {
            if (userProfileRef.current?.isBanned) {
              updateDoc(userRef, {
                isOnline: false,
                online: false
              }).catch(() => {});
              return;
            }
            updateDoc(userRef, {
              isOnline: true,
              online: true,
              lastSeen: serverTimestamp()
            }).catch(() => {});
          }
        };

        const handleVisibilityChange = () => {
          if (document.visibilityState === 'hidden') {
            setOffline();
          } else {
            setOnline();
          }
        };

        const handleBeforeUnload = () => {
          setOffline();
        };

        const handlePageHide = () => {
          setOffline();
        };

        const handleOffline = () => {
          setOffline();
        };

        const handleOnline = () => {
          setOnline();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        cleanupEvents = () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('beforeunload', handleBeforeUnload);
          window.removeEventListener('pagehide', handlePageHide);
          window.removeEventListener('offline', handleOffline);
          window.removeEventListener('online', handleOnline);
          setOffline();
        };
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
      if (cleanupEvents) {
        cleanupEvents();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, deviceId }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
