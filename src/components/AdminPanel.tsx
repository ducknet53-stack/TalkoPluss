import { useState, useEffect, FormEvent } from "react";
import {
  collection,
  doc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  writeBatch,
  setDoc,
  increment,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { User, Chat, Message } from "../types";
import {
  Fingerprint,
  Users,
  MessageSquare,
  ArrowLeft,
  Ban,
  Search,
  BadgeCheck,
  KeyRound,
  Clock,
  Eye,
  Trash2,
  Megaphone,
  Bell,
  Camera,
  Star,
  ShieldAlert, Shield,
} from "lucide-react";
import { TALKO_LOGO_DATA_URL } from "../lib/assets";
import toast from "react-hot-toast";
import { cn } from "../lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const safeFormatDate = (timestamp: any, formatStr: string) => {
  if (!timestamp) return "Tarih yok";
  try {
    const d = typeof timestamp === "number"
      ? new Date(timestamp)
      : (timestamp?.toDate ? timestamp.toDate() : new Date(timestamp));
    if (isNaN(d.getTime())) return "Geçersiz tarih";
    return format(d, formatStr, { locale: tr });
  } catch (e) {
    return "Tarih yok";
  }
};

const safeString = (val: any, fallback: string = "") => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    if (typeof val.text === "string") return val.text;
    if (typeof val.content === "string") return val.content;
    if (typeof val.caption === "string") return val.caption;
    if (typeof val.message === "string") return val.message;
    if (typeof val.name === "string") return val.name;
    return fallback || "[Metin / Obje]";
  }
  return String(val);
};

export default function AdminPanel() {
  const { currentUser, userProfile } = useAuth();
  const [password, setPassword] = useState("");
  
  // Developer Mode state (enabled by default in dev environment or via toggle)
  const [isDevMode, setIsDevMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("talko_dev_mode");
    if (saved !== null) return saved === "true";
    return import.meta.env.DEV || true;
  });

  const [isGoogleShutdownDisabled, setIsGoogleShutdownDisabled] = useState<boolean>(() => {
    return localStorage.getItem("talko_google_shutdown_disabled") === "true";
  });

  const toggleGoogleShutdown = () => {
    if (isGoogleShutdownDisabled) {
      localStorage.removeItem("talko_google_shutdown_disabled");
      setIsGoogleShutdownDisabled(false);
      toast.success("Google Kapatma Ekranı Aktifleştirildi! (Ziyaretçilere kapatma bildirimi gösterilecek)");
    } else {
      localStorage.setItem("talko_google_shutdown_disabled", "true");
      setIsGoogleShutdownDisabled(true);
      toast.success("Google Kapatma Ekranı Devredışı Bırakıldı! (Site normale döndü)");
    }
  };

  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return isDevMode || localStorage.getItem("talko_admin_auth") === "true";
  });

  // Toggle developer mode
  const toggleDevMode = (enabled: boolean) => {
    setIsDevMode(enabled);
    localStorage.setItem("talko_dev_mode", enabled ? "true" : "false");
    if (enabled) {
      setIsAuthorized(true);
      toast.success("Geliştirme Modu (Developer Mode) Aktifleştirildi!");
    } else {
      toast.success("Geliştirme Modu Kapatıldı (Prod Moduna Geçildi).");
    }
  };

  // Permanently authorize & ensure admin role in Firestore
  const ensureAdminDoc = async () => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, "users", currentUser.uid), { isAdmin: true }, { merge: true });
    } catch (e) {
      console.warn("ensureAdminDoc note:", e);
    }
  };

  useEffect(() => {
    localStorage.setItem("talko_admin_auth", "true");
    ensureAdminDoc();
  }, [currentUser, isDevMode]);

  const [activeTab, setActiveTab] = useState<
    "users" | "chats" | "broadcast" | "verifications" | "logs"
  >("users");
  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [selectedChatMessages, setSelectedChatMessages] = useState<Message[]>(
    [],
  );
  const [moderationLogs, setModerationLogs] = useState<any[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [searchChatQuery, setSearchChatQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Announcement broadcast states
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementImage, setAnnouncementImage] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(0);

  const [verifications, setVerifications] = useState<any[]>([]);

  // Check and authorize
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const validPasswords = ["9999", "admin", "123456"];
    if (validPasswords.includes(password.trim())) {
      setIsAuthorized(true);
      localStorage.setItem("talko_admin_auth", "true");
      toast.success("Admin girişi başarılı!");
      await ensureAdminDoc();
    } else {
      toast.error("Hatalı şifre! Lütfen tekrar deneyin.");
    }
  };

  const handleLogout = () => {
    setIsAuthorized(false);
    localStorage.removeItem("talko_admin_auth");
    toast.success("Admin oturumu kapatıldı.");
  };

  // Real-time Firestore Listeners with automatic retry on permission delay
  useEffect(() => {
    if (!isAuthorized) return;

    let unsubUsers: (() => void) | null = null;
    let unsubChats: (() => void) | null = null;
    let unsubVerifs: (() => void) | null = null;
    let unsubLogs: (() => void) | null = null;
    let retryTimer: any = null;

    const fetchViaApi = async () => {
      try {
        const token = await auth.currentUser?.getIdToken().catch(() => "");
        const res = await fetch('/api/admin/data', {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            if (json.users) setUsers(json.users);
            if (json.chats) setChats(json.chats);
            if (json.verifications) setVerifications(json.verifications);
            if (json.moderationLogs) setModerationLogs(json.moderationLogs);
          }
        }
      } catch (e) {
        console.warn("API fallback error:", e);
      }
    };

    const setupListeners = async (retryCount = 0) => {
      await ensureAdminDoc();

      try {
        unsubUsers = onSnapshot(
          collection(db, "users"),
          (snap) => {
            const fetchedUsers = snap.docs.map(
              (d) => ({ uid: d.id, ...d.data() } as User),
            );
            fetchedUsers.sort((a, b) => {
              if (a.isBanned && !b.isBanned) return -1;
              if (!a.isBanned && b.isBanned) return 1;
              const aOnline = a.isOnline || (a as any).online || false;
              const bOnline = b.isOnline || (b as any).online || false;
              if (aOnline && !bOnline) return -1;
              if (!aOnline && bOnline) return 1;
              const nameA = safeString(a.username || (a as any).displayName);
              const nameB = safeString(b.username || (b as any).displayName);
              return nameA.localeCompare(nameB, "tr");
            });
            setUsers(fetchedUsers);
          },
          (err) => {
            console.warn("Users snapshot note:", err?.message);
            if (err?.code === 'permission-denied') {
              if (isDevMode) fetchViaApi();
              if (retryCount < 3) {
                retryTimer = setTimeout(() => setupListeners(retryCount + 1), 2000);
              }
            }
          },
        );

        unsubChats = onSnapshot(
          collection(db, "chats"),
          (snap) => {
            const fetchedChats = snap.docs.map(
              (d) => ({ id: d.id, ...d.data() } as Chat),
            );
            fetchedChats.sort(
              (a, b) => ((b.updatedAt as number) || 0) - ((a.updatedAt as number) || 0),
            );
            setChats(fetchedChats);
          },
          (err) => {
            console.warn("Chats snapshot note:", err?.message);
            if (err?.code === 'permission-denied') {
               if (isDevMode) fetchViaApi();
            }
          },
        );

        unsubVerifs = onSnapshot(
          collection(db, "verifications"),
          (snap) => {
            const fetchedVerifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            fetchedVerifs.sort((a: any, b: any) => {
              if (a.status === "pending" && b.status !== "pending") return -1;
              if (a.status !== "pending" && b.status === "pending") return 1;
              return (b.createdAt || 0) - (a.createdAt || 0);
            });
            setVerifications(fetchedVerifs);
          },
          (err) => {
            console.warn("Verifications snapshot note:", err?.message);
          },
        );

        unsubLogs = onSnapshot(
          collection(db, "moderation_logs"),
          (snap) => {
            const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            logs.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
            setModerationLogs(logs);
          },
          (err) => {
            console.warn("Moderation logs snapshot note:", err?.message);
          },
        );
      } catch (e) {
        console.warn("Error setting up client listeners:", e);
      }
    };

    setupListeners();

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubChats) unsubChats();
      if (unsubVerifs) unsubVerifs();
      if (unsubLogs) unsubLogs();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isAuthorized, currentUser, isDevMode]);

  // Real-time messages listener for selected chat
  useEffect(() => {
    if (!isAuthorized || !selectedChat) {
      setSelectedChatMessages([]);
      return;
    }

    let unsubMsgs: (() => void) | null = null;
    let retryTimer: any = null;

    const fetchMsgsViaApi = async () => {
      try {
        const token = await auth.currentUser?.getIdToken().catch(() => "");
        const res = await fetch(`/api/admin/chat-messages?chatId=${selectedChat.id}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.messages) {
            setSelectedChatMessages(json.messages);
          }
        }
      } catch (e) {
        console.warn("Messages API fallback error:", e);
      }
    };

    const setupMsgListener = async (retryCount = 0) => {
      await ensureAdminDoc();
      try {
        const messagesRef = collection(db, `chats/${selectedChat.id}/messages`);
        const q = query(messagesRef, orderBy("timestamp", "asc"));
        unsubMsgs = onSnapshot(
          q,
          (snapshot) => {
            const msgs = snapshot.docs.map(
              (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Message),
            );
            setSelectedChatMessages(msgs);
          },
          (err) => {
            console.warn("Messages snapshot error:", err?.message);
            if (err?.code === 'permission-denied') {
              if (isDevMode) fetchMsgsViaApi();
              if (retryCount < 3) {
                retryTimer = setTimeout(() => setupMsgListener(retryCount + 1), 2000);
              }
            }
          },
        );
      } catch (e) {
        console.warn("Error setting up chat messages listener:", e);
      }
    };

    setupMsgListener();

    return () => {
      if (unsubMsgs) unsubMsgs();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isAuthorized, selectedChat, isDevMode]);

  const adminBatch = async (writes: any[]) => {
    await ensureAdminDoc();
    // 1. Try server admin batch API first
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => "");
      const res = await fetch('/api/admin/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ writes })
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json && json.success) return;
      }
    } catch (e) {
      console.warn("Server admin batch API note, fallback to client batch:", e);
    }

    // 2. Client writeBatch fallback
    try {
      const batch = writeBatch(db);
      for (const w of writes) {
        const ref = doc(db, w.path);
        const data = { ...w.data };
        for (const k in data) {
          if (data[k] === '__serverTimestamp') {
            data[k] = serverTimestamp();
          } else if (data[k] && typeof data[k] === 'object' && data[k].__increment !== undefined) {
            data[k] = increment(data[k].__increment);
          }
        }
        if (w.type === 'set') batch.set(ref, data, { merge: w.merge });
        else if (w.type === 'update') batch.update(ref, data);
        else if (w.type === 'delete') batch.delete(ref);
      }
      await batch.commit();
    } catch (err: any) {
      console.warn("Batch commit failed, attempting individual retries:", err);
      for (const w of writes) {
        const ref = doc(db, w.path);
        const data = { ...w.data };
        for (const k in data) {
          if (data[k] === '__serverTimestamp') {
            data[k] = serverTimestamp();
          } else if (data[k] && typeof data[k] === 'object' && data[k].__increment !== undefined) {
            data[k] = increment(data[k].__increment);
          }
        }
        if (w.type === 'update') await updateDoc(ref, data);
        else if (w.type === 'delete') await deleteDoc(ref);
        else await setDoc(ref, data, { merge: w.merge });
      }
    }
  };

  // Admin user action
  const handleToggleAdmin = async (user: User) => {
    const willBeAdmin = !user.isAdmin;
    try {
      await adminBatch([{
        type: 'update',
        path: `users/${user.uid}`,
        data: { isAdmin: willBeAdmin }
      }]);
      toast.success(
        willBeAdmin
          ? `${user.username} admin yapıldı.`
          : `${user.username} admin yetkisi alındı.`,
      );
    } catch (err: any) {
      console.error("Error toggling admin status:", err);
      toast.error("Hata: " + (err?.message || "İşlem başarısız oldu."));
    }
  };

  // Ban/Unban user action
  const handleToggleBan = async (user: User) => {
    const willBan = !user.isBanned;
    try {
      await adminBatch([{
        type: "update",
        path: `users/${user.uid}`,
        data: {
          isBanned: willBan,
          bannedAt: willBan ? Date.now() : null,
          isOnline: false,
          online: false,
        }
      }]);
      toast.success(
        willBan
          ? `${user.username} başarıyla engellendi.`
          : `${user.username} engeli kaldırıldı.`,
      );
    } catch (err: any) {
      console.error("Error toggling ban status:", err);
      toast.error("Hata: " + (err?.message || "İşlem başarısız oldu."));
    }
  };

  const handleToggleVerified = async (user: User) => {
    const willVerify = !user.isVerified;
    try {
      await adminBatch([{
        type: "update",
        path: `users/${user.uid}`,
        data: {
          isVerified: willVerify,
          blueTickStatus: willVerify ? "approved" : null,
        }
      }]);
      toast.success(
        willVerify
          ? `${user.username} Talko Verified yapıldı.`
          : `${user.username} Talko Verified unvanı kaldırıldı.`,
      );
    } catch (err: any) {
      console.error("Error toggling verified status:", err);
      toast.error("Hata: " + (err?.message || "İşlem başarısız oldu."));
    }
  };

  const handleRejectBlueTick = async (user: User) => {
    try {
      await adminBatch([{
        type: "update",
        path: `users/${user.uid}`,
        data: {
          blueTickStatus: "rejected",
        }
      }]);
      toast.success(`${user.username} mavi tik talebi reddedildi.`);
    } catch (err: any) {
      console.error("Error rejecting blue tick status:", err);
      toast.error("Hata: " + (err?.message || "İşlem başarısız oldu."));
    }
  };
  const handleVerification = async (
    verif: any,
    action: "approved" | "rejected",
  ) => {
    try {
      const writes: any[] = [];
      writes.push({ type: "update", path: `verifications/${verif.id}`, data: { status: action } });
      if (action === "approved") {
        writes.push({ type: "update", path: `users/${verif.uid}`, data: { isBanned: false, bannedAt: null, verificationStatus: "approved" } });
      } else {
        writes.push({ type: "update", path: `users/${verif.uid}`, data: { verificationStatus: "rejected" } });
      }

      const SYSTEM_USER_ID = "system_talko_destek";
      const chatId = [SYSTEM_USER_ID, verif.uid].sort().join("_");
      const messageText = action === "approved"
            ? "🟢 Kimliğiniz doğrulandı.\nHesabınız tekrar kullanıma açılmıştır."
            : "🔴 Kimlik doğrulamanız onaylanmadı.\nLütfen tekrar doğrulama gönderiniz.";

      writes.push({
        type: "set",
        path: `chats/${chatId}`,
        merge: true,
        data: {
            id: chatId,
            participants: [SYSTEM_USER_ID, verif.uid],
            participantDetails: {
              [SYSTEM_USER_ID]: { username: "Talko Destek", photoURL: TALKO_LOGO_DATA_URL },
              [verif.uid]: { username: verif.username, photoURL: null },
            },
            lastMessage: messageText,
            lastMessageTimestamp: Date.now(),
            updatedAt: Date.now(),
            [`unreadCount.${verif.uid}`]: { __increment: 1 },
        }
      });

      const messageId = Date.now().toString() + "_" + Math.random().toString(36).substring(2, 9);
      writes.push({
        type: "set",
        path: `chats/${chatId}/messages/${messageId}`,
        data: {
          id: messageId,
          senderId: SYSTEM_USER_ID,
          text: messageText,
          timestamp: Date.now(),
        }
      });

      await adminBatch(writes);
      if (action === "approved") toast.success(`${verif.username} kullanıcısının askısı kaldırıldı.`);
      else toast.error(`${verif.username} doğrulaması reddedildi.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Doğrulama işlemi başarısız: " + err.message);
    }
  };

  // Broadcast announcement action
  const handleSendBroadcast = async (e: FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) {
      toast.error("Duyuru metni boş olamaz!");
      return;
    }
    const SYSTEM_USER_ID = "system_talko_destek";
    const targetUsers = users.filter(
      (u) => u && u.uid && u.uid !== SYSTEM_USER_ID && !u.isBanned,
    );
    if (targetUsers.length === 0) {
      toast.error("Duyuru gönderilecek aktif kullanıcı bulunamadı!");
      return;
    }
    const confirmSend = window.confirm(
      `Bu duyuruyu tüm ${targetUsers.length} kayıtlı kullanıcıya "Talko Destek" ismiyle göndermek istediğinizden emin misiniz?`,
    );
    if (!confirmSend) return;

    setIsBroadcasting(true);
    setBroadcastProgress(0);
    let successCount = 0;

    try {
      const BATCH_SIZE = 200;
      for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
        const batchUsers = targetUsers.slice(i, i + BATCH_SIZE);
        const writes: any[] = [];
        
        for (const user of batchUsers) {
          const chatId = [SYSTEM_USER_ID, user.uid].sort().join("_");
          
          writes.push({
            type: "set",
            path: `chats/${chatId}`,
            merge: true,
            data: {
              id: chatId,
              participants: [SYSTEM_USER_ID, user.uid],
              participantDetails: {
                [SYSTEM_USER_ID]: { username: "Talko Destek", photoURL: TALKO_LOGO_DATA_URL },
                [user.uid]: { username: user.username || "Kullanıcı", photoURL: user.photoURL || null },
              },
              lastMessage: announcementText,
              lastMessageTimestamp: Date.now(),
              updatedAt: Date.now(),
              [`unreadCount.${user.uid}`]: { __increment: 1 },
            }
          });

          const messageId = Date.now().toString() + "_" + Math.random().toString(36).substring(2, 9);
          writes.push({
            type: "set",
            path: `chats/${chatId}/messages/${messageId}`,
            data: {
              id: messageId,
              senderId: SYSTEM_USER_ID,
              text: announcementText,
              imageUrl: announcementImage.trim() || null,
              timestamp: Date.now(),
            }
          });
        }
        
        try {
           await adminBatch(writes);
           successCount += batchUsers.length;
           setBroadcastProgress(Math.round((successCount / targetUsers.length) * 100));
        } catch (e) {
           console.error("Batch send error:", e);
        }
      }
      toast.success(`Duyuru başarıyla ${successCount} kullanıcıya gönderildi!`);
      setAnnouncementText("");
      setAnnouncementImage("");
    } catch (err: any) {
      console.error("Error broadcasting announcement:", err);
      toast.error(`Duyuru gönderilirken hata oluştu: ${err.message || err}`);
    } finally {
      setIsBroadcasting(false);
      setBroadcastProgress(0);
    }
  };

  // Filter users lists
  const filteredUsers = (Array.isArray(users) ? users : []).filter(
    (u) =>
      u &&
      (safeString(u.username || (u as any).displayName).toLowerCase().includes((searchUserQuery || "").toLowerCase()) ||
       safeString(u.email).toLowerCase().includes((searchUserQuery || "").toLowerCase())),
  );

  const filteredChats = (Array.isArray(chats) ? chats : []).filter((chat) => {
    if (!chat) return false;
    const participants = Array.isArray(chat.participants) ? chat.participants : [];
    const participantsNames = participants
      .map((pId) => {
        if (pId === "system_talko_destek" || pId === "system_talko_ai") return "Talko Sistem";
        const userObj = users.find((u) => u && u.uid === pId);
        return userObj ? safeString(userObj.username || (userObj as any).displayName, pId) : safeString(pId);
      })
      .join(" ");

    const queryStr = (searchChatQuery || "").toLowerCase();
    const lastMsgStr = safeString(chat.lastMessage).toLowerCase();

    return (
      participantsNames.toLowerCase().includes(queryStr) ||
      lastMsgStr.includes(queryStr)
    );
  });

  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans z-50">
        <div className="max-w-md w-full bg-slate-850/60 backdrop-blur-md rounded-3xl border border-slate-700/50 p-8 shadow-2xl relative overflow-hidden my-auto">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500" />
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-5 relative group flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-md group-hover:blur-lg transition-all duration-300 animate-pulse" />
              <img
                src={TALKO_LOGO_DATA_URL}
                alt="Talko Logo"
                className="w-20 h-20 rounded-2xl border border-blue-500/30 shadow-lg shadow-blue-500/10 relative z-10 hover:scale-105 transition-transform duration-300 select-none pointer-events-none"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Talko Yönetim Paneli
            </h1>
            <p className="text-sm text-slate-400">
              Güvenlik ve denetim paneline erişmek için şifreyi girin
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Giriş Şifresi
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <KeyRound size={18} />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700/60 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-center tracking-widest font-bold placeholder-slate-600 text-lg text-white"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <KeyRound size={18} />
              Giriş Yap
            </button>
          </form>

          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="w-full mt-4 py-2.5 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700/30 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm"
          >
            <ArrowLeft size={16} />
            Sohbete Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-950 text-slate-100 flex flex-col font-sans overflow-y-auto overflow-x-hidden relative">
      {/* Header */}
      <header className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={TALKO_LOGO_DATA_URL}
            alt="Talko Logo"
            className="w-10 h-10 rounded-xl border border-blue-500/20 shadow-md shadow-blue-500/5 select-none pointer-events-none"
          />
          <div>
            <h1 className="font-bold text-lg text-white flex items-center gap-2">
              Talko Yönetim Paneli
              <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/30 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Yetkili
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Sistem denetimi, hesap engelleme ve güvenlik günlükleri
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              window.location.hash = "";
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Sohbete Dön
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-950/40 hover:bg-red-950/60 border border-red-900/30 text-red-400 hover:text-red-300 rounded-xl text-sm font-semibold transition-all"
          >
            Güvenli Çıkış
          </button>
        </div>
      </header>

      {/* Developer Mode Info Banner & Controls */}
      <div className="px-6 pt-4">
        <div className={cn(
          "rounded-2xl p-4 border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg",
          isDevMode 
            ? "bg-amber-950/30 border-amber-500/30 text-amber-200" 
            : "bg-slate-900/60 border-slate-800 text-slate-300"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl border flex items-center justify-center shrink-0",
              isDevMode ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-slate-800 border-slate-700 text-slate-400"
            )}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide">
                  {isDevMode ? "⚡ Geliştirme Modu (Developer Mode) Aktif" : "🔒 Üretim Modu (Production Mode) Aktif"}
                </span>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border",
                  isDevMode ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                )}>
                  {isDevMode ? "DEV ENVIRONMENT" : "PROD RULES"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isDevMode 
                  ? "Geliştirme aşamasında oturum açan kullanıcı admin yetkisiyle ilişkilendirilir. Tüm Firestore verileri (kullanıcılar, sohbetler, doğrulamalar, loglar) gerçek zamanlı yüklenir."
                  : "Üretim modunda standart Firebase yetkilendirme kuralları ve admin izinleri geçerlidir."
                }
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end md:self-auto shrink-0">
            <button
              onClick={toggleGoogleShutdown}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 shadow-sm cursor-pointer",
                !isGoogleShutdownDisabled
                  ? "bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30"
              )}
              title="Ziyaretçilere Google kapatma bildirim ekranı gösterme modunu açar/kapatır"
            >
              <ShieldAlert size={14} />
              {!isGoogleShutdownDisabled ? "🔴 Google Kapatma Modu: AÇIK" : "🟢 Google Kapatma Modu: KAPALI"}
            </button>

            <button
              onClick={() => toggleDevMode(!isDevMode)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 shadow-sm cursor-pointer",
                isDevMode
                  ? "bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400"
                  : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
              )}
            >
              <Shield size={14} />
              {isDevMode ? "Prod Moduna Geç" : "Dev Modunu Aç"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <section className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
              Kayıtlı Kullanıcı
            </span>
            <h3 className="text-xl font-bold text-white mt-1">
              {users.length}
            </h3>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
              Çevrimiçi Kullanıcı
            </span>
            <h3 className="text-xl font-bold text-emerald-400 mt-1">
              {users.filter((u) => u.isOnline || (u as any).online).length}
            </h3>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center shrink-0">
            <MessageSquare size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
              Aktif Sohbet Odası
            </span>
            <h3 className="text-xl font-bold text-blue-400 mt-1">
              {chats.length}
            </h3>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center shrink-0">
            <BadgeCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
              Bekleyen Mavi Tik
            </span>
            <h3 className="text-xl font-bold text-amber-400 mt-1">
              {verifications.filter((v) => v.status === "pending").length}
            </h3>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center shrink-0">
            <Ban size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">
              Engellenen Hesaplar
            </span>
            <h3 className="text-xl font-bold text-red-400 mt-1">
              {users.filter((u) => u.isBanned).length}
            </h3>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="flex-1 px-6 pb-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Action and Listings Block */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden lg:col-span-6 xl:col-span-5 flex flex-col h-[600px]">
          {/* Tab buttons */}
          <div className="flex border-b border-slate-800 bg-slate-900/60 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hide">
            <button
              onClick={() => setActiveTab("users")}
              className={cn(
                "flex-1 min-w-max py-4 px-5 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2",
                activeTab === "users"
                  ? "border-blue-500 text-blue-400 bg-slate-950/20"
                  : "border-transparent text-slate-400 hover:text-white",
              )}
            >
              <Users size={16} />
              Kullanıcı Listesi
            </button>
            <button
              onClick={() => setActiveTab("chats")}
              className={cn(
                "flex-1 min-w-max py-4 px-5 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2",
                activeTab === "chats"
                  ? "border-blue-500 text-blue-400 bg-slate-950/20"
                  : "border-transparent text-slate-400 hover:text-white",
              )}
            >
              <MessageSquare size={16} />
              Sohbet Günlükleri
            </button>
            <button
              onClick={() => setActiveTab("broadcast")}
              className={cn(
                "flex-1 min-w-max py-4 px-5 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2",
                activeTab === "broadcast"
                  ? "border-blue-500 text-blue-400 bg-slate-950/20"
                  : "border-transparent text-slate-400 hover:text-white",
              )}
            >
              <Megaphone size={16} />
              Duyuru Gönder
            </button>
            <button
              onClick={() => setActiveTab("verifications")}
              className={cn(
                "flex-1 min-w-max py-4 px-5 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2",
                activeTab === "verifications"
                  ? "border-blue-500 text-blue-400 bg-slate-950/20"
                  : "border-transparent text-slate-400 hover:text-white",
              )}
            >
              <Camera size={16} />
              Fotoğraflar{" "}
              {verifications.filter((v) => v.status === "pending").length >
                0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {verifications.filter((v) => v.status === "pending").length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={cn(
                "flex-1 min-w-max py-4 px-5 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2",
                activeTab === "logs"
                  ? "border-blue-500 text-blue-400 bg-slate-950/20"
                  : "border-transparent text-slate-400 hover:text-white",
              )}
            >
              <ShieldAlert size={16} />
              Moderasyon
              {moderationLogs.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {moderationLogs.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Inputs */}
          {(activeTab === "users" || activeTab === "chats") && (
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/20">
              {activeTab === "users" ? (
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute inset-y-0 left-3 my-auto text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Kullanıcı adı veya e-posta ile ara..."
                    value={searchUserQuery}
                    onChange={(e) => setSearchUserQuery(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:border-blue-500 focus:ring-0 transition-all text-slate-200"
                  />
                </div>
              ) : (
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute inset-y-0 left-3 my-auto text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Katılımcı isimlerine göre sohbet ara..."
                    value={searchChatQuery}
                    onChange={(e) => setSearchChatQuery(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:border-blue-500 focus:ring-0 transition-all text-slate-200"
                  />
                </div>
              )}
            </div>
          )}

          {/* Scrollable List / Dynamic Content Area */}
          <div
            className={cn(
              "flex-1 overflow-y-auto",
              activeTab !== "broadcast" && "divide-y divide-slate-900",
            )}
          >
            {activeTab === "users" ? (
              filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const isOnline =
                    user.isOnline || (user as any).online || false;
                  return (
                    <div
                      key={user.uid}
                      className="p-4 flex items-center justify-between hover:bg-slate-900/20 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-10 h-10 flex-shrink-0">
                          <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 border border-slate-700/60">
                            {user.photoURL ? (
                              <img
                                src={user.photoURL}
                                alt=""
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-800">
                                <Users size={16} />
                              </div>
                            )}
                          </div>
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-100 truncate text-[14px]">
                            {user.username}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {user.email || "E-posta yok"}
                          </p>
                          {user.isBanned && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-extrabold bg-red-950/80 text-red-400 border border-red-900/50 rounded uppercase tracking-wider">
                              Yasaklı
                            </span>
                          )}
                          {user.blueTickStatus === 'pending' && (
                            <div className="mt-1.5 p-1.5 bg-sky-950/40 border border-sky-900/30 rounded-lg max-w-[200px]">
                              <p className="text-[10px] font-extrabold text-[#38bdf8] uppercase tracking-wider flex items-center gap-1">
                                <span className="animate-pulse">⏳</span> Mavi Tik Talebi!
                              </p>
                              {(user as any).blueTickReason && (
                                <p className="text-[9px] text-slate-300 italic mt-0.5 line-clamp-2">
                                  "{(user as any).blueTickReason}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {user.blueTickStatus === 'pending' && !user.isVerified && (
                          <button
                            onClick={() => handleRejectBlueTick(user)}
                            className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all text-xs font-semibold flex items-center justify-center gap-1"
                            title="Mavi Tik Talebi Reddet"
                          >
                            Talebi Reddet
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleVerified(user)}
                          className={cn(
                            "p-2 rounded-lg border transition-all text-xs font-semibold flex items-center justify-center gap-1.5",
                            user.isVerified
                              ? "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800"
                              : "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20",
                          )}
                          title={
                            user.isVerified
                              ? "Talko Verified Kaldır"
                              : "Talko Verified Ver"
                          }
                        >
                          <Star
                            size={14}
                            className={user.isVerified ? "" : "fill-current"}
                          />
                          {user.isVerified ? "Verified Kaldır" : (user.blueTickStatus === 'pending' ? "Talebi Onayla" : "Verified Ver")}
                        </button>
                        <button
                          onClick={() => handleToggleAdmin(user)}
                          className={cn(
                            "p-2 rounded-lg border transition-all text-xs font-semibold flex items-center justify-center gap-1.5",
                            user.isAdmin
                              ? "bg-amber-950/30 border-amber-900/40 text-amber-400 hover:bg-amber-950/60"
                              : "bg-indigo-950/30 border-indigo-900/40 text-indigo-400 hover:bg-indigo-950/60",
                          )}
                          title={user.isAdmin ? "Admin Yetkisini Al" : "Admin Yap"}
                        >
                          <Shield size={14} />
                          {user.isAdmin ? "Admin Al" : "Admin Yap"}
                        </button>
                        <button
                          onClick={() => handleToggleBan(user)}
                          className={cn(
                            "p-2 rounded-lg border transition-all text-xs font-semibold flex items-center justify-center gap-1.5",
                            user.isBanned
                              ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-400 hover:bg-emerald-950/60"
                              : "bg-red-950/30 border-red-900/40 text-red-400 hover:bg-red-950/60",
                          )}
                          title={user.isBanned ? "Engeli Kaldır" : "Engelle"}
                        >
                          <Ban size={14} />
                          {user.isBanned ? "Aç" : "Banla"}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">
                  Kullanıcı bulunamadı.
                </div>
              )
            ) : activeTab === "chats" ? (
              filteredChats.length > 0 ? (
                filteredChats.map((chat) => {
                  const pNames = (chat.participants || [])
                    .map((pId) => {
                      if (pId === "system_talko_destek" || pId === "system_talko_ai") return "Talko Sistem";
                      const userObj = users.find((u) => u.uid === pId);
                      return userObj ? (userObj.username || userObj.displayName || pId) : pId;
                    })
                    .join(" ↔ ");

                  const isSelected = selectedChat?.id === chat.id;

                  return (
                    <button
                      key={chat.id}
                      onClick={() => setSelectedChat(chat)}
                      className={cn(
                        "w-full p-4 text-left flex items-center justify-between hover:bg-slate-900/20 transition-all border-l-2",
                        isSelected
                          ? "border-blue-500 bg-blue-950/15"
                          : "border-transparent",
                      )}
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="font-semibold text-slate-200 text-sm truncate">
                          {pNames}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-1">
                          {safeString(chat.lastMessage, "Mesaj yok")}
                        </p>
                        <span className="inline-block mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock size={10} />
                          Güncelleme:{" "}
                          {safeFormatDate(chat.updatedAt, "dd MMM HH:mm")}
                        </span>
                      </div>
                      <Eye
                        size={16}
                        className={cn(
                          "text-slate-500 flex-shrink-0",
                          isSelected && "text-blue-400",
                        )}
                      />
                    </button>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">
                  Sohbet bulunamadı.
                </div>
              )
            ) : (
              /* Broadcast Info & Preview */
              <div className="p-5 flex flex-col h-full justify-between gap-5 select-none">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-2">
                    <Megaphone className="text-blue-400" size={16} />
                    Duyuru Sistemi Nasıl Çalışır?
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Göndereceğiniz duyurular, tüm aktif Talko üyelerine{" "}
                    <strong className="text-slate-200 font-bold">
                      Talko Destek
                    </strong>{" "}
                    resmi hesabı üzerinden anlık olarak iletilecektir.
                  </p>

                  {/* Mobil Önizleme */}
                  <div className="border border-slate-800/80 rounded-2xl p-4 bg-slate-950/40 flex flex-col max-w-sm mx-auto shadow-inner">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 text-center border-b border-slate-800 pb-1.5">
                      Sohbet Balonu Önizlemesi
                    </div>
                    {/* Chat Area Simulation */}
                    <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-3 flex flex-col gap-2 min-h-[190px]">
                      {/* Header Simulation */}
                      <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/40 mb-1">
                        <img
                          src={TALKO_LOGO_DATA_URL}
                          alt=""
                          className="w-5 h-5 rounded-full"
                        />
                        <div>
                          <div className="text-[10px] font-bold text-white">
                            Talko Destek
                          </div>
                          <div className="text-[7px] text-emerald-400">
                            Duyuru Hesabı
                          </div>
                        </div>
                      </div>
                      {/* Message Bubble Simulation */}
                      <div className="flex justify-start">
                        <div className="bg-slate-800 border border-slate-700/50 rounded-xl rounded-bl-none p-2.5 max-w-[90%] text-left">
                          {announcementImage.trim() && (
                            <img
                              src={announcementImage.trim()}
                              alt="Duyuru Görseli"
                              className="max-h-20 rounded-lg mb-2 object-cover w-full border border-slate-700"
                            />
                          )}
                          <p className="text-[10px] text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                            {announcementText.trim() ||
                              "Sağ tarafa yazacağınız duyuru metni kullanıcıların sohbetinde bu şekilde görünecektir..."}
                          </p>
                          <span className="block text-[7px] text-slate-500 text-right mt-1 font-mono">
                            {format(Date.now(), "HH:mm")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-950/15 p-3 border border-slate-800/30 rounded-lg">
                  <strong>💡 İpucu:</strong> Duyurularınıza görsellik katmak
                  için resim URL adresi ekleyebilirsiniz. (Örn: doğrudan bir
                  .png veya .jpg linki)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Log Display / Message Inspection Box / Broadcast Form */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden lg:col-span-6 xl:col-span-7 flex flex-col h-[600px]">
          {activeTab === "broadcast" ? (
            /* Broadcast Composer Form */
            <form
              onSubmit={handleSendBroadcast}
              className="flex flex-col h-full justify-between p-6"
            >
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-4">
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Bell className="text-blue-400 animate-pulse" size={18} />
                    Yeni Duyuru Oluştur
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Toplam{" "}
                    <span className="text-blue-400 font-bold">
                      {
                        users.filter(
                          (u) => u.uid !== "system_talko_destek" && !u.isBanned,
                        ).length
                      }
                    </span>{" "}
                    kayıtlı kullanıcıya Talko Destek adıyla yayınlanacaktır.
                  </p>
                </div>

                {/* Duyuru Metni */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Duyuru İçeriği (Zorunlu)
                  </label>
                  <textarea
                    required
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Tüm kullanıcılara duyurmak istediğiniz mesajı buraya yazın..."
                    className="w-full h-44 px-4 py-3 bg-slate-950/40 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-white placeholder-slate-600 resize-none transition-all outline-none leading-relaxed font-sans"
                    disabled={isBroadcasting}
                  />
                </div>

                {/* Görsel URL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Kapak Görseli URL adresi (İsteğe Bağlı)
                  </label>
                  <input
                    type="url"
                    value={announcementImage}
                    onChange={(e) => setAnnouncementImage(e.target.value)}
                    placeholder="https://resim-adresi.com/gorsel.jpg"
                    className="w-full px-4 py-3 bg-slate-950/40 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-white placeholder-slate-600 transition-all outline-none font-sans"
                    disabled={isBroadcasting}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                {isBroadcasting && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-400">
                      <span>Duyuru Gönderiliyor...</span>
                      <span>%{broadcastProgress}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full transition-all duration-300"
                        style={{ width: `${broadcastProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBroadcasting || !announcementText.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isBroadcasting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Yayınlanıyor...
                    </>
                  ) : (
                    <>
                      <Megaphone size={16} />
                      Yayınla ve Tüm Kullanıcılara Gönder
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : activeTab === "verifications" ? (
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                <Camera className="text-blue-400" />
                Doğrulama Talepleri
              </h3>
              {verifications.length > 0 ? (
                verifications.map((verif) => (
                  <div
                    key={verif.id}
                    className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl mb-4"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-white text-md">
                          {verif.username || verif.email || "Kullanıcı"}
                        </h4>
                        <p className="text-sm text-slate-400">{verif.email || ""}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {safeFormatDate(verif.createdAt, "dd MMM yyyy HH:mm")}
                        </p>
                      </div>
                      {verif.status === "pending" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleVerification(verif, "approved")
                            }
                            className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-500/30 transition-all text-sm"
                          >
                            Onayla
                          </button>
                          <button
                            onClick={() =>
                              handleVerification(verif, "rejected")
                            }
                            className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg font-bold hover:bg-red-500/30 transition-all text-sm"
                          >
                            Reddet
                          </button>
                        </div>
                      ) : (
                        <span
                          className={cn(
                            "px-2 py-1 text-xs font-bold rounded-lg uppercase tracking-wider",
                            verif.status === "approved"
                              ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900"
                              : "bg-red-950/50 text-red-400 border border-red-900",
                          )}
                        >
                          {verif.status === "approved"
                            ? "Onaylandı"
                            : "Reddedildi"}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(verif.photos || []).map((photo: string, idx: number) => (
                        <img
                          key={idx}
                          src={photo}
                          alt={`Verification ${idx}`}
                          className="w-full aspect-[3/4] object-cover rounded-lg border border-slate-700 shadow-md"
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 py-10">
                  Henüz doğrulama talebi bulunmuyor.
                </div>
              )}
            </div>
          ) : activeTab === "logs" ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                <ShieldAlert className="text-red-400" />
                Moderasyon Logları (Ağır İhlaller)
              </h3>
              {moderationLogs.length > 0 ? (
                moderationLogs.map((log) => (
                  <div key={log.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{log.username || "Bilinmeyen"}</span>
                          <span className={cn(
                            "px-2 py-0.5 text-[10px] font-bold uppercase rounded-md tracking-wider border",
                            log.type === "profanity" ? "bg-red-950/50 text-red-400 border-red-900/50" :
                            log.type === "harassment" ? "bg-orange-950/50 text-orange-400 border-orange-900/50" :
                            log.type === "threat" ? "bg-purple-950/50 text-purple-400 border-purple-900/50" :
                            "bg-yellow-950/50 text-yellow-400 border-yellow-900/50"
                          )}>
                            {log.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 font-mono flex items-center gap-2">
                          <span>{safeFormatDate(log.timestamp, "dd MMM yyyy HH:mm")}</span>
                          <span>•</span>
                          <span>ID: {log.userId}</span>
                          <span>•</span>
                          <span className="text-blue-400">{log.chatType === "group" ? "Grup Sohbeti" : "Birebir Sohbet"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
                      <p className="text-sm text-slate-300 italic">"{log.text}"</p>
                    </div>
                    {log.reason && (
                      <p className="text-xs text-slate-400 mt-2 font-mono flex items-center gap-1.5">
                        <span className="text-slate-500">AI Kararı:</span> {log.reason}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 py-10">
                  Şu an için moderasyon günlüğü temiz.
                </div>
              )}
            </div>
          ) : selectedChat ? (
            <>
              {/* Inspection Header */}
              <div className="px-5 py-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {(selectedChat.participants || [])
                      .map((pId) => {
                        if (pId === "system_talko_destek" || pId === "system_talko_ai")
                          return "Talko Sistem";
                        const userObj = users.find((u) => u.uid === pId);
                        return userObj ? (userObj.username || userObj.displayName || pId) : pId;
                      })
                      .join(" ↔ ")}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sohbet Odası Logları (Gözlem Modu)
                  </p>
                </div>
                <div className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-400 border border-slate-700/60 font-mono">
                  ID: {selectedChat.id ? selectedChat.id.substring(0, 12) : ""}...
                </div>
              </div>

              {/* Inspection Message History */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-950/20">
                {selectedChatMessages.length > 0 ? (
                  selectedChatMessages.map((msg) => {
                    const sender = users.find((u) => u.uid === msg.senderId);
                    const senderName =
                      msg.senderId === "system_talko_destek" || msg.senderId === "system_talko_ai"
                        ? "Talko Sistem"
                        : sender
                          ? (sender.username || sender.displayName || "Kullanıcı")
                          : "Bilinmeyen Kullanıcı";
                    const isSystem = msg.senderId === "system_talko_destek" || msg.senderId === "system_talko_ai";

                    return (
                      <div
                        key={msg.id}
                        className="p-3 bg-slate-900/60 border border-slate-800/60 rounded-xl max-w-full flex gap-3"
                      >
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
                          {isSystem ? (
                            <img
                              src={TALKO_LOGO_DATA_URL}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : sender?.photoURL ? (
                            <img
                              src={sender.photoURL}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                              {(senderName || "U").substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={cn(
                                "font-bold text-xs text-slate-200",
                                isSystem && "text-blue-400",
                              )}
                            >
                              {senderName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {safeFormatDate(msg.timestamp, "dd/MM/yyyy HH:mm:ss")}
                            </span>
                          </div>
                          {msg.imageUrl && (
                            <img
                              src={msg.imageUrl}
                              alt="Shared"
                              className="max-h-40 rounded-lg mb-2 object-cover border border-slate-800"
                            />
                          )}
                          {msg.text && (
                            <p className="text-sm text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                              {msg.text}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    Bu sohbette henüz mesaj bulunmuyor.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <div className="w-16 h-16 bg-slate-900 border border-slate-800 text-slate-600 rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare size={28} />
              </div>
              <h3 className="font-semibold text-slate-400 mb-1">
                Sohbet Seçilmedi
              </h3>
              <p className="text-xs max-w-xs leading-relaxed text-slate-500">
                Sol listeden gözlemlemek istediğiniz sohbet odasını seçerek tüm
                mesaj geçmişini inceleyebilirsiniz.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
