import { useState, useEffect, FormEvent } from 'react';
import { X, Smartphone, Monitor, Lock, LogOut, Loader2 } from 'lucide-react';
import { doc, updateDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { currentUser, deviceId: currentDeviceId } = useAuth();
  
  // Device Tracking State
  const [devices, setDevices] = useState<any[]>([]);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribe = onSnapshot(collection(db, 'users', currentUser.uid, 'devices'), (snapshot) => {
      const devicesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by last active desc
      devicesList.sort((a: any, b: any) => {
        const timeA = a.lastActive?.toMillis() || 0;
        const timeB = b.lastActive?.toMillis() || 0;
        return timeB - timeA;
      });
      setDevices(devicesList);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleLogoutDevice = async (deviceIdToLogout: string) => {
    if (!currentUser) return;
    try {
      const deviceRef = doc(db, 'users', currentUser.uid, 'devices', deviceIdToLogout);
      await updateDoc(deviceRef, { isRevoked: true });
      if (deviceIdToLogout === currentDeviceId) {
        auth.signOut().then(() => {
          window.location.href = '/';
        });
      } else {
        toast.success('Cihaz oturumu kapatıldı.');
      }
    } catch (error) {
      console.error('Error logging out device:', error);
      toast.error('Cihaz kapatılamadı.');
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.email) return;

    if (newPassword !== newPasswordConfirm) {
      toast.error('Yeni şifreler eşleşmiyor.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }

    setChangingPassword(true);
    const toastId = toast.loading('Şifre değiştiriliyor...');

    try {
      // Re-authenticate
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPassword);

      // Revoke all other devices
      const devicesRef = collection(db, 'users', currentUser.uid, 'devices');
      const snap = await getDocs(devicesRef);
      const updatePromises: Promise<void>[] = [];
      snap.forEach(d => {
        if (d.id !== currentDeviceId) {
          updatePromises.push(updateDoc(d.ref, { isRevoked: true }));
        }
      });
      await Promise.all(updatePromises);

      toast.success('Şifreniz başarıyla değiştirildi. Diğer oturumlar güvenlik nedeniyle kapatıldı.', { id: toastId });
      
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (error: any) {
      console.error('Change password error:', error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        toast.error('Mevcut şifreniz yanlış.', { id: toastId });
      } else if (error.code === 'auth/weak-password') {
        toast.error('Yeni şifre çok zayıf.', { id: toastId });
      } else {
        toast.error('Şifre değiştirilemedi.', { id: toastId });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            ⚙️ Ayarlar
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto flex-1">
          {/* Cihazlar Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-800 pb-2">
              <Monitor size={18} className="text-blue-500" />
              Oturum Açık Cihazlar
            </h3>
            <div className="space-y-3">
              {devices.map((device: any) => {
                const isCurrent = device.id === currentDeviceId;
                return (
                  <div key={device.id} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800/70 rounded-xl p-3.5 flex items-start justify-between gap-3 transition-all hover:border-slate-200 dark:hover:border-slate-700">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                        {device.platform?.toLowerCase().includes('windows') || device.platform?.toLowerCase().includes('mac') || device.platform?.toLowerCase().includes('linux') ? (
                          <Monitor size={20} />
                        ) : (
                          <Smartphone size={20} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">{device.deviceName}</h4>
                          {isCurrent && (
                            <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800">Bu Cihaz</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{device.browser} • {device.platform}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                          Son aktif: {device.lastActive ? formatDistanceToNow(device.lastActive.toDate(), { addSuffix: true, locale: tr }) : 'Bilinmiyor'}
                        </p>
                      </div>
                    </div>
                    {!device.isRevoked && (
                      <button
                        type="button"
                        onClick={() => handleLogoutDevice(device.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors tooltip-trigger shrink-0"
                        title="Oturumu Kapat"
                      >
                        <LogOut size={18} />
                      </button>
                    )}
                    {device.isRevoked && (
                      <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded-md">Kapatıldı</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Şifreyi Değiştir Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-800 pb-2">
              <Lock size={18} className="text-blue-500" />
              Şifreyi Değiştir
            </h3>
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800/70 rounded-xl p-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Mevcut Şifre</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Yeni Şifre</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all dark:text-white"
                />
              </div>
              <button
                type="button"
                disabled={changingPassword || !currentPassword || !newPassword || !newPasswordConfirm}
                onClick={handleChangePassword}
                className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:bg-blue-600 shadow-sm"
              >
                {changingPassword ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Şifreyi Güncelle"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
