import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { X, Camera, Loader2, BadgeCheck, Bell, CheckCircle2, XCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { uploadImage } from '../lib/imgbb';
import { TALKO_VERIFIED_SVG } from '../lib/assets';
import { requestNotificationPermission } from '../lib/notifications';
import toast from 'react-hot-toast';

interface ProfileModalProps {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { currentUser, userProfile } = useAuth();
  
  const [username, setUsername] = useState(userProfile?.username || '');
  const [userHandle, setUserHandle] = useState(userProfile?.userHandle || '');
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [about, setAbout] = useState(userProfile?.about || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  useEffect(() => {
    // Only check if it's not empty, not the current one, and follows rules
    const handle = userHandle.trim().toLowerCase();
    
    if (handle === userProfile?.userHandle?.toLowerCase()) {
      setHandleAvailable(true);
      return;
    }

    if (handle.length < 3) {
      setHandleAvailable(null);
      return;
    }

    const checkHandle = async () => {
      setIsCheckingHandle(true);
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('userHandleLower', '==', handle));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setHandleAvailable(true);
        } else {
          setHandleAvailable(false);
        }
      } catch (err) {
        setHandleAvailable(null);
      } finally {
        setIsCheckingHandle(false);
      }
    };

    const debounce = setTimeout(() => {
      checkHandle();
    }, 500);

    return () => clearTimeout(debounce);
  }, [userHandle, userProfile?.userHandle]);

  const handleHandleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.startsWith('@')) {
      val = val.substring(1);
    }
    // Remove spaces, only letters, numbers, _, .
    val = val.replace(/[^a-zA-Z0-9_.]/g, '');
    setUserHandle(val);
    setHandleAvailable(null);
  };
  
  // Notification states
  const [msgNotif, setMsgNotif] = useState(userProfile?.notificationSettings?.messages !== false);
  const [groupNotif, setGroupNotif] = useState(userProfile?.notificationSettings?.groups !== false);
  const [eventNotif, setEventNotif] = useState(userProfile?.notificationSettings?.events !== false);
  const [requestingNativePerm, setRequestingNativePerm] = useState(false);

  // Verification states
  const [blueTickReason, setBlueTickReason] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);
  const [showAppForm, setShowAppForm] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApplyBlueTick = async () => {
    if (!currentUser) return;
    if (!blueTickReason.trim()) {
      toast.error('Lütfen doğrulanma talebiniz için kısa bir açıklama yazın.');
      return;
    }
    setSubmittingApp(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        blueTickStatus: 'pending',
        blueTickReason: blueTickReason.trim()
      });
      toast.success('Mavi tik başvurunuz alındı!');
      setShowAppForm(false);
    } catch (err: any) {
      toast.error('Başvuru hatası: ' + err.message);
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen geçerli bir görsel seçin.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Görsel boyutu 5MB\'dan küçük olmalıdır.');
      return;
    }

    setUploadingImage(true);
    try {
      const url = await uploadImage(file);
      if (url) {
        setPhotoURL(url);
        toast.success('Görsel yüklendi!');
      }
    } catch (err: any) {
      toast.error('Görsel yüklenirken hata oluştu: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (userHandle && handleAvailable === false) {
      toast.error('Bu kullanıcı adı zaten kullanılıyor.');
      return;
    }

    if (userHandle && userHandle.length < 3) {
      toast.error('Kullanıcı adı en az 3 karakter olmalıdır.');
      return;
    }

    setLoading(true);

    try {
      // Check username uniqueness if changed
      if (username !== userProfile?.username) {
        const usernameLower = username.toLowerCase();
        
        // Reserved usernames check
        const reservedNames = [
          'talko', 'talko ai', 'talko updates', 'talko official', 
          'talko support', 'talko helpdesk', 'talko verified'
        ];
        
        if (reservedNames.some(name => usernameLower.includes(name))) {
          toast.error("Bu ad alınamaz. Lütfen başka bir ad seçin.");
          setLoading(false);
          return;
        }

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('usernameLower', '==', usernameLower));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          toast.error("Bu ad zaten alınmış.");
          setLoading(false);
          return;
        }
      }

      // Check handle uniqueness if changed (as a fallback)
      if (userHandle && userHandle !== userProfile?.userHandle) {
        const handleLower = userHandle.toLowerCase();
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('userHandleLower', '==', handleLower));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          toast.error("Bu kullanıcı adı zaten kullanılıyor.");
          setLoading(false);
          return;
        }
      }

      const updateData: any = {
        username,
        usernameLower: username.toLowerCase(),
        about,
        photoURL,
        notificationSettings: {
          messages: msgNotif,
          groups: groupNotif,
          events: eventNotif
        }
      };

      if (userHandle) {
        updateData.userHandle = userHandle;
        updateData.userHandleLower = userHandle.toLowerCase();
      }

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, updateData);

      toast.success('Profil güncellendi!');
      onClose();
    } catch (err: any) {
      toast.error('Güncelleme hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transition-colors max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profili Düzenle</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-900 shadow-sm overflow-hidden flex items-center justify-center">
                {photoURL ? (
                  <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 text-3xl font-medium">
                    {username ? username.charAt(0).toUpperCase() : 'K'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
              >
                {uploadingImage ? <Loader2 size={24} className="text-white animate-spin" /> : <Camera size={24} className="text-white" />}
              </button>
            </div>
            <div className="text-center mt-4 mb-2">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center justify-center gap-1.5 text-lg">
                 {username || 'İsimsiz'} {userProfile?.isVerified && <BadgeCheck size={18} className="text-[#38bdf8] fill-[#38bdf8] dark:fill-none" />}
              </h3>
              {userHandle && <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">@{userHandle}</p>}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">JPG, PNG veya GIF. Maks 5MB.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Görünen Ad</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                required
                minLength={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kullanıcı Adı</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-400 font-medium">@</span>
                </div>
                <input
                  type="text"
                  value={userHandle}
                  onChange={handleHandleChange}
                  placeholder="kullanici_adi"
                  className="w-full pl-9 pr-10 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                  minLength={3}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {isCheckingHandle ? (
                    <Loader2 size={18} className="text-gray-400 animate-spin" />
                  ) : handleAvailable === true ? (
                    <CheckCircle2 size={18} className="text-green-500" />
                  ) : handleAvailable === false ? (
                    <XCircle size={18} className="text-red-500" />
                  ) : null}
                </div>
              </div>
              {handleAvailable === true && userHandle.length >= 3 && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  Kullanıcı adı kullanılabilir.
                </p>
              )}
              {handleAvailable === false && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                  Bu kullanıcı adı zaten kullanılıyor.
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hakkımda</label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none h-24 dark:text-white"
                maxLength={120}
              />
              <p className="text-xs text-right text-gray-400 mt-1">{about.length}/120</p>
            </div>

            {/* Bildirim Ayarları Section */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                <Bell size={18} className="text-blue-500" />
                🔔 Bildirim Ayarları
              </h3>
              
              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 block">Mesaj Bildirimleri</span>
                    <span className="text-[10px] text-gray-500">Bire bir sohbet mesajları</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={msgNotif}
                    onChange={(e) => setMsgNotif(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-t border-gray-100 dark:border-gray-800">
                  <div>
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 block">Grup Bildirimleri</span>
                    <span className="text-[10px] text-gray-500">Grup sohbeti mesajları</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={groupNotif}
                    onChange={(e) => setGroupNotif(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-t border-gray-100 dark:border-gray-800">
                  <div>
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 block">Etkinlik Bildirimleri</span>
                    <span className="text-[10px] text-gray-500">Özel Talko eventleri ve davetler</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={eventNotif}
                    onChange={(e) => setEventNotif(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!currentUser) return;
                    setRequestingNativePerm(true);
                    await requestNotificationPermission(currentUser.uid);
                    setRequestingNativePerm(false);
                  }}
                  disabled={requestingNativePerm}
                  className="w-full mt-1 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
                >
                  {requestingNativePerm ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
                  Tarayıcı Bildirim İznini Etkinleştir
                </button>
              )}
            </div>

            {/* Talko Verified Section */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                <BadgeCheck size={18} className="text-[#38bdf8] fill-[#38bdf8] dark:fill-none" />
                Talko Verified Durumu
              </h3>

              {userProfile?.isVerified ? (
                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3 flex items-start gap-3">
                  <div className="w-8 h-8 flex-shrink-0" dangerouslySetInnerHTML={{ __html: TALKO_VERIFIED_SVG }} />
                  <div>
                    <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">Profiliniz Doğrulandı!</h4>
                    <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-0.5">Talko Verified mavi tik rozetiniz profilinizde aktif bir şekilde gösterilmektedir.</p>
                  </div>
                </div>
              ) : userProfile?.blueTickStatus === 'pending' ? (
                <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-xl p-3 flex items-start gap-3">
                  <span className="text-xl select-none">⏳</span>
                  <div>
                    <h4 className="text-sm font-bold text-amber-950 dark:text-amber-300">Başvurunuz İncelemede</h4>
                    <p className="text-xs text-amber-800/80 dark:text-amber-400/80 mt-0.5">Mavi tik talebiniz başarıyla alındı ve Talko ekibi tarafından incelenmektedir.</p>
                  </div>
                </div>
              ) : userProfile?.blueTickStatus === 'rejected' && !showAppForm ? (
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl select-none">❌</span>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-300">Başvuru Onaylanmadı</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Önceki doğrulama başvurunuz onay kriterlerimizi karşılayamadı. Bilgilerinizi zenginleştirerek tekrar deneyebilirsiniz.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAppForm(true)}
                    className="mt-3 w-full py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold rounded-lg text-xs transition-colors"
                  >
                    Yeni Başvuru Yap
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800/70 rounded-xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                    Önemli bir kişi, marka veya kuruluşu temsil ediyorsanız veya profilinizi tescillemek istiyorsanız mavi tik talebi gönderebilirsiniz.
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Doğrulanma Gerekçeniz</label>
                      <textarea
                        value={blueTickReason}
                        onChange={(e) => setBlueTickReason(e.target.value)}
                        placeholder="Neden doğrulanmak istediğinizi yazın (örneğin: İçerik üreticisiyim, profilimin sahte olmadığını kanıtlamak istiyorum vb.)"
                        className="w-full text-xs px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none h-16 dark:text-white"
                        maxLength={150}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={submittingApp || !blueTickReason.trim()}
                      onClick={handleApplyBlueTick}
                      className="w-full py-2 bg-[#25d366] hover:bg-[#20bd5a] disabled:opacity-40 disabled:hover:bg-[#25d366] text-[#111b21] rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      {submittingApp ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        "Mavi Tik Talebi Gönder"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
