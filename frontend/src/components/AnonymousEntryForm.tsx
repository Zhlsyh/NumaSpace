import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile, GenderType, StudyMode, GlobalStats, UserStreakStats } from '../types';
import { NemuLogo } from './NemuLogo';
import { getUserStreakStats, requestBrowserNotificationPermission, calculateUnlockedBadges } from '../utils/streak';
import {
  Sparkles,
  Users,
  Shuffle,
  Zap,
  Target,
  Flame,
  Radio,
  Lock,
  ArrowRight,
  Trophy,
  Award,
  Key,
  Clock,
  VolumeX,
  MessageSquare,
  Headphones
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
  'Hukum & Hubungan Internasional',
  'Farmasi & Keperawatan',
  'Psikologi',
];

const POPULAR_INTERESTS = [
  { label: 'Mikrokontroler & IoT', color: 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200' },
  { label: 'Algoritma & Coding', color: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200' },
  { label: 'Calculus & Matematika', color: 'bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-200' },
  { label: 'IELTS / TOEFL Prep', color: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200' },
  { label: 'UI/UX & Desain', color: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200' },
  { label: 'Anatomi & Fisiologi', color: 'bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-200' },
];

const AVATAR_COLORS = [
  'from-indigo-600 to-blue-600',
  'from-amber-400 to-orange-500',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-purple-600 to-indigo-600',
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

export const AnonymousEntryForm: React.FC<Props> = ({ onStartMatching, onStartInstantDemo, stats }) => {
  const [displayName, setDisplayName] = useState(
    () => RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]
  );
  const [gender, setGender] = useState<GenderType>('male');
  const [major, setMajor] = useState('Teknik Elektro');
  const [interest, setInterest] = useState('Mikrokontroler & IoT');
  const [currentGoal, setCurrentGoal] = useState('Selesaikan Bab 3 & Simulasi Proteus');
  const [studyMode, setStudyMode] = useState<StudyMode>('pomodoro');
  const [subjectTopic] = useState<string>('Pemrograman & Coding');
  const [isPrivateRoom, setIsPrivateRoom] = useState<boolean>(false);
  const [roomCode, setRoomCode] = useState<string>('STUDY-778');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [streakStats, setStreakStats] = useState<UserStreakStats>({
    totalMinutes: 0,
    totalSessions: 0,
    currentStreak: 1,
    lastStudyDate: '',
  });

  useEffect(() => {
    setStreakStats(getUserStreakStats());
  }, []);

  const generateRandomName = () => {
    const random = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setDisplayName(`${random} #${Math.floor(100 + Math.random() * 900)}`);
  };

  const generateRandomRoomCode = () => {
    const code = `STUDY-${Math.floor(100 + Math.random() * 900)}`;
    setRoomCode(code);
  };

  const getProfile = (): UserProfile => ({
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    displayName: displayName.trim() || 'Mahasiswa Anonim',
    gender,
    major: major.trim() || 'Umum',
    interest: interest.trim() || 'Belajar Mandiri',
    currentGoal: currentGoal.trim() || 'Fokus Sesi Ini',
    studyMode,
    subjectTopic,
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-indigo-600 p-3 sm:p-6 md:p-8 lg:p-10 font-sans flex flex-col justify-between overflow-x-hidden text-slate-900"
    >
      {/* Top Navbar */}
      <nav className="flex justify-between items-center mb-4 sm:mb-6 md:mb-8 max-w-6xl mx-auto w-full">
        <NemuLogo size="md" />

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-indigo-500/30 text-indigo-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold backdrop-blur-md border border-indigo-400/20 flex items-center gap-1.5 sm:gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{stats.onlineUsers || 1} <span className="hidden sm:inline">Mahasiswa</span> Online</span>
          </div>
          <div className="hidden md:flex bg-indigo-500/30 text-indigo-100 px-4 py-2 rounded-full text-xs sm:text-sm font-bold backdrop-blur-md border border-indigo-400/20 items-center gap-1.5 shadow-sm">
            <Flame className="w-4 h-4 text-amber-300 animate-bounce" />
            <AnimatePresence mode="wait">
              <motion.span
                key={stats.totalMatchesCount}
                initial={{ opacity: 0, y: -4, scale: 1.25 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.3 }}
                className="font-black text-amber-300 font-mono text-sm"
              >
                {stats.totalMatchesCount || 142}
              </motion.span>
            </AnimatePresence>
            <span>Sesi Berhasil</span>
          </div>
        </div>
      </nav>

      {/* Main Chunky Card Container */}
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="max-w-6xl mx-auto w-full flex-1 bg-white rounded-[24px] sm:rounded-[40px] lg:rounded-[48px] shadow-2xl flex flex-col lg:flex-row overflow-hidden border-[6px] sm:border-[12px] lg:border-[16px] border-indigo-400/30"
      >
        {/* Left Side: Matchmaking Setup Form */}
        <div className="w-full lg:w-[500px] xl:w-[540px] p-4 sm:p-8 lg:p-12 flex flex-col justify-center">
          <div className="mb-4 sm:mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] sm:text-xs font-black uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Virtual Matchmaking</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight text-slate-900">
              Ready to focus <br />
              <span className="text-indigo-600">together?</span>
            </h1>
            <p className="text-slate-500 text-xs sm:text-base mt-1.5 sm:mt-2 font-medium">
              Tanpa akun. Tanpa ribet. Cukup 1 klik untuk menemukan teman belajar virtual Anda.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-5">
            {/* Matchmaking Mode Switcher: Public vs Private Room */}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setIsPrivateRoom(false)}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  !isPrivateRoom ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Publik (Matchmaking)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPrivateRoom(true)}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isPrivateRoom ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Private Room (Kode)</span>
              </button>
            </div>

            {/* If Private Room is selected */}
            {isPrivateRoom && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-indigo-50 border-2 border-indigo-200 rounded-2xl space-y-2"
              >
                <div className="flex justify-between items-center ml-1">
                  <label htmlFor="input-roomCode" className="block text-[11px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Kode Ruang Rahasia (Private Code)</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomRoomCode}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
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
                  placeholder="e.g. STUDY-123"
                  className="w-full py-2.5 px-4 rounded-xl bg-white border-2 border-indigo-300 focus:border-indigo-600 outline-none font-mono font-black text-indigo-950 text-base uppercase tracking-wider shadow-inner"
                />
                <p className="text-[11px] font-semibold text-indigo-600/90 leading-tight">
                  Bagikan kode unik ini ke teman Anda. Siapapun yang memasukkan kode yang sama akan otomatis terhubung!
                </p>
              </motion.div>
            )}

            {/* 1. Alias / Display Name */}
            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label htmlFor="input-displayName" className="block text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-400">
                  Nama Alias (Anonim)
                </label>
                <button
                  type="button"
                  onClick={generateRandomName}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
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
                  placeholder="e.g. Mahasiswa Rajin"
                  className="flex-1 py-2.5 sm:py-3 px-4 sm:px-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-900 text-sm sm:text-base"
                />
                {/* Avatar Color Swatches */}
                <div className="flex items-center justify-center gap-1.5 bg-slate-50 py-1.5 px-3 rounded-2xl border-2 border-slate-100">
                  {AVATAR_COLORS.map((col, idx) => (
                    <motion.button
                      key={idx}
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setAvatarColor(col)}
                      className={`w-6 h-6 rounded-full bg-gradient-to-br ${col} transition-all cursor-pointer ${
                        avatarColor === col ? 'ring-2 ring-indigo-600 scale-110' : 'opacity-60 hover:opacity-100'
                      }`}
                      title="Pilih Warna Avatar"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Gender Selection */}
            <div>
              <label className="block text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5 sm:mb-2 ml-1">
                Identitas Gender
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                {[
                  { val: 'male', label: 'Laki-laki' },
                  { val: 'female', label: 'Perempuan' },
                  { val: 'prefer_not_to_say', label: 'Rahasiakan' },
                ].map((item) => (
                  <motion.button
                    key={item.val}
                    id={`btn-gender-${item.val}`}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setGender(item.val as GenderType)}
                    className={`py-2 sm:py-3 px-1 sm:px-4 rounded-2xl border-2 font-bold text-xs sm:text-sm text-center transition-all cursor-pointer ${
                      gender === item.val
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                        : 'border-slate-100 hover:border-indigo-200 text-slate-600 bg-slate-50/50'
                    }`}
                  >
                    {item.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* 3. Major / Program Studi */}
            <div>
              <label htmlFor="input-major" className="block text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Jurusan / Program Studi
              </label>
              <input
                id="input-major"
                type="text"
                required
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="e.g. Teknik Elektro, Informatika"
                className="w-full py-2.5 sm:py-3 px-4 sm:px-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-900 text-sm sm:text-base mb-2"
              />
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_MAJORS.slice(0, 4).map((m) => (
                  <motion.button
                    key={m}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setMajor(m)}
                    className={`text-[10px] sm:text-[11px] px-2.5 sm:px-3 py-1 rounded-full font-bold border transition-all cursor-pointer ${
                      major === m
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {m}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* 4. Minat / Focus Topic */}
            <div>
              <label htmlFor="input-interest" className="block text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Topik Belajar Utama
              </label>
              <input
                id="input-interest"
                type="text"
                required
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                placeholder="e.g. Mikrokontroler & IoT, Algoritma"
                className="w-full py-2.5 sm:py-3 px-4 sm:px-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-900 text-sm sm:text-base mb-2"
              />
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {POPULAR_INTERESTS.map((item) => (
                  <motion.span
                    key={item.label}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setInterest(item.label)}
                    className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-black border-2 cursor-pointer transition-all active:scale-95 ${
                      item.color
                    } ${interest === item.label ? 'ring-2 ring-indigo-600 scale-105 shadow-sm' : ''}`}
                  >
                    {item.label}
                  </motion.span>
                ))}
              </div>
            </div>

            {/* 5. Target Sesi Ini */}
            <div>
              <label htmlFor="input-currentGoal" className="block text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Target Sesi Belajar Ini (Goal)
              </label>
              <div className="relative">
                <input
                  id="input-currentGoal"
                  type="text"
                  required
                  value={currentGoal}
                  onChange={(e) => setCurrentGoal(e.target.value)}
                  placeholder="e.g. Selesaikan Bab 3 & Latihan Soal"
                  className="w-full py-2.5 sm:py-3 pl-10 sm:pl-11 pr-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-900 text-xs sm:text-base"
                />
                <Target className="w-4 h-4 text-indigo-500 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* 6. Mode Belajar Preference (No Unicode Emojis) */}
            <div>
              <label className="block text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                Mode Belajar
              </label>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {[
                  { id: 'pomodoro', label: 'Pomodoro Focus', desc: '25m Fokus + 5m Rehat', icon: Clock },
                  { id: 'silent', label: 'Silent Study', desc: 'Kamera On, Mic Mute', icon: VolumeX },
                  { id: 'discussion', label: 'Diskusi Aktif', desc: 'Tanya jawab bareng', icon: MessageSquare },
                  { id: 'casual', label: 'Santai / Casual', desc: 'Fleksibel & Lo-Fi', icon: Headphones },
                ].map((mode) => {
                  const ModeIcon = mode.icon;
                  return (
                    <motion.button
                      key={mode.id}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setStudyMode(mode.id as StudyMode)}
                      className={`p-2 sm:p-2.5 rounded-2xl text-left border-2 transition-all cursor-pointer ${
                        studyMode === mode.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                          : 'border-slate-100 bg-slate-50/60 text-slate-600 hover:border-indigo-200'
                      }`}
                    >
                      <div className="text-[11px] sm:text-xs font-black flex items-center gap-1.5">
                        <ModeIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{mode.label}</span>
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-medium text-slate-500 truncate mt-0.5">{mode.desc}</div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Primary Action Button */}
            <motion.button
              id="btn-start-matching"
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className="w-full py-3.5 sm:py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl sm:rounded-3xl text-base sm:text-xl font-black shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] transition-all mt-2 cursor-pointer flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Cari Partner Sekarang</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>

            {/* Instant Demo Shortcut */}
            <div className="flex items-center justify-between text-[11px] sm:text-xs pt-1 px-1">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                Stateless & Aman
              </span>
              <button
                type="button"
                onClick={handleInstantDemo}
                className="font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Uji Coba Demo Instan</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Social Proof Top & Statistics Pinned to Bottom Right */}
        <div className="flex-1 bg-indigo-50/60 p-5 sm:p-8 flex flex-col justify-between relative min-h-[500px] lg:min-h-[600px] border-t lg:border-t-0 lg:border-l border-indigo-100">
          {/* Top Section: Central P2P Sphere & Social Proof Stream */}
          <div className="flex flex-col items-center justify-center my-auto space-y-4">
            <div className="relative w-36 h-36 sm:w-48 sm:h-48">
              <div className="absolute inset-0 bg-amber-400 rounded-full blur-3xl opacity-25 animate-pulse"></div>
              <motion.div
                whileHover={{ scale: 1.03 }}
                className="relative w-full h-full bg-white rounded-full border-[6px] sm:border-[10px] border-white shadow-xl overflow-hidden flex flex-col items-center justify-center text-center p-3"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-100 rounded-full mb-1.5 flex items-center justify-center shadow-inner">
                  <Radio className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600 animate-pulse" />
                </div>
                <h2 className="text-base sm:text-lg font-black text-indigo-900">Peer-to-Peer</h2>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500">Encrypted & Anonymous</p>
              </motion.div>
            </div>

            {/* Social Proof Stream Stack */}
            <div className="text-center w-full">
              <div className="flex -space-x-3 mb-1.5 justify-center">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white bg-indigo-500 shadow-md"></div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white bg-rose-500 shadow-md"></div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white bg-amber-400 shadow-md"></div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white bg-emerald-500 shadow-md flex items-center justify-center text-[10px] font-black text-white">
                  +{stats.onlineUsers || 42}
                </div>
              </div>
              <p className="text-indigo-950 font-black text-[10px] tracking-widest uppercase">
                BELAJAR BERSAMA MAHASISWA SE-INDONESIA
              </p>
            </div>
          </div>

          {/* Bottom Right: Statistics & Achievements Card */}
          <div className="w-full bg-white rounded-3xl p-4 shadow-xl border-2 border-indigo-100 space-y-2.5 mt-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-black uppercase tracking-wider text-indigo-950">Statistik Belajar Anda</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>{streakStats.currentStreak} Hari Streak</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Waktu Fokus</span>
                <span className="text-base font-black text-indigo-950 font-mono">{streakStats.totalMinutes} <span className="text-[10px] font-normal text-slate-500">Menit</span></span>
              </div>
              <div className="p-2 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Total Sesi</span>
                <span className="text-base font-black text-emerald-950 font-mono">{streakStats.totalSessions} <span className="text-[10px] font-normal text-slate-500">Sesi</span></span>
              </div>
            </div>

            {/* Achievement Badges Unlocked */}
            {unlockedBadges.length > 0 && (
              <div className="pt-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Pencapaian Terbuka ({unlockedBadges.length}):</span>
                <div className="flex flex-wrap gap-1">
                  {unlockedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10px] font-bold shadow-xs"
                      title={badge.description}
                    >
                      <Award className="w-3 h-3 text-indigo-600 shrink-0" />
                      <span>{badge.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </motion.div>

      {/* Footer */}
      <footer className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-center text-indigo-200 px-4 text-xs sm:text-sm font-medium gap-2 max-w-6xl mx-auto w-full">
        <p className="text-center sm:text-left text-[11px] sm:text-xs font-semibold">
          &copy; NemuSpace • Privacy First • No History Stored
        </p>

        <div className="flex gap-3 sm:gap-6 text-[10px] sm:text-sm font-bold uppercase tracking-widest">
          <span className="hover:text-white transition-colors">1-Click Match</span>
          <span className="hover:text-white transition-colors">WebRTC Video</span>
          <span className="hover:text-white transition-colors">Synced Pomodoro</span>
        </div>
      </footer>
    </motion.div>
  );
};
