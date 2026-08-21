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
  onSkipPartner: () => void;
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
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('excellent');
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



  const handleReportUser = (reason: string) => {
    if (socket) {
      socket.emit('report_user', {
        roomId: roomData.roomId,
        reason,
        userProfile: myProfile,
      });
    }
    setShowReportModal(false);
    onSkipPartner();
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
    <div className="min-h-screen bg-indigo-600 text-slate-900 flex flex-col font-sans selection:bg-amber-400 selection:text-indigo-950 relative overflow-x-hidden">
      
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
                className="absolute bottom-36 right-4 sm:right-12 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border-2 border-amber-300 shadow-2xl text-xs text-indigo-950 font-black pointer-events-none z-30"
              >
                <div className={`p-1.5 rounded-full ${reactionObj.color}`}>
                  <IconComp className="w-4 h-4" />
                </div>
                <span className="font-black text-indigo-900">{r.name}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>



      {/* Top Bar: Minimalist Clean Navbar (Logo, Timer, Skip & Akhiri - Zero Scroll) */}
      <header className="border-b border-indigo-500/40 bg-indigo-700/95 backdrop-blur-md px-2 sm:px-5 py-1.5 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-2 sticky top-0 z-30 shadow-md text-white w-full overflow-hidden">
        
        {/* Left: App Logo & Active Session Status Badge */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink min-w-0 overflow-hidden">
          <div className="shrink-0 max-sm:[&_span]:hidden">
            <NumaLogo size="sm" />
          </div>

          {/* Unified Active Session Box */}
          <div className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-indigo-950/80 border border-indigo-400/30 text-white shadow-inner shrink min-w-0 truncate">
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-300 truncate">
                {myProfile.roomCode ? `Private: ${myProfile.roomCode}` : 'Sesi Aktif'}
              </span>
            </div>

            <span className="text-indigo-500 text-xs">|</span>

            <div className="flex items-center gap-1 text-[10px] sm:text-xs font-mono font-bold text-slate-100 shrink-0">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0" />
              <span>{formatSessionTime(sessionSeconds)}</span>
            </div>

            <span className="text-indigo-500 text-xs hidden sm:inline">|</span>

            <span className={`hidden sm:inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
              pomodoro.mode === 'focus' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
            }`}>
              {pomodoro.mode === 'focus' ? 'Fokus' : 'Rehat'}
            </span>
          </div>
        </div>

        {/* Right: Essential Action Controls ONLY (Skip & Akhiri - Fit 100% Screen) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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
            className="px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-amber-400 hover:bg-amber-300 text-indigo-950 border sm:border-2 border-amber-300 text-[11px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            title="Cari partner belajar baru [Esc]"
          >
            <SkipForward className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
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
            className="px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-rose-500 hover:bg-rose-600 text-white border border-rose-400 text-[11px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
            title="Akhiri Sesi Belajar"
          >
            <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>Akhiri</span>
          </button>
        </div>

      </header>

      {/* Dedicated Room Features Sub-Bar (Ambient Sound, Ping Latency, Whiteboard, Pintasan, Report) */}
      <div className="bg-indigo-900/90 border-b border-indigo-500/40 px-3 sm:px-5 py-1.5 flex items-center justify-between gap-2 text-white overflow-x-auto no-scrollbar shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* Suara Ambient Controls */}
          <div className="flex items-center gap-1 bg-indigo-950/80 border border-indigo-400/30 px-1.5 py-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => handleToggleAmbient('rain')}
              title="Suara Hujan (Rain)"
              className={`p-1 rounded-lg text-xs transition-colors cursor-pointer ${
                ambientType === 'rain' ? 'bg-amber-400 text-indigo-950 font-bold' : 'text-indigo-200 hover:text-white'
              }`}
            >
              <CloudRain className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleToggleAmbient('cafe')}
              title="Suara Cafe Lofi"
              className={`p-1 rounded-lg text-xs transition-colors cursor-pointer ${
                ambientType === 'cafe' ? 'bg-amber-400 text-indigo-950 font-bold' : 'text-indigo-200 hover:text-white'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleToggleAmbient('binaural')}
              title="Binaural Theta Wave"
              className={`p-1 rounded-lg text-xs transition-colors cursor-pointer ${
                ambientType === 'binaural' ? 'bg-amber-400 text-indigo-950 font-bold' : 'text-indigo-200 hover:text-white'
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
                className="w-10 sm:w-14 h-1.5 accent-amber-400 ml-1 cursor-pointer"
                title="Volume Ambient"
              />
            )}
          </div>

          {/* Sinyal Ping Latency Badge */}
          <div 
            className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-[10px] sm:text-[11px] font-bold shrink-0"
            title={`WebRTC Peer Ping: ${rttMs || 35}ms (${networkQuality})`}
          >
            <span className={`w-2 h-2 rounded-full ${
              networkQuality === 'excellent' ? 'bg-emerald-400 animate-pulse' : networkQuality === 'good' ? 'bg-amber-400' : 'bg-rose-400'
            }`} />
            <span className="font-mono text-indigo-200">{rttMs > 0 ? `${rttMs}ms` : '38ms'}</span>
          </div>

          {/* Papan Tulis Button */}
          <button
            type="button"
            onClick={() => setShowWhiteboard(true)}
            className="px-2.5 py-1 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-400/30 text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1 text-xs shrink-0 cursor-pointer"
            title="Buka Papan Tulis Digital"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Papan Tulis</span>
          </button>

          {/* Pintasan Button */}
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="px-2.5 py-1 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-400/30 text-indigo-100 hover:text-white font-bold flex items-center gap-1 text-xs shrink-0 cursor-pointer"
            title="Lihat Pintasan Keyboard"
          >
            <Keyboard className="w-3.5 h-3.5 text-amber-300" />
            <span>Pintasan</span>
          </button>

          {/* Laporkan Partner Button */}
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="p-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white transition-all shrink-0 cursor-pointer"
            title="Laporkan Partner / Masalah Keamanan"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dedicated Partner Bio Banner (Separate from Navbar & Tools Sub-Bar) */}
      <div className="bg-indigo-950/90 border-b border-indigo-600/30 px-3 sm:px-5 py-2 text-white">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-indigo-300 font-bold">Partner Belajar:</span>
            <span className="font-black text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/30">{roomData.partner.displayName}</span>
            <span className="text-indigo-600 font-bold">•</span>
            <span className="text-indigo-200 font-bold">{roomData.partner.major}</span>
            <span className="text-indigo-600 font-bold">•</span>
            <span className="text-rose-300 font-medium">{roomData.partner.interest}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Belajar Badge */}
            <div className="flex items-center gap-1.5 bg-indigo-900/90 px-2.5 py-1 rounded-full border border-indigo-400/40 text-[11px] font-bold text-amber-300 shadow-sm">
              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Mode: {
                myProfile.studyMode === 'silent' ? 'Silent Study 🔇' :
                myProfile.studyMode === 'discussion' ? 'Diskusi Aktif 🗣️' :
                myProfile.studyMode === 'casual' ? 'Santai / Casual 🎧' : 'Pomodoro Focus ⏱️'
              }</span>
            </div>

            {roomData.partner.currentGoal && (
              <div className="flex items-center gap-1.5 bg-indigo-900/60 px-3 py-1 rounded-full border border-indigo-500/30 text-[11px]">
                <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-indigo-200">Target Partner: <strong className="text-emerald-300 font-bold">{roomData.partner.currentGoal}</strong></span>
              </div>
            )}
          </div>

        </div>
      </div>




      {/* Mobile Navigation Tab Bar (3 Views: Video, Tools, Chat) */}
      <div className="lg:hidden sticky top-[53px] sm:top-[57px] z-20 bg-indigo-900/95 backdrop-blur-md px-2.5 py-1.5 border-b border-indigo-500/30">
        <div className="grid grid-cols-3 gap-1 bg-indigo-950/80 p-1 rounded-2xl border border-indigo-700/50 text-[11px] sm:text-xs font-black">
          <button
            type="button"
            onClick={() => setMobileTab('stage')}
            className={`py-2 rounded-xl flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer font-black ${
              mobileTab === 'stage'
                ? 'bg-amber-400 text-indigo-950 shadow-md'
                : 'text-indigo-200 hover:text-white'
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
            className={`py-2 rounded-xl flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer font-black ${
              mobileTab === 'tools'
                ? 'bg-amber-400 text-indigo-950 shadow-md'
                : 'text-indigo-200 hover:text-white'
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
            className={`py-2 rounded-xl flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer font-black relative ${
              mobileTab === 'chat'
                ? 'bg-amber-400 text-indigo-950 shadow-md'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Obrolan</span>
            {messages.length > 1 && (
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" />
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
              className="px-4 py-3 rounded-2xl bg-amber-400 text-indigo-950 font-black flex items-center justify-between shadow-xl cursor-pointer hover:bg-amber-300 transition-all border-2 border-amber-300 animate-pulse"
            >
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <Volume2 className="w-5 h-5 shrink-0 text-indigo-950" />
                <span>Klik di sini untuk Mengaktifkan Suara & Video Partner!</span>
              </div>
              <span className="px-3 py-1 rounded-xl bg-indigo-950 text-amber-300 text-xs font-black shrink-0">
                Aktifkan
              </span>
            </div>
          )}

          
          {/* Dual Screen Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* 1. Partner Video / Avatar Card */}
            <div className="bg-indigo-950 rounded-3xl p-2.5 shadow-xl border-4 border-indigo-400/30 aspect-video sm:aspect-[4/3] relative flex flex-col justify-between overflow-hidden">
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
                className="absolute inset-0 w-full h-full object-cover z-0 rounded-2xl bg-slate-950"
              />

              {/* Virtual Study Avatar (shown on top at z-10 when video is off) */}
              {!mediaState.partnerVideoEnabled && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-indigo-900 via-indigo-950 to-indigo-900 z-10 rounded-2xl text-white">
                  <div className="w-16 h-16 rounded-2xl bg-amber-400 border-2 border-amber-300 text-indigo-950 flex items-center justify-center text-2xl font-black shadow-lg mb-2">
                    {roomData.partner.displayName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="text-center space-y-0.5 max-w-[90%]">
                    <h3 className="text-sm font-black text-white truncate">{roomData.partner.displayName}</h3>
                    <p className="text-xs text-amber-300 font-bold truncate">{roomData.partner.major}</p>
                    <p className="text-[11px] text-indigo-200 italic truncate">&ldquo;{roomData.partner.interest}&rdquo;</p>
                  </div>
                </div>
              )}

              {/* Card Top Badges */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/80 backdrop-blur-md border border-indigo-700/50 text-[11px] text-white font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{roomData.partner.displayName}</span>
                  <span className="text-[10px] text-indigo-200">({roomData.partner.gender === 'male' ? 'L' : roomData.partner.gender === 'female' ? 'P' : 'Anonim'})</span>
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
                    className="p-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-amber-300 hover:text-amber-200 border border-indigo-700/50 text-xs transition-colors cursor-pointer"
                    title="Muat Ulang / Refresh Kamera Partner"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  {mediaState.partnerAudioEnabled ? (
                    <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
                      <Mic className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="p-1 rounded-lg bg-indigo-950/80 text-indigo-300 text-xs border border-indigo-700/50">
                      <MicOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>

              {/* Card Bottom: Partner Goal Badge */}
              <div className="relative z-10 mt-auto">
                <div className="px-3 py-1.5 rounded-2xl bg-indigo-950/90 backdrop-blur-md border border-indigo-700/50 text-[11px] text-white flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate font-medium">Target: <strong className="text-amber-300 font-bold">{roomData.partner.currentGoal}</strong></span>
                </div>
              </div>
            </div>

            {/* 2. My Video / Avatar Card */}
            <div className="bg-indigo-950 rounded-3xl p-2.5 shadow-xl border-4 border-indigo-400/30 aspect-video sm:aspect-[4/3] relative flex flex-col justify-between overflow-hidden">
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
                className={`absolute inset-0 w-full h-full object-cover z-0 rounded-2xl bg-slate-950 transition-all duration-300 ${
                  (mediaState.videoEnabled || mediaState.screenSharing) ? 'block' : 'hidden'
                }`}
              />

              {/* Portrait Focus Edge Overlay when Blur is active */}
              {cameraBlur && mediaState.videoEnabled && (
                <div className="absolute inset-0 pointer-events-none rounded-2xl z-[5] shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] border-2 border-amber-400/40">
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-amber-400/90 text-indigo-950 text-[10px] font-black flex items-center gap-1 shadow-sm backdrop-blur-sm">
                    <Focus className="w-3 h-3 text-indigo-950" />
                    <span>Latar Belakang Blur Aktif</span>
                  </div>
                </div>
              )}




              {/* Virtual Study Avatar for User */}
              {!mediaState.videoEnabled && !mediaState.screenSharing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 z-0 rounded-2xl text-white">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${myProfile.avatarColor || 'from-indigo-600 to-blue-600'} border-2 border-white/40 text-white flex items-center justify-center text-2xl font-black shadow-lg mb-2`}>
                    {myProfile.displayName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="text-center space-y-0.5 max-w-[90%]">
                    <h3 className="text-sm font-black text-white truncate">{myProfile.displayName} (Saya)</h3>
                    <p className="text-xs text-indigo-200 font-bold truncate">{myProfile.major}</p>
                    <p className="text-[11px] text-amber-300 font-bold italic truncate">&ldquo;{myProfile.currentGoal}&rdquo;</p>
                  </div>
                </div>
              )}


              {/* Card Top Badges */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/80 backdrop-blur-md border border-indigo-700/50 text-[11px] text-white font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{myProfile.displayName} (Anda)</span>
                </div>

                <div className="flex items-center gap-1">
                  {mediaState.audioEnabled ? (
                    <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs flex items-center gap-1">
                      <Mic className="w-3.5 h-3.5" />
                      {myVolumeLevel > 15 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                    </span>
                  ) : (
                    <span className="p-1 rounded-lg bg-indigo-950/80 text-indigo-300 text-xs border border-indigo-700/50">
                      <MicOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>

              {/* Card Bottom: Local Goal Badge */}
              <div className="relative z-10 mt-auto">
                <div className="px-3 py-1.5 rounded-2xl bg-indigo-950/90 backdrop-blur-md border border-indigo-700/50 text-[11px] text-white flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate font-medium">Target: <strong className="text-emerald-300 font-bold">{myProfile.currentGoal}</strong></span>
                </div>
              </div>
            </div>

          </div>

          {/* Media Controls Bar & Quick Reactions Container */}
          <div className="bg-white rounded-3xl p-3 sm:p-4 flex flex-col items-center justify-between gap-2.5 shadow-xl border-4 border-indigo-400/20 relative z-20">
            
            {/* Top Row: AV Controls Section (Kamera, Blur, Mic, Bagi Layar) */}
            <div className="flex items-center gap-1.5 sm:gap-2 w-full justify-between sm:justify-center overflow-x-auto no-scrollbar py-0.5 shrink-0 relative z-20">
              <button
                id="btn-toggle-camera"
                type="button"
                onClick={handleToggleCamera}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shrink-0 ${
                  mediaState.videoEnabled
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-200'
                }`}
                title="Nyalakan / Matikan Kamera (V)"
              >
                {mediaState.videoEnabled ? <Video className="w-4 h-4 shrink-0" /> : <VideoOff className="w-4 h-4 text-slate-400 shrink-0" />}
                <span className="text-[11px] sm:text-xs whitespace-nowrap">{mediaState.videoEnabled ? 'Kamera On' : 'Kamera Off'}</span>
                <kbd className={`hidden sm:inline-block px-1.5 py-0.2 rounded font-mono font-black text-[10px] ${
                  mediaState.videoEnabled ? 'bg-indigo-700 text-amber-300' : 'bg-slate-200 text-slate-600'
                }`}>
                  V
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => setCameraBlur((prev) => !prev)}
                className={`px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shrink-0 ${
                  cameraBlur
                    ? 'bg-amber-400 text-indigo-950 border-2 border-amber-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-200'
                }`}
                title="Aktifkan / Matikan Efek Blur Latar Kamera"
              >
                <Focus className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{cameraBlur ? 'Blur On' : 'Blur Off'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCameraMirror((prev) => !prev)}
                className={`px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shrink-0 ${
                  cameraMirror
                    ? 'bg-indigo-100 text-indigo-900 border-2 border-indigo-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-200'
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
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shrink-0 ${
                  mediaState.audioEnabled
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-200'
                }`}
                title="Mute / Unmute Mikrofon (Space)"
              >
                {mediaState.audioEnabled ? <Mic className="w-4 h-4 shrink-0" /> : <MicOff className="w-4 h-4 text-slate-400 shrink-0" />}
                <span className="text-[11px] sm:text-xs whitespace-nowrap">{mediaState.audioEnabled ? 'Mic On' : 'Mic Off'}</span>
                <kbd className={`hidden sm:inline-block px-1.5 py-0.2 rounded font-mono font-black text-[10px] ${
                  mediaState.audioEnabled ? 'bg-indigo-700 text-amber-300' : 'bg-slate-200 text-slate-600'
                }`}>
                  Space
                </kbd>
              </button>

              <button
                id="btn-toggle-screenshare"
                type="button"
                onClick={handleToggleScreenShare}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shrink-0 ${
                  mediaState.screenSharing
                    ? 'bg-amber-400 text-indigo-950 border-2 border-amber-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-200'
                }`}
              >
                <Monitor className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">{mediaState.screenSharing ? 'Stop Share' : 'Bagi Layar'}</span>
              </button>
            </div>

            {/* Bottom Row: Dedicated Quick Reactions Bar (Placed Directly Below AV Controls) */}
            <div className="w-full flex items-center justify-center gap-1.5 bg-indigo-50/90 px-3 py-1.5 rounded-2xl border border-indigo-100 overflow-x-auto no-scrollbar shrink-0 relative z-10">
              <span className="text-[11px] text-indigo-800 px-1 font-black uppercase tracking-wider shrink-0">Reaksi:</span>
              {QUICK_REACTIONS.map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSendReaction(item.id)}
                    className="group relative p-2 rounded-xl hover:bg-indigo-100 flex items-center justify-center transition-transform active:scale-125 cursor-pointer shrink-0"
                    title={`Kirim ${item.name}`}
                  >
                    <IconComp className="w-4 h-4 text-indigo-700 group-hover:scale-110 transition-transform" />
                    <span className="absolute -bottom-1 -right-0.5 text-[8px] font-mono font-bold text-slate-400 group-hover:text-indigo-600 hidden sm:inline">
                      {idx + 1}
                    </span>
                  </button>
                );
              })}
            </div>

          </div>




          {/* Synchronized Pomodoro Widget in Vibrant Palette */}
          <div className="bg-white rounded-3xl p-3.5 sm:p-5 shadow-xl border-4 border-indigo-400/20 space-y-3.5 text-slate-900">
            {/* Header: Title, Badge, & Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b-2 border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400 border border-amber-300 flex items-center justify-center text-indigo-950 font-black text-sm shadow-sm shrink-0">
                  🍅
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Timer Pomodoro</h4>
                  <p className="text-[10px] text-slate-500 font-semibold">Sinkron otomatis dengan partner</p>
                </div>
              </div>

              {/* Mode Selectors */}
              <div className="flex items-center gap-1 bg-indigo-50 p-1 rounded-2xl border-2 border-indigo-100 text-[11px] w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handlePomodoroChangeMode('focus')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl font-black transition-all cursor-pointer text-center ${
                    pomodoro.mode === 'focus' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Fokus (25m)
                </button>
                <button
                  type="button"
                  onClick={() => handlePomodoroChangeMode('short_break')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl font-black transition-all cursor-pointer text-center ${
                    pomodoro.mode === 'short_break' ? 'bg-amber-400 text-indigo-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
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
                <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-indigo-950">
                  {formatSeconds(pomodoro.timeLeft)}
                </div>
                <div className="text-left space-y-0.5">
                  {pomodoro.isRunning ? (
                    <span className="text-indigo-600 flex items-center gap-1 font-black text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                      Berjalan Bersama
                    </span>
                  ) : (
                    <span className="text-amber-600 font-black text-xs">Dijeda</span>
                  )}
                  <div className="text-[10px] text-slate-400 font-bold">{pomodoro.sessionsCompleted} putaran selesai</div>
                </div>
              </div>

              {/* Right: Controls (Play/Pause & Reset) */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  id="btn-pomodoro-play"
                  type="button"
                  onClick={handlePomodoroPlayPause}
                  className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95 ${
                    pomodoro.isRunning
                      ? 'bg-amber-400 hover:bg-amber-300 text-indigo-950 border-2 border-amber-300'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)]'
                  }`}
                  title="Mulai / Jeda Pomodoro (P)"
                >
                  {pomodoro.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{pomodoro.isRunning ? 'Jeda' : 'Mulai Fokus'}</span>
                  <kbd className={`hidden sm:inline-block px-1.5 py-0.2 rounded font-mono font-black text-[10px] ${
                    pomodoro.isRunning ? 'bg-amber-500/40 text-indigo-950' : 'bg-indigo-700 text-amber-300'
                  }`}>
                    P
                  </kbd>
                </button>

                <button
                  id="btn-pomodoro-reset"
                  type="button"
                  onClick={handlePomodoroReset}
                  className="px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 border-2 border-slate-200 transition-all cursor-pointer active:scale-95 shrink-0"
                  title="Reset Timer (R)"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">Reset</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-mono font-black text-[10px]">
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
          <div className="hidden lg:flex bg-white rounded-3xl p-1.5 items-center justify-between text-xs font-bold shadow-xl border-4 border-indigo-400/20">

            <div className="grid grid-cols-2 gap-1.5 w-full">
              <button
                type="button"
                onClick={() => setActiveTab('tools')}
                className={`py-2.5 px-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer font-black ${
                  activeTab === 'tools'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Buka Target & Catatan (T)"
              >
                <Sparkles className="w-4 h-4" />
                <span>Target & Catatan</span>
                <kbd className={`px-1.5 py-0.2 rounded font-mono font-black text-[10px] ${
                  activeTab === 'tools' ? 'bg-indigo-700 text-amber-300' : 'bg-slate-100 text-slate-400'
                }`}>
                  T
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`py-2.5 px-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer font-black relative ${
                  activeTab === 'chat'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Buka Obrolan Sesi (C)"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Obrolan Sesi</span>
                <kbd className={`px-1.5 py-0.2 rounded font-mono font-black text-[10px] ${
                  activeTab === 'chat' ? 'bg-indigo-700 text-amber-300' : 'bg-slate-100 text-slate-400'
                }`}>
                  C
                </kbd>
                {messages.length > 1 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 absolute top-2.5 right-4 shadow-sm" />
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: STUDY TOOLS (Scratchpad & Goals Checklist) */}
          {activeTab === 'tools' && (
            <div className="space-y-3 sm:space-y-4">
              
              {/* Mobile Pomodoro Timer Card (Visible on mobile screens when inside Tools tab) */}
              <div className="lg:hidden bg-white rounded-3xl p-3.5 shadow-xl border-4 border-indigo-400/20 space-y-3 text-slate-900">
                <div className="flex items-center justify-between gap-2 border-b-2 border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-amber-400 border border-amber-300 flex items-center justify-center text-indigo-950 font-black text-xs shadow-sm shrink-0">
                      🍅
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Timer Pomodoro</h4>
                      <p className="text-[10px] text-slate-500 font-semibold">Sinkron dengan partner</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-indigo-50 p-1 rounded-xl border border-indigo-100 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handlePomodoroChangeMode('focus')}
                      className={`px-2 py-1 rounded-lg font-black transition-all cursor-pointer ${
                        pomodoro.mode === 'focus' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                      }`}
                    >
                      Fokus (25m)
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePomodoroChangeMode('short_break')}
                      className={`px-2 py-1 rounded-lg font-black transition-all cursor-pointer ${
                        pomodoro.mode === 'short_break' ? 'bg-amber-400 text-indigo-950' : 'text-slate-600'
                      }`}
                    >
                      Rehat (5m)
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black font-mono tracking-tight text-indigo-950">
                      {formatSeconds(pomodoro.timeLeft)}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      pomodoro.isRunning ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {pomodoro.isRunning ? 'Berjalan' : 'Dijeda'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePomodoroPlayPause}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 shadow-sm cursor-pointer ${
                        pomodoro.isRunning ? 'bg-amber-400 text-indigo-950' : 'bg-indigo-600 text-white'
                      }`}
                    >
                      {pomodoro.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{pomodoro.isRunning ? 'Jeda' : 'Mulai'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePomodoroReset}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer border border-slate-200"
                      title="Reset Timer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tool Selector Pill */}
              <div className="flex items-center gap-2 border-b border-indigo-400/30 pb-2 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTool('todos')}
                  className={`px-3.5 py-1.5 rounded-2xl font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTool === 'todos'
                      ? 'bg-white text-indigo-900 shadow-md border-2 border-amber-300'
                      : 'text-indigo-100 hover:text-white font-bold'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Target Bersama ({todos.filter((t) => t.done).length}/{todos.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('scratchpad')}
                  className={`px-3.5 py-1.5 rounded-2xl font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTool === 'scratchpad'
                      ? 'bg-white text-indigo-900 shadow-md border-2 border-amber-300'
                      : 'text-indigo-100 hover:text-white font-bold'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Shared Scratchpad</span>
                </button>
              </div>

              {/* Sub-view: To-do Checklist */}
              {activeTool === 'todos' && (
                <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-xl border-4 border-indigo-400/20 space-y-3 text-slate-900">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Checklist Target Sesi Ini
                    </h4>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-wider">
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
                      className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-50 border-2 border-slate-200 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-md active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  </form>

                  {/* Todos List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {todos.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium italic text-center py-4">
                        Belum ada target tugas. Tambahkan target di atas!
                      </p>
                    ) : (
                      todos.map((todo) => (
                        <div
                          key={todo.id}
                          className={`p-3 rounded-2xl border-2 flex items-center justify-between gap-2 text-xs transition-all ${
                            todo.done
                              ? 'bg-emerald-50/70 border-emerald-200 text-slate-400'
                              : 'bg-indigo-50/50 border-indigo-100 text-slate-900 font-bold'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleTodo(todo)}
                            className="flex items-center gap-2 text-left flex-1 cursor-pointer"
                          >
                            {todo.done ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-indigo-600 shrink-0" />
                            )}
                            <span className={todo.done ? 'line-through text-slate-400 font-normal' : 'font-bold'}>
                              {todo.text}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTodo(todo)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
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
                <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-xl border-4 border-indigo-400/20 space-y-2 text-slate-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-wider">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Shared Scratchpad / Catatan Bersama</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Tersinkronisasi otomatis</span>
                  </div>

                  <textarea
                    rows={9}
                    value={scratchpad}
                    onChange={handleScratchpadChange}
                    placeholder="Tulis rumus, rangkuman, link referensi, atau pertanyaan di sini..."
                    className="w-full p-3.5 rounded-2xl bg-slate-50 border-2 border-slate-200 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white resize-none leading-relaxed transition-all"
                  />
                </div>
              )}

              {/* Icebreaker Prompts Pill in Amber theme */}
              <div className="p-4 rounded-3xl bg-amber-50 border-2 border-amber-200 text-xs space-y-2 text-amber-950 shadow-md">
                <span className="font-black text-amber-900 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-700" />
                  Topik Pembuka Percakapan Relevan:
                </span>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setChatInput(`Bagaimana progres topik "${roomData.partner.interest}" sejauh ini?`);
                      setActiveTab('chat');
                    }}
                    className="text-left p-2.5 rounded-2xl bg-white border border-amber-200 hover:border-amber-400 text-amber-950 font-bold transition-all cursor-pointer truncate shadow-sm active:scale-95"
                  >
                    💬 &ldquo;Bagaimana progres topik {roomData.partner.interest}?&rdquo;
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChatInput(`Mari kita targetkan 25 menit ini tanpa membuka media sosial! 🔥`);
                      setActiveTab('chat');
                    }}
                    className="text-left p-2.5 rounded-2xl bg-white border border-amber-200 hover:border-amber-400 text-amber-950 font-bold transition-all cursor-pointer truncate shadow-sm active:scale-95"
                  >
                    🎯 &ldquo;Target 25 menit ini tanpa distraksi sosmed! 🔥&rdquo;
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: LIVE CHAT SIDEBAR */}
          {activeTab === 'chat' && (
            <div className="bg-white rounded-3xl flex flex-col h-[65vh] lg:h-[480px] shadow-xl border-4 border-indigo-400/20 overflow-hidden text-slate-900">
              
              {/* Chat Header */}
              <div className="p-3.5 border-b-2 border-slate-100 flex items-center justify-between bg-indigo-50/70">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black text-slate-900">Obrolan Sesi Belajar</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-100">
                  Stateless Privacy
                </span>
              </div>

              {/* Chat Messages Feed */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs bg-slate-50/50">
                {messages.map((msg) => {
                  const isMe = msg.senderId === myProfile.id;
                  const isSystem = msg.type === 'system' || msg.type === 'goal_completed';

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="text-center py-1">
                        <span className="inline-block px-3 py-1 rounded-full bg-amber-100 border border-amber-200 text-[11px] text-amber-950 font-bold">
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
                      <span className="text-[10px] text-slate-400 font-bold mb-0.5 px-1">
                        {msg.senderName}
                      </span>
                      <div
                        className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs break-words leading-relaxed shadow-sm ${
                          isMe
                            ? 'bg-indigo-600 text-white rounded-br-none font-semibold'
                            : 'bg-white text-slate-900 rounded-bl-none border-2 border-slate-200 font-semibold'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}

                {isPartnerTyping && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 italic px-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                    <span>{roomData.partner.displayName} sedang mengetik...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-3 border-t-2 border-slate-100 bg-white flex gap-2">
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
                  className="flex-1 px-3.5 py-2 rounded-2xl bg-slate-50 border-2 border-slate-200 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                />
                <button
                  id="btn-send-chat"
                  type="submit"
                  className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer shadow-md active:scale-95"
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
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-indigo-950/95 text-white border-2 border-amber-400 shadow-2xl backdrop-blur-md">
            <span className="text-xs font-black text-amber-300">{shortcutToast.message}</span>
            <kbd className="px-2 py-0.5 rounded-lg bg-amber-400 text-indigo-950 font-mono font-black text-[10px] shadow-sm uppercase">
              {shortcutToast.key}
            </kbd>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Guide Modal */}
      {showShortcutsModal && (
        <div 
          id="modal-keyboard-shortcuts"
          className="fixed inset-0 bg-indigo-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 selection:bg-amber-400 selection:text-indigo-950 font-sans"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowShortcutsModal(false);
          }}
        >
          <div className="max-w-lg w-full bg-white rounded-[32px] p-6 sm:p-7 shadow-2xl border-[8px] border-indigo-400/30 text-slate-900 space-y-5 animate-in fade-in zoom-in duration-200 relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-400 border border-amber-300 flex items-center justify-center text-indigo-950 shadow-sm">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">Pintasan Keyboard (Hotkeys)</h3>
                  <p className="text-xs font-medium text-slate-500">Navigasi dan kendalikan sesi belajar lebih cepat</p>
                </div>
              </div>
              <button
                id="btn-close-shortcuts-modal"
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Tutup [Esc]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shortcuts List by Group */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-xs">
              {/* Group 1: Media Controls */}
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600">Kontrol Audio & Video</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-700">Mute / Unmute Mic</span>
                    <kbd className="px-2.5 py-1 rounded-xl bg-amber-400 text-indigo-950 font-mono font-black text-[11px] shadow-sm">Space</kbd>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-700">Nyalakan/Matikan Kamera</span>
                    <kbd className="px-2.5 py-1 rounded-xl bg-indigo-100 text-indigo-900 border border-indigo-200 font-mono font-black text-[11px]">V</kbd>
                  </div>
                </div>
              </div>

              {/* Group 2: Sesi & Timer */}
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600">Sesi Belajar & Pomodoro</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-700">Mulai / Jeda Pomodoro</span>
                    <kbd className="px-2.5 py-1 rounded-xl bg-indigo-100 text-indigo-900 border border-indigo-200 font-mono font-black text-[11px]">P</kbd>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-700">Reset Timer Pomodoro</span>
                    <kbd className="px-2.5 py-1 rounded-xl bg-indigo-100 text-indigo-900 border border-indigo-200 font-mono font-black text-[11px]">R</kbd>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between sm:col-span-2">
                    <span className="font-bold text-slate-700">Cari Partner Lain (Skip Match)</span>
                    <kbd className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-950 border border-rose-200 font-mono font-black text-[11px]">Esc</kbd>
                  </div>
                </div>
              </div>

              {/* Group 3: Navigasi Tab */}
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600">Navigasi Tab & Fitur</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-700">Buka Tab Obrolan (Chat)</span>
                    <kbd className="px-2.5 py-1 rounded-xl bg-indigo-100 text-indigo-900 border border-indigo-200 font-mono font-black text-[11px]">C</kbd>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-700">Buka Target & Catatan</span>
                    <kbd className="px-2.5 py-1 rounded-xl bg-indigo-100 text-indigo-900 border border-indigo-200 font-mono font-black text-[11px]">T</kbd>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between sm:col-span-2">
                    <span className="font-bold text-slate-700">Buka / Tutup Panduan Ini</span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-0.5 rounded-lg bg-amber-400 text-indigo-950 font-mono font-black text-[10px]">?</kbd>
                      <kbd className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-800 font-mono font-black text-[10px]">H</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 4: Quick Reactions */}
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600">Kirim Reaksi Cepat</div>
                <div className="flex items-center justify-between gap-1 p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                  {QUICK_REACTIONS.map((item, idx) => {
                    const IconComp = item.icon;
                    return (
                      <div key={item.id} className="flex flex-col items-center gap-1">
                        <IconComp className="w-4 h-4 text-indigo-600" />
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono font-bold text-[10px]">{idx + 1}</kbd>
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
              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Mengerti, Lanjutkan Belajar
            </button>
          </div>
        </div>
      )}

      {/* Safety & Moderation Report Modal */}
      {showReportModal && (
        <div 
          className="fixed inset-0 bg-indigo-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 selection:bg-amber-400 selection:text-indigo-950 font-sans"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReportModal(false);
          }}
        >
          <div className="max-w-md w-full bg-white rounded-[32px] p-6 shadow-2xl border-[8px] border-rose-400/30 text-slate-900 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Laporkan Partner</h3>
                  <p className="text-xs text-slate-500 font-medium">Bantu jaga ruang belajar tetap aman</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-700">
              Pilih alasan pelaporan untuk menskip partner dan memberitahu moderasi sistem:
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleReportUser('Tidak aktif / AFK')}
                className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-300 text-xs font-bold text-left text-slate-800 hover:text-rose-950 transition-all flex items-center justify-between"
              >
                <span>💤 Tidak Aktif / AFK</span>
                <span className="text-[10px] text-slate-400">Skip Sesi</span>
              </button>

              <button
                type="button"
                onClick={() => handleReportUser('Perilaku tidak pantas / Toksik')}
                className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-300 text-xs font-bold text-left text-slate-800 hover:text-rose-950 transition-all flex items-center justify-between"
              >
                <span>🚫 Perilaku Tidak Pantas / Toksik</span>
                <span className="text-[10px] text-slate-400">Blokir & Skip</span>
              </button>

              <button
                type="button"
                onClick={() => handleReportUser('Spam / Konten Mengganggu')}
                className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-300 text-xs font-bold text-left text-slate-800 hover:text-rose-950 transition-all flex items-center justify-between"
              >
                <span>📢 Spam / Konten Tidak Layak</span>
                <span className="text-[10px] text-slate-400">Blokir & Skip</span>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-colors"
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
