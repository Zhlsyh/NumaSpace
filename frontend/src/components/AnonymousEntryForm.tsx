import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile, GenderType, StudyMode, GlobalStats, UserStreakStats } from '../types';
import { NumaLogo } from './NumaLogo';
import { DeviceCheckModal } from './DeviceCheckModal';
import { getUserStreakStats, requestBrowserNotificationPermission, calculateUnlockedBadges, getCurrentWeekStudyDays } from '../utils/streak';
import {
  Users,
  Shuffle,
  Zap,
  Video,
  Target,
  Flame,
  Lock,
  ArrowRight,
  Trophy,
  Award,
  Key,
  Clock,
  VolumeX,
  MessageSquare,
  Headphones,
  Check,
  CheckCircle2,
  Calendar,
  BookOpen,
  ChevronDown
} from 'lucide-react';

interface Props {
  onStartMatching: (profile: UserProfile) => void;
  onStartInstantDemo: (profile: UserProfile) => void;
  stats: GlobalStats;
}

const POPULAR_MAJORS = [
  'Teknik Elektro',
  'Teknik Informatika',
  'Kedokteran',
  'Manajemen Bisnis',
  'Desain Komunikasi Visual',
  'Hukum & HI',
  'Farmasi',
  'Psikologi',
];

const POPULAR_INTERESTS = [
  { label: 'Mikrokontroler & IoT', bg: 'bg-[#E7F8FC]', text: 'text-[#003D30]', border: 'border-[#32BFDB]' },
  { label: 'Algoritma & Coding', bg: 'bg-[#E6F5F1]', text: 'text-[#003D30]', border: 'border-[#00785D]' },
  { label: 'Calculus & Matematika', bg: 'bg-[#FFF8E6]', text: 'text-[#5A3C00]', border: 'border-[#FDC323]' },
  { label: 'IELTS / TOEFL Prep', bg: 'bg-[#EDF5F7]', text: 'text-[#0F1E1C]', border: 'border-[#539BA9]' },
  { label: 'UI/UX & Desain', bg: 'bg-[#EDF5F7]', text: 'text-[#0F1E1C]', border: 'border-[#539BA9]' },
  { label: 'Anatomi & Medis', bg: 'bg-[#E7F8FC]', text: 'text-[#003D30]', border: 'border-[#32BFDB]' },
];

const AVATAR_COLORS = [
  'from-[#FDC323] to-[#EBB215]',
  'from-[#00785D] to-[#005A46]',
  'from-[#32BFDB] to-[#21ADC9]',
  'from-[#539BA9] to-[#00785D]',
  'from-[#FDC323] to-[#32BFDB]',
];

const RANDOM_NAMES = [
  'Mahasiswa Rajin',
  'Pejuang Skripsi',
  'Fokus Belajar',
  'Sobat Koding',
  'Kutu Buku Positif',
  'Pembelajar Gigih',
  'Night Owl Cerdas',
  'Kandidat Juara',
];

function createPrivateRoomCode() {
  const bytes = new Uint8Array(8);
  window.crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `STUDY-${code}`;
}

export const AnonymousEntryForm: React.FC<Props> = ({ onStartMatching, onStartInstantDemo, stats }) => {
  const [displayName, setDisplayName] = useState(
    () => RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]
  );
  const [gender, setGender] = useState<GenderType>('prefer_not_to_say');
  const [major, setMajor] = useState('');
  const [interest, setInterest] = useState('');
  const [currentGoal, setCurrentGoal] = useState('');
  const [studyMode, setStudyMode] = useState<StudyMode>('pomodoro');
  const [isPrivateRoom, setIsPrivateRoom] = useState<boolean>(false);
  const [showDeviceCheck, setShowDeviceCheck] = useState(false);
  const [roomCode, setRoomCode] = useState<string>(createPrivateRoomCode);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [streakStats, setStreakStats] = useState<UserStreakStats>({
    totalMinutes: 0,
    totalSessions: 0,
    currentStreak: 0,
    lastStudyDate: '',
    studyDates: [],
  });

  useEffect(() => {
    setStreakStats(getUserStreakStats());
  }, []);

  const generateRandomName = () => {
    const random = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setDisplayName(`${random} #${Math.floor(100 + Math.random() * 900)}`);
  };

  const generateRandomRoomCode = () => {
    setRoomCode(createPrivateRoomCode());
  };

  const getProfile = (): UserProfile => ({
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    displayName: displayName.trim() || 'Mahasiswa Anonim',
    gender,
    major: major.trim() || 'Umum',
    interest: interest.trim() || 'Belajar Mandiri',
    currentGoal: currentGoal.trim() || 'Fokus Sesi Ini',
    studyMode,
    subjectTopic: interest.trim() || 'Umum',
    roomCode: isPrivateRoom ? roomCode.trim().toUpperCase() : undefined,
    avatarColor,
    avatarIcon: 'graduation-cap',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestBrowserNotificationPermission();
    onStartMatching(getProfile());
  };

  const handleInstantDemo = () => {
    requestBrowserNotificationPermission();
    onStartInstantDemo(getProfile());
  };

  const unlockedBadges = calculateUnlockedBadges(streakStats).filter((b) => b.unlocked);
  const studyDays = getCurrentWeekStudyDays(streakStats.studyDates || []);
  const activeDaysThisWeek = studyDays.filter((day) => day.studied).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen p-3 sm:p-5 lg:p-7 font-sans flex flex-col justify-between overflow-x-hidden text-[#0F1E1C] relative"
    >
      {/* 1. Header Navigation Bar (Clean Flat Style) */}
      <nav className="flex justify-between items-center mb-3 sm:mb-5 max-w-6xl mx-auto w-full">
        <NumaLogo size="md" theme="dark" />

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Online badge */}
          <div className="bg-white text-[#0F1E1C] px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-black border border-[#D2E4E8] shadow-xs flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00785D] animate-pulse"></span>
            <span>{stats.onlineUsers} online</span>
          </div>

          {/* Sesi Berhasil Badge in Dark Charcoal & Lime Pill */}
          {stats.totalMatchesCount > 0 && (
            <div className="hidden sm:flex bg-[#0F1E1C] text-[#FDC323] px-3.5 py-2 rounded-full text-xs font-black items-center gap-2 shadow-xs border border-[#0F1E1C]">
              <Flame className="w-3.5 h-3.5 text-[#FDC323] fill-[#FDC323]" />
              <AnimatePresence mode="wait">
                <motion.span
                  key={stats.totalMatchesCount}
                  initial={{ opacity: 0, y: -4, scale: 1.2 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.25 }}
                  className="font-black font-mono text-xs sm:text-sm text-white"
                >
                  {stats.totalMatchesCount}
                </motion.span>
              </AnimatePresence>
              <span className="text-[#539BA9]">Sesi Selesai</span>
            </div>
          )}
        </div>
      </nav>

      {/* 2. Main Canvas Grid (Left: Setup Form, Right: Habit & Goal Dashboard) */}
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 my-auto items-start"
      >
        {/* Left Side: Form Container (7 Cols on Desktop) */}
        <div className="lg:col-span-7 bg-white rounded-lg p-4 sm:p-6 lg:p-7 border border-[#D2E4E8] shadow-sm flex flex-col justify-between">
          <div className="mb-3 sm:mb-4">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#0F1E1C]">
              Temukan Teman <span className="bg-[#FDC323] px-2 py-0.5 rounded-xl border border-[#0F1E1C]/15 inline-block -rotate-1">Fokus Belajar</span>
            </h1>
          </div>

          <form id="entry-form" onSubmit={handleSubmit} className="space-y-3.5">
            {/* Mode Switcher: Segmented Pill like the reference [Daily Task | Project] */}
            <div className="bg-[#EDF5F7] p-1 rounded-full flex border border-[#D2E4E8]">
              <button
                type="button"
                onClick={() => setIsPrivateRoom(false)}
                className={`flex-1 py-2 sm:py-2.5 rounded-full text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  !isPrivateRoom 
                    ? 'bg-[#0F1E1C] text-white shadow-sm' 
                    : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Publik</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPrivateRoom(true)}
                className={`flex-1 py-2 sm:py-2.5 rounded-full text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isPrivateRoom 
                    ? 'bg-[#0F1E1C] text-white shadow-sm' 
                    : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Ruang Privat</span>
              </button>
            </div>

            {/* If Private Room is selected */}
            {isPrivateRoom && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3.5 bg-[#E7F8FC] border-2 border-[#99DDE9] rounded-2xl space-y-2"
              >
                <div className="flex justify-between items-center ml-1">
                  <label htmlFor="input-roomCode" className="text-[11px] font-black uppercase tracking-wider text-[#0F1E1C] flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-[#00785D]" />
                    <span>Kode Ruang</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomRoomCode}
                    className="text-[11px] font-bold text-[#00664F] hover:text-[#0F1E1C] flex items-center gap-1 cursor-pointer"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Acak Kode</span>
                  </button>
                </div>
                <input
                  id="input-roomCode"
                  type="text"
                  required={isPrivateRoom}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="STUDY-XXXXXXXXXXXXXXXX"
                  className="w-full py-2.5 px-4 rounded-xl bg-white border-2 border-[#0F1E1C] focus:ring-2 focus:ring-[#FDC323] outline-none font-mono font-black text-[#0F1E1C] text-sm uppercase tracking-wider shadow-inner"
                />
                <p className="text-[11px] font-medium text-[#3A6B6A] leading-tight">
                  Bagikan kode ini agar teman Anda dapat bergabung.
                </p>
              </motion.div>
            )}

            {/* 1. Alias / Display Name & Avatar */}
            <div>
              <div className="flex justify-between items-center mb-1 ml-1">
                <label htmlFor="input-displayName" className="text-[11px] font-black uppercase tracking-widest text-[#4A7A79]">
                  Nama Panggilan
                </label>
                <button
                  type="button"
                  onClick={generateRandomName}
                  className="text-xs font-bold text-[#00664F] hover:text-[#0F1E1C] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Shuffle className="w-3 h-3" />
                  <span>Acak Nama</span>
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="input-displayName"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nama samaran"
                  className="flex-1 py-2.5 sm:py-3 px-4 rounded-2xl bg-[#F4F8F9] border-2 border-[#D2E4E8] focus:border-[#0F1E1C] focus:bg-white outline-none transition-all font-bold text-[#0F1E1C] text-sm"
                />
                {/* Avatar Color Swatches */}
                <div className="flex items-center justify-center gap-1.5 bg-[#EDF5F7] py-1.5 px-3 rounded-2xl border border-[#D2E4E8]">
                  {AVATAR_COLORS.map((col, idx) => (
                    <motion.button
                      key={idx}
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setAvatarColor(col)}
                      className={`w-6 h-6 rounded-full bg-gradient-to-br ${col} transition-all cursor-pointer ${
                        avatarColor === col ? 'ring-2 ring-[#0F1E1C] scale-110' : 'opacity-60 hover:opacity-100'
                      }`}
                      title="Pilih Avatar"
                    />
                  ))}
                </div>
              </div>
            </div>

            <details className="group rounded-xl border border-[#D2E4E8] bg-[#F4F8F9]">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-bold text-[#1D4D4A]">
                <span>Preferensi profil <span className="font-medium text-[#4A7A79]">(opsional)</span></span>
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-[#D2E4E8] p-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-[#4A7A79] mb-1.5 ml-1">
                    Identitas Gender
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 'male', label: 'Laki-laki' },
                      { val: 'female', label: 'Perempuan' },
                      { val: 'prefer_not_to_say', label: 'Rahasiakan' },
                    ].map((item) => (
                      <motion.button
                        key={item.val}
                        id={`btn-gender-${item.val}`}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setGender(item.val as GenderType)}
                        className={`py-2 px-2 rounded-2xl border-2 font-black text-xs text-center transition-all cursor-pointer ${
                          gender === item.val
                            ? 'border-[#0F1E1C] bg-[#FDC323] text-[#0F1E1C] shadow-xs'
                            : 'border-[#D2E4E8] hover:border-[#0F1E1C]/30 text-[#3A6B6A] bg-white'
                        }`}
                      >
                        {item.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="input-major" className="block text-[11px] font-black uppercase tracking-widest text-[#4A7A79] mb-1 ml-1">
                    Jurusan / Bidang Studi
                  </label>
                  <input
                    id="input-major"
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="Contoh: Teknik Elektro"
                    className="w-full py-2.5 px-4 rounded-2xl bg-white border-2 border-[#D2E4E8] focus:border-[#0F1E1C] outline-none transition-all font-bold text-[#0F1E1C] text-sm mb-2"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_MAJORS.slice(0, 5).map((popularMajor) => (
                      <motion.button
                        key={popularMajor}
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setMajor(popularMajor)}
                        className={`text-[11px] px-3 py-1 rounded-full font-bold border transition-all cursor-pointer ${
                          major === popularMajor
                            ? 'bg-[#0F1E1C] text-white border-[#0F1E1C]'
                            : 'bg-[#EDF5F7] text-[#1D4D4A] border-[#D2E4E8] hover:border-[#0F1E1C]'
                        }`}
                      >
                        {popularMajor}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </details>

            {/* 4. Minat / Interest */}
            <div>
              <label htmlFor="input-interest" className="block text-[11px] font-black uppercase tracking-widest text-[#4A7A79] mb-1 ml-1">
                Topik Belajar Utama <span className="font-semibold tracking-normal normal-case">(opsional)</span>
              </label>
              <input
                id="input-interest"
                type="text"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                placeholder="Pilih topik atau ketik sendiri"
                className="w-full py-2.5 px-4 rounded-2xl bg-[#F4F8F9] border-2 border-[#D2E4E8] focus:border-[#0F1E1C] focus:bg-white outline-none transition-all font-bold text-[#0F1E1C] text-sm mb-2"
              />
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_INTERESTS.map((item) => (
                  <motion.button
                    key={item.label}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setInterest(item.label)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-all ${
                      item.bg
                    } ${item.text} ${item.border} ${
                      interest === item.label ? 'ring-2 ring-[#0F1E1C] scale-105 font-black' : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    {item.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* 5. Target Sesi (Goal) */}
            <div>
              <label htmlFor="input-currentGoal" className="block text-[11px] font-black uppercase tracking-widest text-[#4A7A79] mb-1 ml-1">
                Target Fokus Sesi Ini <span className="font-semibold tracking-normal normal-case">(opsional)</span>
              </label>
              <div className="relative">
                <input
                  id="input-currentGoal"
                  type="text"
                  value={currentGoal}
                  onChange={(e) => setCurrentGoal(e.target.value)}
                  placeholder="Apa target fokus sesi ini?"
                  className="w-full py-2.5 pl-10 pr-4 rounded-2xl bg-[#F4F8F9] border-2 border-[#D2E4E8] focus:border-[#0F1E1C] focus:bg-white outline-none transition-all font-bold text-[#0F1E1C] text-sm"
                />
                <Target className="w-4 h-4 text-[#00785D] absolute left-3.5 top-3" />
              </div>
            </div>

            {/* 6. Mode Belajar Preference (Clean Cards) */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-[#4A7A79] mb-1.5 ml-1">
                Mode Belajar
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'pomodoro', label: 'Pomodoro Focus', desc: '25m Fokus + 5m Rehat', icon: Clock },
                  { id: 'silent', label: 'Silent Study', desc: 'Kamera opsional, mic mute', icon: VolumeX },
                  { id: 'discussion', label: 'Diskusi Aktif', desc: 'Tanya jawab bareng', icon: MessageSquare },
                  { id: 'casual', label: 'Santai / Casual', desc: 'Fleksibel & Lo-Fi', icon: Headphones },
                ].map((mode) => {
                  const ModeIcon = mode.icon;
                  const isSelected = studyMode === mode.id;
                  return (
                    <motion.button
                      key={mode.id}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setStudyMode(mode.id as StudyMode)}
                      className={`p-2.5 rounded-2xl text-left border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#0F1E1C] bg-[#FDC323] text-[#0F1E1C] shadow-xs'
                          : 'border-[#D2E4E8] bg-[#F4F8F9] text-[#1D4D4A] hover:border-[#0F1E1C]/30'
                      }`}
                    >
                      <div className="text-xs font-black flex items-center gap-1.5">
                        <ModeIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#0F1E1C]' : 'text-[#00785D]'} shrink-0`} />
                        <span>{mode.label}</span>
                      </div>
                      <div className={`text-[10px] font-semibold truncate mt-0.5 ${isSelected ? 'text-[#0F1E1C]/80' : 'text-[#4A7A79]'}`}>
                        {mode.desc}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

          </form>
        </div>

        {/* Right Side: Habit & Goal Dashboard (5 Cols on Desktop, Matching Reference Style) */}
        <div className="lg:col-span-5 flex flex-col gap-3.5 sm:gap-4">
          
          {/* A. Dark Charcoal "Daily Goal" Card (Directly inspired by reference card) */}
          <div className="bg-[#0F1E1C] rounded-lg p-5 sm:p-6 text-white shadow-md relative overflow-hidden border border-[#0F1E1C]">
            <div className="flex justify-between items-center mb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#539BA9] block">
                  Aktivitas Minggu Ini
                </span>
                <h3 className="font-display text-lg font-semibold text-white flex items-center gap-1.5">
                  Hari Belajar
                  <span className="w-2 h-2 rounded-full bg-[#FDC323]"></span>
                </h3>
              </div>
              <div className="w-7 h-7 rounded-full bg-[#172B28] flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-[#32BFDB]" />
              </div>
            </div>

            {/* Weekday Circles (Mon to Sun with checkmark pills from reference) */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center pt-1">
              {studyDays.map((day) => (
                <div key={day.short} className="flex flex-col items-center gap-1" title={`${day.short} ${day.dateNumber}: ${day.studied ? 'sesi selesai' : 'belum ada sesi'}`}>
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      day.studied
                        ? 'bg-[#FDC323] text-[#0F1E1C] shadow-xs'
                        : day.isToday
                          ? 'bg-[#32BFDB] text-[#0F1E1C] ring-2 ring-white/70'
                          : 'bg-[#172B28] text-[#539BA9]'
                    }`}
                  >
                    {day.studied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : day.dateNumber}
                  </div>
                  <span className="text-[9px] font-bold text-[#539BA9] uppercase">
                    {day.short}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* B. Two Side-by-Side Cards: Habit & Streak Days (From reference) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Habit Card (Cream/Matcha) */}
            <div className="bg-[#E6F5F1] border-2 border-[#D2E4E8] rounded-3xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#1D4D4A]">
                  Hari Aktif
                </span>
                <span className="w-2 h-2 rounded-full bg-[#00785D]"></span>
              </div>

              {/* Graphic icon */}
              <div className="my-2 flex items-center justify-center gap-2">
                <BookOpen className="w-5 h-5 text-[#00785D]" />
                <span className="text-3xl font-black font-mono text-[#0F1E1C]">{activeDaysThisWeek}</span>
              </div>

              <div className="text-center">
                <span className="text-xs font-black text-[#0F1E1C] block">Hari belajar</span>
                <span className="text-[10px] font-medium text-[#3A6B6A]">Minggu ini</span>
              </div>
            </div>

            {/* Streak Card (Dark Charcoal with Flame) */}
            <div className="bg-[#0F1E1C] border-2 border-[#0F1E1C] rounded-3xl p-4 flex flex-col justify-between text-white shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-[#FDC323] font-mono leading-none">
                  {streakStats.currentStreak}
                </span>
                <div className="px-2 py-0.5 rounded-full bg-[#172B28] text-[9px] font-black text-[#FDC323]">
                  Hari
                </div>
              </div>

              <div className="my-1 flex items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-[#172B28] flex items-center justify-center">
                  <Flame className="w-7 h-7 text-[#FDC323] fill-[#FDC323] animate-bounce" />
                </div>
              </div>

              <div>
                <span className="text-xs font-black text-white block">Streak Belajar</span>
                <span className="text-[10px] font-medium text-[#539BA9]">Hari beruntun</span>
              </div>
            </div>
          </div>

          {/* C. Primary Action Button: Chunky High-Contrast Pill (From Reference "TODU Lets Start" and "+") */}
          <button
            type="button"
            onClick={() => setShowDeviceCheck(true)}
            className="mb-2 inline-flex items-center gap-2 self-end rounded-md px-2 py-1.5 text-xs font-semibold text-[#00664F] hover:bg-[#E6F5F1]"
          >
            <Video className="h-4 w-4" />
            Cek kamera & mikrofon
          </button>
          <div className="space-y-2 mt-1">
            <motion.button
              id="btn-start-matching"
              form="entry-form"
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 px-6 rounded-full bg-brand-primary hover:bg-brand-primary-hover text-white font-black text-base sm:text-lg border-2 border-brand-primary-hover shadow-[0_4px_0_#005A46] active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5 text-white" />
              <span>Cari Partner</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </motion.button>

            {/* Secondary Instant Bot Button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleInstantDemo}
              className="w-full py-3 px-5 rounded-full bg-brand-secondary-light hover:bg-[#D4F3F8] text-[#0F1E1C] font-black text-xs sm:text-sm border-2 border-brand-secondary shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-[#00785D] fill-[#00785D]" />
              <span>Coba Demo</span>
            </motion.button>
          </div>

          {/* D. Stats Overview Card (Finished / Doing / Time) */}
          <div className="bg-white rounded-3xl p-4 border-2 border-[#D2E4E8] shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#4A7A79] flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#00785D]" />
                <span>Statistik</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2.5 rounded-2xl bg-[#F4F8F9] border border-[#D2E4E8]">
                <span className="text-[10px] font-bold text-[#4A7A79] uppercase block">Total Fokus</span>
                <span className="text-base font-black text-[#0F1E1C] font-mono">
                  {streakStats.totalMinutes} <span className="text-[10px] font-semibold text-[#4A7A79]">Menit</span>
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-[#F4F8F9] border border-[#D2E4E8]">
                <span className="text-[10px] font-bold text-[#4A7A79] uppercase block">Total Sesi</span>
                <span className="text-base font-black text-[#0F1E1C] font-mono">
                  {streakStats.totalSessions} <span className="text-[10px] font-semibold text-[#4A7A79]">Sesi</span>
                </span>
              </div>
            </div>

            {/* Achievement Badges if unlocked */}
            {unlockedBadges.length > 0 && (
              <div className="pt-1 border-t border-[#EDF5F7]">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#4A7A79] block mb-1">
                  Pencapaian Terbuka ({unlockedBadges.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {unlockedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E7F8FC] border border-[#99DDE9] text-[#003D30] text-[10px] font-bold"
                      title={badge.description}
                    >
                      <Award className="w-3 h-3 text-[#00785D] shrink-0" />
                      <span>{badge.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </motion.div>

      {/* 3. Footer */}
      <footer className="mt-3 sm:mt-5 flex flex-col sm:flex-row justify-between items-center text-[#3A6B6A] px-3 text-[11px] font-medium gap-2 max-w-6xl mx-auto w-full">
        <p className="text-center sm:text-left font-semibold">&copy; Numa Space</p>
      </footer>

      {showDeviceCheck && <DeviceCheckModal onClose={() => setShowDeviceCheck(false)} />}
    </motion.div>
  );
};
