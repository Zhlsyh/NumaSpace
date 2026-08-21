export interface QueueUser {
  socketId: string;
  user: {
    id: string;
    displayName: string;
    gender: string;
    major: string;
    interest: string;
    currentGoal: string;
    studyMode: string;
    subjectTopic?: string;
    roomCode?: string;
    avatarColor: string;
    avatarIcon: string;
  };
  joinedAt: number;
}

export interface PomodoroState {
  mode: "focus" | "short_break" | "long_break";
  duration: number;
  timeLeft: number;
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

export interface RoomSession {
  roomId: string;
  users: {
    [socketId: string]: QueueUser["user"];
  };
  pomodoro: PomodoroState;
  scratchpad: string;
  todos: TodoItem[];
  createdAt: number;
}

export interface DemoPartner {
  id: string;
  displayName: string;
  gender: string;
  major: string;
  interest: string;
  currentGoal: string;
  studyMode: string;
  avatarColor: string;
  avatarIcon: string;
}
