import { CollaborationService } from './collaboration'

interface ScreenShareState {
  isSharing: boolean
  stream: MediaStream | null
  connections: Map<string, RTCPeerConnection>
}

export class ScreenShareService {
  private static instance: ScreenShareService
  private collaboration: CollaborationService
  private state: ScreenShareState = {
    isSharing: false,
    stream: null,
    connections: new Map()
  }

  private constructor() {
    this.collaboration = CollaborationService.getInstance()
    this.setupSocketHandlers()
  }

  static getInstance(): ScreenShareService {
    if (!ScreenShareService.instance) {
      ScreenShareService.instance = new ScreenShareService()
    }
    return ScreenShareService.instance
  }

  private setupSocketHandlers() {
    this.collaboration.socket?.on('screen_share_request', async (peerId: string) => {
      if (this.state.isSharing && this.state.stream) {
        await this.setupPeerConnection(peerId, this.state.stream)
      }
    })

    this.collaboration.socket?.on('screen_share_offer', async ({ peerId, offer }) => {
      const peerConnection = await this.setupPeerConnection(peerId)
      await peerConnection.setRemoteDescription(offer)
      
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      
      this.collaboration.socket?.emit('screen_share_answer', {
        peerId,
        answer
      })
    })

    this.collaboration.socket?.on('screen_share_answer', async ({ peerId, answer }) => {
      const connection = this.state.connections.get(peerId)
      if (connection) {
        await connection.setRemoteDescription(answer)
      }
    })

    this.collaboration.socket?.on('screen_share_ice_candidate', async ({ peerId, candidate }) => {
      const connection = this.state.connections.get(peerId)
      if (connection) {
        await connection.addIceCandidate(candidate)
      }
    })
  }

  async startSharing(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      })

      this.state.stream = stream
      this.state.isSharing = true

      // Notify other users that we're sharing
      this.collaboration.socket?.emit('screen_share_started')

      // Handle stream end
      stream.getVideoTracks()[0].onended = () => {
        this.stopSharing()
      }

    } catch (error) {
      console.error('Failed to start screen sharing:', error)
      throw error
    }
  }

  stopSharing() {
    if (this.state.stream) {
      this.state.stream.getTracks().forEach(track => track.stop())
      this.state.stream = null
    }

    this.state.connections.forEach(connection => connection.close())
    this.state.connections.clear()
    this.state.isSharing = false

    this.collaboration.socket?.emit('screen_share_stopped')
  }

  private async setupPeerConnection(
    peerId: string,
    stream?: MediaStream
  ): Promise<RTCPeerConnection> {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: process.env.TURN_SERVER_URL || '',
          username: process.env.TURN_SERVER_USERNAME,
          credential: process.env.TURN_SERVER_CREDENTIAL
        }
      ]
    })

    // Add local stream if we're the sharer
    if (stream) {
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream)
      })
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        this.collaboration.socket?.emit('screen_share_ice_candidate', {
          peerId,
          candidate: event.candidate
        })
      }
    }

    // Store the connection
    this.state.connections.set(peerId, peerConnection)

    return peerConnection
  }

  async requestScreenShare(peerId: string): Promise<MediaStream> {
    return new Promise((resolve, reject) => {
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: process.env.TURN_SERVER_URL || '',
            username: process.env.TURN_SERVER_USERNAME,
            credential: process.env.TURN_SERVER_CREDENTIAL
          }
        ]
      })

      peerConnection.ontrack = event => {
        resolve(event.streams[0])
      }

      this.state.connections.set(peerId, peerConnection)
      this.collaboration.socket?.emit('screen_share_request', peerId)
    })
  }
} 