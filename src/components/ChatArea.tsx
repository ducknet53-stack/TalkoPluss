import React, { useState, useEffect, useRef, ReactNode } from 'react';
import type { ChangeEvent } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, getDoc, updateDoc, increment, addDoc, where, getDocs } from 'firebase/firestore';
import { ArrowLeft, Send, Image as ImageIcon, Smile, User as UserIcon, Loader2, MoreVertical, Ban, ShieldAlert, Flag, CheckCircle2, ShieldBan, X, Copy, Megaphone, BarChart2, Plus, Trash2 } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Chat, Message, PollOption } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatLastSeen } from '../lib/dateUtils';
import { motion, AnimatePresence } from 'motion/react';
import { SYSTEM_USER_ID, TALKO_AI_USER_ID } from '../lib/systemAccount';
import { TALKO_LOGO_DATA_URL, TALKO_AI_LOGO_DATA_URL } from '../lib/assets';
import { cn, playSendSound } from '../lib/utils';
import { uploadImage } from '../lib/imgbb';
import toast from 'react-hot-toast';
import { VerifiedBadge } from './VerifiedBadge';
import { hasProfanity } from '../lib/moderation';

function renderMarkdown(text: string): ReactNode {
  if (!text) return null;

  // Split text into lines to process lists
  const lines = text.split('\n');
  
  return (
    <div className="space-y-1 text-inherit" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      {lines.map((line, lineIndex) => {
        // Check for list items
        const listMatch = line.match(/^(\s*)([-*•]|\d+\.)\s+(.*)$/);
        
        let content = line;
        let isListItem = false;
        let listPadding = '';

        if (listMatch) {
          isListItem = true;
          content = listMatch[3];
          listPadding = listMatch[1] ? 'pl-4' : '';
        }

        // Inline formatting function
        const renderInline = (str: string) => {
          // Parse backticks for code, bold **text**, and italic *text*
          // and @Talko AI mention
          
          // Let's split by backticks first
          const partsByCode = str.split(/(`[^`\n]+`)/g);
          
          return partsByCode.map((part, partIdx) => {
            if (part.startsWith('`') && part.endsWith('`')) {
              const codeText = part.slice(1, -1);
              return (
                <code 
                  key={`code-${partIdx}`} 
                  className="bg-gray-200/50 dark:bg-gray-700/60 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded font-mono text-xs font-semibold mx-0.5"
                >
                  {codeText}
                </code>
              );
            }

            // Inside this text part, split by bold **text**
            const partsByBold = part.split(/(\*\*[^*]+\*\*)/g);
            return partsByBold.map((boldPart, boldIdx) => {
              if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
                const boldText = boldPart.slice(2, -2);
                return (
                  <strong key={`bold-${boldIdx}`} className="font-bold text-gray-950 dark:text-white">
                    {boldText}
                  </strong>
                );
              }

              // Inside this boldPart, split by italic *text*
              const partsByItalic = boldPart.split(/(\*[^*]+\*)/g);
              return partsByItalic.map((italicPart, italicIdx) => {
                if (italicPart.startsWith('*') && italicPart.endsWith('*')) {
                  const italicText = italicPart.slice(1, -1);
                  return (
                    <em key={`italic-${italicIdx}`} className="italic">
                      {italicText}
                    </em>
                  );
                }

                // Inside this italicPart, split by @Talko AI
                const partsByMention = italicPart.split(/(@Talko AI)/gi);
                return partsByMention.map((mentionPart, mentionIdx) => {
                  if (mentionPart.toLowerCase() === '@talko ai') {
                    return (
                      <span 
                        key={`mention-${mentionIdx}`} 
                        className="text-blue-500 dark:text-blue-400 font-semibold underline cursor-pointer"
                      >
                        {mentionPart}
                      </span>
                    );
                  }
                  return mentionPart;
                });
              });
            });
          });
        };

        if (isListItem) {
          return (
            <div key={lineIndex} className={cn("flex items-start gap-2 text-[15px] leading-relaxed", listPadding)}>
              <span className="text-blue-500 dark:text-blue-400 select-none mt-1 text-[8px]">●</span>
              <span className="flex-1 text-inherit">{renderInline(content)}</span>
            </div>
          );
        }

        return (
          <p key={lineIndex} className="text-[15px] leading-relaxed min-h-[1.2em] text-inherit">
            {renderInline(content)}
          </p>
        );
      })}
    </div>
  );
}

interface ChatAreaProps {
  key?: string;
  chat: Chat;
  onBack: () => void;
}

export default function ChatArea({ chat, onBack }: ChatAreaProps) {
  const { currentUser, userProfile } = useAuth();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState([{ id: '1', text: 'Evet' }, { id: '2', text: 'Hayır' }]);
  
  const [mentionQuery, setMentionQuery] = useState<{ query: string, start: number, end: number } | null>(null);

  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState<number | null>(null);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [liveUsers, setLiveUsers] = useState<Record<string, any>>({});
  
  // AI State
  const [aiState, setAiState] = useState({ isGenerating: false, isThinking: false, streamText: '' });
  const [groupTypersText, setGroupTypersText] = useState('');
  const [liveChat, setLiveChat] = useState<Chat>(chat);
  
  useEffect(() => {
    setLiveChat(chat);
    setOptimisticMessages([]); // Reset optimistic and failed moderated messages when switching chats
    if (!chat?.id || !currentUser) return;
    const unsub = onSnapshot(doc(db, 'chats', chat.id), (docSnap) => {
      if (docSnap.exists()) {
        setLiveChat({ id: docSnap.id, ...docSnap.data() } as Chat);
      }
    });
    return () => unsub();
  }, [chat?.id, currentUser]);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef<number>(0);
  const lastMyTypingWriteRef = useRef<number>(0);
  const lastEventErrorTimeRef = useRef<number>(0);
  const messageTimestampsRef = useRef<number[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMessagesLengthRef = useRef(0);

  const dispatchPushNotification = (text: string) => {
    if (!currentUser || !liveChat) return;
    fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: liveChat.id,
        senderId: currentUser.uid,
        senderName: userProfile?.username || currentUser.displayName || "Kullanıcı",
        text,
        participants: liveChat.participants,
        isGroup: liveChat.isGroup === true,
        groupName: liveChat.groupName || ""
      })
    }).catch(err => console.error("Failed to send push notification:", err));
  };

  const otherUserId = chat?.participants?.find(id => id !== currentUser?.uid) || currentUser?.uid;
  const isSystemChat = otherUserId === SYSTEM_USER_ID;
  const isAiChat = otherUserId === TALKO_AI_USER_ID;
  const otherUserDetails = isSystemChat 
    ? { username: 'Talko Updates', photoURL: TALKO_LOGO_DATA_URL }
    : isAiChat
    ? { username: 'Talko AI', photoURL: TALKO_AI_LOGO_DATA_URL }
    : (otherUserId === currentUser?.uid 
        ? userProfile 
        : (liveUsers[otherUserId || ''] || chat?.participantDetails?.[otherUserId || ''] || {}));

  const isVerified = isSystemChat || isAiChat || (otherUserDetails?.isVerified || false);

  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false);
  const [selectedMessageForReport, setSelectedMessageForReport] = useState<Message | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<string>('');

  const isBlockedByMe = userProfile?.blockedUsers?.includes(otherUserId || '');
  const isBlockedByOther = otherUserDetails?.blockedUsers?.includes(currentUser?.uid || '');
  const isBlocked = isBlockedByMe || isBlockedByOther;
  const isTalkoUpdatesChat = !liveChat?.isGroup && liveChat?.participants?.includes('system_talko_destek') && currentUser?.uid !== 'system_talko_destek';

  const handleBlockUser = async () => {
    if (!currentUser?.uid || !otherUserId) return;
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const currentBlocked = userProfile?.blockedUsers || [];
      await updateDoc(userRef, {
        blockedUsers: [...currentBlocked, otherUserId]
      });
      setIsBlockMenuOpen(false);
      toast.success('Kullanıcı engellendi.');
    } catch (err) {
      toast.error('Hata oluştu.');
    }
  };

  const handleUnblockUser = async () => {
    if (!currentUser?.uid || !otherUserId) return;
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const currentBlocked = userProfile?.blockedUsers || [];
      await updateDoc(userRef, {
        blockedUsers: currentBlocked.filter(id => id !== otherUserId)
      });
      setIsBlockMenuOpen(false);
      toast.success('Kullanıcı engeli kaldırıldı.');
    } catch (err) {
      toast.error('Hata oluştu.');
    }
  };

  const handleSubmitReport = async () => {
    if (!currentUser || !selectedMessageForReport || !reportReason) return;
    try {
      const reportRef = doc(collection(db, 'reports'));
      
      // Güvenli payload oluştur: Firestore undefined değerleri kabul etmez.
      // Eğer eski bir mesajsa ve id/senderId yoksa varsayılan değerler atıyoruz.
      const payload = {
        id: reportRef.id,
        messageId: selectedMessageForReport.id || 'unknown_message_id',
        chatId: chat?.id || 'unknown_chat_id',
        reporterId: currentUser.uid,
        reportedUserId: selectedMessageForReport.senderId || 'unknown_sender_id',
        reason: reportReason,
        timestamp: Date.now()
      };

      await setDoc(reportRef, payload);
      toast.success('Rapor başarıyla gönderildi.');
      setShowReportModal(false);
      setSelectedMessageForReport(null);
      setReportReason('');
    } catch (err: any) {
      console.error("Report error:", err);
      // Hatanın tam nedenini kullanıcıya göstererek (izin hatası mı, veri hatası mı) anlamamızı sağlar
      toast.error(err.message ? `Hata: ${err.message}` : 'Rapor gönderilemedi.');
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    const messagesRef = collection(db, `chats/${chat.id}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => doc.data() as Message);
      
      let uniqueMessages = fetchedMessages;
      if (isSystemChat) {
        const seenTexts = new Set<string>();
        uniqueMessages = fetchedMessages.filter(msg => {
          if (!msg.text) return true;
          const normalized = msg.text.trim();
          if (normalized.startsWith("Merhaba") && normalized.includes("Talko'ya hoş geldin")) {
            if (seenTexts.has(normalized)) {
              return false;
            }
            seenTexts.add(normalized);
          }
          return true;
        });
      }

      setMessages(uniqueMessages);
    });

    return () => unsubscribeMessages();
  }, [chat.id, currentUser]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior
      });
    }
  };

  const forceScrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    scrollToBottom(behavior);
    setTimeout(() => scrollToBottom(behavior), 30);
    setTimeout(() => scrollToBottom(behavior), 100);
    setTimeout(() => scrollToBottom(behavior), 250);
  };

  useEffect(() => {
    if (messages.length === 0) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const isInitialLoad = prevMessagesLengthRef.current === 0;
    const isNewMessage = messages.length > prevMessagesLengthRef.current;

    if (isInitialLoad) {
      // Unconditional instant scroll to bottom on initial load
      setTimeout(() => scrollToBottom('auto'), 50);
      setTimeout(() => scrollToBottom('auto'), 150);
    } else if (isNewMessage) {
      const lastMessage = messages[messages.length - 1];
      const isMyMessage = lastMessage.senderId === currentUser?.uid;

      if (isMyMessage) {
        forceScrollToBottom('smooth');
      } else {
        // Only scroll if already near bottom (threshold 200px)
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (isNearBottom) {
          forceScrollToBottom('smooth');
        }
      }
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages, currentUser]);

  useEffect(() => {
    if (isOtherUserTyping) {
      const container = scrollContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (isNearBottom) {
          scrollToBottom('smooth');
        }
      }
    }
  }, [isOtherUserTyping]);

  // Reset our typing status on unmount or chat change
  useEffect(() => {
    return () => {
      if (currentUser && chat.id && !isSystemChat) {
        const typingRef = doc(db, `chats/${chat.id}/typing`, currentUser.uid);
        setDoc(typingRef, { isTyping: false, timestamp: Date.now() }).catch(err => {
          console.error("Error clearing typing on unmount:", err);
        });
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chat.id, currentUser, isSystemChat]);

  // Auto scroll to bottom when keyboard resizes the viewport
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      const container = scrollContainerRef.current;
      if (container) {
        forceScrollToBottom('smooth');
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  // Dynamic textarea height adjustment to match native WhatsApp/Telegram input behavior
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const calculatedHeight = Math.min(Math.max(textarea.scrollHeight, 48), 128);
      textarea.style.height = `${calculatedHeight}px`;
    }
  }, [inputText]);

  // Listen to read status update real-time
  useEffect(() => {
    if (!currentUser || !chat) return;
    const updateReadStatus = async () => {
      try {
        const chatRef = doc(db, 'chats', chat.id);
        await updateDoc(chatRef, {
          [`lastRead.${currentUser.uid}`]: Date.now(),
          [`unreadCount.${currentUser.uid}`]: 0
        });
      } catch (err) {
        console.error("Error updating lastRead timestamp:", err);
      }
    };
    updateReadStatus();
  }, [chat?.id, messages?.length, currentUser?.uid]);

  useEffect(() => {
    let unsubscribeUsers = () => {};
    let unsubscribeTyping = () => {};
    let unsubscribeGroupTyping = () => {};
    
    if (currentUser) {
      const usersRef = collection(db, 'users');
      unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
        const usersMap: Record<string, any> = {};
        snapshot.docs.forEach(doc => {
          usersMap[doc.id] = doc.data();
        });
        setLiveUsers(usersMap);
        
        // Update online/lastSeen state for DM
        if (!liveChat.isGroup && otherUserId) {
          const data = usersMap[otherUserId];
          if (data) {
            if (data.isBanned) {
              setOtherUserOnline(false);
              setOtherUserLastSeen(null);
            } else {
              setOtherUserOnline(data.isOnline || data.online || false);
              
              let lastSeenMs: number | null = null;
              if (data.lastSeen) {
                if (typeof data.lastSeen === 'object' && 'toMillis' in data.lastSeen) {
                  lastSeenMs = data.lastSeen.toMillis();
                } else if (typeof data.lastSeen === 'number') {
                  lastSeenMs = data.lastSeen;
                } else if (data.lastSeen instanceof Date) {
                  lastSeenMs = data.lastSeen.getTime();
                }
              }
              setOtherUserLastSeen(lastSeenMs);
            }
          }
        }
      });
    }

    if (liveChat.isGroup) {
      // Listen to all group members' typing indicators
      const typingColRef = collection(db, `chats/${chat.id}/typing`);
      unsubscribeGroupTyping = onSnapshot(typingColRef, (snapshot) => {
        const typers: string[] = [];
        snapshot.docs.forEach(docSnap => {
          if (docSnap.id === currentUser?.uid) return;
          const data = docSnap.data();
          if (data.isTyping && Date.now() - (data.timestamp || 0) < 3000) {
            const name = liveUsers[docSnap.id]?.username || liveChat.participantDetails?.[docSnap.id]?.username || 'Birisi';
            typers.push(name);
          }
        });
        if (typers.length > 0) {
          setIsOtherUserTyping(true);
          setGroupTypersText(typers.join(', ') + ' yazıyor...');
        } else {
          setIsOtherUserTyping(false);
          setGroupTypersText('');
        }
      });
    } else {
      if (!isSystemChat && otherUserId && currentUser) {
        // Listen to other user's typing status
        const typingRef = doc(db, `chats/${chat.id}/typing`, otherUserId);
        unsubscribeTyping = onSnapshot(typingRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const isTyping = data.isTyping || false;
            const timestamp = data.timestamp || 0;
            lastTypingTimeRef.current = timestamp;
  
            if (isTyping) {
              if (Date.now() - timestamp < 3000) {
                setIsOtherUserTyping(true);
              } else {
                setIsOtherUserTyping(false);
              }
            } else {
              setIsOtherUserTyping(false);
            }
          } else {
            setIsOtherUserTyping(false);
          }
        });
      }
    }

    // Periodically decay/expire typing indicator if sender's connection drops
    const interval = setInterval(() => {
      if (!liveChat.isGroup && lastTypingTimeRef.current && Date.now() - lastTypingTimeRef.current >= 3000) {
        setIsOtherUserTyping(false);
      }
    }, 1000);

    return () => {
      unsubscribeUsers();
      unsubscribeTyping();
      unsubscribeGroupTyping();
      clearInterval(interval);
    };
  }, [otherUserId, isSystemChat, chat.id, currentUser, liveChat.isGroup]);

  // Handle visibility changes or closing tabs to immediately clear typing
  useEffect(() => {
    const handleVisibilityOrUnload = () => {
      if (document.visibilityState === 'hidden' && currentUser && chat.id && !isSystemChat) {
        const typingRef = doc(db, `chats/${chat.id}/typing`, currentUser.uid);
        setDoc(typingRef, { isTyping: false, timestamp: Date.now() }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrUnload);
    window.addEventListener('beforeunload', handleVisibilityOrUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrUnload);
      window.removeEventListener('beforeunload', handleVisibilityOrUnload);
    };
  }, [chat.id, currentUser, isSystemChat]);

  const handleTyping = (textValue?: string) => {
    if (!currentUser || isSystemChat) return;
    
    const typingRef = doc(db, `chats/${chat.id}/typing`, currentUser.uid);
    const currentVal = textValue !== undefined ? textValue : inputText;

    if (!currentVal.trim()) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setDoc(typingRef, { isTyping: false, timestamp: Date.now() }).catch(() => {});
      lastMyTypingWriteRef.current = 0;
      return;
    }

    const now = Date.now();
    // Throttle the Firestore isTyping: true writes to once every 2 seconds to prevent rate-limiting or out-of-order execution
    if (now - lastMyTypingWriteRef.current > 2000) {
      setDoc(typingRef, { isTyping: true, timestamp: now }).catch(() => {});
      lastMyTypingWriteRef.current = now;
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setDoc(typingRef, { isTyping: false, timestamp: Date.now() }).catch(() => {});
      lastMyTypingWriteRef.current = 0;
    }, 1500);
  };

  const handleSendPoll = async () => {
    if (!pollQuestion.trim() || !currentUser || isSystemChat) return;
    
    const validOptions = pollOptions.filter(o => o.text.trim());
    if (validOptions.length < 2) {
      toast.error("Anket için en az 2 seçenek gereklidir.");
      return;
    }

    const now = Date.now();
    const messageId = now.toString() + Math.random().toString(36).substring(2, 5);
    
    try {
      const messageRef = doc(db, `chats/${chat.id}/messages`, messageId);
      await setDoc(messageRef, {
        id: messageId,
        senderId: currentUser.uid,
        text: 'Anket oluşturuldu',
        imageUrl: null,
        timestamp: now,
        type: 'poll',
        pollQuestion: pollQuestion.trim(),
        pollOptions: validOptions.map(o => ({
          id: o.id,
          text: o.text.trim(),
          voters: []
        }))
      });

      const unreadUpdates: Record<string, any> = {};
      liveChat.participants.forEach(p => {
        if (p !== currentUser.uid) {
          unreadUpdates[`unreadCount.${p}`] = increment(1);
        }
      });

      const chatRef = doc(db, 'chats', chat.id);
      await updateDoc(chatRef, {
        lastMessage: '📊 Anket',
        lastMessageTimestamp: now,
        updatedAt: now,
        ...unreadUpdates
      });
      
      playSendSound();
      dispatchPushNotification('📊 Anket: ' + pollQuestion.trim());

      setShowPollModal(false);
      setPollQuestion('');
      setPollOptions([{ id: '1', text: 'Evet' }, { id: '2', text: 'Hayır' }]);

    } catch (err) {
      console.error(err);
      toast.error("Anket gönderilemedi.");
    }
  };

  const handleVotePoll = async (messageId: string, optionId: string) => {
    if (!currentUser) return;
    
    try {
      const messageRef = doc(db, `chats/${chat.id}/messages`, messageId);
      const messageDoc = await getDoc(messageRef);
      if (!messageDoc.exists()) return;

      const messageData = messageDoc.data() as Message;
      if (messageData.type !== 'poll' || !messageData.pollOptions) return;

      const updatedOptions = messageData.pollOptions.map(opt => {
        // Remove user from all options first (single choice)
        const voters = opt.voters.filter(uid => uid !== currentUser.uid);
        
        // Add to selected option
        if (opt.id === optionId) {
          voters.push(currentUser.uid);
        }
        
        return { ...opt, voters };
      });

      await updateDoc(messageRef, {
        pollOptions: updatedOptions
      });
    } catch (err) {
      console.error('Error voting:', err);
      toast.error('Oyunuz kaydedilemedi.');
    }
  };

  // --- Event System Functions ---
  const sendTalkoAiMessage = async (text: string, isEventCard = false, eventData: any = null) => {
    const aiMessageId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    const aiMsg: any = {
      id: aiMessageId,
      senderId: TALKO_AI_USER_ID,
      text,
      imageUrl: null,
      timestamp: Date.now()
    };
    if (isEventCard) {
      aiMsg.type = 'event';
      if (eventData) aiMsg.eventData = eventData;
    }
    await setDoc(doc(db, `chats/${chat.id}/messages`, aiMessageId), aiMsg);
    
    const unreadUpdates: Record<string, any> = {};
    liveChat.participants.forEach(p => {
      if (p !== TALKO_AI_USER_ID && p !== currentUser?.uid) {
        unreadUpdates[`unreadCount.${p}`] = increment(1);
      }
    });
    const chatRef = doc(db, 'chats', chat.id);
    await updateDoc(chatRef, {
      lastMessage: isEventCard ? '🎉 Etkinlik' : text,
      lastMessageTimestamp: Date.now(),
      updatedAt: Date.now(),
      ...unreadUpdates
    });
    dispatchPushNotification(isEventCard ? '🎉 Etkinlik' : text);
  };

  const startStage1 = async () => {
    const chatRef = doc(db, 'chats', chat.id);
    const questions = [
      // Kolay (%60)
      { q: "Türkiye'nin başkenti neresidir?", a: "Ankara" },
      { q: "Instagram, WhatsApp ve Facebook'un çatı şirketinin adı nedir?", a: "Meta" },
      { q: "Minecraft'ta ilk gece hayatta kalmak için genellikle yapılan alet hangi malzemeden yapılır?", a: "Tahta" },
      { q: "Haftanın ilk günü hangisidir?", a: "Pazartesi" },
      { q: "Dünyanın uydusu nedir?", a: "Ay" },
      { q: "Apple'ın kurucularından olan ünlü teknoloji lideri kimdir?", a: "Steve Jobs" },
      // Orta (%30)
      { q: "Romalıların inşa ettiği ünlü amfi tiyatronun adı nedir?", a: "Kolezyum" },
      { q: "Güneş sistemindeki en büyük gezegen hangisidir?", a: "Jüpiter" },
      { q: "Bir satranç tahtasında toplam kaç kare vardır?", a: "64" },
      // Zor (%10)
      { q: "Kuantum renk dinamiğinde gluonların sahip olabileceği kaç farklı renk şarjı (color charge) kombinasyonu vardır?", a: "8" }
    ];
    const randQ = questions[Math.floor(Math.random() * questions.length)];
    
    await updateDoc(chatRef, {
      'eventState.stage': 'quiz',
      'eventState.question': randQ.q,
      'eventState.answer': randQ.a
    });
    
    await sendTalkoAiMessage("🎉 Etkinlik başladı!\n\nBol şans!");
    setTimeout(async () => {
      await sendTalkoAiMessage(`1. ETKİNLİK\n\nBilgi Yarışması\n\n❓ ${randQ.q}\n\nİlk doğru cevabı veren kazansın.`);
    }, 1500);
  };

  const startStage2 = async () => {
    const chatRef = doc(db, 'chats', chat.id);
    const targetNumber = Math.floor(Math.random() * 100) + 1;
    
    await updateDoc(chatRef, {
      'eventState.stage': 'number',
      'eventState.targetNumber': targetNumber
    });
    
    await sendTalkoAiMessage(`2. ETKİNLİK\n\nSayı Tahmin Oyunu\n\n1-100 arasında bir sayı tuttum.\n\nİlk bilen kazansın.`);
  };

  const initiateRewardDM = async (winnerId: string) => {
    if (currentUser?.uid !== winnerId) return;

    const dmChatId = [TALKO_AI_USER_ID, winnerId].sort().join('_');
    const dmRef = doc(db, 'chats', dmChatId);
    const dmDoc = await getDoc(dmRef);
    
    const now = Date.now();
    if (!dmDoc.exists()) {
      const winnerName = liveUsers[winnerId]?.username || currentUser.username;
      const winnerPhoto = liveUsers[winnerId]?.photoURL || currentUser.photoURL || null;
      await setDoc(dmRef, {
        id: dmChatId,
        participants: [TALKO_AI_USER_ID, winnerId],
        participantDetails: {
          [TALKO_AI_USER_ID]: { username: 'Talko AI', photoURL: TALKO_AI_LOGO_DATA_URL },
          [winnerId]: { username: winnerName, photoURL: winnerPhoto }
        },
        lastMessage: 'Verified hangi hesaba verilsin?',
        lastMessageTimestamp: now,
        updatedAt: now
      });
    } else {
       await updateDoc(dmRef, {
        lastMessage: 'Verified hangi hesaba verilsin?',
        lastMessageTimestamp: now,
        updatedAt: now
       });
    }
    
    const msgId = now.toString() + Math.random().toString(36).substring(2, 5);
    await setDoc(doc(db, `chats/${dmChatId}/messages`, msgId), {
      id: msgId,
      senderId: TALKO_AI_USER_ID,
      text: 'Verified hangi hesaba verilsin?',
      type: 'event',
      eventData: { type: 'reward_prompt' },
      timestamp: now
    });
  };

  const handleEventWinStage1 = async (winnerId: string) => {
    const chatRef = doc(db, 'chats', chat.id);
    await updateDoc(chatRef, {
      'eventState.stage': 'transitioning',
      'eventState.yesVotes': [],
      'eventState.noVotes': []
    });
    
    const winnerName = liveUsers[winnerId]?.username || liveChat.participantDetails?.[winnerId]?.username || 'Kullanıcı';
    
    await sendTalkoAiMessage(`🎉 Tebrikler!\n\n@${winnerName} doğru cevabı verdi.`);
    
    setTimeout(async () => {
      await sendTalkoAiMessage("🎲 İkinci etkinliğe geçilsin mi?", true, { type: 'transitioning' });
    }, 1500);
  };
  
  const handleEventWinStage2 = async (winnerId: string) => {
    const chatRef = doc(db, 'chats', chat.id);
    await updateDoc(chatRef, {
      'eventState.isActive': false,
      'eventState.stage': 'finished',
      'eventState.winnerId': winnerId,
      'eventState.lastEndTime': Date.now()
    });
    
    const winnerName = liveUsers[winnerId]?.username || liveChat.participantDetails?.[winnerId]?.username || 'Kullanıcı';
    
    await sendTalkoAiMessage(`🏆 Tebrikler!\n\n@${winnerName} etkinliği kazandı!\n\nÖdül:\n💙 Talko Verified`);
    
    setTimeout(async () => {
      await sendTalkoAiMessage("🎉 Etkinlik sona erdi!\n\nKatılan herkese teşekkür ederiz. ❤️\n\nYeni bir etkinlik başlatmak için birkaç dakika sonra tekrar /event yazabilirsiniz.");
    }, 1500);
    
    await initiateRewardDM(winnerId);
  };

  const handleEventVote = async (vote: 'yes' | 'no') => {
    if (!currentUser || !liveChat.eventState?.isActive) return;
    
    const { stage, yesVotes = [], noVotes = [] } = liveChat.eventState;
    if (yesVotes.includes(currentUser.uid) || noVotes.includes(currentUser.uid)) return;
    
    const chatRef = doc(db, 'chats', chat.id);
    
    if (vote === 'yes') {
      const newYesVotes = [...yesVotes, currentUser.uid];
      await updateDoc(chatRef, {
        'eventState.yesVotes': newYesVotes
      });
      
      if (newYesVotes.length >= 2) {
        if (stage === 'initiating') {
          await startStage1();
        } else if (stage === 'transitioning') {
          await startStage2();
        }
      }
    } else {
      const newNoVotes = [...noVotes, currentUser.uid];
      await updateDoc(chatRef, {
        'eventState.noVotes': newNoVotes
      });
    }
  };

  const handleRewardVote = async (action: 'this_account' | 'other_account') => {
    if (!currentUser) return;
    if (action === 'this_account') {
      await sendTalkoAiMessage("Harika!\n\nVerified isteğin admin onayına gönderildi.");
      await updateDoc(doc(db, "users", currentUser.uid), {
         blueTickStatus: 'pending',
         blueTickReason: 'Talko AI Etkinlik Kazananı'
      });
      await updateDoc(doc(db, 'chats', chat.id), { awaitingOtherAccount: false });
    } else {
      await updateDoc(doc(db, 'chats', chat.id), {
         'awaitingOtherAccount': true
      });
      await sendTalkoAiMessage("Lütfen kullanıcı adını yaz.");
    }
  };

  const handleEventCommand = async () => {
    const now = Date.now();
    if (liveChat.eventState?.isActive) {
      if (now - lastEventErrorTimeRef.current > 10000) {
        lastEventErrorTimeRef.current = now;
        await sendTalkoAiMessage("⏳ Bu sohbette zaten aktif bir etkinlik bulunuyor.\n\nLütfen mevcut etkinliğin bitmesini bekleyin.");
      }
      return;
    }
    
    if (liveChat.eventState?.lastEndTime && now - liveChat.eventState.lastEndTime < 5 * 60 * 1000) {
      if (now - lastEventErrorTimeRef.current > 10000) {
        lastEventErrorTimeRef.current = now;
        await sendTalkoAiMessage("🎉 Bu sohbette az önce bir etkinlik tamamlandı.\n\n⏳ Yeni etkinlik için lütfen 5 dakika bekleyin.");
      }
      return;
    }
    
    const chatRef = doc(db, 'chats', chat.id);
    await updateDoc(chatRef, {
      'eventState.isActive': true,
      'eventState.stage': 'initiating',
      'eventState.yesVotes': [],
      'eventState.noVotes': []
    });
    
    await sendTalkoAiMessage(
      "🎉 Yeni bir Talko Etkinliği başlatılsın mı?\n\n🏆 Kazanan özel ödül kazanacaktır.\n\nKatılmak ister misiniz?",
      true,
      { type: 'initiating' }
    );
  };

  const handleSendMessage = async (text: string, imageUrl: string | null = null) => {
    const messageText = text.trim();
    if ((!messageText && !imageUrl) || !currentUser) return;
    
    if (isSystemChat) {
      toast.error("Talko Destek hesabına yanıt gönderilemez.");
      return;
    }

    const now = Date.now();

    // Spam Check (5 messages within 5 seconds)
    const recentMessages = messageTimestampsRef.current.filter(t => now - t < 5000);
    if (recentMessages.length >= 5) {
      toast.error("⏳ Çok hızlı mesaj gönderiyorsunuz. Lütfen birkaç saniye bekleyin.");
      return;
    }
    messageTimestampsRef.current = [...recentMessages, now];

    // --- OPTIMISTIC UI INITIALIZATION ---
    const tempId = 'opt_' + now + Math.random().toString(36).substring(2, 5);
    const optimisticMsg: Message = {
      id: tempId,
      senderId: currentUser.uid,
      text: messageText || null,
      imageUrl,
      timestamp: now,
      status: 'pending' // 'kontrol ediliyor...' state
    };

    // Immediately show the message in the local UI
    setOptimisticMessages(prev => [...prev, optimisticMsg]);

    // Immediately clear input, focus, and reset emoji picker for high reactivity
    if (!imageUrl) {
      setInputText('');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
    setShowEmojiPicker(false);

    // Immediately clear local and firestore typing status
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    lastMyTypingWriteRef.current = 0;
    const typingRef = doc(db, `chats/${chat.id}/typing`, currentUser.uid);
    setDoc(typingRef, { isTyping: false, timestamp: Date.now() }).catch(err => {
      console.error("Error clearing typing status on send:", err);
    });

    // Staggered smooth scrolling to bottom
    forceScrollToBottom('smooth');

    // --- BACKGROUND PROCESS (ASYNCHRONOUS) ---
    const processBackgroundMessage = async () => {
      console.log("Sending message");
      let isAppropriate = true;
      let modReason = "";
      let modCategory = "clean";
      let apiCallFailed = false;
      let apiErrorMessage = "";

      if (typeof window !== 'undefined' && (window as any).talkoDebugState) {
        (window as any).talkoDebugState.ai = 'Working';
        (window as any).talkoDebugState.moderation = 'Pending';
        (window as any).talkoDebugState.firestore = 'None';
        window.dispatchEvent(new CustomEvent('talko-debug-update'));
      }

      try {
        console.log("Moderation started");
        
        // 8-second timeout to prevent hanging check indefinitely
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch('/api/ai/moderate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: messageText }),
          signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));
        
        if (response.ok) {
          const modResult = await response.json();
          console.log("Moderation result:", modResult);
          isAppropriate = modResult.isAppropriate;
          modReason = modResult.reason || "";
          modCategory = modResult.category || "clean";
        } else {
          apiCallFailed = true;
          const errJson = await response.json().catch(() => ({}));
          apiErrorMessage = errJson.message || errJson.error || `HTTP ${response.status}`;
        }
      } catch (e: any) {
        console.error("Moderation error:", e);
        apiCallFailed = true;
        apiErrorMessage = e.message || String(e);
      }

      if (apiCallFailed) {
        console.error(`[AI MODERATION FATAL] Moderation service failed: ${apiErrorMessage}`);
        if (typeof window !== 'undefined' && (window as any).talkoDebugState) {
          (window as any).talkoDebugState.ai = 'Error';
          (window as any).talkoDebugState.moderation = 'None';
          window.dispatchEvent(new CustomEvent('talko-debug-update'));
        }

        // Set status to error to show Retry button!
        setOptimisticMessages(prev => prev.map(m => {
          if (m.id === tempId) {
            return {
              ...m,
              status: 'error',
              originalText: messageText,
              text: "Bağlantı hatası: Mesaj moderatör kontrolünden geçemedi."
            };
          }
          return m;
        }));
        
        toast.error(`⚠️ Moderasyon bağlantı hatası: ${apiErrorMessage}`, {
           style: { background: '#ef4444', color: '#fff' }
        });
        return;
      }

      if (!isAppropriate) {
        console.log("Moderation result: BLOCKED");
        if (typeof window !== 'undefined' && (window as any).talkoDebugState) {
          (window as any).talkoDebugState.ai = 'Idle';
          (window as any).talkoDebugState.moderation = 'Blocked';
          (window as any).talkoDebugState.firestore = 'None';
          window.dispatchEvent(new CustomEvent('talko-debug-update'));
        }

        toast.error("⚠️ Bu mesaj topluluk kurallarına uygun olmadığı için engellendi.", {
           style: { background: '#ef4444', color: '#fff' }
        });
        
        // Update local optimistic message state to blocked
        setOptimisticMessages(prev => prev.map(m => {
          if (m.id === tempId) {
            return {
              ...m,
              status: 'blocked',
              originalText: messageText,
              text: "⚠️ Bu mesaj topluluk kurallarına uygun olmadığı için engellendi."
            };
          }
          return m;
        }));

        try {
          await addDoc(collection(db, 'moderation_logs'), {
             userId: currentUser.uid,
             username: currentUser.username || userProfile?.username || '',
             chatId: chat.id,
             chatType: chat.isGroup ? 'group' : 'direct',
             text: messageText,
             timestamp: now,
             type: modCategory,
             reason: modReason,
             source: 'ai_moderation'
          });
        } catch(e) {}

        // Talko AI gently warns (rate limited to once every 1 minute per chat)
        const lastWarning = localStorage.getItem(`talko_warning_${chat.id}`);
        if (!lastWarning || now - parseInt(lastWarning) > 60000) {
           localStorage.setItem(`talko_warning_${chat.id}`, now.toString());
           await sendTalkoAiMessage("💙 Lütfen topluluk kurallarına uygun konuşalım.");
        }
        return;
      }

      // --- SAVE SECURE & APPROVED MESSAGE TO FIRESTORE ---
      console.log("Moderation result: SAFE");
      if (typeof window !== 'undefined' && (window as any).talkoDebugState) {
        (window as any).talkoDebugState.ai = 'Idle';
        (window as any).talkoDebugState.moderation = 'Safe';
        (window as any).talkoDebugState.firestore = 'Pending';
        window.dispatchEvent(new CustomEvent('talko-debug-update'));
      }

      const messageId = now.toString() + Math.random().toString(36).substring(2, 5);
      
      try {
        const messageRef = doc(db, `chats/${chat.id}/messages`, messageId);
        await setDoc(messageRef, {
          id: messageId,
          senderId: currentUser.uid,
          text: messageText || null,
          imageUrl,
          timestamp: now
        });

        const unreadUpdates: Record<string, any> = {};
        liveChat.participants.forEach(p => {
          if (p !== currentUser.uid) {
            unreadUpdates[`unreadCount.${p}`] = increment(1);
          }
        });

        const chatRef = doc(db, 'chats', chat.id);
        await updateDoc(chatRef, {
          lastMessage: messageText || (imageUrl ? '📷 Görsel' : ''),
          lastMessageTimestamp: now,
          updatedAt: now,
          ...unreadUpdates
        });
        
        console.log("Firestore write success");
        if (typeof window !== 'undefined' && (window as any).talkoDebugState) {
          (window as any).talkoDebugState.firestore = 'Success';
          window.dispatchEvent(new CustomEvent('talko-debug-update'));
        }

        playSendSound();
        dispatchPushNotification(messageText || (imageUrl ? '📷 Görsel' : ''));

        // Remove from optimistic UI state since Firestore has successfully received and persisted it
        setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));

        // Event Intercepts
        if (messageText.toLowerCase() === '/event') {
          await handleEventCommand();
        } else if (liveChat.eventState?.isActive && !isSystemChat) {
          if (liveChat.eventState.stage === 'quiz' && liveChat.eventState.answer) {
             if (messageText.toLowerCase() === liveChat.eventState.answer.toLowerCase()) {
                await handleEventWinStage1(currentUser.uid);
             }
          } else if (liveChat.eventState.stage === 'number' && liveChat.eventState.targetNumber) {
             const num = parseInt(messageText);
             if (!isNaN(num) && num === liveChat.eventState.targetNumber) {
                await handleEventWinStage2(currentUser.uid);
             }
          }
        } else if (liveChat.awaitingOtherAccount && chat.participants.includes(TALKO_AI_USER_ID)) {
           const q = query(collection(db, 'users'), where('usernameLower', '==', messageText.toLowerCase()));
           const querySnapshot = await getDocs(q);
           if (!querySnapshot.empty) {
             const targetUserDoc = querySnapshot.docs[0];
             await updateDoc(doc(db, "users", targetUserDoc.id), {
               blueTickStatus: 'pending',
               blueTickReason: `Talko AI Etkinlik Kazananı (@${currentUser.username} tarafından önerildi)`
             });
             await updateDoc(doc(db, 'chats', chat.id), { awaitingOtherAccount: false });
             await sendTalkoAiMessage("Tamam!\n\nVerified isteğin admin onayına gönderildi.");
           } else {
             await sendTalkoAiMessage("Kullanıcı bulunamadı. Lütfen doğru kullanıcı adını yazdığından emin ol.");
           }
        }

        // --- TALKO AI CHAT RESPONSE INBACKGROUND ---
        if ((isAiChat || (liveChat.isGroup && messageText.toLowerCase().includes('@talko ai'))) && messageText.toLowerCase() !== '/event' && !liveChat.awaitingOtherAccount) {
          const cleanMessage = isAiChat ? messageText : messageText.replace(/@talko ai/gi, '').trim();

          setAiState({ isGenerating: true, isThinking: true, streamText: '' });
          try {
            const history = messages.slice(-15).map(m => ({
              role: m.senderId === TALKO_AI_USER_ID ? 'model' : 'user',
              text: m.text || ''
            }));

            const response = await fetch('/api/ai/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: cleanMessage || 'Bana yardımcı ol.', history })
            });
            
            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error(errData.error || `AI API Error: ${response.status}`);
            }
            
            setAiState(prev => ({ ...prev, isThinking: false }));
            
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let aiFullText = '';
            let buffer = '';
            
            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
                  const sseMessage = buffer.slice(0, newlineIndex).trim();
                  buffer = buffer.slice(newlineIndex + 2);
                  
                  const lines = sseMessage.split('\n');
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const dataStr = line.slice(6);
                      if (dataStr.trim() === '[DONE]') break;
                      try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.text) {
                          aiFullText += parsed.text;
                          setAiState(prev => ({ ...prev, streamText: aiFullText }));
                        }
                      } catch (e) {
                        console.error("Parse error:", e, dataStr);
                      }
                    }
                  }
                }
              }
            }
            
            setAiState({ isGenerating: false, isThinking: false, streamText: '' });
            
            if (aiFullText.trim()) {
              const aiNow = Date.now();
              const aiMsgId = aiNow.toString() + Math.random().toString(36).substring(2, 5);
              await setDoc(doc(db, `chats/${chat.id}/messages`, aiMsgId), {
                 id: aiMsgId,
                 senderId: TALKO_AI_USER_ID,
                 text: aiFullText,
                 imageUrl: null,
                 timestamp: aiNow
              });
              const aiUnreadUpdates: Record<string, any> = {};
              liveChat.participants.forEach(p => {
                if (p !== currentUser.uid) {
                  aiUnreadUpdates[`unreadCount.${p}`] = increment(1);
                }
              });

              await updateDoc(chatRef, { 
                lastMessage: aiFullText,
                lastMessageTimestamp: aiNow,
                updatedAt: aiNow,
                ...aiUnreadUpdates
              });
            } else {
              throw new Error("AI returned empty response");
            }
          } catch (err: any) {
            console.error("AI chat error:", err);
            toast.error(err.message || "Talko AI yanıt veremedi.");
            setAiState({ isGenerating: false, isThinking: false, streamText: '' });
          }
        }

      } catch (err: any) {
        console.error("Failed to persist optimistic message:", err);
        if (typeof window !== 'undefined' && (window as any).talkoDebugState) {
          (window as any).talkoDebugState.firestore = 'Failed';
          window.dispatchEvent(new CustomEvent('talko-debug-update'));
        }
        toast.error("⚠️ Mesaj gönderilirken bir hata oluştu.");
        // Update optimistic state to error so the user has the retry option
        setOptimisticMessages(prev => prev.map(m => {
          if (m.id === tempId) {
            return {
              ...m,
              status: 'error',
              originalText: messageText,
              text: "Gönderme hatası: Firestore kaydı tamamlanamadı."
            };
          }
          return m;
        }));
      }
    };

    // Execute background thread (non-blocking)
    processBackgroundMessage();
  };

  const handleRetrySendMessage = (msgId: string, text: string, imageUrl: string | null) => {
    console.log("Retrying message sending for id:", msgId);
    setOptimisticMessages(prev => prev.filter(m => m.id !== msgId));
    handleSendMessage(text, imageUrl);
  };

  const onEmojiClick = (emojiObject: any) => {
    const newVal = inputText + emojiObject.emoji;
    setInputText(newVal);
    handleTyping(newVal);
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen geçerli bir görsel seçin.');
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      if (url) {
        await handleSendMessage('', url);
      }
    } catch (err: any) {
      toast.error('Görsel yüklenirken hata: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const renderReadReceipt = (msg: Message, isLastMessage: boolean) => {
    if (msg.senderId !== currentUser?.uid) return null;
    
    if (msg.status === 'blocked' || msg.status === 'error' || msg.isFailed) {
      return (
        <span className="inline-flex ml-1 items-center gap-1 text-[10px] text-red-400 select-none font-semibold animate-fade-in" title="Başarısız">
          ⚠️ Başarısız
        </span>
      );
    }
    
    if (msg.status === 'pending') {
      return (
        <span className="inline-flex ml-1 items-center gap-1 text-[10px] text-blue-100 dark:text-blue-200 select-none" title="Kontrol ediliyor...">
          <Loader2 className="animate-spin" size={10} />
          <span>Kontrol ediliyor...</span>
        </span>
      );
    }
    
    let isRead = false;
    let isDelivered = false;
    
    if (liveChat.isGroup) {
      const otherParticipants = liveChat.participants.filter(id => id !== currentUser?.uid);
      const readCount = otherParticipants.filter(id => {
        const userLastRead = liveChat.lastRead?.[id] || 0;
        return userLastRead >= msg.timestamp;
      }).length;
      isRead = readCount > 0;
      isDelivered = true;
    } else {
      const otherParticipantId = liveChat.participants.find(id => id !== currentUser?.uid);
      if (otherParticipantId) {
        const otherLastRead = liveChat.lastRead?.[otherParticipantId] || 0;
        isRead = otherLastRead >= msg.timestamp;
        
        const otherLastDelivered = liveChat.lastDelivered?.[otherParticipantId] || 0;
        isDelivered = isRead || otherLastDelivered >= msg.timestamp || otherUserOnline || (otherUserLastSeen || 0) >= msg.timestamp;
      }
    }

    return (
      <span className="inline-flex ml-1 select-none items-center animate-fade-in gap-1" title={isRead ? "Okundu" : isDelivered ? "İletildi" : "Gönderildi"}>
        {isRead ? (
          <>
            <svg className="w-4 h-4 text-sky-400 fill-current" viewBox="0 0 24 24">
              <path d="M0.282,11.244 C0.669,10.825 1.302,10.799 1.721,11.185 L7.766,16.746 L21.728,3.9 C22.148,3.515 22.781,3.541 23.167,3.96 C23.553,4.38 23.527,5.012 23.107,5.398 L8.455,18.877 C8.261,19.055 8.006,19.151 7.744,19.141 C7.483,19.13 7.239,19.014 7.062,18.82 L0.34,12.683 C-0.047,12.264 -0.073,11.631 0.282,11.244 Z" />
              <path d="M5.282,11.244 C5.669,10.825 6.302,10.799 6.721,11.185 L12.766,16.746 L18.728,11.26 C19.148,10.875 19.781,10.901 20.167,11.32 C20.553,11.74 20.527,12.372 20.107,12.758 L13.455,18.877 C13.261,19.055 13.006,19.151 12.744,19.141 C12.483,19.13 12.239,19.014 12.062,18.82 L5.34,12.683 C4.953,12.264 4.927,11.631 5.282,11.244 Z" opacity="0.6" />
            </svg>
            {isLastMessage && <span className="text-[10px] text-sky-400 font-medium">Görüldü</span>}
          </>
        ) : (
          isDelivered ? (
            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 fill-current" viewBox="0 0 24 24">
              <path d="M0.282,11.244 C0.669,10.825 1.302,10.799 1.721,11.185 L7.766,16.746 L21.728,3.9 C22.148,3.515 22.781,3.541 23.167,3.96 C23.553,4.38 23.527,5.012 23.107,5.398 L8.455,18.877 C8.261,19.055 8.006,19.151 7.744,19.141 C7.483,19.13 7.239,19.014 7.062,18.82 L0.34,12.683 C-0.047,12.264 -0.073,11.631 0.282,11.244 Z" />
              <path d="M5.282,11.244 C5.669,10.825 6.302,10.799 6.721,11.185 L12.766,16.746 L18.728,11.26 C19.148,10.875 19.781,10.901 20.167,11.32 C20.553,11.74 20.527,12.372 20.107,12.758 L13.455,18.877 C13.261,19.055 13.006,19.151 12.744,19.141 C12.483,19.13 12.239,19.014 12.062,18.82 L5.34,12.683 C4.953,12.264 4.927,11.631 5.282,11.244 Z" opacity="0.6" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 fill-current" viewBox="0 0 24 24">
              <path d="M0.282,11.244 C0.669,10.825 1.302,10.799 1.721,11.185 L7.766,16.746 L21.728,3.9 C22.148,3.515 22.781,3.541 23.167,3.96 C23.553,4.38 23.527,5.012 23.107,5.398 L8.455,18.877 C8.261,19.055 8.006,19.151 7.744,19.141 C7.483,19.13 7.239,19.014 7.062,18.82 L0.34,12.683 C-0.047,12.264 -0.073,11.631 0.282,11.244 Z" />
            </svg>
          )
        )}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-gray-900 relative transition-colors">
      <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-sm z-10 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button 
            onClick={onBack}
            className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="relative w-10 h-10 flex-shrink-0">
            <div className="w-full h-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-155 dark:border-gray-700">
              {liveChat.isGroup ? (
                <div className="w-full h-full flex items-center justify-center text-2xl bg-blue-50 dark:bg-blue-950/40 font-bold select-none text-blue-600 dark:text-blue-400">
                  {liveChat.groupEmoji || '👥'}
                </div>
              ) : isSystemChat ? (
                <img src={TALKO_LOGO_DATA_URL} alt="Talko Updates" className="w-full h-full object-cover" />
              ) : isAiChat ? (
                <img src={TALKO_AI_LOGO_DATA_URL} alt="Talko AI" className="w-full h-full object-cover" />
              ) : otherUserDetails?.photoURL ? (
                <img src={otherUserDetails.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30">
                  <UserIcon size={20} />
                </div>
              )}
            </div>
            {otherUserOnline && !isVerified && !liveChat.isGroup && !isBlocked && (
              <span className="absolute bottom-0 right-0 block w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 shadow-sm z-10" />
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-white leading-tight truncate">
                {liveChat.isGroup ? (liveChat.groupName || 'Grup') : otherUserDetails?.username}
              </h2>
              {isVerified && !liveChat.isGroup && <VerifiedBadge className="w-4 h-4 flex-shrink-0" />}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {liveChat.isGroup ? (liveChat.groupDescription || `${liveChat.participants?.length || 0} katılımcı`) :
               isSystemChat ? 'Talko Resmi Hesabı' : 
               isAiChat ? (aiState.isGenerating ? <span className="text-blue-500 dark:text-blue-400 italic">Düşünüyor...</span> : 'Resmî Yapay Zekâ Asistanı') :
               otherUserDetails?.isBanned ? 'Çevrimdışı' :
               isBlocked ? '' :
               isOtherUserTyping ? <span className="text-blue-500 dark:text-blue-400 italic">yazıyor...</span> :
               otherUserOnline ? <span className="text-blue-600 dark:text-blue-400 font-medium">Çevrimiçi</span> : 
               otherUserLastSeen ? `Son görülme ${formatLastSeen(otherUserLastSeen)}` : 'Çevrimdışı'}
            </p>
          </div>
        </div>
        
        {/* Block Menu for 1-1 Chat */}
        {!liveChat.isGroup && !isSystemChat && !isAiChat && (
          <div className="relative ml-2">
            <button 
              onClick={() => setIsBlockMenuOpen(!isBlockMenuOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors focus:outline-none"
            >
              <MoreVertical size={20} />
            </button>
            <AnimatePresence>
              {isBlockMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsBlockMenuOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-50 overflow-hidden"
                  >
                    {isBlockedByMe ? (
                      <button 
                        onClick={handleUnblockUser}
                        className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <ShieldBan size={18} />
                        <span>Engeli Kaldır</span>
                      </button>
                    ) : (
                      <button 
                        onClick={handleBlockUser}
                        className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <Ban size={18} />
                        <span>Kullanıcıyı Engelle</span>
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6"
      >
        {(() => {
          const allMessages = [...messages, ...optimisticMessages].sort((a, b) => a.timestamp - b.timestamp);
          return allMessages.map((msg, idx) => {
            const isMine = msg.senderId === currentUser?.uid;
            const showAvatar = !isMine && (idx === 0 || allMessages[idx - 1].senderId !== msg.senderId);
            
            const senderName = liveChat.isGroup
              ? (liveUsers[msg.senderId]?.username || liveChat.participantDetails?.[msg.senderId]?.username || 'Katılımcı')
              : otherUserDetails?.username;
              
            const senderPhoto = liveChat.isGroup
              ? (liveUsers[msg.senderId]?.photoURL || liveChat.participantDetails?.[msg.senderId]?.photoURL)
              : otherUserDetails?.photoURL;

          return (
            <div key={msg.id} className="flex flex-col w-full min-w-0">
            <div 
              className={cn(
                "flex w-full min-w-0 px-0.5", 
                isMine ? "justify-end" : "justify-start", 
                !showAvatar && !isMine && "pl-10"
              )}
            >
              {!isMine && showAvatar && (
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mr-2 mt-auto bg-gray-100 dark:bg-gray-800">
                    {isSystemChat ? (
                      <img src={TALKO_LOGO_DATA_URL} alt="Talko Updates" className="w-full h-full object-cover" />
                    ) : msg.senderId === TALKO_AI_USER_ID ? (
                      <img src={TALKO_AI_LOGO_DATA_URL} alt="Talko AI" className="w-full h-full object-cover" />
                    ) : senderPhoto ? (
                      <img src={senderPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 text-xs">
                        <UserIcon size={14} />
                      </div>
                    )}
                </div>
              )}
              
              <div 
                style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelectedMessageForReport(msg);
                }}
                className={cn(
                  "max-w-[75%] md:max-w-[65%] min-w-0 rounded-2xl px-4 py-2.5 shadow-sm relative group break-words transition-all duration-200",
                  (msg.isFailed || msg.status === 'error' || msg.status === 'blocked')
                    ? "bg-red-500/10 dark:bg-red-500/5 text-red-600 dark:text-red-400 border border-red-500/20 rounded-br-sm"
                    : isMine 
                      ? "bg-blue-600 text-white rounded-br-sm" 
                      : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-sm",
                  msg.status === 'pending' && "animate-pulse opacity-85",
                  selectedMessageForReport?.id === msg.id && "ring-2 ring-blue-500 scale-[1.02] shadow-md z-10"
                )}
              >
                {liveChat.isGroup && !isMine && showAvatar && (
                  <p className="text-xs font-bold text-blue-500 dark:text-blue-400 mb-1 select-none">
                    {senderName}
                  </p>
                )}
                {(msg.isFailed || msg.status === 'error' || msg.status === 'blocked') ? (
                  <div className="flex flex-col gap-1.5">
                    {msg.originalText && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 line-through italic mb-1 select-text">
                        {msg.originalText}
                      </span>
                    )}
                    <span className="text-[14px] font-semibold flex items-center gap-1.5 text-red-600 dark:text-red-400">
                      {msg.text}
                    </span>
                    {msg.status === 'error' && (
                      <button
                        onClick={() => handleRetrySendMessage(msg.id, msg.originalText || msg.text || '', msg.imageUrl || null)}
                        className="mt-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm w-max cursor-pointer flex items-center gap-1.5"
                      >
                        🔄 Tekrar Dene
                      </button>
                    )}
                    {msg.status === 'blocked' && (
                      <button
                        onClick={() => setOptimisticMessages(prev => prev.filter(m => m.id !== msg.id))}
                        className="mt-1.5 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold text-xs rounded-xl transition-all w-max cursor-pointer flex items-center gap-1.5"
                      >
                        Kapat
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {msg.imageUrl && (
                      <img 
                        src={msg.imageUrl} 
                        alt="Shared" 
                        onLoad={() => {
                          const container = scrollContainerRef.current;
                          if (container) {
                            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 250;
                            if (isNearBottom) {
                              scrollToBottom('smooth');
                            }
                          }
                        }}
                        className="max-w-full rounded-xl mb-2 object-cover max-h-64 cursor-pointer hover:opacity-95 transition-opacity" 
                      />
                    )}
                    {msg.text && msg.type !== 'poll' && (
                      <div className="text-[15px] leading-relaxed text-inherit">
                        {renderMarkdown(msg.text)}
                      </div>
                    )}
                  </>
                )}
                {msg.type === 'event' && msg.eventData && (
                  <div className="mt-3 space-y-2 w-full min-w-[200px]">
                    {msg.eventData.type === 'initiating' && liveChat.eventState?.stage === 'initiating' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEventVote('yes')}
                          className="flex-1 bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 font-bold py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-200 dark:hover:border-green-800 transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>✅</span> Evet ({liveChat.eventState?.yesVotes?.length || 0}/2)
                        </button>
                        <button 
                          onClick={() => handleEventVote('no')}
                          className="flex-1 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 font-bold py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>❌</span> Hayır
                        </button>
                      </div>
                    )}
                    
                    {msg.eventData.type === 'transitioning' && liveChat.eventState?.stage === 'transitioning' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEventVote('yes')}
                          className="flex-1 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-bold py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800 transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>🎲</span> Evet ({liveChat.eventState?.yesVotes?.length || 0}/2)
                        </button>
                        <button 
                          onClick={() => handleEventVote('no')}
                          className="flex-1 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 font-bold py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>❌</span> Hayır
                        </button>
                      </div>
                    )}
                    
                    {msg.eventData.type === 'reward_prompt' && liveChat.awaitingOtherAccount !== false && (
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => handleRewardVote('this_account')}
                          className="w-full bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-bold py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800 transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>💙</span> Bu Hesabım
                        </button>
                        <button 
                          onClick={() => handleRewardVote('other_account')}
                          className="w-full bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>➕</span> Başka Hesap
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {msg.type === 'poll' && msg.pollOptions && (
                  <div className="mt-2 space-y-2 w-full min-w-[200px]">
                    <h4 className="font-semibold text-[15px] mb-3 leading-snug">{msg.pollQuestion}</h4>
                    {msg.pollOptions.map((opt) => {
                      const totalVotes = msg.pollOptions!.reduce((acc, o) => acc + o.voters.length, 0);
                      const percentage = totalVotes > 0 ? Math.round((opt.voters.length / totalVotes) * 100) : 0;
                      const isVoted = currentUser ? opt.voters.includes(currentUser.uid) : false;
                      
                      return (
                        <div 
                          key={opt.id}
                          onClick={() => handleVotePoll(msg.id, opt.id)}
                          className={cn(
                            "relative overflow-hidden rounded-xl border cursor-pointer transition-all p-2.5 text-sm group/poll",
                            isVoted 
                              ? (isMine ? "border-white/40 bg-white/10" : "border-blue-400 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-900/20")
                              : (isMine ? "border-blue-500/50 hover:bg-white/5" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50")
                          )}
                        >
                          <div 
                            className={cn(
                              "absolute top-0 left-0 bottom-0 transition-all duration-500 ease-out",
                              isVoted 
                                ? (isMine ? "bg-white/20" : "bg-blue-100 dark:bg-blue-800/40") 
                                : (isMine ? "bg-blue-500/30" : "bg-gray-100 dark:bg-gray-800")
                            )}
                            style={{ width: `${percentage}%` }}
                          />
                          <div className="relative z-10 flex items-center justify-between gap-2">
                            <span className={cn(
                              "font-medium truncate",
                              isMine ? "text-white" : "text-gray-900 dark:text-gray-100"
                            )}>
                              {opt.text}
                            </span>
                            <span className={cn(
                              "text-xs font-semibold flex-shrink-0", 
                              isMine ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
                            )}>
                              {percentage}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-[10px] text-right mt-1 opacity-70">
                      Toplam: {msg.pollOptions!.reduce((acc, o) => acc + o.voters.length, 0)} oy
                    </div>
                  </div>
                )}
                
                <span className={cn(
                  "text-[10px] mt-1 flex items-center justify-end gap-1 select-none",
                  isMine ? "text-blue-200" : "text-gray-400 dark:text-gray-500"
                )}>
                  {format(msg.timestamp, 'HH:mm')}
                  {isMine && renderReadReceipt(msg, idx === allMessages.length - 1)}
                </span>
              </div>
            </div>
            
            {msg.senderId === TALKO_AI_USER_ID && (!aiState.isGenerating || idx !== allMessages.length - 1) && (
              <div className="w-full pl-10 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 select-none text-left">
                Talko AI yanlış yanıtlar verebilir.
              </div>
            )}
          </div>
          );
        });
      })()}
        
        {isOtherUserTyping && !isAiChat && (
          <div className="flex justify-start pl-10 w-full mb-2">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-sm flex flex-col gap-1.5 min-w-[60px]">
              {liveChat.isGroup && groupTypersText && (
                <span className="text-[10px] text-blue-500 font-bold mb-1">{groupTypersText.split(' yazıyor...')[0]}</span>
              )}
              <div className="flex items-center gap-1.5 justify-center h-2">
                <span className="w-2.5 h-2.5 bg-blue-500 dark:bg-blue-400 rounded-full animate-typing-dot"></span>
                <span className="w-2.5 h-2.5 bg-blue-500 dark:bg-blue-400 rounded-full animate-typing-dot" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2.5 h-2.5 bg-blue-500 dark:bg-blue-400 rounded-full animate-typing-dot" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          </div>
        )}

        {(isAiChat || liveChat.isGroup) && aiState.isGenerating && (
          <div className="flex w-full min-w-0 px-0.5 justify-start">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mr-2 mt-auto bg-gradient-to-tr from-blue-500 to-indigo-600 p-[1.5px] shadow-md ring-2 ring-blue-500/10">
              <img src={TALKO_AI_LOGO_DATA_URL} alt="Talko AI" className="w-full h-full object-cover rounded-full bg-white dark:bg-gray-950" />
            </div>
            <div className="max-w-[75%] md:max-w-[65%] min-w-0 rounded-2xl px-4 py-2.5 shadow-md relative group break-words bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900/50 text-gray-900 dark:text-gray-100 border border-gray-150 dark:border-gray-800 rounded-bl-sm overflow-hidden">
              {aiState.isThinking ? (
                <div className="flex items-center gap-3 py-1 px-0.5">
                  <div className="flex items-center gap-1 h-5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-gradient-to-t from-blue-500 via-indigo-500 to-purple-500 rounded-full"
                        initial={{ height: 4 }}
                        animate={{ height: [4, 18, 4] }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          delay: i * 0.15,
                          ease: "easeInOut"
                        }}
                      />
                    ))}
                  </div>
                  <motion.span 
                    initial={{ opacity: 0.6 }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest pl-1"
                  >
                    Yazıyor
                  </motion.span>
                </div>
              ) : (
                <div className="relative text-[15px] leading-relaxed">
                  {renderMarkdown(aiState.streamText)}
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {isSystemChat ? (
        <div className="p-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] bg-white dark:bg-[#0b141a] border-t border-gray-200 dark:border-gray-800 flex items-center justify-center">
          <div className="bg-[#f0f2f5] dark:bg-[#1f2c34] rounded-[24px] px-5 py-2.5 text-center shadow-sm max-w-[90%]">
            <span className="text-[13.5px] text-[#54656f] dark:text-[#e9edef] leading-relaxed block">
              Gönderen, yanıt kabul etmiyor. Gönderenle doğrudan iletişim kurun. <button className="text-[#027eb5] dark:text-[#53bdeb] hover:underline cursor-pointer transition-colors font-medium ml-1" onClick={() => toast("Daha fazla bilgi için Yardım Merkezi'ni ziyaret edin.", { icon: "ℹ️" })}>Daha fazla bilgi</button>
            </span>
          </div>
        </div>
      ) : otherUserDetails?.isBanned ? (
        <div className="p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] bg-gray-50 dark:bg-gray-900/60 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center">
          <div className="max-w-md w-full bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 flex gap-3 shadow-sm">
            <span className="text-xl select-none" role="img" aria-label="banned">🚫</span>
            <div className="text-left">
              <h4 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-0.5">
                Kullanıcı Askıya Alındı
              </h4>
              <p className="text-xs text-red-800/85 dark:text-red-400/85 leading-relaxed">
                Bu kullanıcı hesabı, topluluk kurallarını ihlal ettiği gerekçesiyle askıya alınmıştır. Bu hesaba mesaj gönderilemez.
              </p>
            </div>
          </div>
        </div>
      ) : isBlocked ? (
        <div className="p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] bg-gray-50 dark:bg-gray-900/60 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center">
          <div className="max-w-md w-full bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 flex gap-3 shadow-sm">
            <span className="text-xl select-none text-red-500" role="img" aria-label="blocked"><Ban size={24} /></span>
            <div className="text-left">
              <h4 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-0.5">
                Kullanıcı Engellendi
              </h4>
              <p className="text-xs text-red-800/85 dark:text-red-400/85 leading-relaxed">
                Bu kullanıcı engellendi veya sizi engelledi. Bu sohbete mesaj gönderilemez.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          {/* Quick Prompts */}
          {(isAiChat || inputText.toLowerCase().includes('@talko ai') || mentionQuery) && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-1.5 no-scrollbar scroll-smooth">
              <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 flex-shrink-0 uppercase tracking-wider ml-1">İpuçları:</span>
              {[
                { label: "✍️ Özetle", template: "bunu özetle: " },
                { label: "🌍 İngilizceye Çevir", template: "bu metni İngilizceye çevir: " },
                { label: "💡 Fikir Ver", template: "bana şu konuda yaratıcı fikirler ver: " },
                { label: "🌦️ Hava Durumu", template: "bugün hava nasıl olacak?" },
                { label: "📚 Hikaye Anlat", template: "bana kısa ve eğlenceli bir robot hikayesi anlat." }
              ].map((item, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    let newText = "";
                    if (liveChat.isGroup) {
                      newText = `@Talko AI ${item.template}`;
                    } else {
                      newText = item.template;
                    }
                    setInputText(newText);
                    setMentionQuery(null);
                    setTimeout(() => {
                      textareaRef.current?.focus();
                    }, 50);
                  }}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold rounded-full border border-gray-200/60 dark:border-gray-700/60 transition-all flex-shrink-0 active:scale-95 cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputText); }}
            className="flex items-end gap-2 relative w-full min-w-0"
          >
            {mentionQuery && (
              <motion.div 
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="absolute bottom-full left-0 mb-2 w-72 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-150 dark:border-gray-800 overflow-hidden z-50 p-1.5 flex flex-col gap-1"
              >
                <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Etiketle
                </div>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-2 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 rounded-xl transition-all text-left active:scale-[0.98] cursor-pointer"
                  onClick={() => {
                    const newText = inputText.substring(0, mentionQuery.start) + '@Talko AI ' + inputText.substring(mentionQuery.end);
                    setInputText(newText);
                    setMentionQuery(null);
                    setTimeout(() => {
                      textareaRef.current?.focus();
                    }, 50);
                  }}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-tr from-blue-500 to-purple-600 p-[1.5px]">
                    <img src={TALKO_AI_LOGO_DATA_URL} alt="Talko AI" className="w-full h-full object-cover rounded-full bg-white dark:bg-gray-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-[14px] text-gray-900 dark:text-gray-100 leading-none">Talko AI</p>
                      <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded-md">BOT</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-1">Grupta yapay zekâya soru sor</p>
                  </div>
                </button>
              </motion.div>
            )}
            
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 z-50 shadow-2xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 max-w-full">
                <EmojiPicker onEmojiClick={onEmojiClick} autoFocusSearch={false} theme={theme} />
              </div>
            )}
            
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 sm:p-3 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors flex-shrink-0"
            >
              <Smile size={20} className="sm:w-6 sm:h-6" />
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 sm:p-3 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={20} className="animate-spin sm:w-6 sm:h-6" /> : <ImageIcon size={20} className="sm:w-6 sm:h-6" />}
            </button>

            {liveChat.isGroup && (
              <button
                type="button"
                onClick={() => setShowPollModal(true)}
                className="p-2 sm:p-3 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors flex-shrink-0"
                title="Anket Oluştur"
              >
                <BarChart2 size={20} className="sm:w-6 sm:h-6" />
              </button>
            )}

            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => {
                const val = e.target.value;
                setInputText(val);
                handleTyping(val);
                
                if (liveChat.isGroup) {
                  const cursorPos = e.target.selectionStart;
                  const textBeforeCursor = val.slice(0, cursorPos);
                  const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);
                  if (match && "Talko AI".toLowerCase().startsWith(match[1].toLowerCase())) {
                    setMentionQuery({ query: match[1], start: match.index!, end: cursorPos });
                  } else {
                    setMentionQuery(null);
                  }
                }
              }}
              onFocus={() => {
                setTimeout(() => {
                  forceScrollToBottom('smooth');
                }, 150);
              }}
              placeholder="Mesajınızı yazın..."
              className="flex-1 max-h-32 min-h-[48px] bg-gray-100 dark:bg-gray-800 border-transparent rounded-2xl px-4 py-3 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none overflow-y-auto dark:text-white min-w-0"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(inputText);
                }
              }}
            />
            
            <button
              type="submit"
              disabled={!inputText.trim() || isUploading}
              className="p-2 sm:p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors flex-shrink-0 disabled:opacity-50 disabled:bg-gray-300 dark:disabled:bg-gray-700"
            >
              <Send size={16} className="sm:w-5 sm:h-5 ml-0.5 sm:ml-1" />
            </button>
          </form>
        </div>
      )}

      {/* Message Context Menu */}
      <AnimatePresence>
        {selectedMessageForReport && !showReportModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMessageForReport(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center sm:p-4"
            >
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden pb-safe border border-gray-100 dark:border-gray-800"
              >
                <div className="p-4 pb-2 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900 dark:text-white pl-2">Mesaj Seçenekleri</h3>
                  <button onClick={() => setSelectedMessageForReport(null)} className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="p-2">
                  <button 
                    onClick={() => {
                      if (selectedMessageForReport.text) {
                        navigator.clipboard.writeText(selectedMessageForReport.text);
                        toast.success('Mesaj kopyalandı.');
                      }
                      setSelectedMessageForReport(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-700 dark:text-gray-200"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Copy size={20} />
                    </div>
                    <span className="font-medium text-[15px]">Kopyala</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
        
      </AnimatePresence>
      <AnimatePresence>
        {showPollModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPollModal(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-0"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 w-full max-w-[400px] rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                    <BarChart2 size={18} />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Anket Oluştur</h3>
                </div>
                <button 
                  onClick={() => setShowPollModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-5 overflow-y-auto flex-1">
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Soru</label>
                  <input 
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="Bir soru sorun..."
                    className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white placeholder-gray-400"
                    autoFocus
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seçenekler</label>
                  {pollOptions.map((opt, index) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input 
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const newOptions = [...pollOptions];
                          newOptions[index].text = e.target.value;
                          setPollOptions(newOptions);
                        }}
                        placeholder={`Seçenek ${index + 1}`}
                        className="flex-1 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white placeholder-gray-400"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPollOptions(pollOptions.filter(o => o.id !== opt.id));
                          }}
                          className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                {pollOptions.length < 10 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPollOptions([...pollOptions, { id: Date.now().toString(), text: '' }]);
                    }}
                    className="mt-4 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:underline text-sm px-1 py-2"
                  >
                    <Plus size={16} /> Yeni Seçenek Ekle
                  </button>
                )}
              </div>
              
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <button
                  onClick={handleSendPoll}
                  disabled={!pollQuestion.trim() || pollOptions.filter(o => o.text.trim()).length < 2}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm active:scale-[0.98] disabled:active:scale-100 disabled:opacity-70 flex items-center justify-center gap-2 text-[15px]"
                >
                  <Send size={18} /> Anket Gönder
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
