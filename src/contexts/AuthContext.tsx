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

    // Safety timeout: Ensure loading is never stuck indefinitely (max 3 seconds)
    const safetyTimer = setTimeout(() => {
      setLoading((prevLoading) => {
        if (prevLoading) {
          console.warn("AuthContext safety timeout reached. Unblocking loading state.");
          return false;
        }
        return false;
      });
    }, 3000);

    let unsubscribeAuth: (() => void) | null = null;

    try {
      unsubscribeAuth = onAuthStateChanged(
        auth,
        (user) => {
          try {
            // Clean up previous user listeners and event handlers
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

              // Auto-elevate developer/admin user in Firestore database (SILENT)
              const adminEmails = ['ducknet53@gmail.com', 'goku1@gmail.com', 'dev@talko.app', 'admin@talko.app', 'talkodev@gmail.com'];
              const isDevMode = import.meta.env.DEV || localStorage.getItem("talko_dev_mode") !== "false";
              if (adminEmails.includes(user.email || '') || isDevMode) {
                setDoc(userRef, { isAdmin: true }, { merge: true }).catch(() => {});
              }

              // Register device (SILENT & NON-BLOCKING)
              try {
                const parser = new UAParser();
                const result = parser.getResult();
                const deviceName = result.device.model || result.os.name || 'Bilinmeyen Cihaz';
                const browser = result.browser.name || 'Bilinmeyen Tarayıcı';
                const platform = result.os.name || 'Bilinmeyen Platform';

                const deviceRef = doc(db, 'users', user.uid, 'devices', currentDeviceId);
                setDoc(deviceRef, {
                  deviceName,
                  browser,
                  platform,
                  lastActive: serverTimestamp(),
                  isRevoked: false,
                  userAgent: navigator.userAgent
                }, { merge: true }).catch(() => {});

                // Listen for device revocation (SILENT)
                unsubscribeDevice = onSnapshot(
                  deviceRef,
                  (docSnap) => {
                    if (docSnap.exists() && docSnap.data()?.isRevoked === true) {
                      auth.signOut().then(() => {
                        window.location.href = '/';
                      }).catch(() => {});
                    }
                  },
                  () => {} // Silent error handler prevents permission error overlays
                );
              } catch (deviceError) {
                // Ignore device registration setup errors quietly
              }

              let welcomeChecked = false;
              let isInitialLoad = true;

              // Listen to profile updates
              unsubscribeProfile = onSnapshot(
                userRef,
                (docSnap) => {
                  try {
                    const adminEmails = ['ducknet53@gmail.com', 'goku1@gmail.com', 'dev@talko.app', 'admin@talko.app', 'talkodev@gmail.com'];
                    const isDev = adminEmails.includes(user.email || '') || import.meta.env.DEV || localStorage.getItem("talko_dev_mode") !== "false";
                    if (docSnap.exists()) {
                      const data = docSnap.data() as User;
                      if (isDev) {
                        data.isAdmin = true;
                      }
                      userProfileRef.current = data;
                      setUserProfile(data);

                      if (data.isBanned) {
                        updateDoc(userRef, {
                          isOnline: false,
                          online: false
                        }).catch(() => {});
                        if (isInitialLoad) {
                          isInitialLoad = false;
                          setLoading(false);
                          clearTimeout(safetyTimer);
                        }
                        return;
                      }

                      if (!welcomeChecked) {
                        welcomeChecked = true;
                        ensureSystemAccount()
                          .then(() => {
                            sendWelcomeMessageIfNeeded(user.uid, data.username, data.photoURL);
                          })
                          .catch(() => {});
                      }
                    } else {
                      // Fallback profile if user document does not exist yet in Firestore
                      const fallbackProfile: User = {
                        uid: user.uid,
                        username: isDev ? 'The_Goku' : (user.displayName || user.email?.split('@')[0] || 'Kullanıcı'),
                        usernameLower: isDev ? 'the_goku' : (user.displayName || user.email?.split('@')[0] || 'kullanici').toLowerCase(),
                        email: user.email || '',
                        photoURL: user.photoURL || null,
                        about: 'Merhaba, ben Talko kullanıyorum!',
                        isOnline: true,
                        lastSeen: Date.now(),
                        createdAt: Date.now(),
                        isBanned: false,
                        bannedAt: null,
                        isAdmin: isDev
                      };
                      userProfileRef.current = fallbackProfile;
                      setUserProfile(fallbackProfile);
                    }
                  } catch (e) {
                    console.error("Error parsing user profile doc:", e);
                  } finally {
                    if (isInitialLoad) {
                      isInitialLoad = false;
                      setLoading(false);
                      clearTimeout(safetyTimer);
                    }
                  }
                },
                (err) => {
                  console.warn("Profile snapshot note:", err?.message || err);
                  // Create fallback if profile read fails (e.g. permissions or missing document)
                  const isDev = user.email === 'ducknet53@gmail.com' || user.email === 'goku1@gmail.com';
                  const fallbackProfile: User = {
                    uid: user.uid,
                    username: isDev ? 'The_Goku' : (user.displayName || user.email?.split('@')[0] || 'Kullanıcı'),
                    usernameLower: isDev ? 'the_goku' : (user.displayName || user.email?.split('@')[0] || 'kullanici').toLowerCase(),
                    email: user.email || '',
                    photoURL: user.photoURL || null,
                    about: 'Merhaba, ben Talko kullanıyorum!',
                    isOnline: true,
                    lastSeen: Date.now(),
                    createdAt: Date.now(),
                    isBanned: false,
                    bannedAt: null,
                    isAdmin: isDev
                  };
                  userProfileRef.current = fallbackProfile;
                  setUserProfile(fallbackProfile);
                  if (isInitialLoad) {
                    isInitialLoad = false;
                    setLoading(false);
                    clearTimeout(safetyTimer);
                  }
                }
              );

              // Set online status in background
              getDoc(userRef)
                .then((docSnap) => {
                  const isBanned = docSnap.exists() ? docSnap.data()?.isBanned : false;
                  if (!isBanned) {
                    updateDoc(userRef, {
                      isOnline: true,
                      online: true,
                      lastSeen: serverTimestamp()
                    }).catch(() => {});
                  }
                })
                .catch(() => {
                  updateDoc(userRef, {
                    isOnline: true,
                    online: true,
                    lastSeen: serverTimestamp()
                  }).catch(() => {});
                });

              // Event listeners for online/offline status
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
                if (document.visibilityState === 'hidden') setOffline();
                else setOnline();
              };

              document.addEventListener('visibilitychange', handleVisibilityChange);
              window.addEventListener('beforeunload', setOffline);
              window.addEventListener('pagehide', setOffline);
              window.addEventListener('offline', setOffline);
              window.addEventListener('online', setOnline);

              cleanupEvents = () => {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('beforeunload', setOffline);
                window.removeEventListener('pagehide', setOffline);
                window.removeEventListener('offline', setOffline);
                window.removeEventListener('online', setOnline);
                setOffline();
              };
            } else {
              setUserProfile(null);
              setLoading(false);
              clearTimeout(safetyTimer);
            }
          } catch (callbackError) {
            console.error("Error in onAuthStateChanged handler:", callbackError);
            setLoading(false);
            clearTimeout(safetyTimer);
          }
        },
        (authError) => {
          console.error("onAuthStateChanged error:", authError);
          setLoading(false);
          clearTimeout(safetyTimer);
        }
      );
    } catch (authInitError) {
      console.error("Failed to initialize onAuthStateChanged:", authInitError);
      setLoading(false);
      clearTimeout(safetyTimer);
    }

    return () => {
      clearTimeout(safetyTimer);
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeDevice) unsubscribeDevice();
      if (cleanupEvents) cleanupEvents();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, deviceId }}>
      {children}
    </AuthContext.Provider>
  );
}
