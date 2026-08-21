import { Socket } from 'socket.io-client';
import { NetworkQuality } from '../types';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelay',
      credential: 'openrelay',
    },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream = new MediaStream(); // Persistent remote stream
  private screenStream: MediaStream | null = null;
  private socket: Socket | null = null;
  private roomId: string = '';
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onRemoteTrackStateCallback: ((kind: 'video' | 'audio', active: boolean) => void) | null = null;
  private onConnectionStateChangeCallback: ((state: RTCPeerConnectionState) => void) | null = null;
  private onNetworkQualityCallback: ((quality: NetworkQuality, rttMs: number) => void) | null = null;
  private audioContext: AudioContext | null = null;
  private audioAnalyser: AnalyserNode | null = null;
  private audioAnimFrame: number | null = null;
  private onVolumeChangeCallback: ((vol: number) => void) | null = null;
  private synthCanvasTimer: number | null = null;
  private statsIntervalTimer: number | null = null;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];
  private isInitiator: boolean = false;
  private isMakingOffer: boolean = false;
  private ignoreOffer: boolean = false;
  private iceRestartDebounceTimer: number | null = null;

  constructor() {}

  public setIsInitiator(isInit: boolean) {
    this.isInitiator = isInit;
  }

  public initialize(
    socket: Socket,
    roomId: string,
    onRemoteStream: (stream: MediaStream) => void,
    onConnectionStateChange: (state: RTCPeerConnectionState) => void,
    onVolumeChange?: (vol: number) => void,
    onNetworkQuality?: (quality: NetworkQuality, rttMs: number) => void,
    onRemoteTrackState?: (kind: 'video' | 'audio', active: boolean) => void
  ) {
    this.socket = socket;
    this.roomId = roomId;
    this.onRemoteStreamCallback = onRemoteStream;
    this.onConnectionStateChangeCallback = onConnectionStateChange;
    this.onVolumeChangeCallback = onVolumeChange || null;
    this.onNetworkQualityCallback = onNetworkQuality || null;
    this.onRemoteTrackStateCallback = onRemoteTrackState || null;

    this.setupPeerConnection();
    this.setupSocketListeners();
    this.startStatsMonitoring();

    // Provide the persistent remote stream immediately
    if (this.onRemoteStreamCallback) {
      this.onRemoteStreamCallback(this.remoteStream);
    }
  }

  public refreshRemoteStream() {
    if (this.onRemoteStreamCallback && this.remoteStream) {
      this.onRemoteStreamCallback(this.remoteStream);
    }
  }

  private startStatsMonitoring() {
    if (this.statsIntervalTimer) clearInterval(this.statsIntervalTimer);

    this.statsIntervalTimer = window.setInterval(async () => {
      if (!this.peerConnection || !this.onNetworkQualityCallback) return;

      try {
        const stats = await this.peerConnection.getStats();
        let rtt = 0;
        stats.forEach((report) => {
          if (report.type === 'remote-inbound-rtp' && report.roundTripTime) {
            rtt = report.roundTripTime * 1000;
          } else if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime) {
            rtt = report.currentRoundTripTime * 1000;
          }
        });

        let quality: NetworkQuality = 'excellent';
        if (rtt > 300) {
          quality = 'poor';
        } else if (rtt > 150) {
          quality = 'good';
        } else if (rtt === 0) {
          quality = 'good';
        }

        this.onNetworkQualityCallback(quality, Math.round(rtt));
      } catch {
        // ignore
      }
    }, 3000);
  }

  private setupPeerConnection() {
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

    try {
      this.peerConnection.addTransceiver('video', { direction: 'sendrecv' });
      this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
    } catch (err) {
      console.warn('Transceiver add warning:', err);
    }

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('webrtc_ice_candidate', {
          roomId: this.roomId,
          candidate: event.candidate,
        });
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const state = this.peerConnection.iceConnectionState;
      console.log(`[WebRTC] ICE Connection State changed to: ${state}`);

      if (state === 'disconnected' || state === 'failed') {
        console.warn('[WebRTC] ICE state dropped. Scheduling ICE restart...');
        if (this.iceRestartDebounceTimer) clearTimeout(this.iceRestartDebounceTimer);
        this.iceRestartDebounceTimer = window.setTimeout(() => {
          if (
            this.peerConnection &&
            (this.peerConnection.iceConnectionState === 'disconnected' ||
              this.peerConnection.iceConnectionState === 'failed')
          ) {
            console.log('[WebRTC] Triggering ICE restart offer...');
            this.createAndSendOffer(true);
          }
        }, 2000);
      } else if (state === 'connected' || state === 'completed') {
        if (this.iceRestartDebounceTimer) {
          clearTimeout(this.iceRestartDebounceTimer);
          this.iceRestartDebounceTimer = null;
        }
      }
    };

    // Accumulate ALL remote tracks into persistent MediaStream
    this.peerConnection.ontrack = (event) => {
      const track = event.track;
      console.log(
        `[WebRTC] ontrack: kind=${track.kind}, readyState=${track.readyState}, muted=${track.muted}, id=${track.id}`
      );

      // Remove any existing track of the same kind before adding
      const existingTracks = this.remoteStream.getTracks().filter((t) => t.kind === track.kind);
      existingTracks.forEach((t) => this.remoteStream.removeTrack(t));
      this.remoteStream.addTrack(track);

      // Notify callback with the persistent stream
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }

      // Listen for track unmute (frames start arriving), mute, and ended
      track.onunmute = () => {
        console.log(`[WebRTC] Track unmuted: kind=${track.kind}`);
        if (this.onRemoteTrackStateCallback) {
          this.onRemoteTrackStateCallback(track.kind as 'video' | 'audio', true);
        }
      };

      track.onmute = () => {
        console.log(`[WebRTC] Track muted: kind=${track.kind}`);
        if (this.onRemoteTrackStateCallback) {
          this.onRemoteTrackStateCallback(track.kind as 'video' | 'audio', false);
        }
      };

      track.onended = () => {
        console.log(`[WebRTC] Track ended: kind=${track.kind}`);
        if (this.onRemoteTrackStateCallback) {
          this.onRemoteTrackStateCallback(track.kind as 'video' | 'audio', false);
        }
      };
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection && this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(this.peerConnection.connectionState);
      }
    };

    this.peerConnection.onnegotiationneeded = () => {
      console.log('[WebRTC] negotiationneeded fired, signalingState:', this.peerConnection?.signalingState);
    };
  }

  private async processIceCandidateQueue() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('[WebRTC] Processed queued ICE candidate');
        } catch (err) {
          console.error('[WebRTC] Error adding queued ICE candidate:', err);
        }
      }
    }
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('webrtc_offer', async ({ offer }) => {
      if (!this.peerConnection) this.setupPeerConnection();
      if (!this.peerConnection) return;

      try {
        const offerCollision =
          this.isMakingOffer || this.peerConnection.signalingState !== 'stable';

        this.ignoreOffer = !this.isInitiator && offerCollision;

        if (offerCollision) {
          console.log(
            '[WebRTC] Offer collision detected. Initiator:',
            this.isInitiator,
            'State:',
            this.peerConnection.signalingState
          );
          if (!this.isInitiator) {
            // Polite peer: rollback local offer to accept remote offer
            console.log('[WebRTC] Polite peer rolling back local offer');
            await this.peerConnection.setLocalDescription({ type: 'rollback' });
          } else {
            // Impolite peer: ignore offer collision
            console.log('[WebRTC] Impolite peer ignoring offer collision');
            return;
          }
        }

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        await this.processIceCandidateQueue();

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.socket?.emit('webrtc_answer', {
          roomId: this.roomId,
          answer,
        });
        console.log('[WebRTC] Sent answer successfully');
      } catch (err) {
        console.error('Error handling WebRTC offer:', err);
      }
    });

    this.socket.on('webrtc_answer', async ({ answer }) => {
      if (!this.peerConnection) return;
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        await this.processIceCandidateQueue();
      } catch (err) {
        console.error('Error handling WebRTC answer:', err);
      }
    });

    this.socket.on('webrtc_ice_candidate', async ({ candidate }) => {
      if (!candidate) return;
      if (!this.peerConnection || !this.peerConnection.remoteDescription) {
        console.log('[WebRTC] Remote description not set yet. Queueing ICE candidate.');
        this.iceCandidateQueue.push(candidate);
        return;
      }
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    this.socket.on('peer_ready', async () => {
      console.log('[WebRTC] Remote peer reported ready');
      if (this.isInitiator && this.peerConnection) {
        console.log('[WebRTC] Initiating offer after peer_ready signal...');
        await this.createAndSendOffer();
      }
    });
  }

  private async bindTracksToSenders(stream: MediaStream) {
    if (!this.peerConnection) return;

    const videoTrack = stream.getVideoTracks()[0] || null;
    const audioTrack = stream.getAudioTracks()[0] || null;

    const transceivers = this.peerConnection.getTransceivers();
    const videoTransceiver = transceivers.find((t) => t.receiver.track.kind === 'video');
    const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio');

    if (videoTransceiver) {
      videoTransceiver.direction = 'sendrecv';
      await videoTransceiver.sender.replaceTrack(videoTrack);
    } else if (videoTrack) {
      this.peerConnection.addTrack(videoTrack, stream);
    }

    if (audioTransceiver) {
      audioTransceiver.direction = 'sendrecv';
      await audioTransceiver.sender.replaceTrack(audioTrack);
    } else if (audioTrack) {
      this.peerConnection.addTrack(audioTrack, stream);
    }
  }

  /**
   * Acquire local camera & mic stream.
   * If real hardware is unavailable/blocked, falls back to a synthetic animated video stream.
   */
  public async startLocalMedia(video: boolean, audio: boolean): Promise<MediaStream | null> {
    try {
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => {
          try {
            t.enabled = false;
            t.stop();
          } catch {}
        });
        this.localStream = null;
      }

      let acquiredStream: MediaStream | null = null;

      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      try {
        if (video) {
          acquiredStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: audioConstraints,
          });
        } else {
          acquiredStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: audioConstraints,
          });
        }
      } catch (err) {
        console.warn('getUserMedia failed with real constraints:', err);
        try {
          acquiredStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          acquiredStream = this.createSyntheticMediaStream();
        }
      }

      if (!acquiredStream) {
        acquiredStream = this.createSyntheticMediaStream();
      }

      // Apply initial mute/unmute states
      const aTrack = acquiredStream.getAudioTracks()[0];
      if (aTrack) {
        aTrack.enabled = audio;
      }

      const vTrack = acquiredStream.getVideoTracks()[0];
      if (vTrack) {
        vTrack.enabled = video;
        if (!video) {
          try { vTrack.stop(); } catch {}
          acquiredStream.removeTrack(vTrack);
        }
      }

      this.localStream = acquiredStream;

      // Bind to PeerConnection senders via replaceTrack
      await this.bindTracksToSenders(this.localStream);

      this.setupAudioAnalyzer(this.localStream);
      return this.localStream;
    } catch (err) {
      console.warn('Fallback media initialization:', err);
      this.localStream = this.createSyntheticMediaStream();
      await this.bindTracksToSenders(this.localStream);
      return this.localStream;
    }
  }

  public async toggleCamera(enable: boolean): Promise<MediaStream | null> {
    if (!this.localStream) {
      this.localStream = new MediaStream();
    }

    if (enable) {
      let videoTrack = this.localStream.getVideoTracks().find((t) => t.readyState === 'live');

      if (!videoTrack) {
        try {
          const newVideoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          });
          videoTrack = newVideoStream.getVideoTracks()[0];
          if (videoTrack && this.localStream) {
            this.localStream.addTrack(videoTrack);
          }
        } catch (err) {
          console.warn('Could not acquire video track:', err);
          return this.localStream;
        }
      }

      if (videoTrack) {
        videoTrack.enabled = true;

        if (this.peerConnection) {
          const transceivers = this.peerConnection.getTransceivers();
          const videoTransceiver = transceivers.find(
            (t) => t.receiver.track.kind === 'video'
          );

          if (videoTransceiver) {
            videoTransceiver.direction = 'sendrecv';
            await videoTransceiver.sender.replaceTrack(videoTrack);
          } else {
            this.peerConnection.addTrack(videoTrack, this.localStream);
          }
          await this.createAndSendOffer();
        }
      }
    } else {
      // Completely STOP hardware camera video tracks so webcam LED turns off
      const videoTracks = this.localStream.getVideoTracks();
      for (const track of videoTracks) {
        try {
          track.enabled = false;
          track.stop();
        } catch {}
        this.localStream.removeTrack(track);
      }

      if (this.peerConnection) {
        const transceivers = this.peerConnection.getTransceivers();
        const videoTransceiver = transceivers.find(
          (t) => t.receiver.track.kind === 'video'
        );

        if (videoTransceiver) {
          await videoTransceiver.sender.replaceTrack(null);
        }
      }
    }

    return this.localStream;
  }

  public async toggleMic(enable: boolean): Promise<boolean> {
    if (!this.localStream) {
      return (await this.startLocalMedia(false, enable)) !== null;
    }

    let audioTrack = this.localStream.getAudioTracks().find((t) => t.readyState === 'live');

    if (enable && !audioTrack) {
      try {
        const newAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const newTrack = newAudioStream.getAudioTracks()[0];
        if (newTrack) {
          this.localStream.getAudioTracks().forEach((t) => {
            try { t.stop(); } catch {}
            this.localStream?.removeTrack(t);
          });
          this.localStream.addTrack(newTrack);
          audioTrack = newTrack;
        }
      } catch (err) {
        console.warn('Could not acquire audio track:', err);
      }
    }

    if (audioTrack) {
      audioTrack.enabled = enable;

      if (this.peerConnection) {
        const transceivers = this.peerConnection.getTransceivers();
        const audioTransceiver = transceivers.find(
          (t) => t.receiver.track.kind === 'audio'
        );

        if (audioTransceiver) {
          audioTransceiver.direction = 'sendrecv';
          await audioTransceiver.sender.replaceTrack(audioTrack);
        } else {
          this.peerConnection.addTrack(audioTrack, this.localStream);
          await this.createAndSendOffer();
        }
      }

      if (enable) {
        this.setupAudioAnalyzer(this.localStream);
      }
      return true;
    }
    return false;
  }



  public async startScreenShare(): Promise<MediaStream | null> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as MediaTrackConstraints,
        audio: false,
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];

      if (this.peerConnection) {
        const videoSender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else if (this.localStream) {
          this.peerConnection.addTrack(screenTrack, this.screenStream);
        }
        await this.createAndSendOffer();
      }

      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      return this.screenStream;
    } catch (err) {
      console.warn('Screen share canceled or failed:', err);
      return null;
    }
  }

  public async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    if (this.peerConnection && this.localStream) {
      const cameraTrack = this.localStream.getVideoTracks()[0] || null;
      const videoSender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
      if (videoSender && cameraTrack) {
        await videoSender.replaceTrack(cameraTrack);
      }
      await this.createAndSendOffer();
    }
  }

  /** Expose peer connection for direct track management from UI components */
  public getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  public async createAndSendOffer(iceRestart = false) {
    if (!this.peerConnection || !this.socket) return;
    if (this.isMakingOffer) return;

    try {
      this.isMakingOffer = true;
      const offer = await this.peerConnection.createOffer({
        iceRestart,
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      if (this.peerConnection.signalingState !== 'stable') {
        console.log(
          '[WebRTC] Skipping createAndSendOffer because signalingState is',
          this.peerConnection.signalingState
        );
        return;
      }

      await this.peerConnection.setLocalDescription(offer);

      this.socket.emit('webrtc_offer', {
        roomId: this.roomId,
        offer,
      });
      console.log('[WebRTC] Sent offer successfully. ICE restart:', iceRestart);
    } catch (err) {
      console.error('Error creating WebRTC offer:', err);
    } finally {
      this.isMakingOffer = false;
    }
  }

  /**
   * Generates a synthetic animated MediaStream for testing/fallback
   */
  private createSyntheticMediaStream(): MediaStream {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    let angle = 0;

    if (this.synthCanvasTimer) clearInterval(this.synthCanvasTimer);

    this.synthCanvasTimer = window.setInterval(() => {
      if (!ctx) return;
      angle += 0.05;

      // Dynamic Gradient Background
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#312e81');
      grad.addColorStop(0.5, '#4338ca');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      // Pulsing Circles
      ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
      ctx.beginPath();
      ctx.arc(320, 240, 100 + Math.sin(angle) * 20, 0, Math.PI * 2);
      ctx.fill();

      // Center Icon Badge
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(320, 210, 50, 0, Math.PI * 2);
      ctx.fill();

      // Text Labels
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NUMA SPACE LIVE VIDEO', 320, 310);


      ctx.fillStyle = '#a5b4fc';
      ctx.font = '14px sans-serif';
      ctx.fillText('Camera Stream Active', 320, 335);
    }, 1000 / 24);

    const canvasStream = canvas.captureStream(24);

    // Generate Silent Audio Track via Web Audio API (No oscillator humming!)
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const actx = new AudioCtx();
      const dst = actx.createMediaStreamDestination();
      const gain = actx.createGain();
      gain.gain.value = 0; // completely silent
      gain.connect(dst);

      const audioTrack = dst.stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
        canvasStream.addTrack(audioTrack);
      }
    } catch {
      // ignore audio synth
    }

    return canvasStream;
  }

  private setupAudioAnalyzer(stream: MediaStream) {
    if (stream.getAudioTracks().length === 0) return;
    try {
      if (this.audioAnimFrame) cancelAnimationFrame(this.audioAnimFrame);
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx();
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 64;
      source.connect(this.audioAnalyser);

      const bufferLength = this.audioAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!this.audioAnalyser) return;
        this.audioAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));

        if (this.onVolumeChangeCallback) {
          this.onVolumeChangeCallback(normalized);
        }

        this.audioAnimFrame = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch {
      // AudioContext may fail if permission not granted
    }
  }

  public cleanup() {
    if (this.iceRestartDebounceTimer) {
      clearTimeout(this.iceRestartDebounceTimer);
      this.iceRestartDebounceTimer = null;
    }
    if (this.statsIntervalTimer) {
      clearInterval(this.statsIntervalTimer);
      this.statsIntervalTimer = null;
    }
    if (this.synthCanvasTimer) {
      clearInterval(this.synthCanvasTimer);
      this.synthCanvasTimer = null;
    }
    if (this.audioAnimFrame) {
      cancelAnimationFrame(this.audioAnimFrame);
      this.audioAnimFrame = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        t.enabled = false;
        t.stop();
      });
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => {
        t.enabled = false;
        t.stop();
      });
      this.screenStream = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.getSenders().forEach((s) => {
          if (s.track) {
            s.track.enabled = false;
            s.track.stop();
          }
        });
        this.peerConnection.close();
      } catch {
        // ignore
      }
      this.peerConnection = null;
    }
  }
}
