import React from 'react';
import { motion } from 'motion/react';
import { Power, ExternalLink, MessageSquare } from 'lucide-react';

const ShutdownScreen: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
      >
        <div className="p-8 text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Power className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
            Talko Kapandı
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Yapacak bir şey yok, site kapatıldı. Talko'yu kullanmaya devam etmek için eski sürüme yönelebilirsiniz.
          </p>

          <div className="space-y-4">
            <a 
              href="https://talko-chat-abtu.onrender.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95 group"
            >
              <ExternalLink className="w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              Eski Sürüme Git
            </a>
            
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-6">
              <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1.5 uppercase tracking-widest font-semibold">
                <MessageSquare className="w-3 h-3" />
                Talko Chat Legacy
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-2 italic">
                * Bu sürüm oldukça eskidir, lütfen unutmayın.
              </p>
            </div>
          </div>
        </div>
        
        <div className="h-2 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500" />
      </motion.div>
    </div>
  );
};

export default ShutdownScreen;
