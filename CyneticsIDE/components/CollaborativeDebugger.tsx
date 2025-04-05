import { useState, useEffect } from 'react'
import {
  FiPlay,
  FiPause,
  FiSkipForward,
  FiCornerDownRight,
  FiCornerUpLeft,
  FiUsers,
  FiBug,
  FiAlertTriangle
} from 'react-icons/fi'
import { CollaborativeDebugService } from '@/services/collaborativeDebug'
import { useAuth } from '@/contexts/AuthContext'

interface CollaborativeDebuggerProps {
  projectId: string
  currentFile: string
  onLineSelect: (line: number) => void
}

export default function CollaborativeDebugger({
  projectId,
  currentFile,
  onLineSelect
}: CollaborativeDebuggerProps) {
  const { profile } = useAuth()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState<'stopped' | 'running' | 'paused'>('stopped')
  const [currentLine, setCurrentLine] = useState<number | null>(null)
  const [variables, setVariables] = useState<Record<string, any>>({})
  const [callStack, setCallStack] = useState<string[]>([])
  const [participants, setParticipants] = useState<string[]>([])
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const debugger = CollaborativeDebugService.getInstance()

  useEffect(() => {
    if (sessionId) {
      const unsubscribe = debugger.onDebugEvent(sessionId, (event) => {
        switch (event.type) {
          case 'breakpoint':
            setStatus('paused')
            setCurrentLine(event.data.line)
            setVariables(event.data.variables)
            setAnalysis(event.data.analysis)
            onLineSelect(event.data.line)
            break

          case 'step':
            setCurrentLine(event.data.line)
            setVariables(event.data.variables)
            onLineSelect(event.data.line)
            break

          case 'error':
            setStatus('stopped')
            setError(event.data.error.message)
            setAnalysis(event.data.analysis)
            break
        }
      })

      return () => unsubscribe()
    }
  }, [sessionId])

  async function handleStartSession() {
    try {
      const id = await debugger.createSession(projectId)
      setSessionId(id)
      setStatus('running')
      setError(null)
    } catch (error: any) {
      setError(error.message)
    }
  }

  async function handleJoinSession(id: string) {
    try {
      await debugger.joinSession(id)
      setSessionId(id)
      setError(null)
    } catch (error: any) {
      setError(error.message)
    }
  }

  async function handleSetBreakpoint(line: number) {
    if (!sessionId) return

    try {
      await debugger.setBreakpoint(sessionId, currentFile, line)
    } catch (error: any) {
      setError(error.message)
    }
  }

  async function handleContinue() {
    if (!sessionId) return

    try {
      await debugger.continue(sessionId)
      setStatus('running')
    } catch (error: any) {
      setError(error.message)
    }
  }

  async function handleStepOver() {
    if (!sessionId) return

    try {
      await debugger.stepOver(sessionId)
    } catch (error: any) {
      setError(error.message)
    }
  }

  async function handleStepInto() {
    if (!sessionId) return

    try {
      await debugger.stepInto(sessionId)
    } catch (error: any) {
      setError(error.message)
    }
  }

  async function handleStepOut() {
    if (!sessionId) return

    try {
      await debugger.stepOut(sessionId)
    } catch (error: any) {
      setError(error.message)
    }
  }

  async function handleEvaluate(expression: string) {
    if (!sessionId) return

    try {
      const result = await debugger.evaluateExpression(sessionId, expression)
      setVariables(prev => ({
        ...prev,
        [expression]: result
      }))
    } catch (error: any) {
      setError(error.message)
    }
  }

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Collaborative Debugger</h3>
        <div className="flex items-center space-x-2">
          {participants.length > 0 && (
            <div className="flex -space-x-2">
              {participants.map(participant => (
                <div
                  key={participant}
                  className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs"
                  title={participant}
                >
                  {participant[0]}
                </div>
              ))}
            </div>
          )}
          {!sessionId ? (
            <button
              onClick={handleStartSession}
              className="px-3 py-1 bg-green-600 bg-opacity-50 hover:bg-opacity-75 rounded text-sm"
            >
              Start Debug Session
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleContinue}
                disabled={status !== 'paused'}
                className="p-2 rounded hover:bg-white hover:bg-opacity-10"
                title="Continue"
              >
                <FiPlay size={20} />
              </button>
              <button
                onClick={handleStepOver}
                disabled={status !== 'paused'}
                className="p-2 rounded hover:bg-white hover:bg-opacity-10"
                title="Step Over"
              >
                <FiSkipForward size={20} />
              </button>
              <button
                onClick={handleStepInto}
                disabled={status !== 'paused'}
                className="p-2 rounded hover:bg-white hover:bg-opacity-10"
                title="Step Into"
              >
                <FiCornerDownRight size={20} />
              </button>
              <button
                onClick={handleStepOut}
                disabled={status !== 'paused'}
                className="p-2 rounded hover:bg-white hover:bg-opacity-10"
                title="Step Out"
              >
                <FiCornerUpLeft size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-900 bg-opacity-20 rounded text-sm text-red-400">
          <FiAlertTriangle className="inline-block mr-2" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Variables</h4>
          <div className="space-y-1">
            {Object.entries(variables).map(([name, value]) => (
              <div
                key={name}
                className="p-2 bg-white bg-opacity-5 rounded text-sm"
              >
                <span className="font-mono text-blue-400">{name}:</span>{' '}
                <span className="text-green-400">
                  {JSON.stringify(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Call Stack</h4>
          <div className="space-y-1">
            {callStack.map((call, index) => (
              <div
                key={index}
                className="p-2 bg-white bg-opacity-5 rounded text-sm font-mono"
              >
                {call}
              </div>
            ))}
          </div>
        </div>
      </div>

      {analysis && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">AI Analysis</h4>
          <div className="p-3 bg-white bg-opacity-5 rounded text-sm">
            {analysis}
          </div>
        </div>
      )}
    </div>
  )
} 