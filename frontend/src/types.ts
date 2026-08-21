export type GenderType = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type StudyMode = 'pomodoro' | 'silent' | 'discussion' | 'casual';

export type NetworkQuality = 'excellent' | 'good' | 'poor' | 'unknown';

export interface UserProfile {
  id: string;
  displayName: string;
  gender: GenderType;
  major: string;
  interest: string;
  currentGoal: string;
  studyMode: StudyMode;
  subjectTopic?: string;
  roomCode?: string;
  avatarColor: string;
  avatarIcon: string;
}

export interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export interface UserStreakStats {
  totalMinutes: number;
  totalSessions: number;
  currentStreak: number;
  lastStudyDate: string; // YYYY-MM-DD
  unlockedBadges?: string[];
}


export interface WhiteboardDrawPoint {
  x: number;
  y: number;
  color: string;
  size: number;
  isDrawing: boolean;
  clearAll?: boolean;
}

export interface PomodoroState {
  mode: 'focus' | 'short_break' | 'long_break';
  duration: number; // in seconds
  timeLeft: number; // in seconds
  isRunning: boolean;
  lastUpdated: number;
  sessionsCompleted: number;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  addedBy: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  type?: 'chat' | 'system' | 'goal_completed' | 'reaction';
}

export interface MediaState {
  videoEnabled: boolean;
  audioEnabled: boolean;
  screenSharing: boolean;
  partnerVideoEnabled: boolean;
  partnerAudioEnabled: boolean;
  partnerScreenSharing: boolean;
}

export interface RoomSessionData {
  roomId: string;
  isInitiator: boolean;
  isDemoBot?: boolean;
  partner: UserProfile;
  pomodoro: PomodoroState;
  scratchpad: string;
  todos: TodoItem[];
}

export interface GlobalStats {
  onlineUsers: number;
  queueCount: number;
  activeRoomsCount: number;
  totalMatchesCount: number;
  totalStudyMinutesCount?: number;
}

export interface StudyReaction {
  reaction: string;
  userName: string;
  timestamp: number;
}
