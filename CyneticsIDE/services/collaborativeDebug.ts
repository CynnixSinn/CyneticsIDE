import { CollaborationService } from './collaboration'
import { DebuggingService } from './debugging'
import { AIService } from './ai'

interface DebugSession {
  id: string
  projectId: string
  participants: string[]
  breakpoints: Map<string, number[]>
  variables: Map<string, any>
  callStack: string[]
  status: 'running' | 'paused' | 'stopped'
  currentFile?: string
  currentLine?: number
}

interface DebugEvent {
  type: 'breakpoint' | 'step' | 'variable' | 'error'
  data: any
  userId: string
  timestamp: number
}

export class CollaborativeDebugService {
  private static instance: CollaborativeDebugService
  private collaboration: CollaborationService
  private debugger: DebuggingService
  private aiService: AIService
  private sessions = new Map<string, DebugSession>()
  private eventListeners = new Map<string, ((event: DebugEvent) => void)[]>()

  private constructor() {
    this.collaboration = CollaborationService.getInstance()
    this.debugger = DebuggingService.getInstance()
    this.aiService = AIService.getInstance()
    this.setupSocketHandlers()
  }

  static getInstance(): CollaborativeDebugService {
    if (!CollaborativeDebugService.instance) {
      CollaborativeDebugService.instance = new CollaborativeDebugService()
    }
    return CollaborativeDebugService.instance
  }

  private setupSocketHandlers() {
    this.collaboration.socket?.on('debug_session_created', (session: DebugSession) => {
      this.sessions.set(session.id, session)
      this.notifyListeners(session.id, {
        type: 'session',
        data: session,
        userId: session.participants[0],
        timestamp: Date.now()
      })
    })

    this.collaboration.socket?.on('debug_breakpoint_hit', async (data: {
      sessionId: string
      file: string
      line: number
      variables: Record<string, any>
    }) => {
      const session = this.sessions.get(data.sessionId)
      if (!session) return

      session.status = 'paused'
      session.currentFile = data.file
      session.currentLine = data.line
      session.variables = new Map(Object.entries(data.variables))

      // Get AI analysis of the current state
      const analysis = await this.analyzeDebugState(session)

      this.notifyListeners(session.id, {
        type: 'breakpoint',
        data: { ...data, analysis },
        userId: this.collaboration.userId || '',
        timestamp: Date.now()
      })
    })

    this.collaboration.socket?.on('debug_step', (data: {
      sessionId: string
      file: string
      line: number
      variables: Record<string, any>
    }) => {
      const session = this.sessions.get(data.sessionId)
      if (!session) return

      session.currentFile = data.file
      session.currentLine = data.line
      session.variables = new Map(Object.entries(data.variables))

      this.notifyListeners(session.id, {
        type: 'step',
        data,
        userId: this.collaboration.userId || '',
        timestamp: Date.now()
      })
    })

    this.collaboration.socket?.on('debug_error', async (data: {
      sessionId: string
      error: Error
      stackTrace: string
    }) => {
      const session = this.sessions.get(data.sessionId)
      if (!session) return

      session.status = 'stopped'

      // Get AI analysis of the error
      const analysis = await this.debugger.analyzeError({
        code: '',  // You'll need to get the relevant code
        error: data.error.message,
        stackTrace: data.stackTrace,
        variables: Object.fromEntries(session.variables)
      })

      this.notifyListeners(session.id, {
        type: 'error',
        data: { ...data, analysis },
        userId: this.collaboration.userId || '',
        timestamp: Date.now()
      })
    })
  }

  async createSession(projectId: string): Promise<string> {
    const session: DebugSession = {
      id: crypto.randomUUID(),
      projectId,
      participants: [this.collaboration.userId || ''],
      breakpoints: new Map(),
      variables: new Map(),
      callStack: [],
      status: 'stopped'
    }

    this.sessions.set(session.id, session)
    this.collaboration.socket?.emit('debug_session_created', session)

    return session.id
  }

  async joinSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found')

    session.participants.push(this.collaboration.userId || '')
    this.collaboration.socket?.emit('debug_session_joined', {
      sessionId,
      userId: this.collaboration.userId
    })
  }

  async setBreakpoint(sessionId: string, file: string, line: number): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found')

    const fileBreakpoints = session.breakpoints.get(file) || []
    fileBreakpoints.push(line)
    session.breakpoints.set(file, fileBreakpoints)

    this.collaboration.socket?.emit('debug_breakpoint_set', {
      sessionId,
      file,
      line
    })
  }

  async removeBreakpoint(sessionId: string, file: string, line: number): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found')

    const fileBreakpoints = session.breakpoints.get(file) || []
    session.breakpoints.set(
      file,
      fileBreakpoints.filter(l => l !== line)
    )

    this.collaboration.socket?.emit('debug_breakpoint_removed', {
      sessionId,
      file,
      line
    })
  }

  async continue(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found')

    session.status = 'running'
    this.collaboration.socket?.emit('debug_continue', { sessionId })
  }

  async stepOver(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found')

    this.collaboration.socket?.emit('debug_step_over', { sessionId })
  }

  async stepInto(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found')

    this.collaboration.socket?.emit('debug_step_into', { sessionId })
  }

  async stepOut(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found')

    this.collaboration.socket?.emit('debug_step_out', { sessionId })
  }

  async evaluateExpression(
    sessionId: string,
    expression: string
  ): Promise<any> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found')

    const result = await this.collaboration.socket?.emitWithAck('debug_evaluate', {
      sessionId,
      expression
    })

    return result
  }

  private async analyzeDebugState(session: DebugSession): Promise<string> {
    const prompt = `
      Analyze this debug state:
      
      Current File: ${session.currentFile}
      Current Line: ${session.currentLine}
      Variables: ${JSON.stringify(Object.fromEntries(session.variables))}
      Call Stack: ${session.callStack.join('\n')}
      
      Provide insights about:
      1. Current program state
      2. Potential issues
      3. Suggested next steps
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return response.text
  }

  onDebugEvent(sessionId: string, callback: (event: DebugEvent) => void): () => void {
    const listeners = this.eventListeners.get(sessionId) || []
    listeners.push(callback)
    this.eventListeners.set(sessionId, listeners)

    return () => {
      const updatedListeners = this.eventListeners.get(sessionId) || []
      this.eventListeners.set(
        sessionId,
        updatedListeners.filter(l => l !== callback)
      )
    }
  }

  private notifyListeners(sessionId: string, event: DebugEvent) {
    const listeners = this.eventListeners.get(sessionId) || []
    listeners.forEach(listener => listener(event))
  }
} 