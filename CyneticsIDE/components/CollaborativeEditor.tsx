import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { editor } from 'monaco-editor'
import { CollaborationService, UserPresence } from '@/services/collaboration'
import { AIService, CompletionSuggestion, CodeError } from '@/services/ai'
import { useAuth } from '@/contexts/AuthContext'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface CollaborativeEditorProps {
  projectId: string
  value: string
  language?: string
  onChange?: (value: string) => void
}

export default function CollaborativeEditor({
  projectId,
  value,
  language = 'javascript',
  onChange
}: CollaborativeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor>()
  const { profile } = useAuth()
  const [collaborators, setCollaborators] = useState<UserPresence[]>([])
  const [errors, setErrors] = useState<CodeError[]>([])
  const collaboration = CollaborationService.getInstance()
  const aiService = AIService.getInstance()
  const decorationsRef = useRef<string[]>([])
  const errorDecorationsRef = useRef<string[]>([])

  useEffect(() => {
    if (profile) {
      collaboration.connect(projectId, profile)

      return () => {
        collaboration.disconnect()
      }
    }
  }, [projectId, profile])

  useEffect(() => {
    if (!editorRef.current) return

    const unsubscribePresence = collaboration.onPresenceUpdate((users) => {
      setCollaborators(users.filter(u => u.userId !== profile?.id))
      updateCursorDecorations(users)
    })

    const unsubscribeChanges = collaboration.onChangeReceived((change) => {
      if (!editorRef.current) return
      
      editorRef.current.executeEdits('remote', [{
        range: change.range,
        text: change.text,
        forceMoveMarkers: true
      }])
    })

    return () => {
      unsubscribePresence()
      unsubscribeChanges()
    }
  }, [profile?.id])

  // Update error decorations when errors change
  useEffect(() => {
    if (!editorRef.current) return
    updateErrorDecorations()
  }, [errors])

  function updateCursorDecorations(users: UserPresence[]) {
    if (!editorRef.current) return

    const editor = editorRef.current
    const decorations = users
      .filter(u => u.userId !== profile?.id && u.cursor)
      .map(user => ({
        range: new monaco.Range(
          user.cursor.row + 1,
          user.cursor.column + 1,
          user.cursor.row + 1,
          user.cursor.column + 1
        ),
        options: {
          className: 'cursor-decoration',
          hoverMessage: { value: user.profile.full_name },
          zIndex: 1000,
          beforeContentClassName: 'cursor-decoration-before',
          after: {
            content: '|',
            inlineClassName: `cursor-${user.userId}`,
          }
        }
      }))

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations)
  }

  function updateErrorDecorations() {
    if (!editorRef.current) return

    const editor = editorRef.current
    const decorations = errors.map(error => ({
      range: new monaco.Range(
        error.line,
        error.column,
        error.line,
        error.column + 1
      ),
      options: {
        className: `error-decoration error-${error.severity}`,
        hoverMessage: { value: error.message },
        minimap: { color: error.severity === 'error' ? '#ff0000' : '#ffcc00' },
        marginClassName: `error-margin error-${error.severity}`
      }
    }))

    errorDecorationsRef.current = editor.deltaDecorations(errorDecorationsRef.current, decorations)
  }

  async function handleEditorDidMount(editor: editor.IStandaloneCodeEditor) {
    editorRef.current = editor

    // Set up Monaco suggestions provider
    monaco.languages.registerCompletionItemProvider(language, {
      async provideCompletionItems(model, position) {
        const code = model.getValue()
        const suggestions = await aiService.getCompletions(
          code,
          { line: position.lineNumber, column: position.column },
          language
        )

        return {
          suggestions: suggestions.map(suggestion => ({
            label: suggestion.displayText,
            kind: monaco.languages.CompletionItemKind[suggestion.kind],
            insertText: suggestion.text,
            documentation: suggestion.documentation,
            detail: suggestion.documentation
          }))
        }
      }
    })

    editor.onDidChangeCursorPosition(e => {
      collaboration.updateCursor({
        row: e.position.lineNumber - 1,
        column: e.position.column - 1
      })
    })

    editor.onDidChangeModelContent(async e => {
      const changes = e.changes.map(change => ({
        range: change.range,
        text: change.text
      }))
      collaboration.sendChange(changes)
      onChange?.(editor.getValue())

      // Check for errors
      const newErrors = await aiService.detectErrors(editor.getValue(), language)
      setErrors(newErrors)
    })
  }

  return (
    <div className="relative h-full">
      <style jsx global>{`
        .cursor-decoration-before {
          content: '';
          width: 2px;
          height: 18px;
          background-color: #007acc;
          position: absolute;
        }
        
        .cursor-decoration {
          background-color: transparent;
          width: 2px;
        }
        
        ${collaborators.map(user => `
          .cursor-${user.userId} {
            color: #007acc;
            font-weight: bold;
          }
        `).join('\n')}

        .error-decoration {
          background-color: rgba(255, 0, 0, 0.2);
          border-bottom: 2px dotted red;
        }

        .error-warning {
          background-color: rgba(255, 204, 0, 0.2);
          border-bottom: 2px dotted #ffcc00;
        }

        .error-margin {
          width: 5px;
          margin-left: 3px;
        }

        .error-margin.error-error {
          background-color: #ff0000;
        }

        .error-margin.error-warning {
          background-color: #ffcc00;
        }
      `}</style>

      <MonacoEditor
        height="100%"
        language={language}
        value={value}
        theme="vs-dark"
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
          padding: { top: 16 },
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          snippetSuggestions: 'inline',
        }}
      />

      {/* Collaborators List */}
      <div className="absolute top-2 right-2 space-y-2">
        {collaborators.map(user => (
          <div
            key={user.userId}
            className="flex items-center gap-2 px-2 py-1 bg-white bg-opacity-10 rounded text-sm"
          >
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span>{user.profile.full_name}</span>
          </div>
        ))}
      </div>

      {/* Error List */}
      {errors.length > 0 && (
        <div className="absolute bottom-2 right-2 w-64 bg-black bg-opacity-50 rounded-lg p-2 max-h-48 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-2">Issues</h3>
          <div className="space-y-2">
            {errors.map((error, index) => (
              <div
                key={index}
                className={`text-xs p-2 rounded ${
                  error.severity === 'error' ? 'bg-red-900 bg-opacity-50' : 'bg-yellow-900 bg-opacity-50'
                }`}
              >
                <div className="font-medium">{error.message}</div>
                <div className="text-gray-300">Line {error.line}, Column {error.column}</div>
                {error.suggestions && error.suggestions.length > 0 && (
                  <div className="mt-1 text-blue-300 cursor-pointer hover:underline">
                    View suggestions
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 