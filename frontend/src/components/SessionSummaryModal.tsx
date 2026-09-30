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
  Award,
  Star
} from 'lucide-react';

interface Props {
  focusMinutes: number;
  todosCompleted: number;
  onSubmitFeedback: (rating: number, onResult: (saved: boolean) => void) => void;
  onStartNewMatch: () => void;
  onGoHome: () => void;
}

export const SessionSummaryModal: React.FC<Props> = ({
  focusMinutes,
  todosCompleted,
  onSubmitFeedback,
  onStartNewMatch,
  onGoHome,
}) => {
  const [updatedStreak, setUpdatedStreak] = useState<UserStreakStats | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    const stats = recordCompletedSession(focusMinutes);
    setUpdatedStreak(stats);
  }, [focusMinutes]);

  const badges = updatedStreak ? calculateUnlockedBadges(updatedStreak) : [];
  const unlockedBadges = badges.filter((b) => b.unlocked);

  const submitFeedback = () => {
    setFeedbackStatus('sending');
    onSubmitFeedback(feedbackRating, (saved) => setFeedbackStatus(saved ? 'sent' : 'error'));
  };

  const handleDownloadReport = () => {
    const badgeText = unlockedBadges.length > 0
      ? unlockedBadges.map((b) => `- ${b.icon} **${b.name}**: ${b.description}`).join('\n')
      : '- 🌱 **Langkah Pertama**: Selesai sesi pertama';

    const reportText = `# 🎓 Numa Space - Session Summary Report
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
*Generated automatically by Numa Space - Live P2P Virtual Study Room*
`;

    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NumaSpace_Report_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#0F1E1C]/60 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 font-sans"
    >
      <motion.div 
        initial={{ scale: 0.88, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="max-w-md w-full bg-white rounded-[32px] sm:rounded-[40px] p-5 sm:p-7 shadow-2xl border-2 border-[#D2E4E8] text-center space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto"
      >
        {/* Celebration Trophy Box (Dark Charcoal with Lime Trophy) */}
        <motion.div 
          animate={{ rotate: [2, -2, 2] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-[#0F1E1C] border-2 border-[#0F1E1C] flex items-center justify-center shadow-lg"
        >
          <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-[#FDC323] animate-bounce" />
        </motion.div>

        {/* Title & Affirmation */}
        <div className="space-y-1">
          <div className="flex justify-center items-center gap-1.5 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E7F8FC] border border-[#99DDE9] text-[#003D30] text-[11px] font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#00785D]" />
              <span>Sesi Belajar Selesai</span>
            </div>
            {updatedStreak && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0F1E1C] text-[#FDC323] text-[11px] font-black">
                <Flame className="w-3.5 h-3.5 fill-[#FDC323]" />
                <span>{updatedStreak.currentStreak} Hari Streak!</span>
              </div>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0F1E1C] tracking-tight">
            Kerja Bagus! <br /><span className="bg-[#FDC323] px-2 py-0.5 rounded-xl border border-[#0F1E1C]/15 inline-block -rotate-1 mt-0.5">Fokus Maksimal</span>
          </h2>
          <p className="text-xs font-medium text-[#3A6B6A]">
            Sesi Anda telah selesai. Berikut ringkasannya.
          </p>
        </div>

        {/* Metrics Grid (Inspired by the 3 lime boxes in the reference: Finished 4, Doing 2, Abandon 7) */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div className="p-3 sm:p-4 rounded-3xl bg-[#FDC323] border border-[#0F1E1C]/20 text-[#0F1E1C] shadow-xs">
            <div className="flex items-center justify-center gap-1 text-[#003D30] text-[10px] sm:text-xs font-black uppercase tracking-wider mb-0.5">
              <Clock className="w-3.5 h-3.5 text-[#0F1E1C]" />
              <span>Waktu Fokus</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#0F1E1C] font-mono">
              {Math.max(1, focusMinutes)} <span className="text-xs font-bold">Menit</span>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-3xl bg-[#0F1E1C] text-white shadow-xs">
            <div className="flex items-center justify-center gap-1 text-[#539BA9] text-[10px] sm:text-xs font-black uppercase tracking-wider mb-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#FDC323]" />
              <span>Target Selesai</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#FDC323] font-mono">
              {todosCompleted} <span className="text-xs font-bold text-white">Tugas</span>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-[#D2E4E8] bg-[#EDF5F7] p-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-[#0F1E1C]">Bagaimana sesi bersama partner?</h3>
              <p className="text-[10px] text-[#4A7A79]">Opsional dan dikirim tanpa identitas.</p>
            </div>
            {feedbackStatus === 'sent' ? (
              <span className="text-xs font-semibold text-[#00664F]">Terima kasih</span>
            ) : (
              <button type="button" onClick={submitFeedback} disabled={feedbackRating === 0 || feedbackStatus === 'sending'} className="rounded-lg bg-[#00785D] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {feedbackStatus === 'sending' ? 'Mengirim…' : 'Kirim'}
              </button>
            )}
          </div>
          {feedbackStatus !== 'sent' && (
            <div role="group" aria-label="Nilai sesi dari satu sampai lima" className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button key={rating} type="button" aria-label={`${rating} dari 5`} aria-pressed={feedbackRating === rating} onClick={() => { setFeedbackRating(rating); setFeedbackStatus('idle'); }} className="rounded p-1 text-[#539BA9] hover:text-[#00785D]" >
                  <Star className={`h-5 w-5 ${rating <= feedbackRating ? 'fill-[#FDC323] text-[#00785D]' : ''}`} />
                </button>
              ))}
              {feedbackStatus === 'error' && <span role="alert" className="ml-2 self-center text-[10px] text-[#8A3B20]">Belum terkirim. Coba lagi.</span>}
            </div>
          )}
        </section>

        {/* Badges / Achievement Unlocked */}
        {unlockedBadges.length > 0 && (
          <div className="p-3 rounded-2xl bg-[#F4F8F9] border-2 border-[#D2E4E8] text-left space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-[#0F1E1C]">
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-[#00785D]" />
                Pencapaian Terbuka ({unlockedBadges.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unlockedBadges.map((b) => (
                <div
                  key={b.id}
                  className="px-2.5 py-1 rounded-full bg-white border border-[#D2E4E8] text-xs font-bold text-[#0F1E1C] shadow-xs flex items-center gap-1.5"
                  title={b.description}
                >
                  <Award className="w-3.5 h-3.5 text-[#00785D]" />
                  <span>{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Privacy Note */}
        <p className="text-[10px] font-medium text-[#4A7A79] italic">
          Data sesi obrolan & koneksi telah dibersihkan secara aman (Stateless privacy).
        </p>

        {/* Action CTAs */}
        <div className="space-y-2 pt-1">
          <motion.button
            id="btn-summary-new-match"
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStartNewMatch}
            className="w-full py-3.5 px-5 rounded-full bg-[#FDC323] hover:bg-[#EBB215] text-[#0F1E1C] font-black text-sm sm:text-base border-2 border-[#0F1E1C] shadow-[0_4px_0_#0F1E1C] active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Cari Partner Baru (Next Match)</span>
          </motion.button>

          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handleDownloadReport}
              className="py-2.5 px-3 rounded-full bg-[#0F1E1C] hover:bg-[#172B28] text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#FDC323]" />
              <span>Unduh Laporan</span>
            </motion.button>

            <motion.button
              id="btn-summary-go-home"
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={onGoHome}
              className="py-2.5 px-3 rounded-full bg-white hover:bg-[#F6F9FA] border-2 border-[#D2E4E8] text-[#0F1E1C] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 text-[#3A6B6A]" />
              <span>Beranda</span>
            </motion.button>
          </div>
        </div>

      </motion.div>
    </motion.div>
  );
};
