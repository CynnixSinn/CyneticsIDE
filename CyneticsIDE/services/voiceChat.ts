import { CollaborationService } from './collaboration'

interface VoiceState {
  stream: MediaStream | null
  audioContext: AudioContext | null
  mediaRecorder: MediaRecorder | null
  isMuted: boolean
  isDeafened: boolean
}

interface VoiceUser {
  userId: string
  name: string
  isSpeaking: boolean
  isMuted: boolean
}

export class VoiceChatService {
  private static instance: VoiceChatService
  private collaboration: CollaborationService
  private voiceState: VoiceState = {
    stream: null,
    audioContext: null,
    mediaRecorder: null,
    isMuted: false,
    isDeafened: false
  }
  private peers = new Map<string, RTCPeerConnection>()
  private voiceUsers = new Map<string, VoiceUser>()
  private onVoiceUsersChange: ((users: VoiceUser[]) => void)[] = []

  private constructor() {
    this.collaboration = CollaborationService.getInstance()
  }

  static getInstance(): VoiceChatService {
    if (!VoiceChatService.instance) {
      VoiceChatService.instance = new VoiceChatService()
    }
    return VoiceChatService.instance
  }

  async joinVoiceChat(roomId: string): Promise<void> {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      this.voiceState.stream = stream
      this.voiceState.audioContext = new AudioContext()

      // Set up audio analysis for voice activity detection
      const analyser = this.voiceState.audioContext.createAnalyser()
      const source = this.voiceState.audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      // Set up WebRTC for each peer
      this.collaboration.onPresenceUpdate(users => {
        users.forEach(user => {
          if (!this.peers.has(user.userId)) {
            this.setupPeerConnection(user.userId, stream)
          }
        })
      })

      // Voice activity detection
      const detectVoiceActivity = () => {
        if (this.voiceState.isDeafened) return

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(dataArray)
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        const isSpeaking = average > 30 // Adjust threshold as needed

        this.collaboration.socket?.emit('voice_activity', {
          isSpeaking,
          isMuted: this.voiceState.isMuted
        })
      }

      setInterval(detectVoiceActivity, 100)

    } catch (error) {
      console.error('Failed to join voice chat:', error)
      throw error
    }
  }

  private setupPeerConnection(peerId: string, stream: MediaStream) {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:your-turn-server.com',
          username: 'username',
          credential: 'credential'
        }
      ]
    })

    // Add local stream
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream)
    })

    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        this.collaboration.socket?.emit('voice_ice_candidate', {
          candidate: event.candidate,
          peerId
        })
      }
    }

    // Handle incoming tracks
    peerConnection.ontrack = event => {
      const remoteStream = new MediaStream()
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track)
      })
      
      // Create and play audio element for remote stream
      const audio = new Audio()
      audio.srcObject = remoteStream
      audio.play()
    }

    this.peers.set(peerId, peerConnection)

    // Create and send offer
    peerConnection.createOffer()
      .then(offer => peerConnection.setLocalDescription(offer))
      .then(() => {
        this.collaboration.socket?.emit('voice_offer', {
          offer: peerConnection.localDescription,
          peerId
        })
      })
  }

  toggleMute(): boolean {
    if (this.voiceState.stream) {
      this.voiceState.isMuted = !this.voiceState.isMuted
      this.voiceState.stream.getAudioTracks().forEach(track => {
        track.enabled = !this.voiceState.isMuted
      })
    }
    return this.voiceState.isMuted
  }

  toggleDeafen(): boolean {
    this.voiceState.isDeafened = !this.voiceState.isDeafened
    this.peers.forEach(peer => {
      peer.getReceivers().forEach(receiver => {
        if (receiver.track) {
          receiver.track.enabled = !this.voiceState.isDeafened
        }
      })
    })
    return this.voiceState.isDeafened
  }

  leaveVoiceChat() {
    // Stop local stream
    if (this.voiceState.stream) {
      this.voiceState.stream.getTracks().forEach(track => track.stop())
    }

    // Close peer connections
    this.peers.forEach(peer => peer.close())
    this.peers.clear()

    // Reset state
    this.voiceState = {
      stream: null,
      audioContext: null,
      mediaRecorder: null,
      isMuted: false,
      isDeafened: false
    }

    this.collaboration.socket?.emit('voice_leave')
  }

  onVoiceUsersUpdated(callback: (users: VoiceUser[]) => void) {
    this.onVoiceUsersChange.push(callback)
    return () => {
      this.onVoiceUsersChange = this.onVoiceUsersChange.filter(cb => cb !== callback)
    }
  }
} 