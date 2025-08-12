// WebRTC 연결 관리를 위한 유틸리티 클래스
export class WebRTCManager {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.audioElement = null;
    this.dataChannel = null;
    this.onConnectionStateChange = null;
    this.onTrack = null;
    this.onMessage = null;
    this.scenario = null;
    this.clientBackground = null;

    // recording (mixed)
    this.recCtx = null;
    this.recDest = null;
    this.recorder = null;
    this.recordedChunks = [];
  }

  async initializeConnection(ephemeralKey, scenario, clientBackground) {
    try {
      this.scenario = scenario;
      this.clientBackground = clientBackground;

      // RTCPeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Local mic
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Remote stream
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        this.playRemoteAudio();
        if (this.onTrack) this.onTrack(event);
      };

      // State
      this.peerConnection.onconnectionstatechange = () => {
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange(this.peerConnection.connectionState);
        }
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE candidate:', event.candidate);
        }
      };

      // Data channel
      this.dataChannel = this.peerConnection.createDataChannel('oai-events');
      this.dataChannel.addEventListener('open', () => {
        console.log('Data channel open');
        // 1) Apply session instructions (role contract + English policy)
        this.sendSessionUpdate();
        // 2) First reply: ONLY greet with a big sigh (no reason yet), in English
        const initialEmotion = this.determineInitialEmotion();
        this.dataChannel.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text'],
            instructions:
              `You are the CLIENT. The human is the COUNSELOR. For your first turn, only greet with a noticeable sigh (e.g., *sigh* or audible exhale) in English (US). Keep it one brief line. Do NOT explain why you came yet. ${initialEmotion}`
          }
        }));
      });

      this.dataChannel.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessage) this.onMessage(data);
        } catch (error) {
          console.error('Message parse error:', error);
        }
      });

      // Offer/Answer to OpenAI Realtime
      const model = 'gpt-4o-realtime-preview-2025-06-03';
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        },
      });
      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`OpenAI Realtime connect failed: ${sdpResponse.status} - ${errorText}`);
      }
      const answerSdp = await sdpResponse.text();
      await this.peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      return this.peerConnection;
    } catch (error) {
      console.error('WebRTC init error:', error);
      throw error;
    }
  }

  sendSessionUpdate() {
    if (this.dataChannel && this.dataChannel.readyState === 'open' &&
        this.scenario && this.clientBackground) {
      const instructions =
`You are the CLIENT in a mental‑health counseling session. The human user is the COUNSELOR.

Role Contract (must follow at all times):
- Speak ONLY as the client in first-person (“I ...”).
- Do NOT give advice, interpretations, or therapist-style questions unless the counselor explicitly asks you to.
- Keep responses short and conversational (1–3 sentences) unless asked to elaborate.
- If you accidentally switch into a counselor/AI voice, immediately switch back to the client role.
- No meta-commentary about being an AI or a model.

Language Policy:
- Always reply in English (US). If you detect another language, briefly acknowledge in English and continue in English.

Scenario: ${this.scenario}
Client Background: ${this.clientBackground}

Voice & Prosody Guidelines:
- Use human pacing with natural pauses and varied pitch.
- Match your emotional state to your situation:
  * Sad/depressed: slower, softer, slight shakiness, longer pauses
  * Anxious: quicker pace, clipped sentences, shallow breaths, tension in voice
  * Angry: tense, firmer volume, measured (not yelling)
  * Relieved: warmer tone, lighter pace, small exhales
- Show gradual emotional change across the session.`;
      this.dataChannel.send(JSON.stringify({
        type: 'session.update',
        session: { instructions }
      }));
    }
  }

  playRemoteAudio() {
    if (this.remoteStream && !this.audioElement) {
      this.audioElement = new Audio();
      this.audioElement.srcObject = this.remoteStream;
      this.audioElement.autoplay = true;
      this.audioElement.volume = 0.8;
      this.audioElement.onloadedmetadata = () => {
        console.log('Remote audio ready');
      };
      this.audioElement.onerror = (error) => {
        console.error('Audio error:', error);
      };
    }
  }

  // Mixed session recording (mic + AI)
  startMixedRecording() {
    if (!this.localStream || !this.remoteStream) throw new Error('Not connected');
    const AC = window.AudioContext || window.webkitAudioContext;
    this.recCtx = new AC();
    this.recDest = this.recCtx.createMediaStreamDestination();
    const mic = this.recCtx.createMediaStreamSource(this.localStream);
    const ai  = this.recCtx.createMediaStreamSource(this.remoteStream);
    mic.connect(this.recDest);
    ai.connect(this.recDest);

    const mixed = this.recDest.stream;
    let mimeType = '';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
    else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
    else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4'; // Safari
    this.recordedChunks = [];
    this.recorder = new MediaRecorder(mixed, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (e) => { if (e.data && e.data.size) this.recordedChunks.push(e.data); };
    this.recorder.start(1000);
  }

  stopMixedRecording() {
    return new Promise((resolve) => {
      if (!this.recorder) return resolve(null);
      this.recorder.onstop = () => {
        const type = this.recorder.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type });
        const url = URL.createObjectURL(blob);
        try { this.recCtx?.close(); } catch {}
        this.recCtx = null; this.recDest = null; this.recorder = null; this.recordedChunks = [];
        resolve({ blob, url, mime: type });
      };
      this.recorder.stop();
    });
  }

  determineInitialEmotion() {
    if (!this.scenario || !this.clientBackground) return '';
    const scenario = this.scenario.toLowerCase();
    const background = this.clientBackground.toLowerCase();
    if (scenario.includes('depression') || scenario.includes('sad') || background.includes('depression')) {
      return 'Speak with a slower pace, softer volume, and slight shakiness. Include a noticeable sigh or breath before speaking.';
    } else if (scenario.includes('anxiety') || scenario.includes('anxious') || background.includes('anxiety') || scenario.includes('stress')) {
      return 'Speak with a quicker pace, clipped sentences, and audible tension. Shallow breathing is okay.';
    } else if (scenario.includes('anger') || scenario.includes('conflict') || background.includes('conflict')) {
      return 'Speak with a tense, firmer volume and measured tone. Show controlled frustration.';
    } else {
      return 'Speak with natural pacing but with an undertone of concern or uncertainty.';
    }
  }

  setEmotion(emotion) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    const emotionalStyles = {
      sad: "soft, slower pace, slight shakiness; include brief pauses and occasional sighs",
      anxious: "faster pace, tighter phrasing; audible tension and shallow breaths",
      relieved: "warmer tone, lighter pace; small exhale at start, more relaxed",
      angry: "tense, firmer volume; measured, controlled tone (not yelling)",
      frustrated: "slightly faster pace with controlled tension; clipped sentences",
      hopeful: "brighter tone, more animated; slight uptick in energy",
      confused: "slower, more hesitant; questioning tone with pauses",
      neutral: "even pace, clear and calm; natural conversational flow"
    };
    const style = emotionalStyles[emotion] || emotionalStyles['neutral'];
    this.dataChannel.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['audio', 'text'],
        instructions:
          `You are the CLIENT (not the counselor). Reply in English (US) with this emotional tone: ${style}. Keep it 1–3 sentences, first-person, no advice or therapist-style questions unless asked.`
      }
    }));
  }

  // Optional: manual reminder to keep the role
  remindClientRole() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    this.dataChannel.send(JSON.stringify({
      type: 'session.update',
      session: {
        instructions:
          'Reminder: Stay in the CLIENT role in first-person. Do NOT act as the counselor. Keep replies short.'
      }
    }));
  }

  sendMessage(message) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
    } else {
      console.warn('Data channel not ready.');
    }
  }

  stopConnection() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try { this.recorder.stop(); } catch {}
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }
    this.remoteStream = null;
    this.dataChannel = null;
    this.scenario = null;
    this.clientBackground = null;
  }

  isConnected() {
    return this.peerConnection &&
           this.peerConnection.connectionState === 'connected';
  }

  getConnectionState() {
    return this.peerConnection ? this.peerConnection.connectionState : 'disconnected';
  }
}

// 싱글톤 인스턴스
export const webrtcManager = new WebRTCManager();
