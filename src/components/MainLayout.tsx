import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import ProfileModal from './ProfileModal';
import { User, Chat } from '../types';

export default function MainLayout() {
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [viewportHeight, setViewportHeight] = useState('100dvh');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
      }
    };

    const handleOpenProfile = () => {
      setIsProfileOpen(true);
    };

    const handleOpenChat = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const chatId = customEvent.detail?.chatId;
      if (chatId) {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        try {
          const chatSnap = await getDoc(doc(db, 'chats', chatId));
          if (chatSnap.exists()) {
            setActiveChat(chatSnap.data() as Chat);
            if (window.innerWidth < 768) {
              setIsSidebarOpen(false);
            }
          }
        } catch (err) {
          console.error("Error fetching chat for notification navigation:", err);
        }
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    window.addEventListener('open-profile-modal', handleOpenProfile);
    window.addEventListener('open-chat', handleOpenChat as EventListener);
    
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      window.removeEventListener('open-profile-modal', handleOpenProfile);
      window.removeEventListener('open-chat', handleOpenChat as EventListener);
    };
  }, []);

  const handleChatSelect = (chat: Chat) => {
    setActiveChat(chat);
    // On mobile, close sidebar when a chat is selected
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div 
      style={{ height: viewportHeight }}
      className="flex bg-white dark:bg-gray-900 overflow-hidden transition-colors w-full"
    >
      <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 h-full ${isSidebarOpen ? 'block' : 'hidden md:block'}`}>
        <Sidebar 
          onChatSelect={handleChatSelect} 
          activeChatId={activeChat?.id} 
          onOpenProfile={() => setIsProfileOpen(true)}
        />
      </div>
      
      <div className={`flex-1 min-w-0 h-full ${!isSidebarOpen ? 'block' : 'hidden md:block'}`}>
        {activeChat ? (
          <ChatArea 
            key={activeChat.id}
            chat={activeChat} 
            onBack={() => setIsSidebarOpen(true)}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 transition-colors">
            <p>Sohbet başlatmak için bir konuşma seçin.</p>
          </div>
        )}
      </div>

      {isProfileOpen && (
        <ProfileModal onClose={() => setIsProfileOpen(false)} />
      )}
    </div>
  );
}
