import { createServer } from 'http'
import { Server } from 'socket.io'
import { UserPresence } from '@/services/collaboration'

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

interface RoomState {
  users: Map<string, UserPresence>
  content: string
}

const rooms = new Map<string, RoomState>()

io.on('connection', (socket) => {
  const { projectId, userId, profile } = socket.handshake.query
  if (!projectId || !userId || !profile) {
    socket.disconnect()
    return
  }

  // Initialize room if it doesn't exist
  if (!rooms.has(projectId as string)) {
    rooms.set(projectId as string, {
      users: new Map(),
      content: ''
    })
  }

  const room = rooms.get(projectId as string)!
  
  // Join room
  socket.join(projectId as string)
  
  // Add user to room state
  room.users.set(userId as string, {
    userId: userId as string,
    profile: JSON.parse(profile as string),
    cursor: { row: 0, column: 0 },
    lastActive: Date.now()
  })

  // Broadcast updated presence to all users in room
  io.to(projectId as string).emit('presence', Array.from(room.users.values()))

  // Handle cursor updates
  socket.on('cursor', ({ position, selection }) => {
    const user = room.users.get(userId as string)
    if (user) {
      user.cursor = position
      user.selection = selection
      user.lastActive = Date.now()
      io.to(projectId as string).emit('presence', Array.from(room.users.values()))
    }
  })

  // Handle content changes
  socket.on('change', (change) => {
    // Broadcast change to all other users in room
    socket.to(projectId as string).emit('change', change)
    
    // Update room content
    if (typeof change.text === 'string') {
      room.content = applyChange(room.content, change)
    }
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    room.users.delete(userId as string)
    io.to(projectId as string).emit('presence', Array.from(room.users.values()))
    
    // Clean up empty rooms
    if (room.users.size === 0) {
      rooms.delete(projectId as string)
    }
  })
})

// Helper function to apply changes to content
function applyChange(content: string, change: any): string {
  const lines = content.split('\n')
  const { range, text } = change
  
  // Handle single line changes
  if (range.startLineNumber === range.endLineNumber) {
    const line = lines[range.startLineNumber - 1]
    lines[range.startLineNumber - 1] = 
      line.substring(0, range.startColumn - 1) +
      text +
      line.substring(range.endColumn - 1)
  } else {
    // Handle multi-line changes
    const startLine = lines[range.startLineNumber - 1]
    const endLine = lines[range.endLineNumber - 1]
    
    const newLines = text.split('\n')
    newLines[0] = startLine.substring(0, range.startColumn - 1) + newLines[0]
    newLines[newLines.length - 1] += endLine.substring(range.endColumn - 1)
    
    lines.splice(
      range.startLineNumber - 1,
      range.endLineNumber - range.startLineNumber + 1,
      ...newLines
    )
  }
  
  return lines.join('\n')
}

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`)
}) 