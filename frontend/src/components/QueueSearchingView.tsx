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
  Sparkles,
  Copy
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
  "Nyalakan kamera hanya jika Anda nyaman; kamera tidak wajib untuk belajar bersama.",
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
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen text-[#0F1E1C] flex flex-col items-center justify-center p-3 sm:p-6 font-sans relative overflow-hidden"
    >

      {/* Main Flat Search Card */}
      <motion.div 
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="max-w-md w-full bg-white rounded-lg p-5 sm:p-8 shadow-sm border border-[#D2E4E8] relative z-10 text-center space-y-4 sm:space-y-5"
      >
        {/* Animated Radar Visual with Flat Lime Theme */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto flex items-center justify-center">
          <motion.div 
            animate={{ scale: [1, 1.55, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-[#FDC323]/50" 
          />
          <div className="absolute inset-2 rounded-full bg-[#E7F8FC] animate-pulse" />
          <motion.div 
            whileHover={{ scale: 1.05, rotate: -4 }}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0F1E1C] border-2 border-[#0F1E1C] flex items-center justify-center shadow-md z-10"
          >
            <Radio className="w-7 h-7 sm:w-8 sm:h-8 text-[#FDC323] animate-pulse" />
          </motion.div>
        </div>

        {/* Notification Banner when partner skipped/ended session */}
        <AnimatePresence>
          {searchNotification && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="p-3.5 rounded-2xl bg-[#E7F8FC] border-2 border-[#99DDE9] text-[#0F1E1C] text-left font-medium text-xs sm:text-sm flex items-start gap-3 shadow-xs my-1"
            >
              <div className="p-1.5 rounded-xl bg-[#0F1E1C] text-[#FDC323] shrink-0 mt-0.5">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="font-black text-[10px] uppercase tracking-wider text-[#00664F]">
                  Info Sesi
                </div>
                <p className="leading-snug font-bold text-[#0F1E1C]">{searchNotification.message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Title & Status */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F5F1] border border-[#D2E4E8] text-[#1A3A38] text-[11px] font-black uppercase tracking-wider">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00785D]" />
            <span>{myProfile.roomCode ? 'Menunggu Teman Private Room...' : 'Mencari Partner Belajar...'}</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#0F1E1C]">
            {myProfile.roomCode ? 'Ruang Private Aktif' : 'Menghubungkan Sesi'}
          </h2>
          <p className="text-xs font-medium text-[#3A6B6A] px-2">
            {myProfile.roomCode 
              ? `Menunggu seseorang memasukkan kode rahasia: ${myProfile.roomCode}`
              : 'Sistem sedang mencocokkan Anda dengan mahasiswa aktif lainnya.'}
          </p>
        </div>

        {/* Private Room Code Share Box if user joined via roomCode */}
        {myProfile.roomCode && (
          <div className="p-3 bg-[#E7F8FC] border-2 border-[#99DDE9] rounded-2xl flex items-center justify-between gap-2 shadow-xs">
            <div className="text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#00664F] block">Kode Ruang Rahasia</span>
              <span className="font-mono font-black text-[#0F1E1C] text-lg tracking-widest">{myProfile.roomCode}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(myProfile.roomCode || '');
                alert(`Kode ${myProfile.roomCode} telah disalin! Bagikan ke teman Anda.`);
              }}
              className="py-2 px-3 rounded-xl bg-[#0F1E1C] hover:bg-[#172B28] text-white font-black text-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin</span>
            </button>
          </div>
        )}

        {/* Queue Metrics in Clean Tinted Boxes */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div className="p-3 rounded-2xl bg-[#F4F8F9] border-2 border-[#D2E4E8]">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#4A7A79] flex items-center justify-center gap-1 mb-0.5">
              <Clock className="w-3.5 h-3.5 text-[#00785D]" />
              <span>Waktu Tunggu</span>
            </div>
            <div className="text-xl font-black text-[#0F1E1C] font-mono">
              {formatTime(secondsElapsed)}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#F4F8F9] border-2 border-[#D2E4E8]">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#4A7A79] flex items-center justify-center gap-1 mb-0.5">
              <Sparkles className="w-3.5 h-3.5 text-[#00785D]" />
              <span>Posisi Antrean</span>
            </div>
            <div className="text-xl font-black text-[#0F1E1C] font-mono">
              #{queuePosition} <span className="text-xs font-normal text-[#4A7A79]">dari {stats.queueCount}</span>
            </div>
          </div>
        </div>

        {/* Profile Shared Summary */}
        <div className="p-3.5 rounded-2xl bg-[#F4F8F9] border-2 border-[#D2E4E8] text-left space-y-1.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-[#4A7A79] flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-[#00785D]" />
            <span>Profil Sesi Anda</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#4A7A79] font-medium">Nama Alias:</span>
              <span className="font-bold text-[#0F1E1C] truncate max-w-[150px]">{myProfile.displayName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#4A7A79] font-medium">Jurusan:</span>
              <span className="font-black text-[#0F1E1C] truncate max-w-[150px]">{myProfile.major}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#4A7A79] font-medium">Topik:</span>
              <span className="font-black text-[#00785D] truncate max-w-[150px]">{myProfile.interest}</span>
            </div>
            <div className="flex items-start justify-between gap-2 pt-1 border-t border-[#D2E4E8]">
              <span className="text-[#4A7A79] font-medium shrink-0">Target:</span>
              <span className="font-bold text-[#0F1E1C] text-right truncate">{myProfile.currentGoal}</span>
            </div>
          </div>
        </div>

        {/* Study Tips Box in Matcha Tint */}
        <div className="p-3 rounded-2xl bg-[#E6F5F1] border border-[#D2E4E8] text-left flex items-start gap-2.5 min-h-[58px]">
          <Lightbulb className="w-4 h-4 text-[#00664F] shrink-0 mt-0.5" />
          <AnimatePresence mode="wait">
            <motion.p 
              key={tipIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="text-xs text-[#1A3A38] font-medium leading-relaxed italic"
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
            whileTap={{ scale: 0.98 }}
            onClick={onRequestInstantDemo}
            className="w-full py-3.5 px-4 rounded-full bg-[#FDC323] hover:bg-[#EBB215] text-[#0F1E1C] font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border-2 border-[#0F1E1C] shadow-[0_4px_0_#0F1E1C] active:translate-y-0.5 active:shadow-none"
          >
            <Zap className="w-4 h-4 text-[#0F1E1C] fill-[#0F1E1C]" />
            <span>Mulai Langsung dengan Demo Partner</span>
          </motion.button>

          <motion.button
            id="btn-cancel-queue"
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={onCancelQueue}
            className="w-full py-2.5 px-4 rounded-full bg-white hover:bg-[#F6F9FA] border-2 border-[#D2E4E8] text-[#3A6B6A] hover:text-[#0F1E1C] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Batalkan Pencarian</span>
          </motion.button>
        </div>

      </motion.div>
    </motion.div>
  );
};
