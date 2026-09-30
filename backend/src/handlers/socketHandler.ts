import { Server as SocketIOServer, Socket } from "socket.io";
import { QueueUser, RoomSession } from "../types";
import { demoPartners } from "../data/demoPartners";

// Global in-memory state for matchmaking and active rooms
const matchmakingQueue: QueueUser[] = [];
const activeRooms = new Map<string, RoomSession>();
const socketToRoomMap = new Map<string, string>();
const lastAssignedBotMap = new Map<string, string>();
const blockedPartners = new Map<string, Set<string>>();
const socketEventRates = new Map<string, Map<string, { windowStartedAt: number; count: number }>>();

const allowedStudyModes = new Set(["pomodoro", "silent", "discussion", "casual"]);
const allowedAvatarColors = new Set([
  "from-[#FDC323] to-[#EBB215]",
  "from-[#00785D] to-[#005A46]",
  "from-[#32BFDB] to-[#21ADC9]",
  "from-[#539BA9] to-[#00785D]",
  "from-[#FDC323] to-[#32BFDB]",
]);

let totalMatchesCount = 0;
let totalStudyMinutesCount = 0;
let sessionFeedbackCount = 0;
let sessionFeedbackTotal = 0;

export function getStats(io: SocketIOServer) {
  return {
    onlineUsers: io.engine.clientsCount,
    queueCount: matchmakingQueue.length,
    activeRoomsCount: activeRooms.size,
    totalMatchesCount,
    totalStudyMinutesCount,
  };
}

export function startStatsTicker(io: SocketIOServer) {
  setInterval(() => {
    io.emit("stats_update", getStats(io));
  }, 12000);
}

function removeFromQueue(socketId: string) {
  const index = matchmakingQueue.findIndex((item) => item.socketId === socketId);
  if (index !== -1) {
    matchmakingQueue.splice(index, 1);
  }
}

function broadcastQueuePositions(io: SocketIOServer) {
  matchmakingQueue.forEach((user, index) => {
    io.sockets.sockets.get(user.socketId)?.emit("queue_status", {
      status: "waiting",
      position: index + 1,
    });
  });
}

function usersHaveBlockedEachOther(user1: QueueUser, user2: QueueUser) {
  return blockedPartners.get(user1.user.id)?.has(user2.user.id) === true
    || blockedPartners.get(user2.user.id)?.has(user1.user.id) === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, maxLength: number, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback;
}

function normalizeUserProfile(socketId: string, value: unknown): QueueUser["user"] {
  const input = isRecord(value) ? value : {};
  const interest = readText(input.interest, 100, "Belajar Umum");
  const suppliedRoomCode = readText(input.roomCode, 24).toUpperCase();
  const gender = ["male", "female", "other", "prefer_not_to_say"].includes(String(input.gender))
    ? String(input.gender)
    : "prefer_not_to_say";

  return {
    id: socketId,
    displayName: readText(input.displayName, 48, "Mahasiswa Anonim"),
    gender,
    major: readText(input.major, 80, "Umum"),
    interest,
    currentGoal: readText(input.currentGoal, 180, "Fokus Belajar Mandiri"),
    studyMode: allowedStudyModes.has(String(input.studyMode)) ? String(input.studyMode) : "pomodoro",
    subjectTopic: readText(input.subjectTopic, 100, interest),
    roomCode: /^[A-Z0-9-]{4,24}$/.test(suppliedRoomCode) ? suppliedRoomCode : "",
    avatarColor: allowedAvatarColors.has(String(input.avatarColor))
      ? String(input.avatarColor)
      : "from-[#FDC323] to-[#EBB215]",
    avatarIcon: /^[a-z-]{1,32}$/.test(String(input.avatarIcon)) ? String(input.avatarIcon) : "graduation-cap",
  };
}

function getAuthorizedRoom(socket: Socket, roomId: unknown) {
  if (typeof roomId !== "string" || socketToRoomMap.get(socket.id) !== roomId) return undefined;
  const room = activeRooms.get(roomId);
  return room?.users[socket.id] ? room : undefined;
}

function allowSocketEvent(socketId: string, eventName: string, maxEvents: number, windowMs = 10000) {
  const now = Date.now();
  let socketRates = socketEventRates.get(socketId);
  if (!socketRates) {
    socketRates = new Map();
    socketEventRates.set(socketId, socketRates);
  }

  const current = socketRates.get(eventName);
  if (!current || now - current.windowStartedAt >= windowMs) {
    socketRates.set(eventName, { windowStartedAt: now, count: 1 });
    return true;
  }
  if (current.count >= maxEvents) return false;
  current.count++;
  return true;
}

function createRoomAndPair(io: SocketIOServer, user1: QueueUser, user2: QueueUser) {
  const s1 = io.sockets.sockets.get(user1.socketId);
  const s2 = io.sockets.sockets.get(user2.socketId);

  if (!s1 || !s2) {
    if (s1) matchmakingQueue.unshift(user1);
    if (s2) matchmakingQueue.unshift(user2);
    broadcastQueuePositions(io);
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
  broadcastQueuePositions(io);

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
        if (u2.user.roomCode && u2.user.roomCode.trim().toUpperCase() === code1 && !usersHaveBlockedEachOther(u1, u2)) {
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

      if (topic1 !== 'Umum' && topic1 === topic2 && !usersHaveBlockedEachOther(u1, u2)) {
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

  // 2. Default fallback: pair the first public users who have not blocked each other.
  let pair: { idx1: number; idx2: number; user1: QueueUser; user2: QueueUser } | undefined;
  for (let i = 0; i < publicIndices.length && !pair; i++) {
    for (let j = i + 1; j < publicIndices.length; j++) {
      const idx1 = publicIndices[i];
      const idx2 = publicIndices[j];
      const user1 = matchmakingQueue[idx1];
      const user2 = matchmakingQueue[idx2];
      if (!usersHaveBlockedEachOther(user1, user2)) {
        pair = { idx1, idx2, user1, user2 };
        break;
      }
    }
  }
  if (!pair) return;

  const { idx1, idx2, user1: u1, user2: u2 } = pair;
  const maxIdx = Math.max(idx1, idx2);
  const minIdx = Math.min(idx1, idx2);

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
    socket.on("join_queue", (userData: unknown) => {
      if (!allowSocketEvent(socket.id, "join_queue", 3) || !isRecord(userData)) return;
      removeFromQueue(socket.id);

      const user = normalizeUserProfile(socket.id, userData);

      const existingRoomId = socketToRoomMap.get(socket.id);
      if (existingRoomId) {
        const existingRoom = activeRooms.get(existingRoomId);
        const currentUser = existingRoom?.users[socket.id];
        if (existingRoom && currentUser) {
          socket.to(existingRoomId).emit("partner_left", {
            reason: "Partner telah meninggalkan sesi.",
            action: "leave",
            partnerName: currentUser.displayName,
          });
          activeRooms.delete(existingRoomId);
        }
        socket.leave(existingRoomId);
        socketToRoomMap.delete(socket.id);
      }

      matchmakingQueue.push({
        socketId: socket.id,
        user,
        joinedAt: Date.now(),
      });

      broadcastQueuePositions(io);

      io.emit("stats_update", getStats(io));
      tryMatchUsers(io);
    });

    // 1b. Instant Demo Partner
    socket.on("request_instant_partner", (userData: unknown) => {
      if (!allowSocketEvent(socket.id, "request_instant_partner", 3) || !isRecord(userData) || socketToRoomMap.has(socket.id)) return;
      const user = normalizeUserProfile(socket.id, userData);
      const lastBotId = lastAssignedBotMap.get(socket.id);
      const blockedBotIds = blockedPartners.get(socket.id) || new Set<string>();
      const availablePartners = demoPartners.filter((partner) => !blockedBotIds.has(partner.id));

      const eligiblePartners = availablePartners.filter(
        (p) => p.major !== user.major && p.id !== lastBotId
      );
      const fallbackPartners = availablePartners.filter((p) => p.id !== lastBotId);
      const pool = eligiblePartners.length > 0 ? eligiblePartners : (fallbackPartners.length > 0 ? fallbackPartners : availablePartners);
      if (pool.length === 0) return;
      const selectedPartner = pool[Math.floor(Math.random() * pool.length)];

      removeFromQueue(socket.id);
      broadcastQueuePositions(io);

      lastAssignedBotMap.set(socket.id, selectedPartner.id);

      const roomId = `room_instant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newRoom: RoomSession = {
        roomId,
        users: {
          [socket.id]: user,
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
        scratchpad: `// Catatan Bersama / Shared Scratchpad\n// ${user.displayName} & ${selectedPartner.displayName}\n\nTarget Belajar:\n- ${user.displayName}: ${user.currentGoal}\n- ${selectedPartner.displayName}: ${selectedPartner.currentGoal}\n\nCatatan:\n- Sesi belajar dimulai. Jangan ragu menggunakan timer Pomodoro!`,
        todos: [
          {
            id: `todo_${Date.now()}_1`,
            text: `${user.displayName}: ${user.currentGoal}`,
            done: false,
            addedBy: user.displayName,
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
      if (!allowSocketEvent(socket.id, "leave_queue", 5)) return;
      removeFromQueue(socket.id);
      broadcastQueuePositions(io);
      socket.emit("queue_status", { status: "left" });
      io.emit("stats_update", getStats(io));
    });

    // 3. WebRTC Signaling Relays
    socket.on("webrtc_offer", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "webrtc_offer", 20)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      const offer = payload.offer;
      if (!room || !isRecord(offer) || offer.type !== "offer" || typeof offer.sdp !== "string" || offer.sdp.length > 100000) return;
      socket.to(room.roomId).emit("webrtc_offer", { offer, from: socket.id });
    });

    socket.on("webrtc_answer", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "webrtc_answer", 20)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      const answer = payload.answer;
      if (!room || !isRecord(answer) || answer.type !== "answer" || typeof answer.sdp !== "string" || answer.sdp.length > 100000) return;
      socket.to(room.roomId).emit("webrtc_answer", { answer, from: socket.id });
    });

    socket.on("webrtc_ice_candidate", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "webrtc_ice_candidate", 120)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      const candidate = payload.candidate;
      if (!room || !isRecord(candidate) || typeof candidate.candidate !== "string" || candidate.candidate.length > 4096) return;
      socket.to(room.roomId).emit("webrtc_ice_candidate", { candidate, from: socket.id });
    });

    socket.on("peer_ready", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "peer_ready", 20)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      if (!room) return;
      socket.to(room.roomId).emit("peer_ready", { from: socket.id });
    });

    // 4. Media State Updates
    socket.on("media_state_change", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "media_state_change", 30)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      if (!room || typeof payload.videoEnabled !== "boolean" || typeof payload.audioEnabled !== "boolean" || typeof payload.screenSharing !== "boolean") return;
      socket.to(room.roomId).emit("partner_media_state", {
        videoEnabled: payload.videoEnabled,
        audioEnabled: payload.audioEnabled,
        screenSharing: payload.screenSharing,
      });
    });

    // 5. Real-time Chat
    socket.on("chat_message", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "chat_message", 8)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      const message = payload.message;
      if (!room || !isRecord(message)) return;
      const text = readText(message.text, 1200);
      if (!text) return;
      const sender = room.users[socket.id];
      io.to(room.roomId).emit("chat_message", {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        senderId: sender.id,
        senderName: sender.displayName,
        text,
        timestamp: Date.now(),
        type: message.type === "goal_completed" ? "goal_completed" : "chat",
      });
    });

    socket.on("chat_typing", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "chat_typing", 30)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      if (!room || typeof payload.isTyping !== "boolean") return;
      socket.to(room.roomId).emit("partner_typing", {
        isTyping: payload.isTyping,
        userName: room.users[socket.id].displayName,
      });
    });

    // 6. Synchronized Pomodoro Events
    socket.on("pomodoro_action", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "pomodoro_action", 12)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      if (!room) return;
      const pomodoro = room.pomodoro;
      const action = payload.action;
      const modeDurations = { focus: 25, short_break: 5, long_break: 15 } as const;

      if (action === "start") {
        pomodoro.isRunning = true;
        pomodoro.lastUpdated = Date.now();
      } else if (action === "pause") {
        const timeLeft = payload.timeLeft;
        if (typeof timeLeft !== "number" || !Number.isFinite(timeLeft) || timeLeft < 0 || timeLeft > pomodoro.duration) return;
        pomodoro.isRunning = false;
        pomodoro.timeLeft = timeLeft;
      } else if (action === "reset") {
        pomodoro.isRunning = false;
        pomodoro.duration = modeDurations[pomodoro.mode] * 60;
        pomodoro.timeLeft = pomodoro.duration;
      } else if (action === "change_mode") {
        if (typeof payload.mode !== "string" || !Object.hasOwn(modeDurations, payload.mode)) return;
        pomodoro.mode = payload.mode as keyof typeof modeDurations;
        pomodoro.duration = modeDurations[pomodoro.mode] * 60;
        pomodoro.timeLeft = pomodoro.duration;
        pomodoro.isRunning = false;
      } else if (action === "completed") {
        const elapsedSeconds = (Date.now() - pomodoro.lastUpdated) / 1000;
        if (!pomodoro.isRunning || elapsedSeconds + 1 < pomodoro.timeLeft) return;
        if (pomodoro.mode === "focus") {
          pomodoro.sessionsCompleted++;
          totalStudyMinutesCount += Math.round(pomodoro.duration / 60);
        }
        pomodoro.isRunning = false;
        pomodoro.timeLeft = 0;
      } else {
        return;
      }

      io.to(room.roomId).emit("pomodoro_sync", pomodoro);
    });

    // 7. Synchronized Scratchpad
    socket.on("scratchpad_update", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "scratchpad_update", 30)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      if (!room || typeof payload.content !== "string" || payload.content.length > 20000) return;
      room.scratchpad = payload.content;
      socket.to(room.roomId).emit("scratchpad_sync", room.scratchpad);
    });

    // 8. Synchronized Todo list
    socket.on("todo_action", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "todo_action", 20)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      const todo = payload.todo;
      if (!room || !isRecord(todo)) return;

      if (payload.action === "add") {
        const text = readText(todo.text, 200);
        if (!text || room.todos.length >= 50) return;
        room.todos.push({
          id: `todo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          text,
          done: false,
          addedBy: room.users[socket.id].displayName,
        });
      } else if (payload.action === "toggle" || payload.action === "delete") {
        if (typeof todo.id !== "string" || todo.id.length > 80) return;
        const index = room.todos.findIndex((item) => item.id === todo.id);
        if (index < 0) return;
        if (payload.action === "toggle") room.todos[index].done = !room.todos[index].done;
        else room.todos.splice(index, 1);
      } else {
        return;
      }
      io.to(room.roomId).emit("todo_sync", room.todos);
    });

    // 9. Quick Reaction
    socket.on("study_reaction", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "study_reaction", 8)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      const allowedReactions = new Set(["flame", "thumbs", "coffee", "lightbulb", "award", "heart", "sparkles"]);
      if (!room || typeof payload.reaction !== "string" || !allowedReactions.has(payload.reaction)) return;
      io.to(room.roomId).emit("study_reaction", {
        reaction: payload.reaction,
        userName: room.users[socket.id].displayName,
        timestamp: Date.now(),
      });
    });

    // 9b. Whiteboard Sync
    socket.on("whiteboard_draw", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "whiteboard_draw", 150)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      const drawData = payload.drawData;
      if (!room || !isRecord(drawData)) return;
      if (drawData.clearAll === true) {
        socket.to(room.roomId).emit("whiteboard_draw", { clearAll: true });
        return;
      }
      if (
        typeof drawData.x !== "number" || !Number.isFinite(drawData.x) || drawData.x < 0 || drawData.x > 800
        || typeof drawData.y !== "number" || !Number.isFinite(drawData.y) || drawData.y < 0 || drawData.y > 500
        || typeof drawData.size !== "number" || !Number.isFinite(drawData.size) || drawData.size < 1 || drawData.size > 80
        || typeof drawData.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(drawData.color)
        || typeof drawData.isDrawing !== "boolean"
      ) return;
      socket.to(room.roomId).emit("whiteboard_draw", {
        x: drawData.x,
        y: drawData.y,
        size: drawData.size,
        color: drawData.color,
        isDrawing: drawData.isDrawing,
      });
    });

    // 9c. Report & Block User
    socket.on("report_user", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "report_user", 3, 60000)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      if (!room) return;
      const reason = readText(payload.reason, 80);
      const allowedReasons = new Set([
        "Tidak aktif / AFK",
        "Perilaku tidak pantas / Toksik",
        "Spam / Konten Mengganggu",
      ]);
      if (!allowedReasons.has(reason)) return;

      const reporter = room.users[socket.id];
      const partnerSocketId = Object.keys(room.users).find((socketId) => socketId !== socket.id);
      const partner = partnerSocketId ? room.users[partnerSocketId] : undefined;
      if (payload.blockPartner === true && partner) {
        const blockedIds = blockedPartners.get(reporter.id) || new Set<string>();
        blockedIds.add(partner.id);
        blockedPartners.set(reporter.id, blockedIds);
      }

      console.log(`[Safety Report] Room ${room.roomId}: User ${reporter.displayName} reported partner for reason: ${reason}`);
      socket.to(room.roomId).emit("partner_left", {
        reason: "Partner mengakhiri sesi dan mengirim laporan.",
        action: "skip",
        partnerName: reporter.displayName,
      });

      activeRooms.delete(room.roomId);
      socket.leave(room.roomId);
      socketToRoomMap.delete(socket.id);
      removeFromQueue(socket.id);
      matchmakingQueue.push({ socketId: socket.id, user: reporter, joinedAt: Date.now() });
      broadcastQueuePositions(io);
      io.emit("stats_update", getStats(io));
      tryMatchUsers(io);
    });

    socket.on("session_feedback", (payload: unknown, acknowledge?: (response: { ok: boolean }) => void) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "session_feedback", 3, 60000)) {
        acknowledge?.({ ok: false });
        return;
      }
      const rating = payload.rating;
      if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        acknowledge?.({ ok: false });
        return;
      }
      sessionFeedbackCount++;
      sessionFeedbackTotal += rating;
      console.log(`[Session Feedback] Average ${ (sessionFeedbackTotal / sessionFeedbackCount).toFixed(2) }/5 from ${sessionFeedbackCount} anonymous ratings`);
      acknowledge?.({ ok: true });
    });

    // 10. Skip / Next Partner
    socket.on("skip_partner", (payload: unknown) => {
      if (!isRecord(payload) || !allowSocketEvent(socket.id, "skip_partner", 5)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      if (!room) return;
      const currentUser = room.users[socket.id];
      socket.to(room.roomId).emit("partner_left", {
        reason: "Partner beralih mencari teman belajar berikutnya (Skip).",
        action: "skip",
        partnerName: currentUser.displayName,
      });

      activeRooms.delete(room.roomId);
      socket.leave(room.roomId);
      socketToRoomMap.delete(socket.id);
      removeFromQueue(socket.id);
      matchmakingQueue.push({ socketId: socket.id, user: currentUser, joinedAt: Date.now() });
      broadcastQueuePositions(io);
      io.emit("stats_update", getStats(io));
      tryMatchUsers(io);
    });

    // 11. End Session & Leave
    socket.on("leave_room", (payload: unknown) => {
      if (!isRecord(payload)) return;
      const room = getAuthorizedRoom(socket, payload.roomId);
      if (!room) return;
      const currentUser = room.users[socket.id];
      socket.to(room.roomId).emit("partner_left", {
        reason: "Partner telah menyelesaikan sesi belajar.",
        action: "leave",
        partnerName: currentUser.displayName,
      });
      activeRooms.delete(room.roomId);
      socket.leave(room.roomId);
      socketToRoomMap.delete(socket.id);

      io.emit("stats_update", getStats(io));
    });

    // Disconnect handler
    socket.on("disconnect", () => {
      socketEventRates.delete(socket.id);
      blockedPartners.delete(socket.id);
      for (const blockedIds of blockedPartners.values()) blockedIds.delete(socket.id);
      removeFromQueue(socket.id);
      broadcastQueuePositions(io);

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
