import { CollaborationService } from './collaboration'
import { AIService } from './ai'

interface TerminalCommand {
  command: string
  output: string
  exitCode: number
  timestamp: number
  userId: string
}

interface TerminalState {
  history: TerminalCommand[]
  currentDirectory: string
  environment: Record<string, string>
  isRunning: boolean
}

export class TerminalService {
  private static instance: TerminalService
  private collaboration: CollaborationService
  private aiService: AIService
  private terminalStates = new Map<string, TerminalState>()
  private commandCallbacks = new Map<string, ((output: string) => void)[]>()
  private worker: Worker | null = null

  private constructor() {
    this.collaboration = CollaborationService.getInstance()
    this.aiService = AIService.getInstance()
    this.initializeWorker()
  }

  static getInstance(): TerminalService {
    if (!TerminalService.instance) {
      TerminalService.instance = new TerminalService()
    }
    return TerminalService.instance
  }

  private initializeWorker() {
    // Create a Web Worker for running terminal commands
    this.worker = new Worker(new URL('./terminalWorker.ts', import.meta.url))

    this.worker.onmessage = (event) => {
      const { command, output, exitCode } = event.data
      const callbacks = this.commandCallbacks.get(command) || []
      callbacks.forEach(callback => callback(output))
      
      // Broadcast command output to collaborators
      this.collaboration.socket?.emit('terminal_output', {
        command,
        output,
        exitCode,
        timestamp: Date.now()
      })
    }
  }

  async executeCommand(
    projectId: string,
    command: string,
    userId: string
  ): Promise<void> {
    // Get or initialize terminal state
    const state = this.getTerminalState(projectId)

    // Check if command is safe to execute
    const isSafe = await this.validateCommand(command)
    if (!isSafe) {
      throw new Error('Command execution blocked for security reasons')
    }

    // Execute command in worker
    this.worker?.postMessage({
      command,
      cwd: state.currentDirectory,
      env: state.environment
    })

    // Add command to history
    state.history.push({
      command,
      output: '',
      exitCode: -1,
      timestamp: Date.now(),
      userId
    })

    // Broadcast command execution to collaborators
    this.collaboration.socket?.emit('terminal_command', {
      command,
      userId,
      timestamp: Date.now()
    })
  }

  async getCommandSuggestions(
    command: string,
    history: TerminalCommand[]
  ): Promise<string[]> {
    const prompt = `
      Suggest command completions based on:
      
      Current command: ${command}
      
      Command history:
      ${history.map(h => h.command).join('\n')}
      
      Return an array of suggested commands.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    try {
      return JSON.parse(response.text) as string[]
    } catch (error) {
      console.error('Failed to parse command suggestions:', error)
      return []
    }
  }

  async explainCommand(command: string): Promise<string> {
    const prompt = `
      Explain this command in detail:
      ${command}
      
      Include:
      1. What the command does
      2. Common use cases
      3. Important flags/options
      4. Potential risks or side effects
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return response.text
  }

  onCommandOutput(command: string, callback: (output: string) => void): () => void {
    const callbacks = this.commandCallbacks.get(command) || []
    callbacks.push(callback)
    this.commandCallbacks.set(command, callbacks)

    return () => {
      const updatedCallbacks = this.commandCallbacks.get(command) || []
      this.commandCallbacks.set(
        command,
        updatedCallbacks.filter(cb => cb !== callback)
      )
    }
  }

  private getTerminalState(projectId: string): TerminalState {
    if (!this.terminalStates.has(projectId)) {
      this.terminalStates.set(projectId, {
        history: [],
        currentDirectory: '/',
        environment: { ...process.env },
        isRunning: false
      })
    }
    return this.terminalStates.get(projectId)!
  }

  private async validateCommand(command: string): Promise<boolean> {
    const prompt = `
      Analyze this command for security risks:
      ${command}
      
      Return true if the command is safe to execute, false otherwise.
      Consider:
      1. System modifications
      2. Network access
      3. File system operations
      4. Resource usage
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    try {
      return JSON.parse(response.text) as boolean
    } catch (error) {
      console.error('Failed to validate command:', error)
      return false
    }
  }
} 