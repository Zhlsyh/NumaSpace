import { Server as SocketIOServer, Socket } from "socket.io";
import { QueueUser, RoomSession } from "../types";
import { demoPartners } from "../data/demoPartners";

// Global in-memory state for matchmaking and active rooms
const matchmakingQueue: QueueUser[] = [];
const activeRooms = new Map<string, RoomSession>();
const socketToRoomMap = new Map<string, string>();
const lastAssignedBotMap = new Map<string, string>();

let totalMatchesCount = 142;
let totalStudyMinutesCount = 3580;

export function getStats(io: SocketIOServer) {
  return {
    onlineUsers: Math.max(io.engine.clientsCount, 1),
    queueCount: matchmakingQueue.length,
    activeRoomsCount: activeRooms.size,
    totalMatchesCount,
    totalStudyMinutesCount,
  };
}

export function startStatsTicker(io: SocketIOServer) {
  setInterval(() => {
    totalMatchesCount += 1;
    totalStudyMinutesCount += Math.floor(Math.random() * 3) + 1;
    io.emit("stats_update", getStats(io));
  }, 12000);
}

function removeFromQueue(socketId: string) {
  const index = matchmakingQueue.findIndex((item) => item.socketId === socketId);
  if (index !== -1) {
    matchmakingQueue.splice(index, 1);
  }
}

function createRoomAndPair(io: SocketIOServer, user1: QueueUser, user2: QueueUser) {
  const s1 = io.sockets.sockets.get(user1.socketId);
  const s2 = io.sockets.sockets.get(user2.socketId);

  if (!s1 || !s2) {
    if (s1) matchmakingQueue.unshift(user1);
    if (s2) matchmakingQueue.unshift(user2);
    return;
  }

  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newRoom: RoomSession = {
    roomId,
    users: {
      [user1.socketId]: user1.user,
      [user2.socketId]: user2.user,
    },
    pomodoro: {
      mode: "focus",
      duration: 25 * 60,
      timeLeft: 25 * 60,
      isRunning: false,
      lastUpdated: Date.now(),
      sessionsCompleted: 0,
    },
    scratchpad: `// Catatan Bersama / Shared Scratchpad\n// ${user1.user.displayName} & ${user2.user.displayName}\n\nTarget Belajar:\n- ${user1.user.displayName}: ${user1.user.currentGoal || "Membaca & Memahami Materi"}\n- ${user2.user.displayName}: ${user2.user.currentGoal || "Latihan Soal & Review"}\n\n`,
    todos: [
      {
        id: `todo_${Date.now()}_1`,
        text: `${user1.user.displayName}: ${user1.user.currentGoal || "Fokus 25 Menit Sesi 1"}`,
        done: false,
        addedBy: user1.user.displayName,
      },
      {
        id: `todo_${Date.now()}_2`,
        text: `${user2.user.displayName}: ${user2.user.currentGoal || "Fokus 25 Menit Sesi 1"}`,
        done: false,
        addedBy: user2.user.displayName,
      },
    ],
    createdAt: Date.now(),
  };

  activeRooms.set(roomId, newRoom);
  socketToRoomMap.set(user1.socketId, roomId);
  socketToRoomMap.set(user2.socketId, roomId);

  s1.join(roomId);
  s2.join(roomId);

  totalMatchesCount++;

  s1.emit("match_found", {
    roomId,
    isInitiator: true,
    partner: user2.user,
    roomState: newRoom,
  });

  s2.emit("match_found", {
    roomId,
    isInitiator: false,
    partner: user1.user,
    roomState: newRoom,
  });

  io.emit("stats_update", getStats(io));
}

function tryMatchUsers(io: SocketIOServer) {
  if (matchmakingQueue.length < 2) return;

  // 0. Private Room Code Matching
  for (let i = 0; i < matchmakingQueue.length; i++) {
    const u1 = matchmakingQueue[i];
    if (u1.user.roomCode && u1.user.roomCode.trim().length > 0) {
      const code1 = u1.user.roomCode.trim().toUpperCase();
      for (let j = i + 1; j < matchmakingQueue.length; j++) {
        const u2 = matchmakingQueue[j];
        if (u2.user.roomCode && u2.user.roomCode.trim().toUpperCase() === code1) {
          matchmakingQueue.splice(j, 1);
          matchmakingQueue.splice(i, 1);
          createRoomAndPair(io, u1, u2);
          tryMatchUsers(io);
          return;
        }
      }
    }
  }

  // Public queue indices (users without roomCode)
  const publicIndices: number[] = [];
  for (let i = 0; i < matchmakingQueue.length; i++) {
    if (!matchmakingQueue[i].user.roomCode || matchmakingQueue[i].user.roomCode?.trim() === '') {
      publicIndices.push(i);
    }
  }

  if (publicIndices.length < 2) return;

  // 1. Match public users with identical subject topics
  for (let i = 0; i < publicIndices.length; i++) {
    for (let j = i + 1; j < publicIndices.length; j++) {
      const idx1 = publicIndices[i];
      const idx2 = publicIndices[j];
      const u1 = matchmakingQueue[idx1];
      const u2 = matchmakingQueue[idx2];

      const topic1 = u1.user.subjectTopic || 'Umum';
      const topic2 = u2.user.subjectTopic || 'Umum';

      if (topic1 !== 'Umum' && topic1 === topic2) {
        const maxIdx = Math.max(idx1, idx2);
        const minIdx = Math.min(idx1, idx2);
        matchmakingQueue.splice(maxIdx, 1);
        matchmakingQueue.splice(minIdx, 1);
        createRoomAndPair(io, u1, u2);
        tryMatchUsers(io);
        return;
      }
    }
  }

  // 2. Default fallback: pair first two public users
  const idx1 = publicIndices[0];
  const idx2 = publicIndices[1];
  const maxIdx = Math.max(idx1, idx2);
  const minIdx = Math.min(idx1, idx2);
  const u1 = matchmakingQueue[minIdx];
  const u2 = matchmakingQueue[maxIdx];

  matchmakingQueue.splice(maxIdx, 1);
  matchmakingQueue.splice(minIdx, 1);
  createRoomAndPair(io, u1, u2);
  tryMatchUsers(io);
}

export function initSocketHandlers(io: SocketIOServer) {
  io.on("connection", (socket: Socket) => {
    socket.emit("stats_update", getStats(io));

    socket.on("disconnect", () => {
      lastAssignedBotMap.delete(socket.id);
    });

    // 1. Join matchmaking queue
    socket.on("join_queue", (userData) => {
      removeFromQueue(socket.id);

      const existingRoomId = socketToRoomMap.get(socket.id);
      if (existingRoomId) {
        socket.leave(existingRoomId);
        socketToRoomMap.delete(socket.id);
      }

      matchmakingQueue.push({
        socketId: socket.id,
        user: {
          id: userData.id || socket.id,
          displayName: userData.displayName || "Mahasiswa Anonim",
          gender: userData.gender || "other",
          major: userData.major || "Umum",
          interest: userData.interest || "Belajar Umum",
          currentGoal: userData.currentGoal || "Fokus Belajar Mandiri",
          studyMode: userData.studyMode || "pomodoro",
          subjectTopic: userData.subjectTopic || "Umum",
          roomCode: userData.roomCode ? String(userData.roomCode).trim().toUpperCase() : "",
          avatarColor: userData.avatarColor || "from-emerald-500 to-teal-600",
          avatarIcon: userData.avatarIcon || "book",
        },
        joinedAt: Date.now(),
      });

      socket.emit("queue_status", {
        status: "waiting",
        position: matchmakingQueue.length,
      });

      io.emit("stats_update", getStats(io));
      tryMatchUsers(io);
    });

    // 1b. Instant Demo Partner
    socket.on("request_instant_partner", (userData) => {
      removeFromQueue(socket.id);
      const lastBotId = lastAssignedBotMap.get(socket.id);

      const eligiblePartners = demoPartners.filter(
        (p) => p.major !== userData.major && p.id !== lastBotId
      );
      const fallbackPartners = demoPartners.filter((p) => p.id !== lastBotId);
      const pool = eligiblePartners.length > 0 ? eligiblePartners : (fallbackPartners.length > 0 ? fallbackPartners : demoPartners);
      const selectedPartner = pool[Math.floor(Math.random() * pool.length)];

      lastAssignedBotMap.set(socket.id, selectedPartner.id);

      const roomId = `room_instant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newRoom: RoomSession = {
        roomId,
        users: {
          [socket.id]: {
            id: userData.id || socket.id,
            displayName: userData.displayName || "Saya",
            gender: userData.gender || "other",
            major: userData.major || "Umum",
            interest: userData.interest || "Belajar Mandiri",
            currentGoal: userData.currentGoal || "Fokus 25 Menit",
            studyMode: userData.studyMode || "pomodoro",
            avatarColor: userData.avatarColor || "from-blue-500 to-indigo-600",
            avatarIcon: userData.avatarIcon || "user",
          },
          [`bot_${selectedPartner.id}`]: {
            ...selectedPartner,
          },
        },
        pomodoro: {
          mode: "focus",
          duration: 25 * 60,
          timeLeft: 25 * 60,
          isRunning: false,
          lastUpdated: Date.now(),
          sessionsCompleted: 0,
        },
        scratchpad: `// Catatan Bersama / Shared Scratchpad\n// ${userData.displayName || "Saya"} & ${selectedPartner.displayName}\n\nTarget Belajar:\n- ${userData.displayName || "Saya"}: ${userData.currentGoal || "Membaca & Memahami Materi"}\n- ${selectedPartner.displayName}: ${selectedPartner.currentGoal}\n\nCatatan:\n- Sesi belajar dimulai. Jangan ragu menggunakan timer Pomodoro!`,
        todos: [
          {
            id: `todo_${Date.now()}_1`,
            text: `${userData.displayName || "Saya"}: ${userData.currentGoal || "Selesaikan Bab Materi Utama"}`,
            done: false,
            addedBy: userData.displayName || "Saya",
          },
          {
            id: `todo_${Date.now()}_2`,
            text: `${selectedPartner.displayName}: ${selectedPartner.currentGoal}`,
            done: false,
            addedBy: selectedPartner.displayName,
          },
        ],
        createdAt: Date.now(),
      };

      activeRooms.set(roomId, newRoom);
      socketToRoomMap.set(socket.id, roomId);
      socket.join(roomId);

      socket.emit("match_found", {
        roomId,
        isInitiator: true,
        isDemoBot: true,
        partner: selectedPartner,
        roomState: newRoom,
      });

      totalMatchesCount++;
      io.emit("stats_update", getStats(io));
    });

    // 2. Cancel Queue Search
    socket.on("leave_queue", () => {
      removeFromQueue(socket.id);
      socket.emit("queue_status", { status: "left" });
      io.emit("stats_update", getStats(io));
    });

    // 3. WebRTC Signaling Relays
    socket.on("webrtc_offer", ({ roomId, offer }) => {
      socket.to(roomId).emit("webrtc_offer", { offer, from: socket.id });
    });

    socket.on("webrtc_answer", ({ roomId, answer }) => {
      socket.to(roomId).emit("webrtc_answer", { answer, from: socket.id });
    });

    socket.on("webrtc_ice_candidate", ({ roomId, candidate }) => {
      socket.to(roomId).emit("webrtc_ice_candidate", { candidate, from: socket.id });
    });

    socket.on("peer_ready", ({ roomId }) => {
      socket.to(roomId).emit("peer_ready", { from: socket.id });
    });

    // 4. Media State Updates
    socket.on("media_state_change", ({ roomId, videoEnabled, audioEnabled, screenSharing }) => {
      socket.to(roomId).emit("partner_media_state", {
        videoEnabled,
        audioEnabled,
        screenSharing,
      });
    });

    // 5. Real-time Chat
    socket.on("chat_message", ({ roomId, message }) => {
      const room = activeRooms.get(roomId);
      if (room) {
        const fullMessage = {
          ...message,
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: Date.now(),
        };
        io.to(roomId).emit("chat_message", fullMessage);
      }
    });

    socket.on("chat_typing", ({ roomId, isTyping, userName }) => {
      socket.to(roomId).emit("partner_typing", { isTyping, userName });
    });

    // 6. Synchronized Pomodoro Events
    socket.on("pomodoro_action", ({ roomId, action, mode, duration, timeLeft }) => {
      const room = activeRooms.get(roomId);
      if (room) {
        if (action === "start") {
          room.pomodoro.isRunning = true;
          room.pomodoro.lastUpdated = Date.now();
        } else if (action === "pause") {
          room.pomodoro.isRunning = false;
          if (typeof timeLeft === "number") room.pomodoro.timeLeft = timeLeft;
        } else if (action === "reset") {
          room.pomodoro.isRunning = false;
          room.pomodoro.timeLeft = (duration || 25) * 60;
          room.pomodoro.duration = (duration || 25) * 60;
        } else if (action === "change_mode") {
          room.pomodoro.mode = mode;
          room.pomodoro.duration = (duration || (mode === "focus" ? 25 : 5)) * 60;
          room.pomodoro.timeLeft = room.pomodoro.duration;
          room.pomodoro.isRunning = false;
        } else if (action === "completed") {
          room.pomodoro.sessionsCompleted++;
          room.pomodoro.isRunning = false;
          totalStudyMinutesCount += Math.round(room.pomodoro.duration / 60);
        }

        io.to(roomId).emit("pomodoro_sync", room.pomodoro);
      }
    });

    // 7. Synchronized Scratchpad
    socket.on("scratchpad_update", ({ roomId, content }) => {
      const room = activeRooms.get(roomId);
      if (room) {
        room.scratchpad = content;
        socket.to(roomId).emit("scratchpad_sync", content);
      }
    });

    // 8. Synchronized Todo list
    socket.on("todo_action", ({ roomId, action, todo }) => {
      const room = activeRooms.get(roomId);
      if (room) {
        if (action === "add" && todo) {
          room.todos.push(todo);
        } else if (action === "toggle" && todo) {
          const item = room.todos.find((t) => t.id === todo.id);
          if (item) item.done = !item.done;
        } else if (action === "delete" && todo) {
          room.todos = room.todos.filter((t) => t.id !== todo.id);
        }
        io.to(roomId).emit("todo_sync", room.todos);
      }
    });

    // 9. Quick Reaction
    socket.on("study_reaction", ({ roomId, reaction, userName }) => {
      io.to(roomId).emit("study_reaction", { reaction, userName, timestamp: Date.now() });
    });

    // 9b. Whiteboard Sync
    socket.on("whiteboard_draw", ({ roomId, drawData }) => {
      socket.to(roomId).emit("whiteboard_draw", drawData);
    });

    // 9c. Report & Block User
    socket.on("report_user", ({ roomId, reason, userProfile }) => {
      const room = activeRooms.get(roomId);
      if (room) {
        const currentUser = room.users[socket.id] || userProfile;
        console.log(`[Safety Report] Room ${roomId}: User ${currentUser?.displayName} reported partner for reason: ${reason}`);

        socket.to(roomId).emit("partner_left", {
          reason: "Sesi diakhiri oleh sistem moderasi.",
          action: "skip",
          partnerName: currentUser?.displayName || "Partner",
        });

        activeRooms.delete(roomId);
      }

      socket.leave(roomId);
      socketToRoomMap.delete(socket.id);

      if (userProfile) {
        removeFromQueue(socket.id);
        matchmakingQueue.push({
          socketId: socket.id,
          user: userProfile,
          joinedAt: Date.now(),
        });

        socket.emit("queue_status", {
          status: "waiting",
          position: matchmakingQueue.length,
        });

        io.emit("stats_update", getStats(io));
        tryMatchUsers(io);
      }
    });

    // 10. Skip / Next Partner
    socket.on("skip_partner", ({ roomId, userProfile }) => {
      const room = activeRooms.get(roomId);
      if (room) {
        const currentUser = room.users[socket.id] || userProfile;
        socket.to(roomId).emit("partner_left", {
          reason: "Partner beralih mencari teman belajar berikutnya (Skip).",
          action: "skip",
          partnerName: currentUser?.displayName || "Partner",
        });
        activeRooms.delete(roomId);
      }

      socket.leave(roomId);
      socketToRoomMap.delete(socket.id);

      if (userProfile) {
        removeFromQueue(socket.id);
        matchmakingQueue.push({
          socketId: socket.id,
          user: userProfile,
          joinedAt: Date.now(),
        });

        socket.emit("queue_status", {
          status: "waiting",
          position: matchmakingQueue.length,
        });

        io.emit("stats_update", getStats(io));
        tryMatchUsers(io);
      }
    });

    // 11. End Session & Leave
    socket.on("leave_room", ({ roomId }) => {
      const room = activeRooms.get(roomId);
      if (room) {
        const currentUser = room.users[socket.id];
        socket.to(roomId).emit("partner_left", {
          reason: "Partner telah menyelesaikan sesi belajar.",
          action: "leave",
          partnerName: currentUser?.displayName || "Partner",
        });
        activeRooms.delete(roomId);
      }
      socket.leave(roomId);
      socketToRoomMap.delete(socket.id);

      io.emit("stats_update", getStats(io));
    });

    // Disconnect handler
    socket.on("disconnect", () => {
      removeFromQueue(socket.id);

      const roomId = socketToRoomMap.get(socket.id);
      if (roomId) {
        const room = activeRooms.get(roomId);
        if (room) {
          const currentUser = room.users[socket.id];
          socket.to(roomId).emit("partner_left", {
            reason: "Partner terputus dari jaringan.",
            action: "disconnect",
            partnerName: currentUser?.displayName || "Partner",
          });
          activeRooms.delete(roomId);
        }
        socketToRoomMap.delete(socket.id);
      }

      io.emit("stats_update", getStats(io));
    });
  });
}
