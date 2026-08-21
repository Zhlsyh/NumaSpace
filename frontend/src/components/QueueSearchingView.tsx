import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile, GlobalStats } from '../types';
import { 
  Loader2, 
  X, 
  Zap, 
  Lightbulb, 
  GraduationCap, 
  Radio, 
  Clock,
  Sparkles
} from 'lucide-react';

interface Props {
  myProfile: UserProfile;
  stats: GlobalStats;
  queuePosition: number;
  searchNotification?: { message: string; type: 'skip' | 'leave' | 'disconnect' } | null;
  onCancelQueue: () => void;
  onRequestInstantDemo: () => void;
}

const STUDY_TIPS = [
  "Teknik Pomodoro: 25 menit fokus penuh + 5 menit rehat menjaga stamina otak tetap prima.",
  "Mendengarkan suara hujan (Rain noise) membantu meredam distraksi lingkungan sekitar.",
  "Tulis target spesifik Anda di Shared Scratchpad agar Anda dan partner saling menjaga akuntabilitas.",
  "Nyalakan kamera jika nyaman; kehadiran visual partner meningkatkan fokus hingga 2x lipat.",
  "Gunakan fitur To-do checklist di dalam room untuk menandai kemajuan belajar Anda."
];

export const QueueSearchingView: React.FC<Props> = ({
  myProfile,
  stats,
  queuePosition,
  searchNotification,
  onCancelQueue,
  onRequestInstantDemo,
}) => {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % STUDY_TIPS.length);
    }, 6000);

    return () => {
      clearInterval(timer);
      clearInterval(tipTimer);
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-indigo-600 text-slate-900 flex flex-col items-center justify-center p-3 sm:p-6 selection:bg-amber-400 selection:text-indigo-950 font-sans relative overflow-hidden"
    >
      
      {/* Background Ambient Pulsing Spheres */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.35, 0.2] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
        className="absolute top-10 left-10 w-56 sm:w-72 h-56 sm:h-72 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" 
      />
      <motion.div 
        animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0.35, 0.2] }}
        transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
        className="absolute bottom-10 right-10 w-64 sm:w-80 h-64 sm:h-80 bg-rose-400/20 rounded-full blur-3xl pointer-events-none" 
      />

      {/* Main Chunky Search Card in Vibrant Palette */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full bg-white rounded-[28px] sm:rounded-[36px] p-5 sm:p-8 shadow-2xl border-[8px] sm:border-[12px] border-indigo-400/30 relative z-10 text-center space-y-4 sm:space-y-5"
      >
        
        {/* Animated Radar Visual with Framer Motion Pulse */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto flex items-center justify-center">
          <motion.div 
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-indigo-500/30" 
          />
          <div className="absolute inset-1 rounded-full bg-amber-400/30 animate-pulse" />
          <motion.div 
            whileHover={{ scale: 1.08, rotate: 6 }}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-400 border-2 border-amber-300 transform rotate-3 flex items-center justify-center shadow-lg shadow-amber-500/30 z-10"
          >
            <Radio className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-950 animate-pulse" />
          </motion.div>
        </div>

        {/* Notification Banner when partner skipped/ended session */}
        <AnimatePresence>
          {searchNotification && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="p-3.5 sm:p-4 rounded-2xl bg-amber-400 border-2 border-amber-300 text-indigo-950 text-left font-medium text-xs sm:text-sm flex items-start gap-3 shadow-lg my-1"
            >
              <div className="p-1.5 rounded-xl bg-indigo-950 text-amber-300 shrink-0 mt-0.5">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="font-black text-[11px] uppercase tracking-wider text-indigo-950">
                  Informer Sesi
                </div>

                <p className="leading-snug font-bold text-slate-900">{searchNotification.message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Title & Status */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] sm:text-xs font-black uppercase tracking-wider">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{myProfile.roomCode ? 'Menunggu Teman Private Room...' : 'Mencari Partner Belajar...'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {myProfile.roomCode ? 'Private Room Active' : 'Menghubungkan Sesi'}
          </h2>
          <p className="text-xs font-medium text-slate-500 px-2">
            {myProfile.roomCode 
              ? `Menunggu seseorang memasukkan kode rahasia yang sama: ${myProfile.roomCode}`
              : 'Sistem sedang mencocokkan Anda dengan mahasiswa aktif lainnya.'}
          </p>
        </div>

        {/* Private Room Code Share Box if user joined via roomCode */}
        {myProfile.roomCode && (
          <div className="p-3 bg-amber-100 border-2 border-amber-300 rounded-2xl flex items-center justify-between gap-2 shadow-sm">
            <div className="text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">Kode Ruang Rahasia</span>
              <span className="font-mono font-black text-indigo-950 text-lg tracking-widest">{myProfile.roomCode}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(myProfile.roomCode || '');
                alert(`Kode ${myProfile.roomCode} telah disalin! Bagikan ke teman Anda.`);
              }}
              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow cursor-pointer active:scale-95"
            >
              Salin Kode
            </button>
          </div>
        )}

        {/* Queue Metrics in Chunky Tinted Boxes */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div className="p-3 sm:p-3.5 rounded-2xl bg-indigo-50/70 border-2 border-indigo-100">
            <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-indigo-600 flex items-center justify-center gap-1 mb-0.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Waktu Tunggu</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-indigo-950 font-mono">
              {formatTime(secondsElapsed)}
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-indigo-50/70 border-2 border-indigo-100">
            <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-indigo-600 flex items-center justify-center gap-1 mb-0.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Online</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-indigo-950 font-mono">
              {stats.onlineUsers || 1} Mahasiswa
            </div>
          </div>
        </div>

        {/* Profile Shared Summary */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 text-left space-y-1.5 sm:space-y-2">
          <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <span>Profil Sesi Anda</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Nama Alias:</span>
              <span className="font-bold text-slate-900 truncate max-w-[150px]">{myProfile.displayName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Jurusan:</span>
              <span className="font-black text-indigo-600 truncate max-w-[150px]">{myProfile.major}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Topik:</span>
              <span className="font-black text-rose-600 truncate max-w-[150px]">{myProfile.interest}</span>
            </div>
            <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200">
              <span className="text-slate-500 font-medium shrink-0">Target:</span>
              <span className="font-bold text-slate-800 text-right truncate">{myProfile.currentGoal}</span>
            </div>
          </div>
        </div>

        {/* Study Tips Box in Warm Amber with AnimatePresence */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-200 text-left flex items-start gap-2.5 min-h-[64px]">
          <Lightbulb className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <AnimatePresence mode="wait">
            <motion.p 
              key={tipIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              className="text-[11px] sm:text-xs text-amber-950 font-medium leading-relaxed italic"
            >
              &ldquo;{STUDY_TIPS[tipIndex]}&rdquo;
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Action Controls */}
        <div className="space-y-2 pt-1">
          <motion.button
            id="btn-instant-demo-partner"
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={onRequestInstantDemo}
            className="w-full py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md border-2 border-amber-300"
          >
            <Zap className="w-4 h-4 text-indigo-950" />
            <span>Mulai Langsung dengan Demo Partner</span>
          </motion.button>

          <motion.button
            id="btn-cancel-queue"
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={onCancelQueue}
            className="w-full py-2.5 px-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Batalkan Pencarian</span>
          </motion.button>
        </div>

      </motion.div>
    </motion.div>
  );
};
