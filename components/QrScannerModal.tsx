'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  onResult: (phone: string) => void
  onClose: () => void
  color?: string
}

export default function QrScannerModal({ onResult, onClose, color = '#6366f1' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const resultSentRef = useRef(false)

  useEffect(() => {
    let jsQR: ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null = null

    const startCamera = async () => {
      try {
        const mod = await import('jsqr')
        jsQR = mod.default

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          setScanning(true)
        }
      } catch {
        setError('Impossible d\'accéder à la caméra. Autorisez l\'accès dans votre navigateur.')
      }
    }

    const tick = () => {
      if (!videoRef.current || !canvasRef.current || !jsQR || resultSentRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code?.data) {
        resultSentRef.current = true
        // Extract phone: could be raw phone or "TEL:+33..."
        let phone = code.data.replace(/^TEL:/i, '').trim()
        stopCamera()
        onResult(phone)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    startCamera().then(() => {
      rafRef.current = requestAnimationFrame(tick)
    })

    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  const handleClose = () => {
    stopCamera()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl">
        <div className="px-5 py-4 flex items-center justify-between border-b">
          <h2 className="font-bold text-gray-900 text-lg">📷 Scanner la carte client</h2>
          <button onClick={handleClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        {error ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">📵</div>
            <p className="text-gray-600 text-sm">{error}</p>
            <button onClick={handleClose} className="mt-4 px-6 py-2 rounded-xl font-semibold text-white text-sm" style={{ background: color }}>
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div className="relative bg-black" style={{ aspectRatio: '1' }}>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-52 h-52 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg" style={{ borderColor: color }} />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg" style={{ borderColor: color }} />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg" style={{ borderColor: color }} />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-lg" style={{ borderColor: color }} />
                  {scanning && (
                    <div className="absolute inset-x-0 top-0 h-0.5 animate-[scan_2s_ease-in-out_infinite]" style={{ background: color }} />
                  )}
                </div>
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="p-4 text-center text-sm text-gray-500">
              Pointez la caméra sur le QR du client
            </div>
          </>
        )}
      </div>
    </div>
  )
}
