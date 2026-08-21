# 🎓 NumaSpace (StudyMatch)

> **Platform Teman Belajar Virtual Real-Time**  
> Pasangkan diri Anda dengan kawan belajar secara anonim, dilengkapi video/audio call P2P WebRTC, timer Pomodoro ter-sinkronisasi, catatan bersama (scratchpad), papan tulis interaktif (whiteboard), dan fitur moderasi keamanan.

---

## 🌟 Fitur Utama

- ⚡ **Matchmaking Instan & Kode Ruang Privat**: Temukan teman belajar berdasarkan topik/jurusan atau buat ruang belajar privat dengan kode unik.
- 📹 **Video & Audio Call WebRTC**: Komunikasi P2P jernih dengan kontrol mikrofon, kamera, dan efek blur latar belakang (*Virtual Background*).
- ⏱️ **Timer Pomodoro Ter-sinkronisasi**: Kelola sesi fokus 25 menit dan waktu istirahat secara real-time bersama partner Anda.
- 📝 **Shared Scratchpad & To-Do List**: Catat target belajar dan tandai tugas selesai bersama secara langsung.
- 🎨 **Papan Tulis Interaktif (Whiteboard)**: Coret-coret ide, rumus, atau diagram secara visual bersama pasangan belajar.
- 💬 **Chat Real-Time & Reaksi Cepat**: Kirim pesan singkat, indikator ketik (*typing indicator*), dan dorongan motivasi dengan emotikon reaksi.
- 🤖 **Mode Instant Demo Buddy**: Opsi instan untuk menguji fitur aplikasi kapan saja tanpa perlu menunggu pengguna lain di antrean.
- 🛡️ **Moderasi Keamanan & Privasi**: Sistem *report & block* serta *stateless privacy session* untuk menjaga kenyamanan sesi belajar.

---

## 🏗️ Struktur Proyek (Frontend & Backend)

Aplikasi ini menggunakan arsitektur modular yang memisahkan **Frontend** dan **Backend** secara rapi:

```text
NumaSpace/
├── backend/                       # 🟢 BACKEND (Express + Socket.IO)
│   └── src/
│       ├── data/                  # Data mock demo partners
│       ├── handlers/              # Socket.IO & WebRTC signaling handlers
│       ├── routes/                # API Endpoints (/api/health)
│       ├── types/                 # Interface TypeScript backend
│       └── index.ts               # Entry point Express server
│
├── frontend/                      # 🔵 FRONTEND (React + Vite + Tailwind)
│   ├── public/                    # Asset publik
│   ├── src/
│   │   ├── components/            # Komponen UI React (StudyRoom, Modals, Form)
│   │   ├── utils/                 # WebRTC Manager, Audio, Firebase, Virtual Background
│   │   ├── types.ts               # Types TypeScript frontend
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── index.html
│   └── vite.config.ts
│
├── package.json                   # Script terpusat (dev, build, start, lint)
└── tsconfig.json                  # Konfigurasi path TypeScript
```

---

## 💻 Teknologi yang Digunakan

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Canvas-Confetti, Motion.
- **Backend**: Node.js, Express, Socket.IO, TypeScript, TSX.
- **Real-Time Communication**: WebRTC P2P (Signaling via Socket.IO).
- **Services**: Firebase (Anonymous Authentication & Temporary Sessions).

---

## 🚀 Cara Menjalankan Lokal

### **Prasyarat**
- [Node.js](https://nodejs.org/) versi 18 atau lebih baru.
- [npm](https://www.npmjs.com/) atau [bun](https://bun.sh/).

### **Langkah Penginstalasi & Menjalankan:**

1. **Clone repository ini:**
   ```bash
   git clone https://github.com/Zhlsyh/NumaSpace.git
   cd NumaSpace
   ```

2. **Install dependensi:**
   ```bash
   npm install
   ```

3. **Jalankan Mode Pengembangan (Development):**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000`.

4. **Build untuk Produksi:**
   ```bash
   npm run build
   ```

5. **Jalankan Server Produksi:**
   ```bash
   npm run start
   ```

---

## 📄 Lisensi

Proyek ini dibuat untuk tujuan pembelajaran dan kolaborasi. Silakan gunakan dan kembangkan secara bebas!
