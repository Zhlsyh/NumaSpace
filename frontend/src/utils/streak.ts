import { UserStreakStats, BadgeItem } from '../types';

const STREAK_KEY = 'numaspace_user_streak_stats';

export const ALL_BADGES: Omit<BadgeItem, 'unlocked'>[] = [
  { id: 'first_step', name: 'Langkah Pertama', description: 'Selesaikan sesi belajar pertama Anda', icon: '' },
  { id: 'focus_master', name: 'Focus Master 60m', description: 'Akumulasi waktu belajar mencapai 60 menit', icon: '' },
  { id: 'marathoner', name: 'Marathoner 250m', description: 'Akumulasi waktu belajar mencapai 250+ menit', icon: '' },
  { id: 'night_owl', name: 'Night Owl', description: 'Belajar di atas pukul 21:00 malam', icon: '' },
  { id: 'streak_legend', name: 'Streak Legend 3D', description: 'Pertahankan streak belajar berturut-turut 3 hari', icon: '' },
  { id: 'polymath', name: 'Polymath 5 Sesi', description: 'Menyelesaikan total 5 sesi belajar virtual', icon: '' },
];


export function calculateUnlockedBadges(stats: UserStreakStats): BadgeItem[] {
  const currentHour = new Date().getHours();
  const unlockedSet = new Set<string>(stats.unlockedBadges || []);

  if (stats.totalSessions >= 1) unlockedSet.add('first_step');
  if (stats.totalMinutes >= 60) unlockedSet.add('focus_master');
  if (stats.totalMinutes >= 250) unlockedSet.add('marathoner');
  if (currentHour >= 21 || currentHour < 4) unlockedSet.add('night_owl');
  if (stats.currentStreak >= 3) unlockedSet.add('streak_legend');
  if (stats.totalSessions >= 5) unlockedSet.add('polymath');

  return ALL_BADGES.map((b) => ({
    ...b,
    unlocked: unlockedSet.has(b.id),
  }));
}

export function getUserStreakStats(): UserStreakStats {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        totalMinutes: parsed.totalMinutes || 0,
        totalSessions: parsed.totalSessions || 0,
        currentStreak: parsed.currentStreak || 1,
        lastStudyDate: parsed.lastStudyDate || new Date().toISOString().split('T')[0],
        unlockedBadges: parsed.unlockedBadges || ['first_step'],
      };
    }
  } catch (e) {
    console.warn('Failed to parse streak stats from localStorage:', e);
  }

  return {
    totalMinutes: 0,
    totalSessions: 0,
    currentStreak: 1,
    lastStudyDate: new Date().toISOString().split('T')[0],
    unlockedBadges: ['first_step'],
  };
}

export function recordCompletedSession(focusMinutes: number): UserStreakStats {
  const current = getUserStreakStats();
  const today = new Date().toISOString().split('T')[0];

  let newStreak = current.currentStreak;

  if (current.lastStudyDate) {
    const lastDate = new Date(current.lastStudyDate);
    const currentDate = new Date(today);
    const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  const updatedMinutes = (current.totalMinutes || 0) + Math.max(1, focusMinutes);
  const updatedSessions = (current.totalSessions || 0) + 1;

  const tempStats: UserStreakStats = {
    totalMinutes: updatedMinutes,
    totalSessions: updatedSessions,
    currentStreak: newStreak,
    lastStudyDate: today,
    unlockedBadges: current.unlockedBadges || [],
  };

  const badgeObjs = calculateUnlockedBadges(tempStats);
  const unlockedIds = badgeObjs.filter((b) => b.unlocked).map((b) => b.id);

  const updated: UserStreakStats = {
    ...tempStats,
    unlockedBadges: unlockedIds,
  };

  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save streak stats to localStorage:', e);
  }

  return updated;
}

export function requestBrowserNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

export function sendBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    } catch {
      // ignore
    }
  }
}

