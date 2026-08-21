import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { recordCompletedSession, calculateUnlockedBadges } from '../utils/streak';
import { UserStreakStats } from '../types';
import { 
  Trophy, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  Home,
  Download,
  Flame,
  Award
} from 'lucide-react';

interface Props {
  focusMinutes: number;
  todosCompleted: number;
  onStartNewMatch: () => void;
  onGoHome: () => void;
}

export const SessionSummaryModal: React.FC<Props> = ({
  focusMinutes,
  todosCompleted,
  onStartNewMatch,
  onGoHome,
}) => {
  const [updatedStreak, setUpdatedStreak] = useState<UserStreakStats | null>(null);

  useEffect(() => {
    const stats = recordCompletedSession(focusMinutes);
    setUpdatedStreak(stats);
  }, [focusMinutes]);

  const badges = updatedStreak ? calculateUnlockedBadges(updatedStreak) : [];
  const unlockedBadges = badges.filter((b) => b.unlocked);

  const handleDownloadReport = () => {
    const badgeText = unlockedBadges.length > 0
      ? unlockedBadges.map((b) => `- ${b.icon} **${b.name}**: ${b.description}`).join('\n')
      : '- 🌱 **Langkah Pertama**: Selesai sesi pertama';

    const reportText = `# 🎓 NemuSpace - Session Summary Report
Date: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

---

### ⏱️ Stat Sesi Belajar:
- **Total Waktu Fokus**: ${Math.max(1, focusMinutes)} Menit
- **Target/Tugas Selesai**: ${todosCompleted} Tugas
- **Total Menit Belajar Akumulasi**: ${updatedStreak?.totalMinutes || focusMinutes} Menit
- **Beruntun (Daily Streak)**: ${updatedStreak?.currentStreak || 1} Hari

### 🏆 Achievement Badges Terbuka:
${badgeText}

---
*Generated automatically by NemuSpace - Live P2P Virtual Study Room*
`;


    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NemuSpace_Report_${Date.now()}.md`;

    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-indigo-950/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 selection:bg-amber-400 selection:text-indigo-950 font-sans"
    >
      <motion.div 
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="max-w-md w-full bg-white rounded-[28px] sm:rounded-[36px] p-5 sm:p-8 shadow-2xl border-[8px] sm:border-[12px] border-indigo-400/30 text-center space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto"
      >
        
        {/* Celebration Trophy Icon in Rotated Amber Box */}
        <motion.div 
          animate={{ rotate: [3, -3, 3] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl sm:rounded-3xl bg-amber-400 border-2 border-amber-300 transform rotate-3 flex items-center justify-center shadow-lg shadow-amber-500/20"
        >
          <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-950 animate-bounce" />
        </motion.div>

        {/* Title & Affirmation */}
        <div className="space-y-1">
          <div className="flex justify-center items-center gap-1.5 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] sm:text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sesi Belajar Selesai</span>
            </div>
            {updatedStreak && (
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-black">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                <span>{updatedStreak.currentStreak} Hari Streak!</span>
              </div>
            )}
          </div>
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 leading-tight">
            Kerja Bagus! <br /><span className="text-indigo-600">Fokus Luar Biasa.</span>
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Setiap menit fokus membawa Anda selangkah lebih dekat menuju kesuksesan akademik.
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div className="p-3 sm:p-4 rounded-2xl bg-indigo-50 border-2 border-indigo-100">
            <div className="flex items-center justify-center gap-1 text-indigo-600 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-0.5">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Waktu Fokus</span>
            </div>
            <div className="text-xl sm:text-3xl font-black text-indigo-950 font-mono">
              {Math.max(1, focusMinutes)} <span className="text-[10px] sm:text-xs font-bold text-slate-500">Menit</span>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-100">
            <div className="flex items-center justify-center gap-1 text-emerald-700 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Target Selesai</span>
            </div>
            <div className="text-xl sm:text-3xl font-black text-emerald-950 font-mono">
              {todosCompleted} <span className="text-[10px] sm:text-xs font-bold text-slate-500">Tugas</span>
            </div>
          </div>
        </div>

        {/* Badges / Achievement Unlocked */}
        {unlockedBadges.length > 0 && (
          <div className="p-3 rounded-2xl bg-amber-50 border-2 border-amber-200 text-left space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-amber-900">
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                Pencapaian Terbuka ({unlockedBadges.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unlockedBadges.map((b) => (
                <div
                  key={b.id}
                  className="px-2.5 py-1 rounded-xl bg-white border border-amber-300 text-xs font-bold text-slate-800 shadow-sm flex items-center gap-1.5"
                  title={b.description}
                >
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span>{b.name}</span>
                </div>

              ))}
            </div>
          </div>
        )}


        {/* Privacy Note */}
        <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 italic">
          Data sesi obrolan & koneksi telah dibersihkan secara aman (Stateless privacy).
        </p>

        {/* Action CTAs */}
        <div className="space-y-2 sm:space-y-2.5 pt-1">
          <motion.button
            id="btn-summary-new-match"
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={onStartNewMatch}
            className="w-full py-3.5 sm:py-4 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-base shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Cari Partner Baru (Next Match)</span>
          </motion.button>

          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleDownloadReport}
              className="py-2.5 px-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-indigo-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Ringkasan</span>
            </motion.button>

            <motion.button
              id="btn-summary-go-home"
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onGoHome}
              className="py-2.5 px-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Beranda</span>
            </motion.button>
          </div>
        </div>

      </motion.div>
    </motion.div>
  );
};
