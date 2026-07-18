import { useState } from 'react';
import { TALKO_VERIFIED_SVG } from '../lib/assets';
import { motion, AnimatePresence } from 'framer-motion';

interface VerifiedBadgeProps {
  className?: string;
}

export function VerifiedBadge({ className = "w-4 h-4" }: VerifiedBadgeProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button 
        type="button"
        onClick={(e) => { 
          e.preventDefault(); 
          e.stopPropagation(); 
          setShowModal(true); 
        }}
        className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 flex-shrink-0 inline-flex items-center justify-center ml-1 p-0 border-0 bg-transparent overflow-visible ${className}`}
        dangerouslySetInnerHTML={{ __html: TALKO_VERIFIED_SVG }}
      />
      
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowModal(false);
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#121b22] dark:bg-[#121b22] w-full max-w-[360px] rounded-[32px] shadow-2xl overflow-hidden px-6 py-8 flex flex-col items-center text-center"
            >
              <div 
                className="w-[88px] h-[88px] mb-6 drop-shadow-lg flex-shrink-0"
                dangerouslySetInnerHTML={{ __html: TALKO_VERIFIED_SVG }}
              />
              
              <h2 className="text-[22px] font-semibold text-white mb-6">
                Talko Verified profilleri hakkında
              </h2>
              
              <p className="text-[#d1d7db] text-[15px] mb-4 leading-relaxed font-medium">
                İşletme ve kişisel profiller, hareketlerine ve sağladıkları bilgilere göre Talko tarafından doğrulanabilir. Doğrulanmış hesap rozetleri bu profillerde gösterilir.
              </p>
              
              <p className="text-[#d1d7db] text-[15px] mb-6 leading-relaxed font-medium">
                Bazı doğrulanmış profiller önemli bir kişi, marka veya kuruluşa aitken bazı profiller Talko Verified abonesidir.
              </p>
              
              <p className="text-[#8696a0] text-sm mb-8 leading-relaxed">
                Talko kullanan uygun hesaplar Talko Verified için başvurabilir. Hesabınızın uygun olup olmadığını <button className="text-[#53bdeb] font-semibold hover:underline">buradan</button> kontrol edebilirsiniz.
              </p>

              <button
                onClick={() => setShowModal(false)}
                className="w-full py-3 bg-[#25d366] hover:bg-[#20bd5a] text-[#111b21] rounded-full font-bold text-[15px] transition-all shadow-sm active:scale-[0.98]"
              >
                Daha fazla bilgi
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
