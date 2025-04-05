import { useState, useEffect, useRef } from 'react'
import { FiTerminal, FiCommand, FiInfo } from 'react-icons/fi'
import { TerminalService } from '@/services/terminal'
import { useAuth } from '@/contexts/AuthContext'

interface TerminalProps {
  projectId: string
}

export default function Terminal({ projectId }: TerminalProps) {
  const { profile } = useAuth()
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [output, setOutput] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [explanation, setExplanation] = useState<string | null>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminal = TerminalService.getInstance()

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [output])

  useEffect(() => {
    if (command) {
      getSuggestions()
    } else {
      setSuggestions([])
    }
  }, [command])

  async function getSuggestions() {
    const newSuggestions = await terminal.getCommandSuggestions(command, [])
    setSuggestions(newSuggestions)
  }

  async function handleCommandSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!command.trim() || !profile) return

    setHistory(prev => [...prev, command])
    setOutput(prev => [...prev, `$ ${command}`])
    setCommand('')

    try {
      const unsubscribe = terminal.onCommandOutput(command, (output) => {
        setOutput(prev => [...prev, output])
      })

      await terminal.executeCommand(projectId, command, profile.id)
      unsubscribe()
    } catch (error: any) {
      setOutput(prev => [...prev, `Error: ${error.message}`])
    }
  }

  async function handleExplainCommand(cmd: string) {
    const explanation = await terminal.explainCommand(cmd)
    setExplanation(explanation)
  }

  return (
    <div className="glass-panel flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b border-white border-opacity-10">
        <div className="flex items-center">
          <FiTerminal className="mr-2" />
          <span className="text-sm font-medium">Terminal</span>
        </div>
      </div>

      <div
        ref={terminalRef}
        className="flex-1 overflow-auto p-2 font-mono text-sm"
      >
        {output.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap">
            {line}
          </div>
        ))}
      </div>

      <form onSubmit={handleCommandSubmit} className="p-2">
        <div className="relative">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="w-full bg-black bg-opacity-50 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Enter command..."
          />
          
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 w-full bg-black bg-opacity-90 rounded-t p-2 border-b border-white border-opacity-10">
              {suggestions.map((suggestion, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-1 hover:bg-white hover:bg-opacity-5 rounded cursor-pointer"
                  onClick={() => setCommand(suggestion)}
                >
                  <span className="text-sm">{suggestion}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleExplainCommand(suggestion)
                    }}
                    className="p-1 hover:bg-white hover:bg-opacity-10 rounded"
                  >
                    <FiInfo size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>

      {explanation && (
        <div className="p-2 border-t border-white border-opacity-10">
          <div className="text-sm bg-white bg-opacity-5 rounded p-2">
            <div className="flex items-center mb-2">
              <FiCommand className="mr-2" />
              <span className="font-medium">Command Explanation</span>
            </div>
            <div className="text-xs text-gray-300">{explanation}</div>
          </div>
        </div>
      )}
    </div>
  )
} 