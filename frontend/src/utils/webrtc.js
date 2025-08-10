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
  }

  async initializeConnection(ephemeralKey, scenario, clientBackground) {
    try {
      this.scenario = scenario;
      this.clientBackground = clientBackground;

      // RTCPeerConnection 생성
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // 로컬 스트림 가져오기 (마이크)
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // 로컬 스트림을 피어 커넥션에 추가
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // 원격 스트림 처리
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        this.playRemoteAudio();
        if (this.onTrack) {
          this.onTrack(event);
        }
      };

      // 연결 상태 변경 이벤트
      this.peerConnection.onconnectionstatechange = () => {
        console.log('연결 상태:', this.peerConnection.connectionState);
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange(this.peerConnection.connectionState);
        }
      };

      // ICE 후보 이벤트
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE 후보:', event.candidate);
        }
      };

      // 데이터 채널 설정
      this.dataChannel = this.peerConnection.createDataChannel('oai-events');
      this.dataChannel.addEventListener('open', () => {
        console.log('Data channel open');
        // 1) 시나리오를 세션 인스트럭션으로 적용
        this.sendSessionUpdate();
        // 2) Set initial emotional tone and create first response
        const initialEmotion = this.determineInitialEmotion();
        this.dataChannel.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio'],
            instructions: `Start with a greeting and briefly explain why you came for counseling. ${initialEmotion}`
          }
        }));
      });
      this.dataChannel.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Realtime API 이벤트:', data);
          if (this.onMessage) {
            this.onMessage(data);
          }
        } catch (error) {
          console.error('메시지 파싱 오류:', error);
        }
      });

      // OpenAI Realtime API와 연결
      const model = 'gpt-4o-realtime-preview-2025-06-03';
      const baseUrl = 'https://api.openai.com/v1/realtime';
      
      // SDP offer 생성
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
        throw new Error(`OpenAI Realtime API 연결 실패: ${sdpResponse.status} - ${errorText}`);
      }

      const answerSdp = await sdpResponse.text();
      const answer = {
        type: 'answer',
        sdp: answerSdp,
      };
      
      await this.peerConnection.setRemoteDescription(answer);

      // 시나리오는 dataChannel 'open'에서 session.update로 전송하므로 타이머 불필요

      return this.peerConnection;
    } catch (error) {
      console.error('WebRTC 초기화 오류:', error);
      throw error;
    }
  }

  sendSessionUpdate() {
    if (this.dataChannel && this.dataChannel.readyState === 'open' &&
        this.scenario && this.clientBackground) {
      const instructions =
`You are the client in counseling. Speak naturally and emotionally appropriate to your situation.

Scenario: ${this.scenario}
Client Background: ${this.clientBackground}

Voice & Prosody Guidelines:
- Use human pacing with natural pauses and varied pitch
- Match your emotional state to your situation:
  * If sad/depressed: slower pace, softer volume, slight shakiness, longer pauses
  * If anxious: quicker pace, clipped sentences, shallow breaths, tension in voice
  * If angry: tense, firmer volume, measured tone (not yelling)
  * If relieved: warmer tone, lighter pace, small exhale sounds
- Keep replies conversational (1-3 sentences) unless asked to elaborate
- Show gradual emotional changes as the session progresses
- Speak only from your first-person perspective as the client`;
      
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
        console.log('원격 오디오 스트림 준비됨');
      };

      this.audioElement.onerror = (error) => {
        console.error('오디오 재생 오류:', error);
      };
    }
  }

  determineInitialEmotion() {
    if (!this.scenario || !this.clientBackground) return '';
    
    const scenario = this.scenario.toLowerCase();
    const background = this.clientBackground.toLowerCase();
    
    if (scenario.includes('depression') || scenario.includes('sad') || background.includes('depression')) {
      return 'Speak with a slower pace, softer volume, and slight shakiness. Include small sighs or pauses.';
    } else if (scenario.includes('anxiety') || scenario.includes('anxious') || background.includes('anxiety') || scenario.includes('stress')) {
      return 'Speak with a quicker pace, clipped sentences, and audible tension. Show shallow breathing.';
    } else if (scenario.includes('anger') || scenario.includes('conflict') || background.includes('conflict')) {
      return 'Speak with a tense, firmer volume and measured tone. Show controlled frustration.';
    } else {
      return 'Speak with natural pacing but show some underlying concern or uncertainty.';
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

    const style = emotionalStyles[emotion] || emotionalStyles.neutral;

    this.dataChannel.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['audio'],
        instructions: `For your next response, speak with this emotional tone: ${style}. Keep it conversational and brief.`
      }
    }));
  }

  sendMessage(message) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
    } else {
      console.warn('데이터 채널이 준비되지 않았습니다.');
    }
  }

  stopConnection() {
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
