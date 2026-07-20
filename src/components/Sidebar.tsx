import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, setDoc, doc, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import { LogOut, User as UserIcon, Search, MessageSquarePlus, Moon, Sun, Users, Bell } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Chat, User } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { SYSTEM_USER_ID, TALKO_AI_USER_ID, ensureSystemAccount, sendWelcomeMessageIfNeeded } from '../lib/systemAccount';
import { TALKO_LOGO_DATA_URL, TALKO_AI_LOGO_DATA_URL } from '../lib/assets';
import { cn } from '../lib/utils';
import { VerifiedBadge } from './VerifiedBadge';
import { requestNotificationPermission } from '../lib/notifications';
import StoriesBar from './StoriesBar';
import CreateGroupModal from './CreateGroupModal';
import ProfileCardModal from './ProfileCardModal';
import { AnimatePresence } from 'motion/react';

interface SidebarProps {
  onChatSelect: (chat: Chat) => void;
  activeChatId?: string;
  onOpenProfile: () => void;
}

export default function Sidebar({ onChatSelect, activeChatId, onOpenProfile }: SidebarProps) {
  const { currentUser, userProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [allUsers, setAllUsers] = useState<User[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  const prevUnreadCountsRef = React.useRef<Record<string, number>>({});
  const isInitialLoadRef = React.useRef(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const isDismissed = localStorage.getItem('talko-notifications-prompt-dismissed') === 'true';
      if (Notification.permission === 'default' && !isDismissed) {
        setShowNotificationPrompt(true);
      }
    }
  }, []);

  const handleEnableNotifications = async () => {
    if (!currentUser) return;
    const granted = await requestNotificationPermission(currentUser.uid);
    if (granted) {
      setShowNotificationPrompt(false);
    }
  };

  const handleDismissNotifications = () => {
    localStorage.setItem('talko-notifications-prompt-dismissed', 'true');
    setShowNotificationPrompt(false);
  };

  // 1. Subscribe to chats in real-time
  useEffect(() => {
    if (!currentUser) return;

    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef, 
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChats = snapshot.docs.map(doc => doc.data() as Chat);
      
      // Sort chats: System chat always first, then by updatedAt desc
      fetchedChats.sort((a, b) => {
        const aIsSystem = a.participants.includes(SYSTEM_USER_ID);
        const bIsSystem = b.participants.includes(SYSTEM_USER_ID);
        
        if (aIsSystem && !bIsSystem) return -1;
        if (!aIsSystem && bIsSystem) return 1;
        
        return b.updatedAt - a.updatedAt;
      });

      // Track unread changes to trigger browser-level notifications
      const unreadCounts: Record<string, number> = {};
      fetchedChats.forEach(chat => {
        unreadCounts[chat.id] = chat.unreadCount?.[currentUser.uid] || 0;
      });

      if (!isInitialLoadRef.current) {
        fetchedChats.forEach(chat => {
          const prevUnread = prevUnreadCountsRef.current[chat.id] || 0;
          const currentUnread = unreadCounts[chat.id] || 0;

          if (currentUnread > prevUnread) {
            // Unread count increased - check category preferences
            const settings = userProfile?.notificationSettings;
            const messagesEnabled = settings?.messages !== false;
            const groupsEnabled = settings?.groups !== false;
            const eventsEnabled = settings?.events !== false;

            const isGroup = chat.isGroup === true;
            const isEvent = chat.lastMessage === '🎉 Etkinlik' || (chat.eventState?.isActive === true && chat.lastMessageTimestamp > Date.now() - 5000);

            let shouldNotify = false;
            if (isEvent && eventsEnabled) {
              shouldNotify = true;
            } else if (isGroup && groupsEnabled) {
              shouldNotify = true;
            } else if (!isGroup && !isEvent && messagesEnabled) {
              shouldNotify = true;
            }

            if (shouldNotify && document.visibilityState === 'hidden') {
              let title = "Talko";
              let photo = "";
              if (chat.isGroup) {
                title = `${chat.groupEmoji || '💬'} ${chat.groupName}`;
              } else {
                const otherUid = chat.participants.find(p => p !== currentUser.uid);
                const otherDetails = chat.participantDetails?.[otherUid || ''];
                title = otherDetails?.username || "Yeni Mesaj";
                photo = otherDetails?.photoURL || "";
              }

              // Display notification using the background-safe utility
              import('../lib/notifications').then(({ showLocalNotification }) => {
                showLocalNotification(title, {
                  body: chat.lastMessage || "Yeni bir mesajınız var",
                  icon: photo || undefined,
                  chatId: chat.id
                });
              });
            }
          }
        });
      }

      prevUnreadCountsRef.current = unreadCounts;
      isInitialLoadRef.current = false;

      setChats(fetchedChats);
    }, (err) => {
      console.error("CHATS ERROR: " + err.message);
      setChats([]);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Delivery receipts logic
  useEffect(() => {
    if (!currentUser || !chats) return;
    
    chats.forEach(chat => {
      // Don't update delivery for system chat since it's one-way
      if (chat.participants.includes(SYSTEM_USER_ID)) return;
      
      const myLastDelivered = chat.lastDelivered?.[currentUser.uid] || 0;
      const lastMsgTime = chat.lastMessageTimestamp || 0;
      
      if (lastMsgTime > myLastDelivered) {
        const chatRef = doc(db, 'chats', chat.id);
        updateDoc(chatRef, {
          [`lastDelivered.${currentUser.uid}`]: lastMsgTime
        }).catch(err => console.error("Delivery update error:", err));
      }
    });
  }, [chats, currentUser]);

  // 2. Subscribe to all registered users in real-time (instant update of online/offline status)
  useEffect(() => {
    if (!currentUser) return;

    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const fetchedUsers = snapshot.docs
        .map(doc => doc.data() as User)
        .filter(u => u.uid !== currentUser?.uid && u.uid !== SYSTEM_USER_ID);

      // Sort users: Online first, then alphabetically
      fetchedUsers.sort((a, b) => {
        const aOnline = a.isOnline || (a as any).online || false;
        const bOnline = b.isOnline || (b as any).online || false;
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        return a.username.localeCompare(b.username, 'tr');
      });

      setAllUsers(fetchedUsers);
    }, (err) => {
      console.error("USERS ERROR: " + err.message);
      setAllUsers([]);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 3. Proactively ensure the Talko Destek (System Chat) is created for this user
  useEffect(() => {
    if (!currentUser || !userProfile || !chats) return;

    const hasSystemChat = chats.some(c => c.participants.includes(SYSTEM_USER_ID));
    if (!hasSystemChat) {
      ensureSystemAccount().then(() => {
        sendWelcomeMessageIfNeeded(currentUser.uid, userProfile.username, userProfile.photoURL);
      }).catch(err => {
        console.error("Proactive system chat generation failed:", err);
      });
    }
  }, [chats, currentUser, userProfile]);

  const startChat = async (targetUser: User) => {
    if (!currentUser || !userProfile || !chats) return;

    const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
    
    // Check if chat already exists in our local list
    const existingChat = chats.find(c => c.id === chatId);
    if (existingChat) {
      onChatSelect(existingChat);
      setSearchQuery('');
      return;
    }

    // Create new chat
    const now = Date.now();
    const newChat: Chat = {
      id: chatId,
      participants: [currentUser.uid, targetUser.uid],
      participantDetails: {
        [currentUser.uid]: { username: userProfile.username, photoURL: userProfile.photoURL || null },
        [targetUser.uid]: { username: targetUser.username, photoURL: targetUser.photoURL || null }
      },
      lastMessage: null,
      lastMessageTimestamp: null,
      updatedAt: now
    };

    await setDoc(doc(db, 'chats', chatId), newChat);
    onChatSelect(newChat);
    setSearchQuery('');
  };

  const handleLogout = async () => {
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.uid);
      try {
        await updateDoc(userRef, {
          isOnline: false,
          online: false,
          lastSeen: serverTimestamp()
        });
      } catch (err) {
        console.error("Error setting offline status on logout:", err);
      }
    }
    await auth.signOut();
  };

  // Filter out banned users for UI lists in real-time
  const visibleAllUsers = allUsers ? allUsers.filter(u => !u.isBanned) : [];

  const visibleChats = chats ? chats.filter(chat => {
    if (!chat || !chat.participants) return false;
    if (chat.isGroup) return true; // Group chats are always visible to participants
    
    const otherUserId = chat.participants.find(id => id !== currentUser?.uid) || currentUser?.uid;
    if (otherUserId === SYSTEM_USER_ID) return true;
    
    // Check if the other user is banned in allUsers in real-time
    const otherUserObj = allUsers?.find(u => u.uid === otherUserId);
    if (otherUserObj?.isBanned) return false;
    
    return true;
  }) : [];

  // Instant local filtering
  const filteredChats = visibleChats.filter(chat => {
    if (chat.isGroup) {
      return (chat.groupName || "").toLowerCase().includes(searchQuery.toLowerCase());
    }
    const otherUserId = chat.participants.find(id => id !== currentUser?.uid) || currentUser?.uid;
    const isSystem = otherUserId === SYSTEM_USER_ID;
    const isAi = otherUserId === TALKO_AI_USER_ID;
    const userObj = otherUserId === currentUser?.uid ? userProfile : allUsers?.find(u => u.uid === otherUserId);
    const otherUser = isSystem 
      ? { username: 'Talko Updates' }
      : isAi
      ? { username: 'Talko AI' }
      : (userObj || chat.participantDetails?.[otherUserId || ''] || {});
    return (otherUser?.username || "").toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredUsers = visibleAllUsers.filter(user => 
    (user.username || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderChatButton = (chat: Chat) => {
    if (!chat || !chat.participants) return null;
    
    let chatTitle = '';
    let chatPhoto: React.ReactNode = null;
    let isOnline = false;
    let isVerified = false;
    let otherUser: any = {};

    if (chat.isGroup) {
      chatTitle = chat.groupName || 'Grup';
      chatPhoto = (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-blue-500/10 to-blue-600/10 text-3xl font-bold select-none text-blue-600 dark:text-blue-400">
          {chat.groupEmoji || '👥'}
        </div>
      );
    } else {
      const otherUserId = chat.participants.find(id => id !== currentUser?.uid) || currentUser?.uid;
      if (!otherUserId) return null;
      
      const isSystem = otherUserId === SYSTEM_USER_ID;
      const isAi = otherUserId === TALKO_AI_USER_ID;
      const userObj = otherUserId === currentUser?.uid ? userProfile : allUsers.find(u => u.uid === otherUserId);
      isVerified = isSystem || isAi || (userObj?.isVerified || false);
      otherUser = isSystem 
        ? { username: 'Talko Updates', photoURL: TALKO_LOGO_DATA_URL }
        : isAi
        ? { username: 'Talko AI', photoURL: TALKO_AI_LOGO_DATA_URL }
        : (userObj || chat.participantDetails?.[otherUserId] || {});
      
      chatTitle = otherUser?.username || '';
      isOnline = userObj ? (userObj.isOnline || (userObj as any).online) : false;
      
      chatPhoto = (
        <div className="w-full h-full overflow-hidden bg-gray-100 dark:bg-gray-800">
          {isSystem ? (
            <img src={TALKO_LOGO_DATA_URL} alt="Talko Updates" className="w-full h-full object-cover" />
          ) : isAi ? (
            <img src={TALKO_AI_LOGO_DATA_URL} alt="Talko AI" className="w-full h-full object-cover" />
          ) : otherUser?.photoURL ? (
            <img src={otherUser.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30">
              <UserIcon size={24} />
            </div>
          )}
        </div>
      );
    }
    
    let timeString = '';
    if (chat.lastMessageTimestamp) {
      try {
        timeString = formatDistanceToNow(chat.lastMessageTimestamp, { addSuffix: true, locale: tr });
      } catch (err) {
        console.error("Error formatting distance to now:", err);
      }
    }

    return (
      <button
        key={chat.id}
        onClick={() => onChatSelect(chat)}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left min-w-0",
          activeChatId === chat.id 
            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium" 
            : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
        )}
      >
        <div className="relative w-12 h-12 flex-shrink-0">
          <div className="w-full h-full rounded-full overflow-hidden border border-gray-100 dark:border-gray-800">
            {chatPhoto}
          </div>
          {isOnline && !isVerified && !chat.isGroup && (
            <span className="absolute bottom-0 right-0 block w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 shadow-sm z-10 animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{chatTitle}</p>
              {isVerified && <VerifiedBadge className="w-4 h-4 flex-shrink-0" />}
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap ml-2 flex-shrink-0">
              {timeString.replace('yaklaşık ', '')}
            </span>
          </div>
          <div className="flex items-center justify-between min-w-0">
            <p className={cn(
              "text-sm truncate pr-2",
              activeChatId === chat.id ? "text-blue-600 dark:text-blue-400 font-medium" : (chat.unreadCount?.[currentUser?.uid || ''] && activeChatId !== chat.id ? "text-gray-900 dark:text-gray-100 font-bold" : "text-gray-500 dark:text-gray-400")
            )}>
              {chat.lastMessage || 'Sohbete başla'}
            </p>
            {(chat.unreadCount?.[currentUser?.uid || ''] || 0) > 0 && activeChatId !== chat.id && (
              <span className="flex-shrink-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center shadow-sm">
                {chat.unreadCount?.[currentUser?.uid || '']}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  const renderUserButton = (user: User) => {
    const isSystem = user.uid === SYSTEM_USER_ID;
    const isAi = user.uid === TALKO_AI_USER_ID;
    const isVerified = isSystem || isAi || (user.isVerified || false);

    return (
      <button
        key={user.uid}
        onClick={() => startChat(user)}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-xl transition-all duration-200 text-left min-w-0"
      >
        <div 
          className="relative w-10 h-10 flex-shrink-0 cursor-pointer group/avatar"
          onClick={(e) => {
            e.stopPropagation();
            setProfileModalUserId(user.uid);
          }}
        >
          <div className="w-full h-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-850 ring-2 ring-transparent group-hover/avatar:ring-blue-500 transition-all">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800">
                <UserIcon size={20} />
              </div>
            )}
          </div>
          {(user.isOnline || (user as any).online) && !isVerified && (
            <span className="absolute bottom-0 right-0 block w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 shadow-sm z-10 animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 w-full">
            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{user.username}</p>
            {isVerified && <VerifiedBadge className="w-4 h-4 flex-shrink-0" />}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate w-full">{user.about || 'Merhaba!'}</p>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={() => setProfileModalUserId(currentUser?.uid || null)} className="relative group focus:outline-none flex-shrink-0">
            <div className="relative w-10 h-10">
              <div className="w-full h-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                {userProfile?.photoURL ? (
                  <img src={userProfile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
                    <UserIcon size={20} />
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                <UserIcon size={16} className="text-white" />
              </div>
              <span className="absolute bottom-0 right-0 block w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 shadow-sm z-20" />
            </div>
          </button>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <h2 className="font-semibold text-gray-900 dark:text-white leading-tight truncate">{userProfile?.username || 'Yükleniyor...'}</h2>
            {userProfile?.userHandle ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{userProfile.userHandle}</p>
            ) : (
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Çevrimiçi</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button 
            onClick={() => setIsGroupModalOpen(true)} 
            className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-50 dark:hover:bg-gray-800"
            title="Grup Oluştur"
          >
            <Users size={20} />
          </button>
          <button onClick={toggleTheme} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-gray-50 dark:hover:bg-gray-800">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 pb-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 p-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            placeholder="Kullanıcı veya grup ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-transparent rounded-xl text-sm focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none dark:text-white"
          />
        </div>
      </div>

      {/* Push Notification Banner */}
      {showNotificationPrompt && (
        <div className="px-4 pb-2">
          <div className="bg-blue-50/75 dark:bg-blue-950/25 border border-blue-100/60 dark:border-blue-900/40 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden transition-colors">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100/80 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                <Bell size={18} className="animate-bounce" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">🔔 Bildirimleri Aç</h4>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed mt-0.5">Yeni mesajları ve önemli etkinlikleri anında öğren.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleDismissNotifications}
                className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-850 transition-all cursor-pointer"
              >
                ⏳ Daha Sonra
              </button>
              <button
                onClick={handleEnableNotifications}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-all shadow-sm hover:shadow cursor-pointer"
              >
                ✅ Bildirimleri Aç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stories Bar */}
      <StoriesBar />

      {/* Chat List & User List */}
      <div className="flex-1 overflow-y-auto">
        {chats === null || allUsers === null ? (
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-md w-24 animate-pulse" />
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-850 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-md w-1/3 animate-pulse" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-md w-1/2 animate-pulse" />
                </div>
              </div>
            </div>
            <div className="space-y-3 pt-4">
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-md w-24 animate-pulse" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-850 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-md w-1/4 animate-pulse" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-md w-1/3 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        ) : searchQuery.length > 0 ? (
          <div className="p-2 space-y-4">
            {/* Filtered Chats */}
            {filteredChats.length > 0 && (
              <div>
                <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Sohbetler</h3>
                <div className="space-y-1">
                  {filteredChats.map(chat => renderChatButton(chat))}
                </div>
              </div>
            )}

            {/* Filtered Users */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Kullanıcılar</h3>
              {filteredUsers.length > 0 ? (
                <div className="space-y-1">
                  {filteredUsers.map(user => renderUserButton(user))}
                </div>
              ) : (
                filteredChats.length === 0 && (
                  <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">Sonuç bulunamadı.</p>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-4">
            {/* Active Chats Section */}
            {visibleChats.length > 0 && (
              <div>
                <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Sohbetler</h3>
                <div className="space-y-1">
                  {visibleChats.map(chat => renderChatButton(chat))}
                </div>
              </div>
            )}

            {/* All Registered Users Section */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Kullanıcılar</h3>
              {visibleAllUsers.length > 0 ? (
                <div className="space-y-1">
                  {visibleAllUsers.map(user => renderUserButton(user))}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">Kayıtlı kullanıcı bulunmuyor.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Group Creator Modal */}
      <AnimatePresence>
        {isGroupModalOpen && (
          <CreateGroupModal 
            onClose={() => setIsGroupModalOpen(false)} 
            onGroupCreated={(newChat) => {
              onChatSelect(newChat);
              setIsGroupModalOpen(false);
            }} 
          />
        )}
      </AnimatePresence>

      {profileModalUserId && (
        <ProfileCardModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
          onEditProfile={onOpenProfile}
          onSendMessage={(id) => {
            setProfileModalUserId(null);
            const userObj = allUsers?.find(u => u.uid === id);
            if (userObj) {
              startChat(userObj);
            }
          }}
        />
      )}
    </div>
  );
}
