/**
 * Numa Space - Virtual Study Partner Matchmaking Web App
 * Real-time anonymous study matchmaking with WebRTC video/audio, synchronized Pomodoro & scratchpad.
 */

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { UserProfile, RoomSessionData, GlobalStats } from './types';
import { AnonymousEntryForm } from './components/AnonymousEntryForm';
import { QueueSearchingView } from './components/QueueSearchingView';
import { StudyRoom } from './components/StudyRoom';
import { SessionSummaryModal } from './components/SessionSummaryModal';
import { studyAudio } from './utils/audio';
import { 
  authenticateAnonymously, 
  saveTemporaryProfile, 
  createTemporarySessionDoc, 
  deleteTemporarySessionData 
} from './utils/firebase';

type AppState = 'entry' | 'searching' | 'in_room' | 'summary';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [appState, setAppState] = useState<AppState>('entry');
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [roomData, setRoomData] = useState<RoomSessionData | null>(null);
  const [queuePosition, setQueuePosition] = useState<number>(1);
  const [searchNotification, setSearchNotification] = useState<{
    message: string;
    type: 'skip' | 'leave' | 'disconnect';
  } | null>(null);

  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    onlineUsers: 1,
    queueCount: 0,
    activeRoomsCount: 0,
    totalMatchesCount: 142,
    totalStudyMinutesCount: 3580,
  });
  const [sessionSummary, setSessionSummary] = useState<{
    focusMinutes: number;
    todosCompleted: number;
  } | null>(null);

  const myProfileRef = useRef<UserProfile | null>(null);
  const roomDataRef = useRef<RoomSessionData | null>(null);

  useEffect(() => {
    myProfileRef.current = myProfile;
  }, [myProfile]);

  useEffect(() => {
    roomDataRef.current = roomData;
  }, [roomData]);

  // Initialize Socket.io connection on mount & authenticate Firebase Anonymously
  useEffect(() => {
    authenticateAnonymously();

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const s = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    s.on('connect', () => {
      console.log('Connected to Numa Space Server with ID:', s.id);
    });

    s.on('stats_update', (stats: GlobalStats) => {
      setGlobalStats(stats);
    });

    s.on('queue_status', (data: { status: string; position?: number }) => {
      if (data.status === 'waiting') {
        setQueuePosition(data.position || 1);
        setAppState('searching');
      } else if (data.status === 'left') {
        setAppState('entry');
      }
    });

    s.on('match_found', (data: {
      roomId: string;
      isInitiator: boolean;
      isDemoBot?: boolean;
      partner: UserProfile;
      roomState: {
        pomodoro: any;
        scratchpad: string;
        todos: any[];
      };
    }) => {
      setSearchNotification(null);
      setRoomData({
        roomId: data.roomId,
        isInitiator: data.isInitiator,
        isDemoBot: data.isDemoBot,
        partner: data.partner,
        pomodoro: data.roomState.pomodoro,
        scratchpad: data.roomState.scratchpad,
        todos: data.roomState.todos,
      });

      // Register temporary session in Cloud Firestore
      createTemporarySessionDoc(data.roomId, s.id || 'user1', data.partner.id);
      setAppState('in_room');
    });

    s.on('partner_left', (data: { reason?: string; action?: 'skip' | 'leave' | 'disconnect'; partnerName?: string }) => {
      console.log('Partner left notification received in App.tsx:', data);

      const partnerName = data.partnerName || 'Partner Anda';
      let msg = '';
      if (data.action === 'skip') {
        msg = `Partner Anda (${partnerName}) telah menskip sesi. Otomatis mencarikan teman belajar baru untuk Anda...`;
      } else if (data.action === 'leave') {
        msg = `Partner Anda (${partnerName}) telah mengakhiri sesi belajar. Otomatis mencarikan teman belajar baru untuk Anda...`;
      } else {
        msg = `Partner Anda (${partnerName}) terputus dari jaringan. Otomatis mencarikan teman belajar baru untuk Anda...`;
      }

      studyAudio.playMessagePop();
      setSearchNotification({ message: msg, type: data.action || 'skip' });

      // Clean up current room session data
      const currentProfile = myProfileRef.current;
      const currentRoom = roomDataRef.current;

      if (currentRoom && currentProfile) {
        deleteTemporarySessionData(currentRoom.roomId, currentProfile.id);
      }
      setRoomData(null);

      // Automatically re-join queue to find a new partner
      if (currentProfile) {
        s.emit('join_queue', currentProfile);
        setAppState('searching');
      } else {
        setAppState('entry');
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // 1. Start Matchmaking in queue
  const handleStartMatching = async (profile: UserProfile) => {
    setSearchNotification(null);
    const user = await authenticateAnonymously();
    const activeProfile = {
      ...profile,
      id: user?.uid || profile.id,
    };

    setMyProfile(activeProfile);
    saveTemporaryProfile(activeProfile.id, activeProfile);

    setAppState('searching');
    socket?.emit('join_queue', activeProfile);
  };

  // 2. Start Instant Demo Session
  const handleStartInstantDemo = async (profile: UserProfile) => {
    setSearchNotification(null);
    const user = await authenticateAnonymously();
    const activeProfile = {
      ...profile,
      id: user?.uid || profile.id,
    };

    setMyProfile(activeProfile);
    saveTemporaryProfile(activeProfile.id, activeProfile);
    socket?.emit('request_instant_partner', activeProfile);
  };

  // 3. Cancel Matchmaking Search
  const handleCancelQueue = () => {
    setSearchNotification(null);
    if (myProfile) {
      deleteTemporarySessionData(undefined, myProfile.id);
    }
    socket?.emit('leave_queue');
    setAppState('entry');
  };

  // 4. Skip Partner and find next in queue (Stateless cleanup per PRD)
  const handleSkipPartner = () => {
    setSearchNotification(null);
    if (roomData && myProfile) {
      deleteTemporarySessionData(roomData.roomId, myProfile.id);

      socket?.emit('skip_partner', {
        roomId: roomData.roomId,
        userProfile: myProfile,
      });
      setRoomData(null);
      setAppState('searching');
    }
  };

  // 5. Leave Room & Complete Session (Stateless cleanup per PRD)
  const handleLeaveRoom = (summary: { focusMinutes: number; todosCompleted: number }) => {
    setSearchNotification(null);
    if (roomData) {
      deleteTemporarySessionData(roomData.roomId, myProfile?.id);
      socket?.emit('leave_room', { roomId: roomData.roomId });
    }
    setSessionSummary(summary);
    setAppState('summary');
  };

  // 6. Summary Modal Actions
  const handleSummaryNewMatch = () => {
    setSearchNotification(null);
    setSessionSummary(null);
    setRoomData(null);
    if (myProfile) {
      handleStartMatching(myProfile);
    } else {
      setAppState('entry');
    }
  };

  const handleGoHome = () => {
    setSearchNotification(null);
    if (myProfile) {
      deleteTemporarySessionData(undefined, myProfile.id);
    }
    setSessionSummary(null);
    setRoomData(null);
    setAppState('entry');
  };

  return (
    <div className="w-full min-h-screen bg-indigo-600 text-slate-900 font-sans antialiased">
      {/* 1. Anonymous Entry Screen */}
      {appState === 'entry' && (
        <AnonymousEntryForm
          onStartMatching={handleStartMatching}
          onStartInstantDemo={handleStartInstantDemo}
          stats={globalStats}
        />
      )}

      {/* 2. Live Matchmaking Searching View */}
      {appState === 'searching' && myProfile && (
        <QueueSearchingView
          myProfile={myProfile}
          stats={globalStats}
          queuePosition={queuePosition}
          searchNotification={searchNotification}
          onCancelQueue={handleCancelQueue}
          onRequestInstantDemo={() => handleStartInstantDemo(myProfile)}
        />
      )}

      {/* 3. Virtual Study Room (Video, Pomodoro, Scratchpad, Bio Display, Chat) */}
      {appState === 'in_room' && roomData && myProfile && (
        <StudyRoom
          socket={socket}
          roomData={roomData}
          myProfile={myProfile}
          onSkipPartner={handleSkipPartner}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {/* 4. Session Summary Modal */}
      {appState === 'summary' && sessionSummary && (
        <SessionSummaryModal
          focusMinutes={sessionSummary.focusMinutes}
          todosCompleted={sessionSummary.todosCompleted}
          onStartNewMatch={handleSummaryNewMatch}
          onGoHome={handleGoHome}
        />
      )}
    </div>
  );
}
