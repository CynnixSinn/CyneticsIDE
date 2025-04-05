import { useState, useEffect } from 'react'
import { FiBug, FiPlay, FiPause, FiSkipForward, FiAlertCircle } from 'react-icons/fi'
import { DebuggingService } from '@/services/debugging'
import type { DebugContext, DebugSuggestion } from '@/services/debugging'

interface DebuggerProps {
  code: string
  language: string
  onBreakpointSet: (line: number) => void
  onBreakpointClear: (line: number) => void
}

export default function Debugger({
  code,
  language,
  onBreakpointSet,
  onBreakpointClear
}: DebuggerProps) {
  const [isDebugging, setIsDebugging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<DebugSuggestion[]>([])
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null)
  const [variables, setVariables] = useState<Record<string, any>>({})
  const [breakpoints, setBreakpoints] = useState<number[]>([])
  const debuggingService = DebuggingService.getInstance()

  useEffect(() => {
    if (error) {
      analyzeError()
    }
  }, [error])

  async function analyzeError() {
    if (!error) return

    const context: DebugContext = {
      code,
      error,
      variables,
      breakpoints
    }

    const newSuggestions = await debuggingService.analyzeError(context)
    setSuggestions(newSuggestions)
  }

  async function handleSuggestBreakpoints() {
    const suggestedBreakpoints = await debuggingService.suggestBreakpoints(code)
    suggestedBreakpoints.forEach(line => {
      setBreakpoints(prev => [...prev, line])
      onBreakpointSet(line)
    })
  }

  async function handleVariableAnalysis(variableName: string) {
    if (!variables[variableName]) return

    const analysis = await debuggingService.analyzeVariableState(
      { [variableName]: variables[variableName] },
      code
    )

    setSelectedVariable(analysis)
  }

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Debugger</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsDebugging(!isDebugging)}
            className={`p-2 rounded ${
              isDebugging ? 'bg-red-600 bg-opacity-50' : 'bg-green-600 bg-opacity-50'
            }`}
            title={isDebugging ? 'Stop Debugging' : 'Start Debugging'}
          >
            {isDebugging ? <FiPause size={20} /> : <FiPlay size={20} />}
          </button>
          <button
            onClick={handleSuggestBreakpoints}
            className="p-2 bg-white bg-opacity-10 rounded"
            title="Suggest Breakpoints"
          >
            <FiBug size={20} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <div className="flex items-center text-red-400 mb-2">
            <FiAlertCircle className="mr-2" />
            <span className="text-sm font-medium">Error Detected</span>
          </div>
          <pre className="text-xs bg-red-900 bg-opacity-20 p-2 rounded overflow-auto">
            {error}
          </pre>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Suggestions</h4>
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="p-2 bg-white bg-opacity-5 rounded text-sm"
              >
                <div className="font-medium mb-1">{suggestion.description}</div>
                <div className="text-xs text-gray-300">{suggestion.solution}</div>
                {suggestion.codeChanges && (
                  <div className="mt-2 text-xs">
                    <div className="text-blue-300">Suggested Changes:</div>
                    {suggestion.codeChanges.map((change, i) => (
                      <div key={i} className="mt-1">
                        <div className="text-red-300">- {change.original}</div>
                        <div className="text-green-300">+ {change.suggested}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(variables).length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Variables</h4>
          <div className="space-y-1">
            {Object.entries(variables).map(([name, value]) => (
              <div
                key={name}
                className="flex items-center justify-between p-2 bg-white bg-opacity-5 rounded text-sm cursor-pointer hover:bg-opacity-10"
                onClick={() => handleVariableAnalysis(name)}
              >
                <span className="font-mono">{name}</span>
                <span className="text-gray-300">
                  {JSON.stringify(value).slice(0, 50)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedVariable && (
        <div className="mt-4 p-2 bg-white bg-opacity-5 rounded">
          <h4 className="text-sm font-medium mb-2">Analysis</h4>
          <div className="text-xs text-gray-300">{selectedVariable}</div>
        </div>
      )}
    </div>
  )
} 