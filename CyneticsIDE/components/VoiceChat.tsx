import { useEffect, useState } from 'react'
import { FiMic, FiMicOff, FiHeadphones, FiVolume2, FiVolume, FiVolumeX } from 'react-icons/fi'
import { VoiceChatService } from '@/services/voiceChat'
import { useAuth } from '@/contexts/AuthContext'

interface VoiceChatProps {
  projectId: string
}

export default function VoiceChat({ projectId }: VoiceChatProps) {
  const { profile } = useAuth()
  const [isJoined, setIsJoined] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [voiceUsers, setVoiceUsers] = useState<Array<{
    userId: string
    name: string
    isSpeaking: boolean
    isMuted: boolean
  }>>([])
  const voiceChat = VoiceChatService.getInstance()

  useEffect(() => {
    if (isJoined) {
      const unsubscribe = voiceChat.onVoiceUsersUpdated(setVoiceUsers)
      return () => unsubscribe()
    }
  }, [isJoined])

  const handleJoinVoice = async () => {
    try {
      await voiceChat.joinVoiceChat(projectId)
      setIsJoined(true)
    } catch (error) {
      console.error('Failed to join voice chat:', error)
    }
  }

  const handleLeaveVoice = () => {
    voiceChat.leaveVoiceChat()
    setIsJoined(false)
  }

  const handleToggleMute = () => {
    const newMuted = voiceChat.toggleMute()
    setIsMuted(newMuted)
  }

  const handleToggleDeafen = () => {
    const newDeafened = voiceChat.toggleDeafen()
    setIsDeafened(newDeafened)
  }

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Voice Chat</h3>
        {!isJoined ? (
          <button
            onClick={handleJoinVoice}
            className="px-3 py-1 bg-green-600 bg-opacity-50 hover:bg-opacity-75 rounded text-sm"
          >
            Join Voice
          </button>
        ) : (
          <button
            onClick={handleLeaveVoice}
            className="px-3 py-1 bg-red-600 bg-opacity-50 hover:bg-opacity-75 rounded text-sm"
          >
            Leave Voice
          </button>
        )}
      </div>

      {isJoined && (
        <>
          <div className="flex space-x-2 mb-4">
            <button
              onClick={handleToggleMute}
              className={`p-2 rounded ${
                isMuted ? 'bg-red-600 bg-opacity-50' : 'bg-white bg-opacity-10'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <FiMicOff size={20} /> : <FiMic size={20} />}
            </button>
            <button
              onClick={handleToggleDeafen}
              className={`p-2 rounded ${
                isDeafened ? 'bg-red-600 bg-opacity-50' : 'bg-white bg-opacity-10'
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              {isDeafened ? <FiVolumeX size={20} /> : <FiVolume2 size={20} />}
            </button>
          </div>

          <div className="space-y-2">
            {/* Current user */}
            <div className="flex items-center justify-between p-2 bg-white bg-opacity-5 rounded">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm">{profile?.full_name} (You)</span>
              </div>
              <div className="flex space-x-1">
                {isMuted && <FiMicOff size={16} className="text-red-400" />}
                {isDeafened && <FiVolumeX size={16} className="text-red-400" />}
              </div>
            </div>

            {/* Other users */}
            {voiceUsers.map(user => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-2 bg-white bg-opacity-5 rounded"
              >
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      user.isSpeaking ? 'bg-green-400' : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-sm">{user.name}</span>
                </div>
                <div className="flex space-x-1">
                  {user.isMuted && <FiMicOff size={16} className="text-red-400" />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
} 