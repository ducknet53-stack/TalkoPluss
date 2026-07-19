import React, { useState, useEffect } from 'react';
import { Bug, X, RefreshCw, Smartphone, ShieldCheck, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

interface DebugState {
  ai: 'Working' | 'Idle' | 'Error';
  moderation: 'Safe' | 'Blocked' | 'Pending' | 'None';
  firestore: 'Success' | 'Failed' | 'Pending' | 'None';
  push: 'Connected' | 'Failed' | 'None';
  serviceWorker: 'Registered' | 'Missing' | 'Pending';
  fcm: 'Token Ready' | 'Failed' | 'Pending' | 'None';
}

export default function DebugPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser } = useAuth();
  const [debugState, setDebugState] = useState<DebugState>({
    ai: 'Idle',
    moderation: 'None',
    firestore: 'None',
    push: 'None',
    serviceWorker: 'Missing',
    fcm: 'None'
  });

  const getLatestState = () => {
    if (typeof window !== 'undefined' && (window as any).talkoDebugState) {
      setDebugState({ ...(window as any).talkoDebugState });
    }
  };

  useEffect(() => {
    // Check if debug mode is enabled
    const checkVisibility = () => {
      const enabled = localStorage.getItem('talko_debug_mode') === 'true';
      setIsVisible(enabled);
    };

    checkVisibility();
    getLatestState();

    // Listen for debug state toggles & updates
    window.addEventListener('talko-debug-toggle', checkVisibility);
    window.addEventListener('talko-debug-update', getLatestState);

    // Periodically update / check service worker and push connection
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          const hasTalkoSW = regs.some(r => r.active && (r.active.scriptURL.includes('service-worker.js') || r.active.scriptURL.includes('firebase-messaging-sw.js')));
          const currentSW = (window as any).talkoDebugState?.serviceWorker;
          
          let nextSW: 'Registered' | 'Missing' | 'Pending' = hasTalkoSW ? 'Registered' : 'Missing';
          if (currentSW === 'Pending' && !hasTalkoSW) {
            nextSW = 'Pending';
          }

          const hasNotificationPermission = 'Notification' in window && Notification.permission === 'granted';
          const currentPush = (window as any).talkoDebugState?.push || 'None';
          
          let nextPush: 'Connected' | 'Failed' | 'None' = currentPush;
          if (!hasNotificationPermission) {
            nextPush = 'None';
          } else if (hasNotificationPermission && hasTalkoSW && currentPush === 'None') {
            nextPush = 'Connected';
          }

          if (typeof window !== 'undefined') {
            if (!(window as any).talkoDebugState) (window as any).talkoDebugState = {};
            (window as any).talkoDebugState.serviceWorker = nextSW;
            if ((window as any).talkoDebugState.push === 'None' || !(window as any).talkoDebugState.push) {
              (window as any).talkoDebugState.push = nextPush;
            }
          }
          getLatestState();
        });
      }
    }, 2000);

    return () => {
      window.removeEventListener('talko-debug-toggle', checkVisibility);
      window.removeEventListener('talko-debug-update', getLatestState);
      clearInterval(interval);
    };
  }, []);

  const handleTestFirestore = async () => {
    if (!currentUser) return;
    
    if (typeof window !== 'undefined') {
      if (!(window as any).talkoDebugState) (window as any).talkoDebugState = {};
      (window as any).talkoDebugState.firestore = 'Pending';
      window.dispatchEvent(new CustomEvent('talko-debug-update'));
    }

    try {
      // Test read to users collection
      const q = query(collection(db, 'users'), limit(1));
      await getDocs(q);
      
      if (typeof window !== 'undefined') {
        (window as any).talkoDebugState.firestore = 'Success';
        window.dispatchEvent(new CustomEvent('talko-debug-update'));
      }
    } catch (err) {
      console.error("Debug Panel: Firestore connectivity test failed:", err);
      if (typeof window !== 'undefined') {
        (window as any).talkoDebugState.firestore = 'Failed';
        window.dispatchEvent(new CustomEvent('talko-debug-update'));
      }
    }
  };

  if (!isVisible) return null;

  const getStatusColor = (val: string) => {
    switch (val) {
      case 'Working':
      case 'Pending':
        return 'bg-amber-500 text-white animate-pulse';
      case 'Safe':
      case 'Success':
      case 'Connected':
      case 'Registered':
      case 'Token Ready':
        return 'bg-emerald-500 text-white';
      case 'Blocked':
      case 'Failed':
      case 'Error':
      case 'Missing':
        return 'bg-rose-500 text-white animate-bounce';
      default:
        return 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 font-sans select-none pointer-events-none">
      {isOpen && (
        <div className="w-80 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-xl p-4 flex flex-col gap-3 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
            <div className="flex items-center gap-2">
              <Bug size={18} className="text-yellow-500" />
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Talko Canlı Sistem Panel</h3>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* AI Indicator */}
            <div className="bg-gray-50/50 dark:bg-gray-950/20 p-2.5 rounded-xl border border-gray-100/60 dark:border-gray-850 flex flex-col gap-1.5">
              <span className="text-gray-500 dark:text-gray-400 font-medium">AI Servisi:</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold w-max ${getStatusColor(debugState.ai)}`}>
                {debugState.ai}
              </span>
            </div>

            {/* Moderation Indicator */}
            <div className="bg-gray-50/50 dark:bg-gray-950/20 p-2.5 rounded-xl border border-gray-100/60 dark:border-gray-850 flex flex-col gap-1.5">
              <span className="text-gray-500 dark:text-gray-400 font-medium">AI Moderasyon:</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold w-max ${getStatusColor(debugState.moderation)}`}>
                {debugState.moderation}
              </span>
            </div>

            {/* Firestore Indicator */}
            <div className="bg-gray-50/50 dark:bg-gray-950/20 p-2.5 rounded-xl border border-gray-100/60 dark:border-gray-850 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Firestore:</span>
                <button 
                  onClick={handleTestFirestore}
                  title="Firestore Bağlantısını Test Et"
                  className="p-0.5 text-blue-500 hover:text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                >
                  <RefreshCw size={10} />
                </button>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold w-max ${getStatusColor(debugState.firestore)}`}>
                {debugState.firestore}
              </span>
            </div>

            {/* Push Status Indicator */}
            <div className="bg-gray-50/50 dark:bg-gray-950/20 p-2.5 rounded-xl border border-gray-100/60 dark:border-gray-850 flex flex-col gap-1.5">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Push Notification:</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold w-max ${getStatusColor(debugState.push)}`}>
                {debugState.push}
              </span>
            </div>

            {/* Service Worker Indicator */}
            <div className="bg-gray-50/50 dark:bg-gray-950/20 p-2.5 rounded-xl border border-gray-100/60 dark:border-gray-850 flex flex-col gap-1.5">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Service Worker:</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold w-max ${getStatusColor(debugState.serviceWorker)}`}>
                {debugState.serviceWorker}
              </span>
            </div>

            {/* FCM Token Indicator */}
            <div className="bg-gray-50/50 dark:bg-gray-950/20 p-2.5 rounded-xl border border-gray-100/60 dark:border-gray-850 flex flex-col gap-1.5">
              <span className="text-gray-500 dark:text-gray-400 font-medium">FCM Token:</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold w-max ${getStatusColor(debugState.fcm)}`}>
                {debugState.fcm}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-2 flex flex-col gap-1">
            <span className="font-semibold text-gray-700 dark:text-gray-300">💡 Canlı İpuçları:</span>
            <span>• Mesaj göndererek AI, Moderasyon ve Firestore'u test edin.</span>
            <span>• Sol alttaki "Bildirimleri Aç" butonuyla SW ve FCM'i kurun.</span>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer pointer-events-auto"
        title="Canlı Sistem Durumu"
      >
        <Bug size={24} />
      </button>
    </div>
  );
}
