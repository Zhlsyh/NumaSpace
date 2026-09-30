import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { 
  UserProfile, 
  RoomSessionData, 
  ChatMessage, 
  PomodoroState, 
  TodoItem, 
  MediaState, 
  StudyReaction,
  NetworkQuality
} from '../types';
import { WebRTCManager } from '../utils/webrtc';
import { studyAudio } from '../utils/audio';
import { sendBrowserNotification } from '../utils/streak';
import { selfieTracker } from '../utils/selfieSegmentation';
import { WhiteboardModal } from './WhiteboardModal';
import { NumaLogo } from './NumaLogo';


import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  MessageSquare, 
  Send, 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  LogOut, 
  Volume2, 
  VolumeX, 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  FileText, 
  Sparkles, 
  Clock, 
  Flame, 
  Radio, 
  Coffee, 
  CloudRain, 
  Waves, 
  Zap,
  Target,
  Keyboard,
  X,
  Command,
  HelpCircle,
  Check,
  ShieldAlert,
  EyeOff,
  FlipHorizontal,
  Focus,
  ThumbsUp,
  Lightbulb,
  Award,
  Heart,
  Timer
} from 'lucide-react';


interface Props {
  socket: Socket | null;
  roomData: RoomSessionData;
  myProfile: UserProfile;
  onSkipPartner: (report?: { reason: string; blockPartner: boolean }) => void;
  onLeaveRoom: (summary: { focusMinutes: number; todosCompleted: number }) => void;
}

const QUICK_REACTIONS = [
  { id: 'flame', name: 'Semangat', icon: Flame, color: 'text-amber-500 bg-amber-50 border-amber-200' },
  { id: 'thumbs', name: 'Mantap', icon: ThumbsUp, color: 'text-blue-500 bg-blue-50 border-blue-200' },
  { id: 'coffee', name: 'Kopi', icon: Coffee, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { id: 'lightbulb', name: 'Ide', icon: Lightbulb, color: 'text-yellow-500 bg-yellow-50 border-yellow-200' },
  { id: 'award', name: 'Hebat', icon: Award, color: 'text-purple-500 bg-purple-50 border-purple-200' },
  { id: 'heart', name: 'Suka', icon: Heart, color: 'text-rose-500 bg-rose-50 border-rose-200' },
  { id: 'sparkles', name: 'Keren', icon: Sparkles, color: 'text-indigo-500 bg-indigo-50 border-indigo-200' },
];


export const StudyRoom: React.FC<Props> = ({
  socket,
  roomData,
  myProfile,
  onSkipPartner,
  onLeaveRoom,
}) => {
  // WebRTC & Media States
  const [mediaState, setMediaState] = useState<MediaState>({
    videoEnabled: false,
    audioEnabled: false,
    screenSharing: false,
    partnerVideoEnabled: false,
    partnerAudioEnabled: false,
    partnerScreenSharing: false,
  });

  const [myVolumeLevel, setMyVolumeLevel] = useState<number>(0);
  const [partnerVolumeLevel, setPartnerVolumeLevel] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'tools' | 'chat'>('tools');
  const [mobileTab, setMobileTab] = useState<'stage' | 'tools' | 'chat'>('stage');
  const [activeTool, setActiveTool] = useState<'pomodoro' | 'scratchpad' | 'todos'>('pomodoro');

  const [showWhiteboard, setShowWhiteboard] = useState<boolean>(false);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('unknown');
  const [rttMs, setRttMs] = useState<number>(0);

  // Video & Audio Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localCanvasRef = useRef<HTMLCanvasElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);

  // Synchronized Room States
  const [pomodoro, setPomodoro] = useState<PomodoroState>(roomData.pomodoro);
  const [scratchpad, setScratchpad] = useState<string>(roomData.scratchpad);
  const [todos, setTodos] = useState<TodoItem[]>(roomData.todos);
  const [newTodoText, setNewTodoText] = useState('');
  
  // Chat States
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'system_welcome',
      senderId: 'system',
      senderName: 'Numa Space Bot',
      text: `Sesi belajar dimulai! Terhubung dengan ${roomData.partner.displayName} (${roomData.partner.major}).`,
      timestamp: Date.now(),
      type: 'system',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Ambient Sound States
  const [ambientType, setAmbientType] = useState<'none' | 'rain' | 'cafe' | 'whitenoise' | 'binaural'>('none');
  const [ambientVolume, setAmbientVolume] = useState(0.35);

  // Floating Reactions
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string; name: string }>>([]);

  // Session duration timer
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Keyboard Shortcuts States
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [shortcutToast, setShortcutToast] = useState<{ message: string; key: string } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Typing Indicator Debounce & Auto-Clear Refs
  const myTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const partnerTypingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Camera Blur, Mirror & Safety Report States
  const [cameraBlur, setCameraBlur] = useState<boolean>(false);
  const [cameraMirror, setCameraMirror] = useState<boolean>(true);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // MediaPipe AI Segmentation & Portrait Blur Effect
  useEffect(() => {
    if (cameraBlur && mediaState.videoEnabled && localVideoRef.current && localCanvasRef.current) {
      selfieTracker.loadMediaPipe().then(() => {
        if (localVideoRef.current && localCanvasRef.current) {
          selfieTracker.startBlurLoop(localVideoRef.current, localCanvasRef.current, cameraMirror);
        }
      });
    } else {
      selfieTracker.stopBlurLoop();
    }
    return () => {
      selfieTracker.stopBlurLoop();
    };
  }, [cameraBlur, mediaState.videoEnabled, cameraMirror]);



  const handleReportUser = (reason: string, blockPartner: boolean) => {
    setShowReportModal(false);
    selfieTracker.stopBlurLoop();
    webrtcManagerRef.current?.cleanup();
    onSkipPartner({ reason, blockPartner });
  };

  const triggerShortcutToast = useCallback((message: string, key: string) => {

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setShortcutToast({ message, key });
    toastTimeoutRef.current = setTimeout(() => {
      setShortcutToast(null);
    }, 1600);
  }, []);

  // Initialize WebRTC and Socket listeners
  useEffect(() => {
    studyAudio.playMatchSound();
    sendBrowserNotification(
      'Partner Belajar Ditemukan!',
      `Terhubung dengan ${roomData.partner.displayName} (${roomData.partner.major})`
    );


    const rtc = new WebRTCManager();
    webrtcManagerRef.current = rtc;

    if (socket) {
      rtc.setIsInitiator(roomData.isInitiator);
      rtc.initialize(
        socket,
        roomData.roomId,
        (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch((err) => {
              console.log('Remote video play warning:', err);
              setIsAutoplayBlocked(true);
            });
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch((err) => {
              console.log('Remote audio play warning:', err);
              setIsAutoplayBlocked(true);
            });
          }
        },
        (connectionState) => {
          console.log('WebRTC Connection state:', connectionState);
          if (connectionState === 'connected') {
            remoteVideoRef.current?.play().catch(() => setIsAutoplayBlocked(true));
            remoteAudioRef.current?.play().catch(() => setIsAutoplayBlocked(true));
          }
        },
        (vol) => {
          setMyVolumeLevel(vol);
        },
        (quality, rtt) => {
          setNetworkQuality(quality);
          setRttMs(rtt);
        },
        (kind, active) => {
          if (kind === 'video') {
            setMediaState((prev) => ({ ...prev, partnerVideoEnabled: active }));
          } else if (kind === 'audio') {
            setMediaState((prev) => ({ ...prev, partnerAudioEnabled: active }));
          }
          if (remoteVideoRef.current) {
            if (remoteVideoRef.current.srcObject) {
              const currentStream = remoteVideoRef.current.srcObject;
              remoteVideoRef.current.srcObject = null;
              remoteVideoRef.current.srcObject = currentStream;
            }
            remoteVideoRef.current.play().catch(() => setIsAutoplayBlocked(true));
          }
          if (remoteAudioRef.current) {
            if (remoteAudioRef.current.srcObject) {
              const currentStream = remoteAudioRef.current.srcObject;
              remoteAudioRef.current.srcObject = null;
              remoteAudioRef.current.srcObject = currentStream;
            }
            remoteAudioRef.current.play().catch(() => setIsAutoplayBlocked(true));
          }
        }
      );

      // Initialize local media stream on mount and apply studyMode preference
      const isSilentMode = myProfile.studyMode === 'silent';
      const isDiscussionMode = myProfile.studyMode === 'discussion';

      rtc.startLocalMedia(false, isDiscussionMode && !isSilentMode).then((stream) => {
        if (localVideoRef.current && stream) {
          localVideoRef.current.srcObject = stream;
        }
        setMediaState((prev) => ({
          ...prev,
          videoEnabled: false,
          audioEnabled: isDiscussionMode && !isSilentMode,
        }));
        
        // Broadcast readiness and send WebRTC offer if initiator
        socket.emit('peer_ready', { roomId: roomData.roomId });
        if (roomData.isInitiator && !roomData.isDemoBot) {
          rtc.createAndSendOffer();
        }
      });

      // Auto-enable ambient sound for Casual mode
      if (myProfile.studyMode === 'casual') {
        studyAudio.setAmbient('cafe');
        studyAudio.setVolume(ambientVolume);
        setAmbientType('cafe');
      }

      // Unblock mobile browser media playback policy on user gesture
      const handleUserGesture = () => {
        if (remoteVideoRef.current && remoteVideoRef.current.paused) {
          remoteVideoRef.current.play().catch(() => {});
        }
        if (remoteAudioRef.current && remoteAudioRef.current.paused) {
          remoteAudioRef.current.play().catch(() => {});
        }
        studyAudio.resumeContext();
        setIsAutoplayBlocked(false);
      };
      window.addEventListener('click', handleUserGesture, { once: false });
      window.addEventListener('touchstart', handleUserGesture, { once: false });

      // Socket Listeners for Room Events
      socket.on('partner_media_state', (state: { videoEnabled: boolean; audioEnabled: boolean; screenSharing: boolean }) => {
        setMediaState((prev) => ({
          ...prev,
          partnerVideoEnabled: state.videoEnabled,
          partnerAudioEnabled: state.audioEnabled,
          partnerScreenSharing: state.screenSharing,
        }));
        if (remoteVideoRef.current) {
          remoteVideoRef.current.play().catch(() => {});
        }
      });

      socket.on('chat_message', (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
        studyAudio.playMessagePop();
      });

      socket.on('partner_typing', ({ isTyping }: { isTyping: boolean }) => {
        if (partnerTypingTimerRef.current) {
          clearTimeout(partnerTypingTimerRef.current);
          partnerTypingTimerRef.current = null;
        }

        if (isTyping) {
          setIsPartnerTyping(true);
          partnerTypingTimerRef.current = setTimeout(() => {
            setIsPartnerTyping(false);
          }, 2500);
        } else {
          setIsPartnerTyping(false);
        }
      });

      socket.on('pomodoro_sync', (pState: PomodoroState) => {
        setPomodoro(pState);
      });

      socket.on('scratchpad_sync', (content: string) => {
        setScratchpad(content);
      });

      socket.on('todo_sync', (updatedTodos: TodoItem[]) => {
        setTodos(updatedTodos);
      });

      socket.on('study_reaction', (data: StudyReaction) => {
        triggerFloatingReaction(data.reaction, data.userName);
        studyAudio.playMessagePop();
      });
    }

    // Session duration timer
    const sessionTimer = setInterval(() => {
      setSessionSeconds((s) => s + 1);
    }, 1000);

    return () => {
      clearInterval(sessionTimer);
      selfieTracker.stopBlurLoop();
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        try {
          const stream = localVideoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((t) => {
            t.enabled = false;
            t.stop();
          });
        } catch {
          // ignore
        }
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
        try {
          const stream = remoteVideoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((t) => {
            t.enabled = false;
            t.stop();
          });
        } catch {
          // ignore
        }
        remoteVideoRef.current.srcObject = null;
      }
      rtc.cleanup();
      studyAudio.setAmbient('none');
      if (socket) {
        socket.off('partner_media_state');
        socket.off('chat_message');
        socket.off('partner_typing');
        socket.off('pomodoro_sync');
        socket.off('scratchpad_sync');
        socket.off('todo_sync');
        socket.off('study_reaction');
      }
    };
  }, [roomData.roomId]);

  // Watchdog timer to detect frozen or stalled partner video stream and auto-recover
  const lastPartnerVideoTimeRef = useRef<number>(0);
  const partnerVideoStuckCountRef = useRef<number>(0);

  useEffect(() => {
    const watchdogTimer = setInterval(() => {
      if (!remoteVideoRef.current) return;
      const video = remoteVideoRef.current;

      if (mediaState.partnerVideoEnabled) {
        const currentTime = video.currentTime;
        if (video.paused || (currentTime > 0 && currentTime === lastPartnerVideoTimeRef.current)) {
          partnerVideoStuckCountRef.current += 1;
          if (partnerVideoStuckCountRef.current >= 2) {
            console.warn('[Watchdog] Partner video detected stuck or paused, attempting stream recovery...');
            if (webrtcManagerRef.current) {
              webrtcManagerRef.current.refreshRemoteStream();
            }
            video.play().catch(() => setIsAutoplayBlocked(true));
            partnerVideoStuckCountRef.current = 0;
          }
        } else {
          partnerVideoStuckCountRef.current = 0;
        }
        lastPartnerVideoTimeRef.current = currentTime;
      }
    }, 2500);

    return () => clearInterval(watchdogTimer);
  }, [mediaState.partnerVideoEnabled]);


  // Pomodoro countdown timer tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (pomodoro.isRunning) {
      interval = setInterval(() => {
        setPomodoro((prev) => {
          if (prev.timeLeft <= 1) {
            studyAudio.playPomodoroChime();
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });

            // Next mode calculation
            const nextMode = prev.mode === 'focus' ? 'short_break' : 'focus';
            const nextDuration = nextMode === 'focus' ? 25 * 60 : 5 * 60;

            if (socket) {
              socket.emit('pomodoro_action', {
                roomId: roomData.roomId,
                action: 'completed',
              });
              socket.emit('pomodoro_action', {
                roomId: roomData.roomId,
                action: 'change_mode',
                mode: nextMode,
                duration: nextDuration / 60,
              });
            }

            return {
              ...prev,
              mode: nextMode,
              duration: nextDuration,
              timeLeft: nextDuration,
              isRunning: false,
              sessionsCompleted: prev.sessionsCompleted + (prev.mode === 'focus' ? 1 : 0),
            };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pomodoro.isRunning, roomData.roomId]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPartnerTyping]);

  // Bot response simulation if testing in demo mode
  useEffect(() => {
    if (roomData.isDemoBot && messages.length === 1) {
      const timer = setTimeout(() => {
        const greetings = [
          `Halo ${myProfile.displayName}! Salam kenal. Saya juga lagi fokus belajar ${roomData.partner.interest}. Ayo kita mulai sesi Pomodoro 25 menit pertama! 🚀`,
          `Hai! Target saya hari ini: ${roomData.partner.currentGoal}. Semangat belajarnya ya!`,
        ];
        const botMsg: ChatMessage = {
          id: `bot_${Date.now()}`,
          senderId: roomData.partner.id,
          senderName: roomData.partner.displayName,
          text: greetings[Math.floor(Math.random() * greetings.length)],
          timestamp: Date.now(),
          type: 'chat',
        };
        setMessages((prev) => [...prev, botMsg]);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [roomData.isDemoBot]);

  // Media Toggle Handlers
  const handleToggleCamera = async () => {
    const nextState = !mediaState.videoEnabled;
    setMediaState((prev) => ({ ...prev, videoEnabled: nextState }));

    const stream = await webrtcManagerRef.current?.toggleCamera(nextState);
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }

    socket?.emit('media_state_change', {
      roomId: roomData.roomId,
      videoEnabled: nextState,
      audioEnabled: mediaState.audioEnabled,
      screenSharing: mediaState.screenSharing,
    });
  };

  const handleToggleMic = async () => {
    const nextState = !mediaState.audioEnabled;
    setMediaState((prev) => ({ ...prev, audioEnabled: nextState }));

    await webrtcManagerRef.current?.toggleMic(nextState);

    socket?.emit('media_state_change', {
      roomId: roomData.roomId,
      videoEnabled: mediaState.videoEnabled,
      audioEnabled: nextState,
      screenSharing: mediaState.screenSharing,
    });
  };

  const handleToggleScreenShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      alert('Fitur Berbagi Layar (Screen Share) membutuhkan dukungan browser Komputer (Chrome/Edge/Firefox) atau browser seluler yang mendukung getDisplayMedia.');
      return;
    }

    try {
      if (!mediaState.screenSharing) {
        const stream = await webrtcManagerRef.current?.startScreenShare();
        if (stream) {
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(() => {});
          }
          setMediaState((prev) => ({ ...prev, screenSharing: true }));
          socket?.emit('media_state_change', {
            roomId: roomData.roomId,
            videoEnabled: mediaState.videoEnabled,
            audioEnabled: mediaState.audioEnabled,
            screenSharing: true,
          });
        }
      } else {
        await webrtcManagerRef.current?.stopScreenShare();
        if (localVideoRef.current && webrtcManagerRef.current) {
          const cameraStream = await webrtcManagerRef.current.toggleCamera(mediaState.videoEnabled);
          if (cameraStream) {
            localVideoRef.current.srcObject = cameraStream;
            localVideoRef.current.play().catch(() => {});
          }
        }
        setMediaState((prev) => ({ ...prev, screenSharing: false }));
        socket?.emit('media_state_change', {
          roomId: roomData.roomId,
          videoEnabled: mediaState.videoEnabled,
          audioEnabled: mediaState.audioEnabled,
          screenSharing: false,
        });
      }
    } catch (err: any) {
      console.warn('Screen share error or canceled:', err);
      if (err?.name !== 'NotAllowedError') {
        alert('Gagal memulai Berbagi Layar. Pastikan Anda memberikan izin akses berbagi layar.');
      }
    }
  };


  // Pomodoro Handlers
  const handlePomodoroPlayPause = () => {
    const nextRunning = !pomodoro.isRunning;
    setPomodoro((prev) => ({ ...prev, isRunning: nextRunning }));

    socket?.emit('pomodoro_action', {
      roomId: roomData.roomId,
      action: nextRunning ? 'start' : 'pause',
      timeLeft: pomodoro.timeLeft,
    });
  };

  const handlePomodoroReset = () => {
    const initialTime = (pomodoro.mode === 'focus' ? 25 : pomodoro.mode === 'short_break' ? 5 : 15) * 60;
    setPomodoro((prev) => ({
      ...prev,
      isRunning: false,
      timeLeft: initialTime,
      duration: initialTime,
    }));

    socket?.emit('pomodoro_action', {
      roomId: roomData.roomId,
      action: 'reset',
      duration: initialTime / 60,
    });
  };

  const handlePomodoroChangeMode = (mode: 'focus' | 'short_break' | 'long_break') => {
    const mins = mode === 'focus' ? 25 : mode === 'short_break' ? 5 : 15;
    setPomodoro((prev) => ({
      ...prev,
      mode,
      duration: mins * 60,
      timeLeft: mins * 60,
      isRunning: false,
    }));

    socket?.emit('pomodoro_action', {
      roomId: roomData.roomId,
      action: 'change_mode',
      mode,
      duration: mins,
    });
  };

  // Scratchpad handler
  const handleScratchpadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setScratchpad(val);
    socket?.emit('scratchpad_update', {
      roomId: roomData.roomId,
      content: val,
    });
  };

  // Todo items handlers
  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    const newTodo: TodoItem = {
      id: `todo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: `${myProfile.displayName}: ${newTodoText.trim()}`,
      done: false,
      addedBy: myProfile.displayName,
    };

    setTodos((prev) => [...prev, newTodo]);
    setNewTodoText('');

    socket?.emit('todo_action', {
      roomId: roomData.roomId,
      action: 'add',
      todo: newTodo,
    });
  };

  const handleToggleTodo = (todo: TodoItem) => {
    const willBeDone = !todo.done;
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, done: willBeDone } : t))
    );

    if (willBeDone) {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      studyAudio.playMessagePop();

      // Announce goal completion in chat
      socket?.emit('chat_message', {
        roomId: roomData.roomId,
        message: {
          senderId: 'system',
          senderName: 'Target Selesai',
          text: `🎉 ${myProfile.displayName} telah menyelesaikan: "${todo.text}"`,
          type: 'goal_completed',
        },
      });
    }

    socket?.emit('todo_action', {
      roomId: roomData.roomId,
      action: 'toggle',
      todo,
    });
  };

  const handleDeleteTodo = (todo: TodoItem) => {
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    socket?.emit('todo_action', {
      roomId: roomData.roomId,
      action: 'delete',
      todo,
    });
  };

  // Real-time Chat Typing Debouncer & Event Emitter
  const handleChatInputChange = (text: string) => {
    setChatInput(text);

    if (socket) {
      if (text.trim().length > 0) {
        socket.emit('chat_typing', {
          roomId: roomData.roomId,
          isTyping: true,
          userName: myProfile.displayName,
        });

        if (myTypingTimeoutRef.current) {
          clearTimeout(myTypingTimeoutRef.current);
        }

        // Auto-stop typing indicator after 2 seconds of inactivity
        myTypingTimeoutRef.current = setTimeout(() => {
          socket.emit('chat_typing', {
            roomId: roomData.roomId,
            isTyping: false,
            userName: myProfile.displayName,
          });
        }, 2000);
      } else {
        if (myTypingTimeoutRef.current) {
          clearTimeout(myTypingTimeoutRef.current);
        }
        socket.emit('chat_typing', {
          roomId: roomData.roomId,
          isTyping: false,
          userName: myProfile.displayName,
        });
      }
    }
  };

  // Chat send handler
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    // Immediately stop local typing indicator
    if (myTypingTimeoutRef.current) {
      clearTimeout(myTypingTimeoutRef.current);
    }
    socket?.emit('chat_typing', {
      roomId: roomData.roomId,
      isTyping: false,
      userName: myProfile.displayName,
    });

    const msg: Omit<ChatMessage, 'id' | 'timestamp'> = {
      senderId: myProfile.id,
      senderName: myProfile.displayName,
      text: chatInput.trim(),
      type: 'chat',
    };

    if (roomData.isDemoBot) {
      // Local addition for instant demo
      const fullMsg: ChatMessage = {
        ...msg,
        id: `msg_${Date.now()}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, fullMsg]);

      // Trigger automatic smart response from simulated partner
      setTimeout(() => {
        setIsPartnerTyping(true);
        setTimeout(() => {
          setIsPartnerTyping(false);
          const replies = [
            `Mantap! Saya juga lagi fokus baca bab yang ini. Semangat terus ya! 📚`,
            `Siap! Jangan lupa minum air putih dan istirahat pas timer Pomodoro bunyi.`,
            `Keren! Nanti pas rehat 5 menit kita review bareng target masing-masing ya. 👍`,
          ];
          const botReply: ChatMessage = {
            id: `reply_${Date.now()}`,
            senderId: roomData.partner.id,
            senderName: roomData.partner.displayName,
            text: replies[Math.floor(Math.random() * replies.length)],
            timestamp: Date.now(),
            type: 'chat',
          };
          setMessages((prev) => [...prev, botReply]);
          studyAudio.playMessagePop();
        }, 1200);
      }, 600);
    } else {
      socket?.emit('chat_message', {
        roomId: roomData.roomId,
        message: msg,
      });
    }

    setChatInput('');
  };

  // Ambient sound handler
  const handleToggleAmbient = (type: 'none' | 'rain' | 'cafe' | 'whitenoise' | 'binaural') => {
    if (ambientType === type) {
      studyAudio.setAmbient('none');
      setAmbientType('none');
    } else {
      studyAudio.setAmbient(type);
      setAmbientType(type);
    }
  };

  const handleAmbientVolume = (vol: number) => {
    setAmbientVolume(vol);
    studyAudio.setVolume(vol);
  };

  // Floating Reaction handler
  const triggerFloatingReaction = (emoji: string, userName: string) => {
    const id = `react_${Date.now()}_${Math.random()}`;
    setFloatingReactions((prev) => [...prev, { id, emoji, name: userName }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3000);
  };

  const handleSendReaction = (emoji: string) => {
    triggerFloatingReaction(emoji, myProfile.displayName);
    studyAudio.playMessagePop();

    socket?.emit('study_reaction', {
      roomId: roomData.roomId,
      reaction: emoji,
      userName: myProfile.displayName,
    });
  };

  // Formatting helpers
  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatSessionTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}j ${m}m`;
    return `${m}m ${s}d`;
  };

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // If user is currently typing in an input/textarea
      if (isInputField) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Ignore if modifier keys like Ctrl, Cmd, Alt are held
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Space: Toggle Mic (Mute/Unmute)
      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleMic();
        triggerShortcutToast(
          !mediaState.audioEnabled ? '🎤 Mikrofon Diaktifkan' : '🔇 Mikrofon Dimatikan (Mute)',
          'Space'
        );
      }
      // V: Toggle Camera Video
      else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        handleToggleCamera();
        triggerShortcutToast(
          !mediaState.videoEnabled ? '📹 Kamera Diaktifkan' : '📷 Kamera Dinonaktifkan',
          'V'
        );
      }
      // Esc: Skip Partner (or close modal if open)
      else if (e.key === 'Escape') {
        e.preventDefault();
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else {
          triggerShortcutToast('⏭️ Mencari Partner Baru...', 'Esc');
          onSkipPartner();
        }
      }
      // P: Toggle Pomodoro Timer Play / Pause
      else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handlePomodoroPlayPause();
        triggerShortcutToast(
          !pomodoro.isRunning ? '🍅 Pomodoro Dimulai' : '⏸️ Pomodoro Dijeda',
          'P'
        );
      }
      // R: Reset Pomodoro Timer
      else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handlePomodoroReset();
        triggerShortcutToast('🔄 Pomodoro Direset', 'R');
      }
      // C: Switch to Chat Tab
      else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setActiveTab('chat');
        triggerShortcutToast('💬 Membuka Tab Obrolan', 'C');
      }
      // T: Switch to Tools Tab (Notes & Checklist)
      else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setActiveTab('tools');
        triggerShortcutToast('📝 Membuka Target & Catatan', 'T');
      }
      // ? or H: Toggle Shortcuts Help Modal
      else if (e.key === '?' || e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      }
      // 1 to 7: Send Quick Reaction Icon
      else if (/^[1-7]$/.test(e.key)) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= QUICK_REACTIONS.length) {
          e.preventDefault();
          const reactionObj = QUICK_REACTIONS[num - 1];
          handleSendReaction(reactionObj.id);
          triggerShortcutToast(`Reaksi Dikirim: ${reactionObj.name}`, `${num}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    mediaState.audioEnabled,
    mediaState.videoEnabled,
    pomodoro.isRunning,
    showShortcutsModal,
    onSkipPartner,
    triggerShortcutToast,
  ]);

  return (
    <div className="min-h-screen text-[#0F1E1C] flex flex-col font-sans selection:bg-[#FDC323] selection:text-[#0F1E1C] relative overflow-x-hidden">
      
      {/* Floating Reaction Layer with Framer Motion Drift (Positioned high above bottom controls) */}
      <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
        <AnimatePresence>
          {floatingReactions.map((r) => {
            const reactionObj = QUICK_REACTIONS.find((q) => q.id === r.emoji) || QUICK_REACTIONS[0];
            const IconComp = reactionObj.icon;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 0, scale: 0.7 }}
                animate={{ opacity: 1, y: -160, scale: 1.1 }}
                exit={{ opacity: 0, y: -230, scale: 0.8 }}
                transition={{ duration: 2.5, ease: "easeOut" }}
                className="absolute bottom-36 right-4 sm:right-12 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border-2 border-[#0F1E1C] shadow-xl text-xs text-[#0F1E1C] font-black pointer-events-none z-30"
              >
                <div className={`p-1.5 rounded-full ${reactionObj.color}`}>
                  <IconComp className="w-4 h-4" />
                </div>
                <span className="font-black text-[#0F1E1C]">{r.name}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Top Bar: Clean Flat Navbar (Logo, Timer, Skip & Akhiri) */}
      <header className="border-b-2 border-[#D2E4E8] bg-white/70 backdrop-blur-md px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between gap-2 sticky top-0 z-30 shadow-xs text-[#0F1E1C] w-full overflow-hidden">
        
        {/* Left: App Logo & Active Session Status Badge */}
        <div className="flex items-center gap-2 sm:gap-3 shrink min-w-0 overflow-hidden">
          <div className="shrink-0 max-sm:[&_span]:hidden">
            <NumaLogo size="sm" theme="dark" />
          </div>

          {/* Unified Active Session Box */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#EDF5F7] border border-[#D2E4E8] text-[#0F1E1C] shrink min-w-0 truncate">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00785D] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00785D]"></span>
              </span>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-[#0F1E1C] truncate">
                {myProfile.roomCode ? `Private: ${myProfile.roomCode}` : 'Sesi Aktif'}
              </span>
            </div>

            <span className="text-[#539BA9] text-xs">|</span>

            <div className="flex items-center gap-1 text-[10px] sm:text-xs font-mono font-bold text-[#0F1E1C] shrink-0">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#00785D] shrink-0" />
              <span>{formatSessionTime(sessionSeconds)}</span>
            </div>

            <span className="text-[#539BA9] text-xs hidden sm:inline">|</span>

            <span className={`hidden sm:inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
              pomodoro.mode === 'focus' ? 'bg-[#FDC323] text-[#0F1E1C] border border-[#0F1E1C]/15' : 'bg-[#0F1E1C] text-[#FDC323]'
            }`}>
              {pomodoro.mode === 'focus' ? 'Fokus' : 'Rehat'}
            </span>
          </div>
        </div>

        {/* Right: Essential Action Controls ONLY (Skip & Akhiri) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Skip / Cari Partner Lain Button */}
          <button
            id="btn-skip-partner"
            type="button"
            onClick={() => {
              selfieTracker.stopBlurLoop();
              if (webrtcManagerRef.current) {
                webrtcManagerRef.current.cleanup();
              }
              onSkipPartner();
            }}
            className="px-3 sm:px-4 py-1.5 rounded-full bg-[#0F1E1C] hover:bg-[#172B28] text-white border-2 border-[#0F1E1C] text-[11px] sm:text-xs font-black flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
            title="Cari partner belajar baru [Esc]"
          >
            <SkipForward className="w-3.5 h-3.5 text-[#FDC323] shrink-0" />
            <span>Skip</span>
          </button>

          {/* Akhiri Sesi Button */}
          <button
            id="btn-leave-room"
            type="button"
            onClick={() => {
              selfieTracker.stopBlurLoop();
              if (webrtcManagerRef.current) {
                webrtcManagerRef.current.cleanup();
              }
              onLeaveRoom({
                focusMinutes: Math.round(sessionSeconds / 60),
                todosCompleted: todos.filter((t) => t.done).length,
              });
            }}
            className="px-3 sm:px-4 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-200 text-[11px] sm:text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
            title="Akhiri Sesi Belajar"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Akhiri</span>
          </button>
        </div>

      </header>

      {/* Dedicated Room Features Sub-Bar (Ambient Sound, Ping Latency, Whiteboard, Pintasan, Report) */}
      <div className="bg-[#F4F8F9] border-b border-[#D2E4E8] px-3 sm:px-5 py-1.5 flex items-center justify-between gap-2 text-[#0F1E1C] overflow-x-auto no-scrollbar shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* Suara Ambient Controls */}
          <div className="flex items-center gap-1 bg-white border border-[#D2E4E8] px-1.5 py-0.5 rounded-full shrink-0 shadow-xs">
            <button
              type="button"
              onClick={() => handleToggleAmbient('rain')}
              title="Suara Hujan (Rain)"
              className={`p-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                ambientType === 'rain' ? 'bg-[#0F1E1C] text-[#FDC323] font-bold' : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
              }`}
            >
              <CloudRain className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleToggleAmbient('cafe')}
              title="Suara Cafe Lofi"
              className={`p-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                ambientType === 'cafe' ? 'bg-[#0F1E1C] text-[#FDC323] font-bold' : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleToggleAmbient('binaural')}
              title="Binaural Theta Wave"
              className={`p-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                ambientType === 'binaural' ? 'bg-[#0F1E1C] text-[#FDC323] font-bold' : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
              }`}
            >
              <Waves className="w-3.5 h-3.5" />
            </button>
            {ambientType !== 'none' && (
              <input
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                value={ambientVolume}
                onChange={(e) => handleAmbientVolume(parseFloat(e.target.value))}
                className="w-10 sm:w-14 h-1.5 accent-[#0F1E1C] ml-1 cursor-pointer"
                title="Volume Ambient"
              />
            )}
          </div>

          {/* Sinyal Ping Latency Badge */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#D2E4E8] text-[10px] sm:text-[11px] font-bold shrink-0 shadow-xs"
            title={rttMs > 0 ? `Ping WebRTC: ${rttMs}ms (${networkQuality})` : 'Menunggu data koneksi peer'}
          >
            <span className={`w-2 h-2 rounded-full ${
              networkQuality === 'excellent' ? 'bg-[#00785D] animate-pulse' : networkQuality === 'good' ? 'bg-amber-400' : networkQuality === 'poor' ? 'bg-rose-400' : 'bg-[#539BA9]'
            }`} />
            <span className="font-mono text-[#3A6B6A]">{rttMs > 0 ? `${rttMs}ms` : 'Menunggu'}</span>
          </div>

          {/* Papan Tulis Button */}
          <button
            type="button"
            onClick={() => setShowWhiteboard(true)}
            className="px-3 py-1 rounded-full bg-[#E7F8FC] hover:bg-[#E7F8FC] border border-[#99DDE9] text-[#003D30] font-black flex items-center gap-1 text-xs shrink-0 cursor-pointer transition-all"
            title="Buka Papan Tulis Digital"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00785D]" />
            <span>Papan Tulis</span>
          </button>

          {/* Pintasan Button */}
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="px-3 py-1 rounded-full bg-white hover:bg-[#F6F9FA] border border-[#D2E4E8] text-[#1D4D4A] font-bold flex items-center gap-1 text-xs shrink-0 cursor-pointer transition-colors shadow-xs"
            title="Lihat Pintasan Keyboard"
          >
            <Keyboard className="w-3.5 h-3.5 text-[#00785D]" />
            <span>Pintasan</span>
          </button>

          {/* Laporkan Partner Button */}
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="p-1.5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 transition-all shrink-0 cursor-pointer shadow-xs"
            title="Laporkan Partner / Masalah Keamanan"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dedicated Partner Bio Banner */}
      <div className="bg-[#E6F5F1] border-b border-[#D2E4E8] px-3 sm:px-5 py-2 text-[#0F1E1C]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#3A6B6A] font-bold">Partner:</span>
            <span className="font-black text-[#FDC323] bg-[#0F1E1C] px-2.5 py-0.5 rounded-full">{roomData.partner.displayName}</span>
            <span className="text-[#539BA9] font-bold">•</span>
            <span className="text-[#1A3A38] font-bold">{roomData.partner.major}</span>
            <span className="text-[#539BA9] font-bold">•</span>
            <span className="text-[#00664F] font-semibold">{roomData.partner.interest}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Belajar Badge */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full border border-[#D2E4E8] text-[11px] font-bold text-[#0F1E1C] shadow-xs">
              <Clock className="w-3 h-3 text-[#00785D] shrink-0" />
              <span>Mode: {
                myProfile.studyMode === 'silent' ? 'Silent Study 🔇' :
                myProfile.studyMode === 'discussion' ? 'Diskusi Aktif 🗣️' :
                myProfile.studyMode === 'casual' ? 'Santai / Casual 🎧' : 'Pomodoro Focus ⏱️'
              }</span>
            </div>

            {roomData.partner.currentGoal && (
              <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full border border-[#D2E4E8] text-[11px] shadow-xs">
                <Target className="w-3.5 h-3.5 text-[#00785D] shrink-0" />
                <span className="text-[#3A6B6A]">Target: <strong className="text-[#0F1E1C] font-bold">{roomData.partner.currentGoal}</strong></span>
              </div>
            )}
          </div>

        </div>
      </div>




      {/* Mobile Navigation Tab Bar (3 Views: Video, Tools, Chat) */}
      <div className="lg:hidden sticky top-[53px] sm:top-[57px] z-20 bg-[#F6F9FA] px-2.5 py-1.5 border-b border-[#D2E4E8]">
        <div className="grid grid-cols-3 gap-1 bg-[#EDF5F7] p-1 rounded-full border border-[#D2E4E8] text-[11px] sm:text-xs font-black">
          <button
            type="button"
            onClick={() => setMobileTab('stage')}
            className={`py-2 rounded-full flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer font-black ${
              mobileTab === 'stage'
                ? 'bg-[#0F1E1C] text-white shadow-xs'
                : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
            }`}
          >
            <Video className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Video</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileTab('tools');
              setActiveTab('tools');
            }}
            className={`py-2 rounded-full flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer font-black ${
              mobileTab === 'tools'
                ? 'bg-[#0F1E1C] text-white shadow-xs'
                : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Tools & Target</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileTab('chat');
              setActiveTab('chat');
            }}
            className={`py-2 rounded-full flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer font-black relative ${
              mobileTab === 'chat'
                ? 'bg-[#0F1E1C] text-white shadow-xs'
                : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Obrolan</span>
            {messages.length > 1 && (
              <span className="w-2 h-2 rounded-full bg-[#00785D] animate-pulse shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* Main Study Stage Grid */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
        
        {/* Left / Center Section: Dual Video/Avatar Stage & Media Controls (7 Cols) */}
        <div className={`lg:col-span-7 flex flex-col gap-3 sm:gap-4 ${mobileTab === 'stage' ? 'flex' : 'hidden lg:flex'}`}>

          {/* Autoplay Unblock Notification Banner */}
          {isAutoplayBlocked && (
            <div 
              onClick={() => {
                if (remoteVideoRef.current) remoteVideoRef.current.play().catch(() => {});
                if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
                studyAudio.resumeContext();
                setIsAutoplayBlocked(false);
              }}
              className="px-4 py-3 rounded-2xl bg-[#FDC323] text-[#0F1E1C] font-black flex items-center justify-between shadow-sm cursor-pointer hover:bg-[#EBB215] transition-all border-2 border-[#0F1E1C] animate-pulse"
            >
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <Volume2 className="w-5 h-5 shrink-0 text-[#0F1E1C]" />
                <span>Klik di sini untuk Mengaktifkan Suara & Video Partner!</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#0F1E1C] text-[#FDC323] text-xs font-black shrink-0">
                Aktifkan
              </span>
            </div>
          )}

          
          {/* Dual Screen Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* 1. Partner Video / Avatar Card */}
            <div className="bg-[#0F1E1C] rounded-[28px] sm:rounded-[36px] p-2.5 shadow-sm border-2 border-[#0F1E1C] aspect-video sm:aspect-[4/3] relative flex flex-col justify-between overflow-hidden">
              {/* Dedicated Remote Audio element for WebRTC audio playback */}
              <audio ref={remoteAudioRef} autoPlay playsInline />

              {/* Partner Video element - permanently active at z-0 so audio & video decode continuously */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                onStalled={() => remoteVideoRef.current?.play().catch(() => {})}
                onWaiting={() => remoteVideoRef.current?.play().catch(() => {})}
                onPause={() => {
                  if (mediaState.partnerVideoEnabled) {
                    remoteVideoRef.current?.play().catch(() => {});
                  }
                }}
                className="absolute inset-0 w-full h-full object-cover z-0 rounded-[22px] sm:rounded-[30px] bg-[#0c100b]"
              />

              {/* Virtual Study Avatar (shown on top at z-10 when video is off) */}
              {!mediaState.partnerVideoEnabled && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-[#0F1E1C] z-10 rounded-[22px] sm:rounded-[30px] text-white">
                  <div className="w-16 h-16 rounded-2xl bg-[#FDC323] border-2 border-[#0F1E1C] text-[#0F1E1C] flex items-center justify-center text-2xl font-black shadow-md mb-2">
                    {roomData.partner.displayName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="text-center space-y-0.5 max-w-[90%]">
                    <h3 className="text-sm font-black text-white truncate">{roomData.partner.displayName}</h3>
                    <p className="text-xs text-[#FDC323] font-bold truncate">{roomData.partner.major}</p>
                    <p className="text-[11px] text-[#539BA9] italic truncate">&ldquo;{roomData.partner.interest}&rdquo;</p>
                  </div>
                </div>
              )}

              {/* Card Top Badges */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F1E1C]/85 backdrop-blur-md border border-[#172B28] text-[11px] text-white font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#00785D] animate-pulse" />
                  <span>{roomData.partner.displayName}</span>
                  <span className="text-[10px] text-[#539BA9]">({roomData.partner.gender === 'male' ? 'L' : roomData.partner.gender === 'female' ? 'P' : 'Anonim'})</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (webrtcManagerRef.current) {
                        webrtcManagerRef.current.refreshRemoteStream();
                      }
                      if (remoteVideoRef.current) {
                        remoteVideoRef.current.play().catch(() => setIsAutoplayBlocked(true));
                      }
                      if (remoteAudioRef.current) {
                        remoteAudioRef.current.play().catch(() => setIsAutoplayBlocked(true));
                      }
                    }}
                    className="p-1.5 rounded-full bg-[#0F1E1C]/85 hover:bg-[#172B28] text-[#FDC323] border border-[#172B28] text-xs transition-colors cursor-pointer"
                    title="Muat Ulang / Refresh Kamera Partner"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  {mediaState.partnerAudioEnabled ? (
                    <span className="p-1.5 rounded-full bg-[#00785D]/20 text-[#FDC323] border border-[#00785D]/40 text-xs">
                      <Mic className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="p-1.5 rounded-full bg-[#0F1E1C]/85 text-[#4A7A79] text-xs border border-[#172B28]">
                      <MicOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>

              {/* Card Bottom: Partner Goal Badge */}
              <div className="relative z-10 mt-auto">
                <div className="px-3 py-1.5 rounded-2xl bg-[#0F1E1C]/90 backdrop-blur-md border border-[#172B28] text-[11px] text-white flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-[#FDC323] shrink-0" />
                  <span className="truncate font-medium">Target: <strong className="text-[#FDC323] font-bold">{roomData.partner.currentGoal}</strong></span>
                </div>
              </div>
            </div>

            {/* 2. My Video / Avatar Card */}
            <div className="bg-[#0F1E1C] rounded-[28px] sm:rounded-[36px] p-2.5 shadow-sm border-2 border-[#0F1E1C] aspect-video sm:aspect-[4/3] relative flex flex-col justify-between overflow-hidden">
              {/* Local Video element with Mirroring & Background Blur */}
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ 
                  filter: cameraBlur ? 'blur(16px)' : 'none',
                  transform: cameraMirror ? 'scaleX(-1)' : 'none'
                }}
                className={`absolute inset-0 w-full h-full object-cover z-0 rounded-[22px] sm:rounded-[30px] bg-[#0c100b] transition-all duration-300 ${
                  (mediaState.videoEnabled || mediaState.screenSharing) ? 'block' : 'hidden'
                }`}
              />

              {/* Portrait Focus Edge Overlay when Blur is active */}
              {cameraBlur && mediaState.videoEnabled && (
                <div className="absolute inset-0 pointer-events-none rounded-[22px] sm:rounded-[30px] z-[5] shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] border-2 border-[#FDC323]/50">
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-[#FDC323] text-[#0F1E1C] text-[10px] font-black flex items-center gap-1 shadow-sm backdrop-blur-sm">
                    <Focus className="w-3 h-3 text-[#0F1E1C]" />
                    <span>Latar Blur Aktif</span>
                  </div>
                </div>
              )}

              {/* Virtual Study Avatar for User */}
              {!mediaState.videoEnabled && !mediaState.screenSharing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-[#0F1E1C] z-0 rounded-[22px] sm:rounded-[30px] text-white">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${myProfile.avatarColor || 'from-[#FDC323] to-[#00785D]'} border-2 border-[#0F1E1C] text-[#0F1E1C] flex items-center justify-center text-2xl font-black shadow-md mb-2`}>
                    {myProfile.displayName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="text-center space-y-0.5 max-w-[90%]">
                    <h3 className="text-sm font-black text-white truncate">{myProfile.displayName} (Saya)</h3>
                    <p className="text-xs text-[#539BA9] font-bold truncate">{myProfile.major}</p>
                    <p className="text-[11px] text-[#FDC323] font-bold italic truncate">&ldquo;{myProfile.currentGoal}&rdquo;</p>
                  </div>
                </div>
              )}

              {/* Card Top Badges */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F1E1C]/85 backdrop-blur-md border border-[#172B28] text-[11px] text-white font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#00785D]" />
                  <span>{myProfile.displayName} (Anda)</span>
                </div>

                <div className="flex items-center gap-1">
                  {mediaState.audioEnabled ? (
                    <span className="p-1.5 rounded-full bg-[#00785D]/20 text-[#FDC323] border border-[#00785D]/40 text-xs flex items-center gap-1">
                      <Mic className="w-3.5 h-3.5" />
                      {myVolumeLevel > 15 && <span className="w-1.5 h-1.5 rounded-full bg-[#FDC323] animate-ping" />}
                    </span>
                  ) : (
                    <span className="p-1.5 rounded-full bg-[#0F1E1C]/85 text-[#4A7A79] text-xs border border-[#172B28]">
                      <MicOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>

              {/* Card Bottom: Local Goal Badge */}
              <div className="relative z-10 mt-auto">
                <div className="px-3 py-1.5 rounded-2xl bg-[#0F1E1C]/90 backdrop-blur-md border border-[#172B28] text-[11px] text-white flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-[#FDC323] shrink-0" />
                  <span className="truncate font-medium">Target: <strong className="text-[#FDC323] font-bold">{myProfile.currentGoal}</strong></span>
                </div>
              </div>
            </div>

          </div>

          {/* Media Controls Bar & Quick Reactions Container */}
          {/* Media Controls Bar & Quick Reactions Container */}
          <div className="bg-white rounded-[28px] sm:rounded-[36px] p-3 sm:p-4 flex flex-col items-center justify-between gap-2.5 shadow-sm border-2 border-[#D2E4E8] relative z-20">
            
            {/* Top Row: AV Controls Section (Kamera, Blur, Mic, Bagi Layar) */}
            <div className="flex items-center gap-1.5 sm:gap-2 w-full justify-between sm:justify-center overflow-x-auto no-scrollbar py-0.5 shrink-0 relative z-20">
              <button
                id="btn-toggle-camera"
                type="button"
                onClick={handleToggleCamera}
                className={`flex-1 sm:flex-none px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0 ${
                  mediaState.videoEnabled
                    ? 'bg-[#0F1E1C] text-white'
                    : 'bg-[#EDF5F7] hover:bg-[#D2E4E8] text-[#1D4D4A] border border-[#D2E4E8]'
                }`}
                title="Nyalakan / Matikan Kamera (V)"
              >
                {mediaState.videoEnabled ? <Video className="w-4 h-4 shrink-0 text-[#FDC323]" /> : <VideoOff className="w-4 h-4 text-[#4A7A79] shrink-0" />}
                <span className="text-[11px] sm:text-xs whitespace-nowrap">{mediaState.videoEnabled ? 'Kamera On' : 'Kamera Off'}</span>
                <kbd className={`hidden sm:inline-block px-1.5 py-0.2 rounded font-mono font-black text-[10px] ${
                  mediaState.videoEnabled ? 'bg-[#172B28] text-[#FDC323]' : 'bg-[#D2E4E8] text-[#1D4D4A]'
                }`}>
                  V
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => setCameraBlur((prev) => !prev)}
                className={`px-3 py-2 sm:py-2.5 rounded-full text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0 ${
                  cameraBlur
                    ? 'bg-[#FDC323] text-[#0F1E1C] border-2 border-[#0F1E1C]'
                    : 'bg-[#EDF5F7] hover:bg-[#D2E4E8] text-[#1D4D4A] border border-[#D2E4E8]'
                }`}
                title="Aktifkan / Matikan Efek Blur Latar Kamera"
              >
                <Focus className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{cameraBlur ? 'Blur On' : 'Blur Off'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCameraMirror((prev) => !prev)}
                className={`px-3 py-2 sm:py-2.5 rounded-full text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0 ${
                  cameraMirror
                    ? 'bg-[#E7F8FC] text-[#0F1E1C] border-2 border-[#99DDE9]'
                    : 'bg-[#EDF5F7] hover:bg-[#D2E4E8] text-[#1D4D4A] border border-[#D2E4E8]'
                }`}
                title="Aktifkan / Matikan Mode Cermin Kamera (Mirror)"
              >
                <FlipHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{cameraMirror ? 'Cermin On' : 'Cermin Off'}</span>
              </button>

              <button
                id="btn-toggle-mic"
                type="button"
                onClick={handleToggleMic}
                className={`flex-1 sm:flex-none px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0 ${
                  mediaState.audioEnabled
                    ? 'bg-[#0F1E1C] text-white'
                    : 'bg-[#EDF5F7] hover:bg-[#D2E4E8] text-[#1D4D4A] border border-[#D2E4E8]'
                }`}
                title="Mute / Unmute Mikrofon (Space)"
              >
                {mediaState.audioEnabled ? <Mic className="w-4 h-4 shrink-0 text-[#FDC323]" /> : <MicOff className="w-4 h-4 text-[#4A7A79] shrink-0" />}
                <span className="text-[11px] sm:text-xs whitespace-nowrap">{mediaState.audioEnabled ? 'Mic On' : 'Mic Off'}</span>
                <kbd className={`hidden sm:inline-block px-1.5 py-0.2 rounded font-mono font-black text-[10px] ${
                  mediaState.audioEnabled ? 'bg-[#172B28] text-[#FDC323]' : 'bg-[#D2E4E8] text-[#1D4D4A]'
                }`}>
                  Space
                </kbd>
              </button>

              <button
                id="btn-toggle-screenshare"
                type="button"
                onClick={handleToggleScreenShare}
                className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0 ${
                  mediaState.screenSharing
                    ? 'bg-[#FDC323] text-[#0F1E1C] border-2 border-[#0F1E1C]'
                    : 'bg-[#EDF5F7] hover:bg-[#D2E4E8] text-[#1D4D4A] border border-[#D2E4E8]'
                }`}
              >
                <Monitor className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">{mediaState.screenSharing ? 'Stop Share' : 'Bagi Layar'}</span>
              </button>
            </div>

            {/* Bottom Row: Dedicated Quick Reactions Bar */}
            <div className="w-full flex items-center justify-center gap-1.5 bg-[#F4F8F9] px-3 py-1.5 rounded-2xl border border-[#D2E4E8] overflow-x-auto no-scrollbar shrink-0 relative z-10">
              <span className="text-[11px] text-[#3A6B6A] px-1 font-black uppercase tracking-wider shrink-0">Reaksi:</span>
              {QUICK_REACTIONS.map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSendReaction(item.id)}
                    className="group relative p-2 rounded-xl hover:bg-[#EDF5F7] flex items-center justify-center transition-transform active:scale-125 cursor-pointer shrink-0"
                    title={`Kirim ${item.name}`}
                  >
                    <IconComp className="w-4 h-4 text-[#0F1E1C] group-hover:scale-110 transition-transform" />
                    <span className="absolute -bottom-1 -right-0.5 text-[8px] font-mono font-bold text-[#539BA9] group-hover:text-[#0F1E1C] hidden sm:inline">
                      {idx + 1}
                    </span>
                  </button>
                );
              })}
            </div>

          </div>

          {/* Synchronized Pomodoro Widget in Clean Flat Style */}
          <div className="bg-white rounded-[28px] sm:rounded-[36px] p-4 sm:p-5 shadow-sm border-2 border-[#D2E4E8] space-y-3.5 text-[#0F1E1C]">
            {/* Header: Title, Badge, & Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#EDF5F7] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-2xl bg-[#E7F8FC] border border-[#99DDE9] flex items-center justify-center text-[#0F1E1C] font-black text-sm shadow-xs shrink-0">
                  🍅
                </div>
                <div>
                  <h4 className="text-xs font-black text-[#0F1E1C] uppercase tracking-wider">Timer Pomodoro</h4>
                  <p className="text-[10px] text-[#3A6B6A] font-semibold">Sinkron otomatis dengan partner</p>
                </div>
              </div>

              {/* Mode Selectors */}
              <div className="flex items-center gap-1 bg-[#EDF5F7] p-1 rounded-full border border-[#D2E4E8] text-[11px] w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handlePomodoroChangeMode('focus')}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-full font-black transition-all cursor-pointer text-center ${
                    pomodoro.mode === 'focus' ? 'bg-[#0F1E1C] text-white shadow-xs' : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
                  }`}
                >
                  Fokus (25m)
                </button>
                <button
                  type="button"
                  onClick={() => handlePomodoroChangeMode('short_break')}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-full font-black transition-all cursor-pointer text-center ${
                    pomodoro.mode === 'short_break' ? 'bg-[#0F1E1C] text-[#FDC323] shadow-xs' : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
                  }`}
                >
                  Rehat (5m)
                </button>
              </div>
            </div>

            {/* Main Countdown & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              
              {/* Left: Timer Display & Status Badge */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-[#0F1E1C]">
                  {formatSeconds(pomodoro.timeLeft)}
                </div>
                <div className="text-left space-y-0.5">
                  {pomodoro.isRunning ? (
                    <span className="text-[#00785D] flex items-center gap-1 font-black text-xs">
                      <span className="w-2 h-2 rounded-full bg-[#00785D] animate-ping shrink-0" />
                      Berjalan Bersama
                    </span>
                  ) : (
                    <span className="text-[#539BA9] font-black text-xs">Dijeda</span>
                  )}
                  <div className="text-[10px] text-[#4A7A79] font-bold">{pomodoro.sessionsCompleted} putaran selesai</div>
                </div>
              </div>

              {/* Right: Controls (Play/Pause & Reset) */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  id="btn-pomodoro-play"
                  type="button"
                  onClick={handlePomodoroPlayPause}
                  className={`flex-1 sm:flex-none px-5 py-3 rounded-full font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 ${
                    pomodoro.isRunning
                      ? 'bg-[#0F1E1C] text-[#FDC323] border-2 border-[#0F1E1C]'
                      : 'bg-[#FDC323] hover:bg-[#EBB215] text-[#0F1E1C] border-2 border-[#0F1E1C] shadow-[0_3px_0_#0F1E1C] active:translate-y-0.5 active:shadow-none'
                  }`}
                  title="Mulai / Jeda Pomodoro (P)"
                >
                  {pomodoro.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{pomodoro.isRunning ? 'Jeda' : 'Mulai Fokus'}</span>
                  <kbd className={`hidden sm:inline-block px-1.5 py-0.2 rounded font-mono font-black text-[10px] ${
                    pomodoro.isRunning ? 'bg-[#172B28] text-[#FDC323]' : 'bg-[#0F1E1C] text-white'
                  }`}>
                    P
                  </kbd>
                </button>

                <button
                  id="btn-pomodoro-reset"
                  type="button"
                  onClick={handlePomodoroReset}
                  className="px-4 py-3 rounded-full bg-white hover:bg-[#F6F9FA] text-[#1D4D4A] font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 border-2 border-[#D2E4E8] transition-all cursor-pointer active:scale-95 shrink-0"
                  title="Reset Timer (R)"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">Reset</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-[#EDF5F7] text-[#4A7A79] font-mono font-black text-[10px]">
                    R
                  </kbd>
                </button>
              </div>

            </div>
          </div>


        </div>

        {/* Right Section: Study Collaboration Tools & Live Chat (5 Cols) */}
        <div className={`lg:col-span-5 flex flex-col gap-3 sm:gap-4 ${mobileTab !== 'stage' ? 'flex' : 'hidden lg:flex'}`}>

          
          {/* Tabs Navigator: Study Tools vs Chat (Desktop only; mobile uses top mobileTab bar) */}
          <div className="hidden lg:flex bg-[#EDF5F7] rounded-full p-1 items-center justify-between text-xs font-bold border border-[#D2E4E8]">

            <div className="grid grid-cols-2 gap-1 w-full">
              <button
                type="button"
                onClick={() => setActiveTab('tools')}
                className={`py-2 px-3 rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer font-black ${
                  activeTab === 'tools'
                    ? 'bg-[#0F1E1C] text-white shadow-xs'
                    : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
                }`}
                title="Buka Target & Catatan (T)"
              >
                <Sparkles className="w-4 h-4 text-[#FDC323]" />
                <span>Target & Catatan</span>
                <kbd className={`px-1.5 py-0.2 rounded font-mono font-black text-[10px] ${
                  activeTab === 'tools' ? 'bg-[#172B28] text-[#FDC323]' : 'bg-[#D2E4E8] text-[#1D4D4A]'
                }`}>
                  T
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`py-2 px-3 rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer font-black relative ${
                  activeTab === 'chat'
                    ? 'bg-[#0F1E1C] text-white shadow-xs'
                    : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
                }`}
                title="Buka Obrolan Sesi (C)"
              >
                <MessageSquare className="w-4 h-4 text-[#FDC323]" />
                <span>Obrolan Sesi</span>
                <kbd className={`px-1.5 py-0.2 rounded font-mono font-black text-[10px] ${
                  activeTab === 'chat' ? 'bg-[#172B28] text-[#FDC323]' : 'bg-[#D2E4E8] text-[#1D4D4A]'
                }`}>
                  C
                </kbd>
                {messages.length > 1 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00785D] absolute top-2 right-4 shadow-xs" />
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: STUDY TOOLS (Scratchpad & Goals Checklist) */}
          {activeTab === 'tools' && (
            <div className="space-y-3 sm:space-y-4">
              
              {/* Mobile Pomodoro Timer Card (Visible on mobile screens when inside Tools tab) */}
              <div className="lg:hidden bg-white rounded-[28px] p-4 shadow-sm border-2 border-[#D2E4E8] space-y-3 text-[#0F1E1C]">
                <div className="flex items-center justify-between gap-2 border-b border-[#EDF5F7] pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-[#E7F8FC] border border-[#99DDE9] flex items-center justify-center text-[#0F1E1C] font-black text-xs shadow-xs shrink-0">
                      🍅
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-[#0F1E1C] uppercase tracking-wider">Timer Pomodoro</h4>
                      <p className="text-[10px] text-[#3A6B6A] font-semibold">Sinkron dengan partner</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-[#EDF5F7] p-1 rounded-full border border-[#D2E4E8] text-[10px]">
                    <button
                      type="button"
                      onClick={() => handlePomodoroChangeMode('focus')}
                      className={`px-2.5 py-1 rounded-full font-black transition-all cursor-pointer ${
                        pomodoro.mode === 'focus' ? 'bg-[#0F1E1C] text-white' : 'text-[#3A6B6A]'
                      }`}
                    >
                      Fokus (25m)
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePomodoroChangeMode('short_break')}
                      className={`px-2.5 py-1 rounded-full font-black transition-all cursor-pointer ${
                        pomodoro.mode === 'short_break' ? 'bg-[#0F1E1C] text-[#FDC323]' : 'text-[#3A6B6A]'
                      }`}
                    >
                      Rehat (5m)
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black font-mono tracking-tight text-[#0F1E1C]">
                      {formatSeconds(pomodoro.timeLeft)}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      pomodoro.isRunning ? 'bg-[#E7F8FC] text-[#003D30] border border-[#99DDE9]' : 'bg-[#EDF5F7] text-[#3A6B6A] border border-[#D2E4E8]'
                    }`}>
                      {pomodoro.isRunning ? 'Berjalan' : 'Dijeda'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePomodoroPlayPause}
                      className={`px-3.5 py-1.5 rounded-full font-black text-xs flex items-center gap-1 shadow-xs cursor-pointer ${
                        pomodoro.isRunning ? 'bg-[#0F1E1C] text-[#FDC323]' : 'bg-[#FDC323] text-[#0F1E1C] border border-[#0F1E1C]/20'
                      }`}
                    >
                      {pomodoro.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{pomodoro.isRunning ? 'Jeda' : 'Mulai'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePomodoroReset}
                      className="p-1.5 rounded-full bg-white hover:bg-[#F6F9FA] text-[#1D4D4A] cursor-pointer border border-[#D2E4E8]"
                      title="Reset Timer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tool Selector Pill */}
              <div className="flex items-center gap-2 bg-[#EDF5F7] p-1 rounded-full border border-[#D2E4E8] text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTool('todos')}
                  className={`flex-1 py-1.5 px-3 rounded-full font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTool === 'todos'
                      ? 'bg-[#0F1E1C] text-white shadow-xs'
                      : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Target Bersama ({todos.filter((t) => t.done).length}/{todos.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('scratchpad')}
                  className={`flex-1 py-1.5 px-3 rounded-full font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTool === 'scratchpad'
                      ? 'bg-[#0F1E1C] text-white shadow-xs'
                      : 'text-[#3A6B6A] hover:text-[#0F1E1C]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Shared Scratchpad</span>
                </button>
              </div>

              {/* Sub-view: To-do Checklist */}
              {activeTool === 'todos' && (
                <div className="bg-white rounded-[28px] sm:rounded-[36px] p-4 sm:p-5 shadow-sm border-2 border-[#D2E4E8] space-y-3 text-[#0F1E1C]">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-[#0F1E1C] uppercase tracking-wider">
                      Checklist Target Sesi Ini
                    </h4>
                    <span className="text-[10px] font-black text-[#003D30] bg-[#E7F8FC] px-2 py-0.5 rounded-full border border-[#99DDE9] uppercase tracking-wider">
                      Real-time Sync
                    </span>
                  </div>

                  {/* Add Todo Input */}
                  <form onSubmit={handleAddTodo} className="flex gap-2">
                    <input
                      type="text"
                      value={newTodoText}
                      onChange={(e) => setNewTodoText(e.target.value)}
                      placeholder="Tambah target / tugas baru..."
                      className="flex-1 px-4 py-2.5 rounded-full bg-[#F4F8F9] border-2 border-[#D2E4E8] text-xs font-bold text-[#0F1E1C] placeholder-[#539BA9] focus:outline-none focus:border-[#0F1E1C] focus:bg-white transition-all"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-full bg-[#FDC323] hover:bg-[#EBB215] text-[#0F1E1C] font-black text-xs flex items-center gap-1 cursor-pointer transition-all border border-[#0F1E1C]/20 shadow-xs active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  </form>

                  {/* Todos List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {todos.length === 0 ? (
                      <p className="text-xs text-[#539BA9] font-medium italic text-center py-4">
                        Belum ada target tugas. Tambahkan target di atas!
                      </p>
                    ) : (
                      todos.map((todo) => (
                        <div
                          key={todo.id}
                          className={`p-3 rounded-2xl border-2 flex items-center justify-between gap-2 text-xs transition-all ${
                            todo.done
                              ? 'bg-[#EDF5F7] border-[#D2E4E8] text-[#539BA9]'
                              : 'bg-[#F4F8F9] border-[#D2E4E8] text-[#0F1E1C] font-bold'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleTodo(todo)}
                            className="flex items-center gap-2 text-left flex-1 cursor-pointer"
                          >
                            {todo.done ? (
                              <CheckSquare className="w-4 h-4 text-[#00785D] shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-[#0F1E1C] shrink-0" />
                            )}
                            <span className={todo.done ? 'line-through text-[#539BA9] font-normal' : 'font-bold'}>
                              {todo.text}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTodo(todo)}
                            className="text-[#539BA9] hover:text-rose-600 p-1 transition-colors cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Sub-view: Shared Scratchpad */}
              {activeTool === 'scratchpad' && (
                <div className="bg-white rounded-[28px] sm:rounded-[36px] p-4 sm:p-5 shadow-sm border-2 border-[#D2E4E8] space-y-2 text-[#0F1E1C]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-[#0F1E1C] uppercase tracking-wider">
                      <FileText className="w-3.5 h-3.5 text-[#00785D]" />
                      <span>Shared Scratchpad / Catatan Bersama</span>
                    </div>
                    <span className="text-[10px] text-[#4A7A79] font-medium">Tersinkronisasi otomatis</span>
                  </div>

                  <textarea
                    rows={9}
                    value={scratchpad}
                    onChange={handleScratchpadChange}
                    placeholder="Tulis rumus, rangkuman, link referensi, atau pertanyaan di sini..."
                    className="w-full p-3.5 rounded-2xl bg-[#F4F8F9] border-2 border-[#D2E4E8] text-xs font-mono text-[#0F1E1C] placeholder-[#539BA9] focus:outline-none focus:border-[#0F1E1C] focus:bg-white resize-none leading-relaxed transition-all"
                  />
                </div>
              )}

              {/* Icebreaker Prompts Pill */}
              <div className="p-4 rounded-3xl bg-[#E6F5F1] border-2 border-[#D2E4E8] text-xs space-y-2 text-[#0F1E1C] shadow-xs">
                <span className="font-black text-[#1A3A38] flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-[#E68A00]" />
                  Topik Pembuka Percakapan:
                </span>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setChatInput(`Bagaimana progres topik "${roomData.partner.interest}" sejauh ini?`);
                      setActiveTab('chat');
                    }}
                    className="text-left p-2.5 rounded-2xl bg-white border border-[#D2E4E8] hover:border-[#0F1E1C] text-[#0F1E1C] font-bold transition-all cursor-pointer truncate shadow-xs active:scale-95"
                  >
                    💬 &ldquo;Bagaimana progres topik {roomData.partner.interest}?&rdquo;
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChatInput(`Mari kita targetkan 25 menit ini tanpa membuka media sosial! 🔥`);
                      setActiveTab('chat');
                    }}
                    className="text-left p-2.5 rounded-2xl bg-white border border-[#D2E4E8] hover:border-[#0F1E1C] text-[#0F1E1C] font-bold transition-all cursor-pointer truncate shadow-xs active:scale-95"
                  >
                    🎯 &ldquo;Target 25 menit ini tanpa distraksi sosmed! 🔥&rdquo;
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: LIVE CHAT SIDEBAR */}
          {activeTab === 'chat' && (
            <div className="bg-white rounded-[28px] sm:rounded-[36px] flex flex-col h-[65vh] lg:h-[480px] shadow-sm border-2 border-[#D2E4E8] overflow-hidden text-[#0F1E1C]">
              
              {/* Chat Header */}
              <div className="p-3.5 border-b border-[#EDF5F7] flex items-center justify-between bg-[#F4F8F9]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00785D] animate-pulse" />
                  <span className="text-xs font-black text-[#0F1E1C]">Obrolan Sesi Belajar</span>
                </div>
                <span className="text-[10px] font-bold text-[#1D4D4A] bg-white px-2.5 py-0.5 rounded-full border border-[#D2E4E8]">
                  Stateless Privacy
                </span>
              </div>

              {/* Chat Messages Feed */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs bg-[#F4F8F9]">
                {messages.map((msg) => {
                  const isMe = msg.senderId === myProfile.id || msg.senderId === socket?.id;
                  const isSystem = msg.type === 'system' || msg.type === 'goal_completed';

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="text-center py-1">
                        <span className="inline-block px-3 py-1 rounded-full bg-[#E7F8FC] border border-[#99DDE9] text-[11px] text-[#003D30] font-bold">
                          {msg.text}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[10px] text-[#4A7A79] font-bold mb-0.5 px-1">
                        {msg.senderName}
                      </span>
                      <div
                        className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs break-words leading-relaxed shadow-xs ${
                          isMe
                            ? 'bg-[#0F1E1C] text-white rounded-br-none font-semibold'
                            : 'bg-white text-[#0F1E1C] rounded-bl-none border border-[#D2E4E8] font-semibold'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}

                {isPartnerTyping && (
                  <div className="flex items-center gap-1 text-[11px] text-[#4A7A79] italic px-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00785D] animate-pulse" />
                    <span>{roomData.partner.displayName} sedang mengetik...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-[#EDF5F7] bg-white flex gap-2">
                <input
                  id="input-chat-message"
                  type="text"
                  value={chatInput}
                  onChange={(e) => handleChatInputChange(e.target.value)}
                  onBlur={() => {
                    if (myTypingTimeoutRef.current) {
                      clearTimeout(myTypingTimeoutRef.current);
                    }
                    socket?.emit('chat_typing', {
                      roomId: roomData.roomId,
                      isTyping: false,
                      userName: myProfile.displayName,
                    });
                  }}
                  placeholder="Ketik pesan atau pertanyaan..."
                  className="flex-1 px-4 py-2.5 rounded-full bg-[#F4F8F9] border-2 border-[#D2E4E8] text-xs font-semibold text-[#0F1E1C] placeholder-[#539BA9] focus:outline-none focus:border-[#0F1E1C] focus:bg-white transition-all"
                />
                <button
                  id="btn-send-chat"
                  type="submit"
                  className="p-2.5 rounded-full bg-[#FDC323] hover:bg-[#EBB215] text-[#0F1E1C] font-bold transition-all cursor-pointer shadow-xs active:scale-95 border border-[#0F1E1C]/20"
                  title="Kirim Pesan"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

        </div>

      </div>

      {/* Keyboard Shortcut HUD Toast Notification */}
      {shortcutToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-150 pointer-events-none">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0F1E1C] text-white border-2 border-[#FDC323] shadow-2xl backdrop-blur-md">
            <span className="text-xs font-black text-[#FDC323]">{shortcutToast.message}</span>
            <kbd className="px-2 py-0.5 rounded-full bg-[#FDC323] text-[#0F1E1C] font-mono font-black text-[10px] shadow-xs uppercase">
              {shortcutToast.key}
            </kbd>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Guide Modal */}
      {showShortcutsModal && (
        <div 
          id="modal-keyboard-shortcuts"
          className="fixed inset-0 bg-[#0F1E1C]/60 backdrop-blur-md z-50 flex items-center justify-center p-4 selection:bg-[#FDC323] selection:text-[#0F1E1C] font-sans"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowShortcutsModal(false);
          }}
        >
          <div className="max-w-lg w-full bg-white rounded-[32px] sm:rounded-[40px] p-6 sm:p-7 shadow-2xl border-2 border-[#D2E4E8] text-[#0F1E1C] space-y-5 animate-in fade-in zoom-in duration-200 relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EDF5F7]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#E7F8FC] border border-[#99DDE9] flex items-center justify-center text-[#0F1E1C] shadow-xs">
                  <Keyboard className="w-5 h-5 text-[#00785D]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#0F1E1C] leading-tight">Pintasan Keyboard (Hotkeys)</h3>
                  <p className="text-xs font-medium text-[#3A6B6A]">Navigasi dan kendalikan sesi belajar lebih cepat</p>
                </div>
              </div>
              <button
                id="btn-close-shortcuts-modal"
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-2 rounded-full bg-[#EDF5F7] hover:bg-[#D2E4E8] text-[#1D4D4A] transition-colors cursor-pointer"
                title="Tutup [Esc]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shortcuts List by Group */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-xs">
              {/* Group 1: Media Controls */}
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#00785D]">Kontrol Audio & Video</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-2xl bg-[#F4F8F9] border border-[#D2E4E8] flex items-center justify-between">
                    <span className="font-bold text-[#0F1E1C]">Mute / Unmute Mic</span>
                    <kbd className="px-2.5 py-1 rounded-full bg-[#FDC323] text-[#0F1E1C] font-mono font-black text-[11px] shadow-xs">Space</kbd>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-[#F4F8F9] border border-[#D2E4E8] flex items-center justify-between">
                    <span className="font-bold text-[#0F1E1C]">Nyalakan/Matikan Kamera</span>
                    <kbd className="px-2.5 py-1 rounded-full bg-[#EDF5F7] text-[#0F1E1C] border border-[#D2E4E8] font-mono font-black text-[11px]">V</kbd>
                  </div>
                </div>
              </div>

              {/* Group 2: Sesi & Timer */}
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#00785D]">Sesi Belajar & Pomodoro</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-2xl bg-[#F4F8F9] border border-[#D2E4E8] flex items-center justify-between">
                    <span className="font-bold text-[#0F1E1C]">Mulai / Jeda Pomodoro</span>
                    <kbd className="px-2.5 py-1 rounded-full bg-[#EDF5F7] text-[#0F1E1C] border border-[#D2E4E8] font-mono font-black text-[11px]">P</kbd>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-[#F4F8F9] border border-[#D2E4E8] flex items-center justify-between">
                    <span className="font-bold text-[#0F1E1C]">Reset Timer Pomodoro</span>
                    <kbd className="px-2.5 py-1 rounded-full bg-[#EDF5F7] text-[#0F1E1C] border border-[#D2E4E8] font-mono font-black text-[11px]">R</kbd>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-[#F4F8F9] border border-[#D2E4E8] flex items-center justify-between sm:col-span-2">
                    <span className="font-bold text-[#0F1E1C]">Cari Partner Lain (Skip Match)</span>
                    <kbd className="px-2.5 py-1 rounded-full bg-[#0F1E1C] text-[#FDC323] font-mono font-black text-[11px]">Esc</kbd>
                  </div>
                </div>
              </div>

              {/* Group 3: Navigasi Tab */}
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#00785D]">Navigasi Tab & Fitur</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-2xl bg-[#F4F8F9] border border-[#D2E4E8] flex items-center justify-between">
                    <span className="font-bold text-[#0F1E1C]">Buka Tab Obrolan (Chat)</span>
                    <kbd className="px-2.5 py-1 rounded-full bg-[#EDF5F7] text-[#0F1E1C] border border-[#D2E4E8] font-mono font-black text-[11px]">C</kbd>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-[#F4F8F9] border border-[#D2E4E8] flex items-center justify-between">
                    <span className="font-bold text-[#0F1E1C]">Buka Target & Catatan</span>
                    <kbd className="px-2.5 py-1 rounded-full bg-[#EDF5F7] text-[#0F1E1C] border border-[#D2E4E8] font-mono font-black text-[11px]">T</kbd>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-[#F4F8F9] border border-[#D2E4E8] flex items-center justify-between sm:col-span-2">
                    <span className="font-bold text-[#0F1E1C]">Buka / Tutup Panduan Ini</span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-0.5 rounded-lg bg-[#FDC323] text-[#0F1E1C] font-mono font-black text-[10px]">?</kbd>
                      <kbd className="px-2 py-0.5 rounded-lg bg-[#EDF5F7] text-[#0F1E1C] font-mono font-black text-[10px]">H</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 4: Quick Reactions */}
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#00785D]">Kirim Reaksi Cepat</div>
                <div className="flex items-center justify-between gap-1 p-2.5 rounded-2xl bg-[#F4F8F9] border border-[#D2E4E8]">
                  {QUICK_REACTIONS.map((item, idx) => {
                    const IconComp = item.icon;
                    return (
                      <div key={item.id} className="flex flex-col items-center gap-1">
                        <IconComp className="w-4 h-4 text-[#0F1E1C]" />
                        <kbd className="px-2 py-0.5 rounded-full bg-white text-[#0F1E1C] font-mono font-bold text-[10px] border border-[#D2E4E8]">{idx + 1}</kbd>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Close button */}
            <button
              id="btn-confirm-shortcuts-modal"
              type="button"
              onClick={() => setShowShortcutsModal(false)}
              className="w-full py-3.5 rounded-full bg-[#FDC323] hover:bg-[#EBB215] text-[#0F1E1C] font-black text-xs transition-all shadow-[0_3px_0_#0F1E1C] active:translate-y-0.5 active:shadow-none border border-[#0F1E1C]/20 cursor-pointer"
            >
              Mengerti, Lanjutkan Belajar
            </button>
          </div>
        </div>
      )}

      {/* Safety & Moderation Report Modal */}
      {showReportModal && (
        <div 
          className="fixed inset-0 bg-[#0F1E1C]/60 backdrop-blur-md z-50 flex items-center justify-center p-4 selection:bg-[#FDC323] selection:text-[#0F1E1C] font-sans"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReportModal(false);
          }}
        >
          <div className="max-w-md w-full bg-white rounded-[32px] p-6 shadow-2xl border-2 border-[#D2E4E8] text-[#0F1E1C] space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDF5F7]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0F1E1C]">Laporkan Partner</h3>
                  <p className="text-xs text-[#3A6B6A] font-medium">Bantu jaga ruang belajar tetap aman</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-full bg-[#EDF5F7] text-[#1D4D4A] hover:bg-[#D2E4E8] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-bold text-[#0F1E1C]">
              Pilih alasan untuk mengakhiri sesi. Blokir berlaku selama koneksi ini aktif.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleReportUser('Tidak aktif / AFK', false)}
                className="w-full p-3 rounded-2xl bg-[#F4F8F9] hover:bg-rose-50 border-2 border-[#D2E4E8] hover:border-rose-300 text-xs font-bold text-left text-[#0F1E1C] hover:text-rose-950 transition-all flex items-center justify-between"
              >
                <span>💤 Tidak Aktif / AFK</span>
                <span className="text-[10px] text-[#539BA9]">Skip Sesi</span>
              </button>

              <button
                type="button"
                onClick={() => handleReportUser('Perilaku tidak pantas / Toksik', true)}
                className="w-full p-3 rounded-2xl bg-[#F4F8F9] hover:bg-rose-50 border-2 border-[#D2E4E8] hover:border-rose-300 text-xs font-bold text-left text-[#0F1E1C] hover:text-rose-950 transition-all flex items-center justify-between"
              >
                <span>🚫 Perilaku Tidak Pantas / Toksik</span>
                <span className="text-[10px] text-[#539BA9]">Blokir & Skip</span>
              </button>

              <button
                type="button"
                onClick={() => handleReportUser('Spam / Konten Mengganggu', true)}
                className="w-full p-3 rounded-2xl bg-[#F4F8F9] hover:bg-rose-50 border-2 border-[#D2E4E8] hover:border-rose-300 text-xs font-bold text-left text-[#0F1E1C] hover:text-rose-950 transition-all flex items-center justify-between"
              >
                <span>📢 Spam / Konten Tidak Layak</span>
                <span className="text-[10px] text-[#539BA9]">Blokir & Skip</span>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 rounded-full bg-[#EDF5F7] hover:bg-[#D2E4E8] text-[#1D4D4A] font-black text-xs transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Whiteboard Modal */}
      {showWhiteboard && (

        <WhiteboardModal
          socket={socket}
          roomId={roomData.roomId}
          onClose={() => setShowWhiteboard(false)}
        />
      )}

    </div>
  );
};
