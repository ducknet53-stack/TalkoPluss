/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component, ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthScreen from './components/AuthScreen';
import MainLayout from './components/MainLayout';
import AdminPanel from './components/AdminPanel';
import BannedScreen from './components/BannedScreen';
import SplashScreen from './components/SplashScreen';
import { motion, AnimatePresence } from 'motion/react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class GlobalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState = {
    hasError: false
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  handleReset = () => {
    this.state = { hasError: false };
    window.location.reload();
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Global Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center z-50 font-sans">
          <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-red-400">Bir Hata Oluştu</h2>
            <p className="text-xs text-slate-400 break-words font-mono bg-slate-950 p-3 rounded-lg border border-slate-800">
              {this.state.error?.message || "Sayfa yüklenirken beklenmeyen bir hata meydana geldi."}
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-blue-600/20"
              >
                Sayfayı Yenile
              </button>
              <button
                onClick={() => {
                  window.location.href = "/";
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium text-slate-300 transition-all border border-slate-700"
              >
                Ana Sayfaya Dön
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Initialize global debug state
if (typeof window !== 'undefined') {
  (window as any).talkoDebugState = {
    ai: 'Idle',
    moderation: 'None',
    firestore: 'None',
    push: 'None',
    serviceWorker: 'Missing',
    fcm: 'None'
  };
}

function AppContent() {
  const { currentUser, userProfile, loading } = useAuth();
  const checkIsAdmin = () => {
    if (typeof window === 'undefined') return false;
    const hash = (window.location.hash || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();
    return hash.includes('admin') || path.endsWith('/admin') || path.includes('/admin/');
  };
  const [isAdminHash, setIsAdminHash] = useState(checkIsAdmin);

  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdminHash(checkIsAdmin());
    };
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    const grantAdminToGoku = async () => {
      if ((currentUser?.email === 'goku1@gmail.com' || currentUser?.email === 'ducknet53@gmail.com') && userProfile && !userProfile.isAdmin) {
        try {
          const { doc, updateDoc } = await import('firebase/firestore');
          const { db } = await import('./lib/firebase');
          await updateDoc(doc(db, 'users', userProfile.uid), { isAdmin: true });
          console.log("Granted admin to developer account automatically.");
        } catch (e) {
          console.error("Failed to auto-grant admin:", e);
        }
      }
    };
    grantAdminToGoku();
  }, [userProfile, currentUser]);

  useEffect(() => {
    if (userProfile?.isAdmin && !localStorage.getItem('removed_hasan1_roblox_bluetick_v2')) {
      localStorage.setItem('removed_hasan1_roblox_bluetick_v2', 'true');
      const run = async () => {
        try {
          const { query, collection, where, getDocs, updateDoc, doc, getDoc, setDoc, increment } = await import('firebase/firestore');
          const { db } = await import('./lib/firebase');
          const q = query(collection(db, 'users'), where('usernameLower', 'in', ['hasan1', 'robloxfanı', 'robloxfani']));
          const snap = await getDocs(q);
          if (!snap.empty) {
            for (const userDoc of snap.docs) {
              await updateDoc(userDoc.ref, {
                isVerified: false,
                blueTickStatus: null,
                blueTickReason: null
              });
              
              const chatId = ['system_talko_ai', userDoc.id].sort().join('_');
              const chatRef = doc(db, 'chats', chatId);
              const chatSnap = await getDoc(chatRef);
              
              const now = Date.now();
              const shortMessage = '😔 Mavi tikiniz geri alındı.';
              const fullMessage = '😔 **Merhaba**, sistem kontrolleri sonucunda hesabınızdaki **Mavi Tik (Verified)** onayının maalesef geri alındığını bildirmek isteriz.\n\nEğer bunun bir hata olduğunu düşünüyorsanız lütfen destek ekibimizle iletişime geçin. Anlayışınız için teşekkürler. 💙';

              if (!chatSnap.exists()) {
                await setDoc(chatRef, {
                  id: chatId,
                  participants: ['system_talko_ai', userDoc.id],
                  participantDetails: {
                    'system_talko_ai': { username: 'Talko AI', photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=TalkoAI&backgroundColor=0ea5e9' },
                    [userDoc.id]: { username: userDoc.data().username, photoURL: userDoc.data().photoURL }
                  },
                  lastMessage: shortMessage,
                  lastMessageTimestamp: now,
                  updatedAt: now
                });
              } else {
                await updateDoc(chatRef, {
                  lastMessage: shortMessage,
                  lastMessageTimestamp: now,
                  updatedAt: now,
                  [`unreadCount.${userDoc.id}`]: increment(1)
                });
              }
              
              const msgId = now.toString() + Math.random().toString(36).substring(2,5);
              await setDoc(doc(db, `chats/${chatId}/messages`, msgId), {
                id: msgId,
                senderId: 'system_talko_ai',
                text: fullMessage,
                timestamp: now
              });
            }
          }
        } catch (e) {
          console.error(e);
        }
      };
      run();
    }
  }, [userProfile?.isAdmin]);

  // Routing for Admin Panel
  if (isAdminHash) {
    if (loading) {
      return (
        <div className="fixed inset-0 bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans z-50">
          <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-bold text-slate-200">Yönetim Paneli Yükleniyor...</h2>
          <p className="text-xs text-slate-400 mt-1">Sistem yetkileri kontrol ediliyor</p>
        </div>
      );
    }
    return <AdminPanel />;
  }

  // General App Loading
  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans z-50">
        <div className="w-10 h-10 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-200">Talko Yükleniyor...</h2>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  if (userProfile?.isBanned) {
    return <BannedScreen />;
  }

  return <MainLayout />;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = (window.location.hash || '').toLowerCase();
      const path = (window.location.pathname || '').toLowerCase();
      if (hash.includes('admin') || path.includes('admin')) {
        return false;
      }
    }
    return true;
  });

  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <Toaster position="top-center" />
        <AnimatePresence mode="wait">
          {showSplash ? (
            <SplashScreen key="splash" onComplete={() => setShowSplash(false)} />
          ) : (
            <AuthProvider>
              <motion.div
                key="app-main-content"
                className="h-full w-full relative overflow-hidden bg-white dark:bg-gray-900 transition-colors"
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              >
                <AppContent />
              </motion.div>
            </AuthProvider>
          )}
        </AnimatePresence>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}

