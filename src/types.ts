export interface NotificationSettings {
  messages: boolean;
  groups: boolean;
  events: boolean;
}

export interface User {
  uid: string;
  username: string;
  usernameLower: string;
  userHandle?: string;
  userHandleLower?: string;
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
  notificationSettings?: NotificationSettings;
}

export interface EventState {
  isActive: boolean;
  stage?: 'initiating' | 'quiz' | 'transitioning' | 'number' | 'finished';
  yesVotes?: string[];
  question?: string;
  answer?: string;
  targetNumber?: number;
  winnerId?: string;
  lastEndTime?: number;
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
  lastDelivered?: Record<string, number>;
  unreadCount?: Record<string, number>;
  eventState?: EventState;
  awaitingOtherAccount?: boolean;
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
  type?: 'text' | 'poll' | 'event';
  pollQuestion?: string;
  pollOptions?: PollOption[];
  eventData?: any;
  status?: 'pending' | 'failed' | 'success' | 'blocked' | 'error';
  isFailed?: boolean;
  originalText?: string;
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
  thumbnailUrl?: string;
  text: string | null;
  textColor: string;
  textStyle: string;
  createdAt: number;
  expiresAt: number;
}

