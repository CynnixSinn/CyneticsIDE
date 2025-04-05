import { useState, useEffect } from 'react'
import { FiFolder, FiFile, FiChevronRight, FiChevronDown } from 'react-icons/fi'
import { supabase } from '@/lib/supabase'
import type { File, Project } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type FileNode = {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

interface FileExplorerProps {
  projectId: string
  onFileSelect: (file: File) => void
}

export default function FileExplorer({ projectId, onFileSelect }: FileExplorerProps) {
  const [files, setFiles] = useState<FileNode[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const { user } = useAuth()

  useEffect(() => {
    if (projectId) {
      loadFiles()
    }
  }, [projectId])

  async function loadFiles() {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .order('path')

    if (error) {
      console.error('Error loading files:', error)
      return
    }

    const fileTree = buildFileTree(data)
    setFiles(fileTree)
  }

  function buildFileTree(files: File[]): FileNode[] {
    const root: { [key: string]: FileNode } = {}

    files.forEach(file => {
      const parts = file.path.split('/')
      let current = root

      parts.forEach((part, index) => {
        const path = parts.slice(0, index + 1).join('/')
        if (!current[path]) {
          current[path] = {
            id: path,
            name: part,
            path: path,
            type: index === parts.length - 1 ? 'file' : 'folder',
            children: index === parts.length - 1 ? undefined : {}
          }
        }
        current = current[path].children as { [key: string]: FileNode }
      })
    })

    return Object.values(root)
  }

  function toggleFolder(path: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  async function handleFileClick(path: string) {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .eq('path', path)
      .single()

    if (error) {
      console.error('Error loading file:', error)
      return
    }

    onFileSelect(data)
  }

  function renderNode(node: FileNode) {
    const isExpanded = expandedFolders.has(node.path)

    return (
      <div key={node.path} className="select-none">
        <div
          className="flex items-center py-1 px-2 hover:bg-white hover:bg-opacity-5 rounded cursor-pointer"
          onClick={() => node.type === 'folder' ? toggleFolder(node.path) : handleFileClick(node.path)}
        >
          {node.type === 'folder' && (
            isExpanded ? <FiChevronDown className="mr-1" /> : <FiChevronRight className="mr-1" />
          )}
          {node.type === 'folder' ? (
            <FiFolder className="mr-2 text-yellow-400" />
          ) : (
            <FiFile className="mr-2 text-blue-400" />
          )}
          <span>{node.name}</span>
        </div>
        {node.type === 'folder' && isExpanded && node.children && (
          <div className="ml-4">
            {Object.values(node.children).map(child => renderNode(child))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto glass-panel">
      <div className="text-sm">
        {files.map(node => renderNode(node))}
      </div>
    </div>
  )
} 