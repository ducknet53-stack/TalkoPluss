export interface User {
  uid: string;
  username: string;
  usernameLower: string;
  email: string;
  photoURL: string | null;
  about: string;
  isOnline: boolean;
  lastSeen: number;
  createdAt: number;
  isBanned?: boolean;
  bannedAt?: number;
  isVerified?: boolean;
  isAdmin?: boolean;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | null;
  blueTickStatus?: 'pending' | 'approved' | 'rejected' | null;
  blockedUsers?: string[];
}

export interface Chat {
  id: string;
  participants: string[];
  participantDetails: Record<string, { username: string; photoURL: string | null }>;
  lastMessage: string | null;
  lastMessageTimestamp: number | null;
  updatedAt: number;
  // Group properties
  isGroup?: boolean;
  groupName?: string;
  groupDescription?: string;
  groupEmoji?: string;
  createdBy?: string;
  lastRead?: Record<string, number>;
  unreadCount?: Record<string, number>;
}

export interface PollOption {
  id: string;
  text: string;
  voters: string[];
}

export interface Message {
  id: string;
  senderId: string;
  text: string | null;
  imageUrl: string | null;
  timestamp: number;
  type?: 'text' | 'poll';
  pollQuestion?: string;
  pollOptions?: PollOption[];
}

export interface TypingStatus {
  isTyping: boolean;
  timestamp: number;
}

export interface Story {
  id: string;
  userId: string;
  username: string;
  userPhotoURL: string | null;
  imageUrl: string;
  text: string | null;
  textColor: string;
  textStyle: string;
  createdAt: number;
  expiresAt: number;
}

