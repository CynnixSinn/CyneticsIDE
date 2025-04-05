import { CollaborationService } from './collaboration'
import { supabase } from '@/lib/supabase'

interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  content?: string
  parentId?: string
  projectId: string
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  metadata?: {
    size?: number
    language?: string
    lastCommit?: string
    permissions?: string[]
  }
}

interface FileOperation {
  type: 'create' | 'update' | 'delete' | 'move' | 'rename'
  file: FileNode
  previousPath?: string
  userId: string
  timestamp: number
}

export class SharedFileSystem {
  private static instance: SharedFileSystem
  private collaboration: CollaborationService
  private fileCache = new Map<string, FileNode>()
  private operationQueue: FileOperation[] = []
  private isProcessing = false
  private fileWatchers = new Map<string, Set<(file: FileNode) => void>>()

  private constructor() {
    this.collaboration = CollaborationService.getInstance()
    this.setupSocketHandlers()
  }

  static getInstance(): SharedFileSystem {
    if (!SharedFileSystem.instance) {
      SharedFileSystem.instance = new SharedFileSystem()
    }
    return SharedFileSystem.instance
  }

  private setupSocketHandlers() {
    this.collaboration.socket?.on('file_operation', async (operation: FileOperation) => {
      await this.processOperation(operation)
    })

    this.collaboration.socket?.on('file_lock', ({ path, userId }: { path: string; userId: string }) => {
      const file = this.fileCache.get(path)
      if (file) {
        file.metadata = { ...file.metadata, lockedBy: userId }
        this.notifyWatchers(file)
      }
    })

    this.collaboration.socket?.on('file_unlock', ({ path }: { path: string }) => {
      const file = this.fileCache.get(path)
      if (file) {
        delete file.metadata?.lockedBy
        this.notifyWatchers(file)
      }
    })
  }

  async createFile(
    projectId: string,
    path: string,
    content: string = '',
    type: FileNode['type'] = 'file'
  ): Promise<FileNode> {
    const file: FileNode = {
      id: crypto.randomUUID(),
      name: path.split('/').pop() || '',
      path,
      type,
      content: type === 'file' ? content : undefined,
      projectId,
      createdBy: this.collaboration.userId || '',
      updatedBy: this.collaboration.userId || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        language: this.detectLanguage(path),
        size: content.length
      }
    }

    await this.queueOperation({
      type: 'create',
      file,
      userId: this.collaboration.userId || '',
      timestamp: Date.now()
    })

    return file
  }

  async updateFile(path: string, content: string): Promise<FileNode> {
    const file = await this.getFile(path)
    if (!file) throw new Error('File not found')

    const updatedFile: FileNode = {
      ...file,
      content,
      updatedBy: this.collaboration.userId || '',
      updatedAt: new Date().toISOString(),
      metadata: {
        ...file.metadata,
        size: content.length
      }
    }

    await this.queueOperation({
      type: 'update',
      file: updatedFile,
      userId: this.collaboration.userId || '',
      timestamp: Date.now()
    })

    return updatedFile
  }

  async deleteFile(path: string): Promise<void> {
    const file = await this.getFile(path)
    if (!file) throw new Error('File not found')

    await this.queueOperation({
      type: 'delete',
      file,
      userId: this.collaboration.userId || '',
      timestamp: Date.now()
    })
  }

  async moveFile(oldPath: string, newPath: string): Promise<FileNode> {
    const file = await this.getFile(oldPath)
    if (!file) throw new Error('File not found')

    const movedFile: FileNode = {
      ...file,
      path: newPath,
      name: newPath.split('/').pop() || '',
      updatedBy: this.collaboration.userId || '',
      updatedAt: new Date().toISOString()
    }

    await this.queueOperation({
      type: 'move',
      file: movedFile,
      previousPath: oldPath,
      userId: this.collaboration.userId || '',
      timestamp: Date.now()
    })

    return movedFile
  }

  async getFile(path: string): Promise<FileNode | null> {
    // Check cache first
    if (this.fileCache.has(path)) {
      return this.fileCache.get(path)!
    }

    // Fetch from database
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('path', path)
      .single()

    if (error) return null

    const file = data as FileNode
    this.fileCache.set(path, file)
    return file
  }

  async listDirectory(path: string): Promise<FileNode[]> {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .like('path', `${path}/%`)
      .order('path')

    if (error) throw error

    const files = data as FileNode[]
    files.forEach(file => this.fileCache.set(file.path, file))
    return files
  }

  watchFile(path: string, callback: (file: FileNode) => void): () => void {
    const watchers = this.fileWatchers.get(path) || new Set()
    watchers.add(callback)
    this.fileWatchers.set(path, watchers)

    return () => {
      const watchers = this.fileWatchers.get(path)
      if (watchers) {
        watchers.delete(callback)
        if (watchers.size === 0) {
          this.fileWatchers.delete(path)
        }
      }
    }
  }

  private async processOperation(operation: FileOperation) {
    this.operationQueue.push(operation)
    if (!this.isProcessing) {
      this.isProcessing = true
      while (this.operationQueue.length > 0) {
        const op = this.operationQueue.shift()!
        await this.applyOperation(op)
      }
      this.isProcessing = false
    }
  }

  private async applyOperation(operation: FileOperation) {
    const { type, file, previousPath } = operation

    switch (type) {
      case 'create':
      case 'update':
        await supabase.from('files').upsert(file)
        this.fileCache.set(file.path, file)
        break

      case 'delete':
        await supabase.from('files').delete().eq('path', file.path)
        this.fileCache.delete(file.path)
        break

      case 'move':
        if (previousPath) {
          await supabase.from('files').delete().eq('path', previousPath)
          this.fileCache.delete(previousPath)
        }
        await supabase.from('files').insert(file)
        this.fileCache.set(file.path, file)
        break
    }

    this.notifyWatchers(file)
  }

  private notifyWatchers(file: FileNode) {
    const watchers = this.fileWatchers.get(file.path)
    if (watchers) {
      watchers.forEach(callback => callback(file))
    }
  }

  private detectLanguage(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml'
    }
    return extension ? languageMap[extension] || 'plaintext' : 'plaintext'
  }
} 