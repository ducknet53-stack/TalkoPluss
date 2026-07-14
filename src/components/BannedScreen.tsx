import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  LogOut,
  ShieldAlert,
  Camera,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Info,
  Lock,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { auth, db } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import Webcam from "react-webcam";
import { uploadImage } from "../lib/imgbb";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { TALKO_LOGO_DATA_URL } from "../lib/assets";

const VERIFICATION_STEPS = [
  {
    id: "front",
    label: "Ön Yüz Doğrulaması",
    desc: "Lütfen yüzünüzü çerçevenin içine hizalayın.",
  },
  { id: "right", label: "Sağ Profil", desc: "Başınızı hafifçe sağa çevirin." },
  { id: "left", label: "Sol Profil", desc: "Başınızı hafifçe sola çevirin." },
  {
    id: "up",
    label: "Yukarı Bakış",
    desc: "Başınızı hafifçe yukarı kaldırın.",
  },
];

function dataURLtoFile(dataurl: string, filename: string) {
  const arr = dataurl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
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
  const [view, setView] = useState<
    "loading" | "banned" | "intro" | "verification" | "success" | "rejected"
  >("loading");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!currentUser || !userProfile) return;

      if (userProfile.verificationStatus === "pending") {
        setView("success");
        return;
      }

      if (userProfile.verificationStatus === "rejected") {
        setView("rejected");
        return;
      }

      // Check verifications collection just in case
      try {
        const q = query(
          collection(db, "verifications"),
          where("uid", "==", currentUser.uid),
          where("status", "==", "pending"),
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setView("success");
        } else {
          setView("banned");
        }
      } catch (err) {
        setView("banned");
      }
    };
    checkVerificationStatus();
  }, [currentUser, userProfile]);

  const webcamRef = useRef<Webcam>(null);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      toast.success("Oturum kapatıldı.");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setPhotos((prev) => [...prev, imageSrc]);
      if (currentStepIndex < VERIFICATION_STEPS.length - 1) {
        setCurrentStepIndex((prev) => prev + 1);
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

      const verifRef = doc(collection(db, "verifications"));
      await setDoc(verifRef, {
        id: verifRef.id,
        uid: currentUser.uid,
        username: userProfile.username,
        email: currentUser.email,
        photos: uploadedUrls,
        status: "pending",
        createdAt: Date.now(),
      });

      // Update user doc locally to reflect pending status if we could
      // But we just switch view here
      setView("success");
      toast.success("Doğrulama talebiniz başarıyla alındı.");
    } catch (err: any) {
      console.error(err);
      toast.error(
        "Görseller yüklenirken bir hata oluştu. Lütfen tekrar deneyin.",
      );
      setPhotos([]);
      setCurrentStepIndex(0);
      setView("banned");
    } finally {
      setIsUploading(false);
    }
  };

  if (view === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Ambient Blur */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center">
        <div
          className={cn(
            "absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 transition-all duration-1000",
            view === "banned" || view === "rejected"
              ? "bg-red-600"
              : view === "success"
                ? "bg-amber-500"
                : "bg-blue-600",
          )}
        />
      </div>

      <AnimatePresence mode="wait">
        {view === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-md w-full p-8 text-center bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-[32px] shadow-2xl z-10"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.2,
                type: "spring",
                stiffness: 200,
                damping: 20,
              }}
              className="w-24 h-24 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative"
            >
              <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full animate-pulse" />
              <ShieldCheck size={40} className="text-amber-500 relative z-10" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-3">
              Kimlik Onayı Devam Ediyor
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Bilgileriniz güvenlik ekibimiz tarafından inceleniyor. Karar
              verildiğinde uygulama içinden ve e-posta yoluyla otomatik olarak
              bilgilendirileceksiniz.
            </p>
            <div className="flex items-center justify-center gap-3 text-amber-500 text-sm font-semibold mb-8">
              <Loader2 size={16} className="animate-spin" />
              Tahmini: Birkaç dakika içerisinde
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
            >
              Çıkış Yap
            </button>
          </motion.div>
        )}

        {view === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="max-w-md w-full mx-auto flex flex-col p-6 z-10"
          >
            <div className="w-24 h-32 border border-slate-700 bg-slate-900/50 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center mb-8 relative mx-auto shadow-xl">
              <div className="absolute -right-3 -bottom-3 w-10 h-10 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center shadow-lg">
                <div className="w-4 h-4 border-[1.5px] border-blue-500 rounded-md"></div>
              </div>
              <Camera size={32} className="text-blue-400 mb-2" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-3 text-center tracking-tight">
              Yüzünüzü Doğrulayın
            </h1>
            <p className="text-slate-400 text-sm mb-10 text-center leading-relaxed">
              Hesabınızın size ait olduğunu doğrulamak için cihazınızın
              kamerasını kullanarak kısa bir tarama yapacağız.
            </p>

            <div className="space-y-6 text-left w-full bg-slate-900/40 backdrop-blur-md p-6 border border-slate-800 rounded-2xl mb-8">
              <div className="flex gap-4 items-start">
                <ShieldCheck
                  className="text-blue-400 shrink-0 mt-0.5"
                  size={20}
                />
                <p className="text-sm text-slate-300 leading-relaxed">
                  Verileriniz şifrelenir ve yalnızca kimlik doğrulaması için
                  kullanılır.
                </p>
              </div>
              <div className="flex gap-4 items-start">
                <CheckCircle2
                  className="text-emerald-400 shrink-0 mt-0.5"
                  size={20}
                />
                <p className="text-sm text-slate-300 leading-relaxed">
                  Yüzünüzün net görünmesi için aydınlık bir ortamda bulunun.
                </p>
              </div>
            </div>

            <button
              onClick={() => setView("verification")}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all"
            >
              Taramayı Başlat
            </button>
            <button
              onClick={() => setView("banned")}
              className="w-full mt-4 py-3 text-slate-400 hover:text-white text-sm font-semibold transition-colors"
            >
              İptal
            </button>
          </motion.div>
        )}

        {view === "verification" && (
          <motion.div
            key="verification"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-[32px] p-6 shadow-2xl relative z-10"
          >
            {isUploading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative w-20 h-20 mb-6">
                  <div className="absolute inset-0 border-4 border-slate-800 rounded-full" />
                  <motion.div
                    className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      ease: "linear",
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-blue-500">
                    <ShieldCheck size={28} />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Güvenli Aktarım
                </h2>
                <p className="text-slate-400 text-sm text-center max-w-xs">
                  Görselleriniz şifrelenerek sunucuya iletiliyor, lütfen
                  bekleyin...
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => {
                      setView("intro");
                      setPhotos([]);
                      setCurrentStepIndex(0);
                    }}
                    className="text-slate-400 hover:text-white transition-colors text-sm font-semibold"
                  >
                    İptal
                  </button>
                  <div className="flex gap-1.5">
                    {VERIFICATION_STEPS.map((_, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          idx <= currentStepIndex
                            ? "w-6 bg-blue-500"
                            : "w-3 bg-slate-800",
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="text-center mb-6">
                  <motion.h2
                    key={currentStepIndex}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xl font-bold text-white mb-2"
                  >
                    {VERIFICATION_STEPS[currentStepIndex].label}
                  </motion.h2>
                  <p className="text-slate-400 text-sm">
                    {VERIFICATION_STEPS[currentStepIndex].desc}
                  </p>
                </div>

                <div className="relative rounded-[24px] overflow-hidden bg-black aspect-[3/4] mb-8 border border-slate-700/50 flex items-center justify-center shadow-inner">
                  {/* @ts-ignore */}
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user" }}
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />

                  {/* Premium Face Guide Overlay & AI Scan Effect */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                    <div className="w-2/3 h-[55%] border-2 border-blue-500/50 rounded-[40%] relative">
                      <motion.div
                        className="absolute inset-0 bg-blue-500/10 mix-blend-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{
                          repeat: Infinity,
                          duration: 2,
                          ease: "easeInOut",
                        }}
                      />
                      <motion.div
                        className="absolute top-0 left-0 w-full h-[2px] bg-blue-400 shadow-[0_0_8px_2px_rgba(59,130,246,0.5)]"
                        animate={{ top: ["0%", "100%", "0%"] }}
                        transition={{
                          repeat: Infinity,
                          duration: 3,
                          ease: "linear",
                        }}
                      />
                      {/* Corner marks */}
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white/80 rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white/80 rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white/80 rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-white/80 rounded-br-lg" />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCapture}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Camera size={20} />
                  {currentStepIndex === VERIFICATION_STEPS.length - 1
                    ? "Tamamla"
                    : "Fotoğraf Çek"}
                </button>
              </>
            )}
          </motion.div>
        )}

        {(view === "banned" || view === "rejected") && (
          <motion.div
            key="banned"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-md w-full bg-slate-900/60 backdrop-blur-2xl border border-red-900/30 rounded-[32px] p-8 shadow-2xl relative z-10 text-center"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 to-red-500" />

            <motion.div
              className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-[24px] flex items-center justify-center mx-auto mb-6 relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-[24px] animate-pulse" />
              <ShieldAlert size={40} className="text-red-500 relative z-10" />
            </motion.div>

            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-3">
              Hesabınız Askıya Alındı
            </h1>

            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              {view === "rejected"
                ? "Kimlik doğrulamanız incelenmiştir ancak maalesef onaylanmamıştır. Lütfen daha net ve güncel bir yüz fotoğrafı ile tekrar doğrulama gönderiniz."
                : "Topluluk güvenliğini korumak amacıyla hesabınıza erişim geçici olarak sınırlandırılmıştır. Bunun bir hata olduğunu düşünüyorsanız kimliğinizi doğrulayarak itiraz edebilirsiniz."}
            </p>

            <div className="space-y-4 mt-8">
              <button
                onClick={() => setView("intro")}
                className="w-full py-4 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 group backdrop-blur-md relative overflow-hidden"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer-slide_1.5s_infinite]" />
                <ShieldCheck
                  size={20}
                  className="text-blue-400 group-hover:scale-110 transition-transform"
                />
                🛡️ Kimliğimi Doğrula
              </button>

              <button
                onClick={handleLogout}
                className="w-full py-3.5 bg-transparent text-slate-400 hover:text-slate-200 font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
              >
                <LogOut size={16} />
                Farklı Hesapla Giriş Yap
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
