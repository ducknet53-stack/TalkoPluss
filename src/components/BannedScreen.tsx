import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LogOut, ShieldAlert, Camera, CheckCircle2, ChevronRight, Loader2, Info, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import Webcam from 'react-webcam';
import { uploadImage } from '../lib/imgbb';
import { cn } from '../lib/utils';

const VERIFICATION_STEPS = [
  { id: 'front', label: 'Ön Kamera ile Selfie', desc: 'Yüzünüz net bir şekilde görünmeli.' },
  { id: 'right', label: 'Sağa Bak', desc: 'Başınızı hafifçe sağa çevirin.' },
  { id: 'left', label: 'Sola Bak', desc: 'Başınızı hafifçe sola çevirin.' },
  { id: 'up', label: 'Yukarı Bak', desc: 'Başınızı hafifçe yukarı kaldırın.' }
];

function dataURLtoFile(dataurl: string, filename: string) {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export default function BannedScreen() {
  const { currentUser, userProfile } = useAuth();
  const [view, setView] = useState<'loading' | 'banned' | 'intro' | 'verification' | 'success'>('loading');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!currentUser) return;
      try {
        const q = query(
          collection(db, 'verifications'), 
          where('uid', '==', currentUser.uid),
          where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setView('success');
        } else {
          setView('banned');
        }
      } catch (err) {
        setView('banned');
      }
    };
    checkVerificationStatus();
  }, [currentUser]);

  const webcamRef = useRef<Webcam>(null);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      toast.success('Oturum kapatıldı.');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setPhotos(prev => [...prev, imageSrc]);
      if (currentStepIndex < VERIFICATION_STEPS.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      } else {
        submitVerification([...photos, imageSrc]);
      }
    }
  }, [webcamRef, currentStepIndex, photos]);

  const submitVerification = async (finalPhotos: string[]) => {
    if (!currentUser || !userProfile) return;
    setIsUploading(true);
    
    try {
      const uploadPromises = finalPhotos.map((dataUrl, idx) => {
        const file = dataURLtoFile(dataUrl, `verification_${idx}.jpg`);
        return uploadImage(file);
      });
      
      const uploadedUrls = await Promise.all(uploadPromises);
      
      const verifRef = doc(collection(db, 'verifications'));
      await setDoc(verifRef, {
        id: verifRef.id,
        uid: currentUser.uid,
        username: userProfile.username,
        email: currentUser.email,
        photos: uploadedUrls,
        status: 'pending',
        createdAt: Date.now()
      });
      
      setView('success');
      toast.success('Doğrulama talebiniz başarıyla alındı.');
    } catch (err: any) {
      console.error(err);
      toast.error('Görseller yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
      setPhotos([]);
      setCurrentStepIndex(0);
      setView('banned');
    } finally {
      setIsUploading(false);
    }
  };

  if (view === 'success') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Kimlik onayı devam ediyor
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-12">
            Bilgilerini genellikle birkaç dakika içinde inceleriz.
            Bir karar verdiğimizde bildirim alacaksın.
          </p>
          
          <div className="fixed bottom-0 left-0 w-full p-4">
            <button
              onClick={handleLogout}
              className="w-full max-w-md mx-auto block py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all"
            >
              Bitir
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'intro') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-6 font-sans relative">
        <div className="flex-1 max-w-md w-full mx-auto flex flex-col items-center justify-center text-center">
          <div className="w-24 h-32 border-2 border-slate-700 rounded-2xl flex flex-col items-center justify-center mb-8 relative">
            <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-slate-900 border-2 border-slate-700 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-pink-500 rounded-lg"></div>
            </div>
            <UserCheck size={32} className="text-orange-400 mb-2" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-4">
            Bir selfie videosuyla gerçek bir insan olduğunu doğrula
          </h1>
          <p className="text-slate-400 text-sm mb-10">
            İnsan olduğundan emin olmak için daha fazla bilgiye ihtiyacımız var.
          </p>

          <div className="space-y-6 text-left w-full">
            <div className="flex gap-4">
              <ShieldCheck className="text-slate-300 shrink-0 mt-0.5" size={24} />
              <p className="text-sm text-slate-300">
                Selfie videon sadece kimliğini onaylamak ve topluluğumuzu güvende tutmak için kullanılacak.
              </p>
            </div>
            <div className="flex gap-4">
              <Lock className="text-slate-300 shrink-0 mt-0.5" size={24} />
              <p className="text-sm text-slate-300">
                30 gün içinde silinecek.
              </p>
            </div>
            <div className="flex gap-4">
              <CheckCircle2 className="text-slate-300 shrink-0 mt-0.5" size={24} />
              <p className="text-sm text-slate-300">
                Yüzünün net bir şekilde göründüğünden emin ol.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-md w-full mx-auto mt-8">
          <button
            onClick={() => setView('verification')}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all"
          >
            Selfie videosuna başla
          </button>
        </div>
      </div>
    );
  }

  if (view === 'verification') {
    const currentStep = VERIFICATION_STEPS[currentStepIndex];
    
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          {isUploading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
              <h2 className="text-lg font-bold text-white mb-2">Kimlik Onayı Gönderiliyor</h2>
              <p className="text-slate-400 text-sm text-center max-w-xs">Selfie kaydınız yükleniyor, lütfen bekleyin...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => { setView('intro'); setPhotos([]); setCurrentStepIndex(0); }} className="text-slate-400 hover:text-white transition-colors">
                  İptal
                </button>
                <div className="flex gap-1">
                  {VERIFICATION_STEPS.map((_, idx) => (
                    <div key={idx} className={cn("h-1.5 w-6 rounded-full transition-colors", idx <= currentStepIndex ? "bg-blue-500" : "bg-slate-800")} />
                  ))}
                </div>
              </div>
              
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white mb-2">{currentStep.label}</h2>
                <p className="text-slate-400 text-sm">{currentStep.desc}</p>
              </div>
              
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] mb-6 border-2 border-slate-800 flex items-center justify-center">
                {/* @ts-ignore react-webcam missing props issue */}
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user" }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Face guide overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-3/5 h-2/5 border-2 border-dashed border-white/50 rounded-[40%] opacity-70" />
                </div>
              </div>
              
              <button
                onClick={handleCapture}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-lg"
              >
                <Camera size={24} />
                {currentStepIndex === VERIFICATION_STEPS.length - 1 ? 'Tamamla' : 'Devam Et'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-red-950/40 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600" />
        
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <ShieldAlert size={36} className="animate-bounce" />
        </div>
        
        <h1 className="text-2xl font-black text-white tracking-tight mb-3">
          Hesabınız Askıya Alındı
        </h1>
        
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Talko topluluk kurallarına aykırı davranışlar tespit edildiği veya güvenlik ihlali gerekçesiyle bu hesaba erişim kalıcı olarak askıya alınmıştır. 
        </p>

        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 mb-6 text-sm text-left">
          <div className="flex items-start gap-3">
            <Info className="text-blue-400 shrink-0 mt-0.5" size={18} />
            <p className="text-slate-300 leading-relaxed">
              Eğer bu durumun bir hata olduğunu düşünüyorsanız, kimliğinizi doğrulayarak itiraz edebilirsiniz.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setView('intro')}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            İtiraz Et (Doğrulama)
            <ChevronRight size={18} />
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-3.5 bg-transparent border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold rounded-xl active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            Başka Bir Hesapla Giriş Yap
          </button>
        </div>
      </div>
    </div>
  );
}
