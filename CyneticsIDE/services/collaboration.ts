import { io, Socket } from 'socket.io-client'
import { UserProfile } from '@/lib/supabase'

export interface CursorPosition {
  row: number
  column: number
}

export interface UserPresence {
  userId: string
  profile: UserProfile
  cursor: CursorPosition
  selection?: {
    startRow: number
    startColumn: number
    endRow: number
    endColumn: number
  }
  lastActive: number
}

export class CollaborationService {
  private static instance: CollaborationService
  private socket: Socket | null = null
  private presenceCallbacks: ((users: UserPresence[]) => void)[] = []
  private changeCallbacks: ((change: any) => void)[] = []

  private constructor() {}

  static getInstance(): CollaborationService {
    if (!CollaborationService.instance) {
      CollaborationService.instance = new CollaborationService()
    }
    return CollaborationService.instance
  }

  connect(projectId: string, user: UserProfile) {
    this.socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      query: {
        projectId,
        userId: user.id,
        profile: JSON.stringify(user)
      }
    })

    this.socket.on('presence', (users: UserPresence[]) => {
      this.presenceCallbacks.forEach(cb => cb(users))
    })

    this.socket.on('change', (change: any) => {
      this.changeCallbacks.forEach(cb => cb(change))
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  updateCursor(position: CursorPosition, selection?: UserPresence['selection']) {
    if (this.socket) {
      this.socket.emit('cursor', { position, selection })
    }
  }

  sendChange(change: any) {
    if (this.socket) {
      this.socket.emit('change', change)
    }
  }

  onPresenceUpdate(callback: (users: UserPresence[]) => void) {
    this.presenceCallbacks.push(callback)
    return () => {
      this.presenceCallbacks = this.presenceCallbacks.filter(cb => cb !== callback)
    }
  }

  onChangeReceived(callback: (change: any) => void) {
    this.changeCallbacks.push(callback)
    return () => {
      this.changeCallbacks = this.changeCallbacks.filter(cb => cb !== callback)
    }
  }
} 