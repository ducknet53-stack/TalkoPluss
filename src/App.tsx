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
              className="h-screen w-full relative overflow-hidden bg-slate-950"
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

