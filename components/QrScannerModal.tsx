'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  onResult: (phone: string) => void
  onClose: () => void
  color?: string
}

type ScanState = 'init' | 'scanning' | 'success' | 'error'

export default function QrScannerModal({ onResult, onClose, color = '#6366f1' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const resultSentRef = useRef(false)

  const [state, setState] = useState<ScanState>('init')
  const [errorMsg, setErrorMsg] = useState('')
  const [lastResult, setLastResult] = useState('')

  useEffect(() => {
    let jsQR: ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null = null

    const startCamera = async () => {
      try {
        const mod = await import('jsqr')
        jsQR = mod.default

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          setState('scanning')
        }
      } catch {
        setErrorMsg('Accès caméra refusé. Autorisez la caméra dans les réglages de votre navigateur.')
        setState('error')
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
        const phone = code.data.replace(/^TEL:/i, '').trim()
        setLastResult(phone)
        setState('success')
        stopCamera()
        // Short delay to show success state before closing
        setTimeout(() => onResult(phone), 800)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    startCamera().then(() => {
      rafRef.current = requestAnimationFrame(tick)
    })

    return () => stopCamera()
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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: color + '33' }}>
            <span className="text-lg">📷</span>
          </div>
          <div>
            <div className="text-white font-bold text-base">Scanner le client</div>
            <div className="text-white/50 text-xs">Pointez sur le QR du client</div>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-xl font-light"
        >
          ×
        </button>
      </div>

      {/* Camera area */}
      <div className="flex-1 flex items-center justify-center px-6 pb-6">
        <div className="w-full max-w-sm">

          {/* Error state */}
          {state === 'error' && (
            <div className="bg-white rounded-3xl p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">📵</span>
              </div>
              <div>
                <div className="font-bold text-gray-900 mb-1">Caméra inaccessible</div>
                <p className="text-gray-500 text-sm">{errorMsg}</p>
              </div>
              <button
                onClick={handleClose}
                className="w-full py-3 rounded-2xl font-bold text-white"
                style={{ background: color }}
              >
                Fermer
              </button>
            </div>
          )}

          {/* Success state */}
          {state === 'success' && (
            <div className="bg-white rounded-3xl p-8 text-center space-y-3 animate-[fadeIn_0.3s_ease]">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: color + '22' }}
              >
                <span className="text-3xl">✅</span>
              </div>
              <div className="font-bold text-gray-900 text-lg">Client identifié !</div>
              <div className="font-mono text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2">{lastResult}</div>
              <p className="text-gray-400 text-xs">Enregistrement de la visite...</p>
            </div>
          )}

          {/* Init/Scanning state */}
          {(state === 'init' || state === 'scanning') && (
            <div className="relative">
              {/* Video feed */}
              <div className="rounded-3xl overflow-hidden bg-gray-900 aspect-square relative">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* Scanning overlay */}
                {state === 'scanning' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Corner markers */}
                    <div className="relative w-56 h-56">
                      {/* Top-left */}
                      <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 rounded-tl-2xl" style={{ borderColor: color }} />
                      {/* Top-right */}
                      <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 rounded-tr-2xl" style={{ borderColor: color }} />
                      {/* Bottom-left */}
                      <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 rounded-bl-2xl" style={{ borderColor: color }} />
                      {/* Bottom-right */}
                      <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 rounded-br-2xl" style={{ borderColor: color }} />
                      {/* Scan line */}
                      <div
                        className="absolute inset-x-2 h-0.5 rounded-full animate-[scan_2s_ease-in-out_infinite]"
                        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, top: '0' }}
                      />
                    </div>
                    {/* Dim overlay outside the target zone */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                      background: 'radial-gradient(ellipse 224px 224px at center, transparent 80%, rgba(0,0,0,0.5) 100%)'
                    }} />
                  </div>
                )}

                {/* Init overlay */}
                {state === 'init' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="text-center">
                      <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-white/70 text-sm">Démarrage caméra...</p>
                    </div>
                  </div>
                )}
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {/* Status bar */}
              {state === 'scanning' && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
                  <span className="text-white/60 text-sm">Recherche en cours...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
