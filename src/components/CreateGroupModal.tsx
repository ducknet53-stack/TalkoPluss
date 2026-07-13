import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Loader2, Smile } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { User, Chat } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { SYSTEM_USER_ID, TALKO_AI_USER_ID } from '../lib/systemAccount';
import toast from 'react-hot-toast';

interface CreateGroupModalProps {
  onClose: () => void;
  onGroupCreated: (chat: Chat) => void;
}

const DEFAULT_EMOJIS = ['👥', '💬', '🚀', '🔥', '🎉', '💡', '🎮', '❤️', '💼', '🍕', '🎧', '⚽'];

export default function CreateGroupModal({ onClose, onGroupCreated }: CreateGroupModalProps) {
  const { currentUser, userProfile } = useAuth();
  const { theme } = useTheme();
  
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('👥');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      if (!currentUser) return;
      try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        const fetchedUsers = snapshot.docs
          .map(d => d.data() as User)
          .filter(u => u.uid !== currentUser.uid && u.uid !== SYSTEM_USER_ID && u.uid !== TALKO_AI_USER_ID && !u.isBanned);
        
        setUsers(fetchedUsers);
      } catch (err) {
        console.error("Error fetching users for group:", err);
        toast.error("Kullanıcılar yüklenemedi.");
      } finally {
        setIsLoadingUsers(false);
      }
    }
    fetchUsers();
  }, [currentUser]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!currentUser || !userProfile) return;
    if (!groupName.trim()) {
      toast.error("Grup adı boş bırakılamaz.");
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error("Grupta en az 1 katılımcı olmalıdır.");
      return;
    }

    setIsCreating(true);
    const toastId = toast.loading('Grup oluşturuluyor...');

    try {
      const groupId = 'group_' + Date.now().toString() + Math.random().toString(36).substring(2, 5);
      const allParticipants = [currentUser.uid, ...selectedUserIds];
      
      const participantDetails: Record<string, { username: string; photoURL: string | null }> = {
        [currentUser.uid]: { username: userProfile.username, photoURL: userProfile.photoURL || null }
      };

      selectedUserIds.forEach(id => {
        const u = users.find(user => user.uid === id);
        if (u) {
          participantDetails[id] = { username: u.username, photoURL: u.photoURL || null };
        }
      });

      const now = Date.now();
      const newChat: Chat = {
        id: groupId,
        participants: allParticipants,
        participantDetails,
        lastMessage: "Grup oluşturuldu",
        lastMessageTimestamp: now,
        updatedAt: now,
        isGroup: true,
        groupName: groupName.trim(),
        groupDescription: groupDescription.trim() || undefined,
        groupEmoji: selectedEmoji,
        createdBy: currentUser.uid,
        lastRead: {
          [currentUser.uid]: now
        }
      };

      await setDoc(doc(db, 'chats', groupId), newChat);

      // Send initial group creation system message
      const messageId = now.toString() + '_system';
      const messageRef = doc(db, `chats/${groupId}/messages`, messageId);
      await setDoc(messageRef, {
        id: messageId,
        senderId: 'system_group_info',
        text: `📢 ${userProfile.username} "${groupName}" grubunu oluşturdu.`,
        imageUrl: null,
        timestamp: now
      });

      toast.success('Grup başarıyla oluşturuldu!', { id: toastId });
      onGroupCreated(newChat);
      onClose();
    } catch (err: any) {
      console.error("Error creating group:", err);
      toast.error("Grup oluşturulurken hata oluştu.", { id: toastId });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-850 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <Users size={20} className="text-blue-500" /> Yeni Grup Oluştur
          </h2>
          <button 
            onClick={onClose}
            disabled={isCreating}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Emoji Avatar Picker */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-950/30 border-2 border-dashed border-blue-200 dark:border-blue-900 flex items-center justify-center text-4xl shadow-sm hover:scale-105 active:scale-95 transition-all"
              >
                {selectedEmoji}
              </button>
              <button 
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute bottom-0 right-0 p-1.5 bg-blue-600 text-white rounded-full border border-white dark:border-gray-900 shadow-sm hover:scale-110 active:scale-90 transition-all"
              >
                <Smile size={14} />
              </button>
            </div>

            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Grup Profil Emojisi Seçin</span>

            {/* Quick Emojis or Emoji Picker Popup */}
            {showEmojiPicker ? (
              <div className="absolute z-50 mt-20 shadow-2xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
                <EmojiPicker 
                  onEmojiClick={(emojiData) => {
                    setSelectedEmoji(emojiData.emoji);
                    setShowEmojiPicker(false);
                  }}
                  autoFocusSearch={false}
                  theme={theme}
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 justify-center max-w-[280px]">
                {DEFAULT_EMOJIS.map(em => (
                  <button
                    key={em}
                    onClick={() => setSelectedEmoji(em)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                      selectedEmoji === em ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-500 scale-110' : ''
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Group Inputs */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Grup Adı
              </label>
              <input 
                type="text" 
                placeholder="Örn. Kahve Severler ☕"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={30}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm outline-none dark:text-white transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Grup Açıklaması
              </label>
              <input 
                type="text" 
                placeholder="Örn. Hafta sonu kahve etkinlikleri grubu"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                maxLength={100}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-850 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm outline-none dark:text-white transition-all"
              />
            </div>
          </div>

          {/* User Multi-Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex justify-between items-center">
              <span>Katılımcı Seç ({selectedUserIds.length})</span>
              {selectedUserIds.length > 0 && (
                <button 
                  onClick={() => setSelectedUserIds([])}
                  className="text-[11px] text-blue-500 hover:underline capitalize"
                >
                  Tümünü Temizle
                </button>
              )}
            </label>
            
            <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden bg-gray-50/50 dark:bg-gray-950/20 max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {isLoadingUsers ? (
                <div className="p-6 flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500">
                  <Loader2 size={16} className="animate-spin" />
                  Kullanıcılar yükleniyor...
                </div>
              ) : users.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  Kayıtlı kullanıcı bulunmuyor.
                </div>
              ) : (
                users.map(user => {
                  const isSelected = selectedUserIds.includes(user.uid);
                  return (
                    <button
                      key={user.uid}
                      type="button"
                      onClick={() => toggleUserSelection(user.uid)}
                      className="w-full px-4 py-3 hover:bg-gray-100/50 dark:hover:bg-gray-800/40 flex items-center justify-between text-left transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-blue-100 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center font-bold text-xs">
                              {user.username.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">
                          {user.username}
                        </span>
                      </div>
                      
                      {/* Checkbox circle */}
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-850'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-850 flex justify-end gap-3 bg-gray-50 dark:bg-gray-950/20">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl transition-all"
          >
            Vazgeç
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !groupName.trim() || selectedUserIds.length === 0}
            className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl shadow-md hover:shadow-blue-500/15 flex items-center gap-2 transition-all"
          >
            {isCreating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              'Grubu Oluştur'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
