import { useState, useEffect, useRef } from 'react'
import { FiMonitor, FiStopCircle, FiMaximize2, FiMinimize2 } from 'react-icons/fi'
import { ScreenShareService } from '@/services/screenShare'
import { useAuth } from '@/contexts/AuthContext'

interface ScreenShareProps {
  peerId?: string
}

export default function ScreenShare({ peerId }: ScreenShareProps) {
  const { profile } = useAuth()
  const [isSharing, setIsSharing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const screenShare = ScreenShareService.getInstance()

  async function handleStartSharing() {
    try {
      await screenShare.startSharing()
      setIsSharing(true)
      setError(null)
    } catch (error: any) {
      setError(error.message)
    }
  }

  async function handleStopSharing() {
    screenShare.stopSharing()
    setIsSharing(false)
  }

  async function handleRequestShare() {
    if (!peerId) return

    try {
      const stream = await screenShare.requestScreenShare(peerId)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setError(null)
    } catch (error: any) {
      setError(error.message)
    }
  }

  function handleToggleFullscreen() {
    if (!videoRef.current) return

    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Screen Sharing</h3>
        <div className="flex space-x-2">
          {!peerId ? (
            <button
              onClick={isSharing ? handleStopSharing : handleStartSharing}
              className={`p-2 rounded ${
                isSharing ? 'bg-red-600 bg-opacity-50' : 'bg-green-600 bg-opacity-50'
              }`}
              title={isSharing ? 'Stop Sharing' : 'Start Sharing'}
            >
              {isSharing ? <FiStopCircle size={20} /> : <FiMonitor size={20} />}
            </button>
          ) : (
            <button
              onClick={handleRequestShare}
              className="p-2 bg-blue-600 bg-opacity-50 rounded"
              title="Request Screen Share"
            >
              <FiMonitor size={20} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-900 bg-opacity-20 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {(isSharing || peerId) && (
        <div className="relative">
          <video
            ref={videoRef}
            className="w-full rounded"
            muted
            autoPlay
            playsInline
          />
          <button
            onClick={handleToggleFullscreen}
            className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 rounded hover:bg-opacity-75"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
          </button>
        </div>
      )}
    </div>
  )
} 