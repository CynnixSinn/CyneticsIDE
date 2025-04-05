'use client'

import { useState, useEffect } from 'react'
import { FiMenu, FiCode, FiTerminal, FiGitBranch, FiGithub } from 'react-icons/fi'
import { useAuth } from '@/contexts/AuthContext'
import FileExplorer from '@/components/FileExplorer'
import CollaborativeEditor from '@/components/CollaborativeEditor'
import { AIService } from '@/services/ai'
import { GitHubService } from '@/services/github'
import type { File } from '@/lib/supabase'
import type { GitHubRepo } from '@/services/github'

export default function Home() {
  const [code, setCode] = useState('// Welcome to CyneticsIDE\n// Start coding with AI-powered assistance\n')
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [aiResponse, setAiResponse] = useState('')
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [selectedRepo, setSelectedRepo] = useState<string>('')
  const { user, profile, signIn, signOut } = useAuth()
  const aiService = AIService.getInstance()
  const githubService = GitHubService.getInstance()

  useEffect(() => {
    if (user) {
      loadGitHubRepos()
    }
  }, [user])

  async function loadGitHubRepos() {
    try {
      const repos = await githubService.listRepositories()
      setRepos(repos)
    } catch (error) {
      console.error('Failed to load repositories:', error)
    }
  }

  const handleFileSelect = (file: File) => {
    setCurrentFile(file)
    setCode(file.content)
  }

  const handleAIAction = async (action: 'refactor' | 'test' | 'flowchart' | 'chat' | 'commit') => {
    if (!code) return

    try {
      let result = ''
      switch (action) {
        case 'refactor':
          result = await aiService.refactorCode(code, 'Improve code quality and readability')
          break
        case 'test':
          result = await aiService.generateTests(code)
          break
        case 'flowchart':
          result = await aiService.generateFlowchart(code)
          break
        case 'chat':
          result = await aiService.chatAssistant('Please explain this code:', code)
          break
        case 'commit':
          if (currentFile && selectedRepo) {
            const message = await githubService.generateCommitMessage([
              { path: currentFile.path, content: code }
            ])
            await githubService.commitChanges(selectedRepo, 'main', [
              { path: currentFile.path, content: code }
            ], message)
            result = `Changes committed to ${selectedRepo}: ${message}`
          }
          break
      }
      setAiResponse(result)
    } catch (error) {
      console.error('AI action failed:', error)
      setAiResponse('Error: Service is currently unavailable')
    }
  }

  return (
    <main className="flex h-screen">
      {/* Sidebar */}
      <div className="w-16 bg-black bg-opacity-30 flex flex-col items-center py-4 glass-panel">
        <button 
          className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg mb-4"
          title="Toggle Menu"
          aria-label="Toggle Menu"
        >
          <FiMenu size={24} />
        </button>
        <button 
          className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg mb-4"
          title="Code Editor"
          aria-label="Code Editor"
        >
          <FiCode size={24} />
        </button>
        <button 
          className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg mb-4"
          title="Git"
          aria-label="Git"
        >
          <FiGitBranch size={24} />
        </button>
        <button 
          className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg mb-4"
          title="GitHub"
          aria-label="GitHub"
        >
          <FiGithub size={24} />
        </button>
        <button 
          className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg"
          title="Terminal"
          aria-label="Terminal"
        >
          <FiTerminal size={24} />
        </button>
      </div>

      {/* File Explorer */}
      <div className="w-64">
        {user ? (
          <>
            <FileExplorer 
              projectId="default-project" 
              onFileSelect={handleFileSelect}
            />
            {/* GitHub Repos */}
            <div className="glass-panel mt-4">
              <h3 className="text-sm font-semibold mb-2">GitHub Repositories</h3>
              <select
                className="w-full bg-white bg-opacity-10 rounded p-1 text-sm"
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
              >
                <option value="">Select a repository</option>
                {repos.map(repo => (
                  <option key={repo.id} value={repo.full_name}>
                    {repo.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div className="glass-panel p-4">
            <p>Please sign in to access files</p>
          </div>
        )}
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-12 glass-panel flex items-center justify-between px-4">
          <h1 className="text-xl font-semibold">CyneticsIDE</h1>
          <div>
            {user ? (
              <div className="flex items-center gap-4">
                <span>{profile?.full_name}</span>
                <button 
                  onClick={() => signOut()}
                  className="px-4 py-2 bg-white bg-opacity-10 rounded-lg hover:bg-opacity-20"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                onClick={() => signIn('demo@example.com', 'password')}
                className="px-4 py-2 bg-white bg-opacity-10 rounded-lg hover:bg-opacity-20"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Editor Container */}
        <div className="flex-1 p-4">
          <div className="editor-container h-full">
            <CollaborativeEditor
              projectId="default-project"
              value={code}
              onChange={setCode}
            />
          </div>
        </div>

        {/* Bottom Panel - AI Assistant */}
        <div className="h-32 glass-panel overflow-auto">
          <div className="text-sm whitespace-pre-wrap">
            {aiResponse || 'AI Assistant: Ready to help with your coding tasks...'}
          </div>
        </div>
      </div>

      {/* Right Sidebar - AI Features */}
      <div className="w-64 glass-panel">
        <h2 className="text-lg font-semibold mb-4">AI Features</h2>
        <div className="space-y-2">
          <button 
            className="w-full p-2 bg-white bg-opacity-10 rounded-lg hover:bg-opacity-20"
            onClick={() => handleAIAction('refactor')}
          >
            Code Refactor
          </button>
          <button 
            className="w-full p-2 bg-white bg-opacity-10 rounded-lg hover:bg-opacity-20"
            onClick={() => handleAIAction('test')}
          >
            Generate Tests
          </button>
          <button 
            className="w-full p-2 bg-white bg-opacity-10 rounded-lg hover:bg-opacity-20"
            onClick={() => handleAIAction('flowchart')}
          >
            Create Flowchart
          </button>
          <button 
            className="w-full p-2 bg-white bg-opacity-10 rounded-lg hover:bg-opacity-20"
            onClick={() => handleAIAction('chat')}
          >
            AI Chat
          </button>
          {selectedRepo && (
            <button 
              className="w-full p-2 bg-white bg-opacity-10 rounded-lg hover:bg-opacity-20"
              onClick={() => handleAIAction('commit')}
            >
              Commit to GitHub
            </button>
          )}
        </div>
      </div>
    </main>
  )
} 