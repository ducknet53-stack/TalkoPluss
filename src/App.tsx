/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthScreen from './components/AuthScreen';
import MainLayout from './components/MainLayout';
import AdminPanel from './components/AdminPanel';
import BannedScreen from './components/BannedScreen';
import SplashScreen from './components/SplashScreen';
import { motion, AnimatePresence } from 'motion/react';

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
  const { currentUser, userProfile } = useAuth();
  const [isAdminHash, setIsAdminHash] = useState(window.location.hash.startsWith('#/admin'));

  useEffect(() => {
    const handleHashChange = () => {
      setIsAdminHash(window.location.hash.startsWith('#/admin'));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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

  if (isAdminHash) {
    return <AdminPanel />;
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
  const [showSplash, setShowSplash] = useState(true);

  return (
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
  );
}

