import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TALKO_LOGO_DATA_URL } from '../lib/assets';

interface SplashScreenProps {
  onComplete: () => void;
  key?: string;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [loadingVisible, setLoadingVisible] = useState(true);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // 1. Fade out spinner after 1.4s
    const spinnerTimer = setTimeout(() => {
      setLoadingVisible(false);
    }, 1400);

    // 2. Complete splash phase and transition to main app after 1.8s
    const completeTimer = setTimeout(() => {
      onCompleteRef.current();
    }, 1800);

    return () => {
      clearTimeout(spinnerTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  return (
    <motion.div
      id="talko-splash-screen"
      className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-between py-16 px-4 z-50 overflow-hidden font-sans select-none"
      initial={{ opacity: 1 }}
      exit={{ 
        opacity: 0,
        transition: { duration: 0.3, ease: 'easeInOut' }
      }}
    >
      {/* Subtle background ambient lights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-600/5 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-amber-500/5 blur-[120px]" />
      </div>

      <div className="h-4" />

      {/* Logo & App Name Container */}
      <div className="flex flex-col items-center text-center z-10">
        <motion.div
          className="relative w-24 h-24 mb-6 rounded-[24px] overflow-hidden shadow-[0_20px_50px_rgba(0,102,255,0.15)] border border-white/5 bg-slate-900"
          animate={{
            scale: [1, 1.03, 1],
          }}
          transition={{
            duration: 2.0,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        >
          <img 
            src={TALKO_LOGO_DATA_URL} 
            alt="Talko Logo" 
            className="w-full h-full object-cover"
            draggable={false}
          />
          
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/35 via-amber-100/45 via-amber-200/35 to-transparent pointer-events-none mix-blend-overlay"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              repeat: Infinity,
              repeatType: 'loop',
              duration: 1.8,
              ease: 'easeInOut',
              repeatDelay: 0.3
            }}
          />
        </motion.div>

        <motion.h1 
          className="text-4xl font-extrabold tracking-tight text-white font-sans bg-clip-text"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
        >
          Talko
        </motion.h1>

        <motion.p 
          className="text-xs text-slate-400 font-medium tracking-[0.2em] uppercase mt-3.5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: 'easeOut' }}
        >
          Connect. Chat. Explore.
        </motion.p>
      </div>

      {/* Loading indicator */}
      <div className="h-16 flex items-center justify-center z-10">
        <AnimatePresence>
          {loadingVisible && (
            <motion.div
              className="relative w-8 h-8"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ 
                opacity: 0, 
                scale: 0.8,
                transition: { duration: 0.2, ease: 'easeIn' } 
              }}
            >
              <motion.div
                className="w-full h-full rounded-full border-2 border-amber-500/20 border-t-amber-500"
                animate={{ rotate: 360 }}
                transition={{
                  repeat: Infinity,
                  ease: 'linear',
                  duration: 0.75,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
