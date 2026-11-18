import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button, ModalSheet } from '../ui/Primitives';

interface SelfieCameraModalProps {
  open: boolean;
  mode: 'check-in' | 'check-out';
  siteName: string;
  onClose: () => void;
  onCaptured: (selfieDataUrl: string) => void;
  onReportCameraException?: (reason: string) => void;
}

export const SelfieCameraModal: React.FC<SelfieCameraModalProps> = ({
  open,
  mode,
  siteName,
  onClose,
  onCaptured,
  onReportCameraException,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<'starting' | 'ready' | 'error'>('starting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setPreviewUrl(null);
    setCameraState('starting');
    setErrorMessage('');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('error');
      setErrorMessage('Camera API is not supported in this browser or context (requires HTTPS or localhost).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('ready');
    } catch (err) {
      setCameraState('error');
      const domErr = err as { name?: string; message?: string };
      if (domErr?.name === 'NotAllowedError' || domErr?.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Camera permission was denied. Allow camera access in your browser site settings so we can verify a fresh live selfie.'
        );
      } else if (domErr?.name === 'NotFoundError' || domErr?.name === 'DevicesNotFoundError') {
        setErrorMessage(
          'No front camera device was detected on this machine. Connect a camera or request an Attendance Exception.'
        );
      } else {
        setErrorMessage(domErr?.message || 'Unable to access the device front camera.');
      }
    }
  }, [stopStream]);

  useEffect(() => {
    if (open) {
      void startCamera();
    } else {
      stopStream();
      setPreviewUrl(null);
    }
    return () => stopStream();
  }, [open, startCamera, stopStream]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const size = Math.min(video.videoWidth, video.videoHeight, 640);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    // Mirror front-camera preview naturally
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
    setPreviewUrl(dataUrl);
  };

  const handleConfirm = () => {
    if (!previewUrl) return;
    stopStream();
    onCaptured(previewUrl);
  };

  return (
    <ModalSheet
      open={open}
      onClose={() => {
        stopStream();
        onClose();
      }}
      title={mode === 'check-in' ? 'Live Check-In Selfie' : 'Live Check-Out Selfie'}
      subtitle={`${siteName} · Live front camera required (gallery uploads disabled)`}
    >
      <div className="space-y-4">
        <div className="relative aspect-square max-w-[320px] mx-auto rounded-2xl overflow-hidden bg-[#101F35] border border-[#E2E8F0]">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Captured attendance selfie preview"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}

          {/* Face positioning guide */}
          {cameraState === 'ready' && !previewUrl && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-48 h-60 rounded-full border-2 border-dashed border-white/85 shadow-[0_0_0_999px_rgba(16,31,53,0.38)]" />
              <span className="mt-3 px-3 py-1 rounded-lg bg-[#101F35]/80 text-white text-xs font-medium">
                Align your face inside the oval guide
              </span>
            </div>
          )}

          {cameraState === 'starting' && !previewUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 gap-2 p-6 text-center">
              <Camera className="w-8 h-8 animate-pulse" />
              <p className="text-sm font-medium">Starting front camera...</p>
            </div>
          )}

          {cameraState === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-5 text-center gap-3 bg-[#101F35]">
              <ShieldAlert className="w-9 h-9 text-[#F59E0B]" />
              <p className="text-sm font-semibold">Camera Access Needed</p>
              <p className="text-xs text-white/80 leading-relaxed">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-[#F5F7FA] border border-[#E2E8F0] px-3.5 py-2.5 text-xs text-[#64748B] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
          <span>
            Only a fresh live camera capture is accepted. Gallery photos cannot be uploaded for attendance verification.
          </span>
        </div>

        {cameraState === 'ready' && !previewUrl && (
          <Button variant="primary" size="lg" className="w-full" onClick={handleCapture}>
            <Camera className="w-5 h-5" />
            Capture Live Selfie
          </Button>
        )}

        {previewUrl && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="lg" onClick={() => setPreviewUrl(null)}>
              <RefreshCw className="w-4 h-4" />
              Retake
            </Button>
            <Button variant="success" size="lg" onClick={handleConfirm}>
              Use This Selfie
            </Button>
          </div>
        )}

        {cameraState === 'error' && (
          <div className="space-y-2.5">
            <Button variant="primary" size="lg" className="w-full" onClick={() => void startCamera()}>
              <RefreshCw className="w-4 h-4" />
              Retry Camera Permission
            </Button>
            {onReportCameraException && (
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={() => {
                  stopStream();
                  onReportCameraException(errorMessage);
                }}
              >
                Submit Attendance Exception Instead
              </Button>
            )}
          </div>
        )}
      </div>
    </ModalSheet>
  );
};
