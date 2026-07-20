import { useState, useEffect } from 'react';
import { X, MessageSquare, Edit2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { VerifiedBadge } from './VerifiedBadge';
import { SYSTEM_USER_ID, TALKO_AI_USER_ID } from '../lib/systemAccount';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface ProfileCardModalProps {
  userId: string;
  onClose: () => void;
  onEditProfile?: () => void;
  onSendMessage?: (userId: string) => void;
}

export default function ProfileCardModal({ userId, onClose, onEditProfile, onSendMessage }: ProfileCardModalProps) {
  const { currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'likes'>('videos');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUser(docSnap.data() as User);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [userId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-8 flex justify-center items-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-6 text-center" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Kullanıcı Bulunamadı</h3>
          <button onClick={onClose} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-medium">Kapat</button>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.uid === userId;
  const isSystem = user.uid === SYSTEM_USER_ID || user.uid === 'system_talko_destek' || user.uid === 'system_talko_ai';
  const isVerified = isSystem || user.isVerified || user.blueTickStatus === 'approved';

  const bioLines = user.about ? user.about.split('\n') : [];
  const hasLongBio = bioLines.length > 2 || (user.about && user.about.length > 90);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="w-full max-w-[400px] bg-white dark:bg-gray-900 rounded-[32px] overflow-hidden shadow-2xl relative transition-all duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header / Cover Area */}
        <div className="h-32 bg-gradient-to-r from-blue-500 to-cyan-500 relative">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-6 relative">
          {/* Avatar */}
          <div className="flex justify-between items-end -mt-16 mb-4">
            <div className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-900 bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0 shadow-md">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-semibold text-gray-400">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Names */}
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-1.5 leading-tight">
              {user.username}
              {isVerified && <VerifiedBadge className="w-5 h-5 flex-shrink-0" />}
            </h2>
            {user.userHandle ? (
              <p className="text-gray-500 dark:text-gray-400 font-medium">@{user.userHandle}</p>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">@{user.usernameLower.replace(/\s+/g, '')}</p>
            )}
          </div>

          {/* Bio */}
          {user.about && (
            <div className="mb-5">
              <p className={cn(
                "text-gray-750 dark:text-gray-300 text-[15px] leading-relaxed whitespace-pre-wrap transition-all",
                (!isBioExpanded && hasLongBio) ? "line-clamp-2" : ""
              )}>
                {user.about}
              </p>
              {!isBioExpanded && hasLongBio && (
                <button 
                  onClick={() => setIsBioExpanded(true)}
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-semibold mt-1 transition-colors"
                >
                  ... Daha Fazla
                </button>
              )}
            </div>
          )}

          {/* Stats & Details */}
          <div className="flex flex-col gap-2.5 mb-5">
            <div className="flex items-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-1">
                <span className="text-gray-900 dark:text-white font-bold">0</span>
                <span className="text-gray-500 dark:text-gray-400">Takipçi</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-900 dark:text-white font-bold">0</span>
                <span className="text-gray-500 dark:text-gray-400">Takip Edilen</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 font-medium">
              <span>📅</span>
              <span>
                {user.createdAt ? `${format(user.createdAt, 'MMMM yyyy', { locale: tr })}'da katıldı` : 'Talko üyesi'}
              </span>
            </div>
          </div>

          {/* Tabs for Future Content */}
          <div className="flex border-b border-gray-150 dark:border-gray-800 mb-4">
            <button
              onClick={() => setActiveTab('videos')}
              className={cn(
                "flex-1 pb-3 text-sm font-semibold transition-colors relative flex items-center justify-center gap-1.5",
                activeTab === 'videos' 
                  ? "text-blue-600 dark:text-blue-400" 
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <span>🎥</span>
              <span>Videolar</span>
              {activeTab === 'videos' && (
                <motion.div 
                  layoutId="profileTabUnderline" 
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" 
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('likes')}
              className={cn(
                "flex-1 pb-3 text-sm font-semibold transition-colors relative flex items-center justify-center gap-1.5",
                activeTab === 'likes' 
                  ? "text-blue-600 dark:text-blue-400" 
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <span>❤️</span>
              <span>Beğenilenler</span>
              {activeTab === 'likes' && (
                <motion.div 
                  layoutId="profileTabUnderline" 
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" 
                />
              )}
            </button>
          </div>

          {/* Tab Content Placeholder */}
          <div className="min-h-[100px] flex flex-col items-center justify-center text-center p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl mb-6">
            {activeTab === 'videos' ? (
              <div className="text-gray-400 dark:text-gray-500">
                <p className="text-2xl mb-1">🎬</p>
                <p className="text-xs font-medium">Henüz yüklenmiş bir video bulunmuyor</p>
              </div>
            ) : (
              <div className="text-gray-400 dark:text-gray-500">
                <p className="text-2xl mb-1">💖</p>
                <p className="text-xs font-medium">Henüz beğenilen bir içerik bulunmuyor</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {isOwnProfile ? (
              <button 
                onClick={() => {
                  onClose();
                  onEditProfile?.();
                }}
                className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Edit2 size={18} />
                Profili Düzenle
              </button>
            ) : (
              <button 
                onClick={() => {
                  onClose();
                  onSendMessage?.(user.uid);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <MessageSquare size={18} />
                Mesaj Gönder
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
