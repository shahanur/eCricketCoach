import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';

type CalibrationPoint = [number, number];

interface OpenAiCapeCalibrationPickerProps {
  source: { file?: File; driveFileId?: string } | null;
  points: CalibrationPoint[];
  onChange: (points: CalibrationPoint[]) => void;
}

const CORNERS = [
  'Batter-end left',
  'Batter-end right',
  'Bowler-end right',
  'Bowler-end left'
];

export const OpenAiCapeCalibrationPicker: React.FC<OpenAiCapeCalibrationPickerProps> = ({ source, points, onChange }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [frameReady, setFrameReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setVideoUrl('');
    setFrameReady(false);
    setError('');
    if (!source) return;
    const setPreview = (blob: Blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setVideoUrl(objectUrl);
    };
    if (source.file) setPreview(source.file);
    else if (source.driveFileId) {
      setLoading(true);
      api.fetchDriveVideo(source.driveFileId)
        .then(setPreview)
        .catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'Could not load the video frame.'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source?.file, source?.driveFileId]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!frameReady || !video || !canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const radius = Math.max(7, canvas.width / 120);
    context.lineWidth = Math.max(2, radius / 3);
    context.strokeStyle = '#34d399';
    if (points.length > 1) {
      context.beginPath();
      points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
      context.stroke();
    }
    points.forEach(([x, y], index) => {
      context.fillStyle = '#34d399';
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.font = `bold ${radius * 2}px sans-serif`;
      context.fillText(String(index + 1), x + radius * 1.4, y - radius * 1.4);
    });
  }, [frameReady, points]);

  const onFrameReady = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (video.currentTime !== 0) video.currentTime = 0;
    else setFrameReady(true);
  };

  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length >= 4) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left) * canvas.width / rect.width);
    const y = Math.round((event.clientY - rect.top) * canvas.height / rect.height);
    onChange([...points, [x, y]]);
  };

  return (
    <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/60 p-3">
      <div>
        <p className="text-[11px] font-semibold text-slate-200">Pitch calibration for CAPE video kinetics</p>
        <p className="mt-1 text-[10px] text-slate-400">Tap the pitch corners in order. These points let CAPE estimate ball speed, momentum, energy and launch angle; keep all four in the same plane and frame.</p>
      </div>
      {loading && <p role="status" className="text-xs text-violet-200">Loading video frame…</p>}
      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
      {videoUrl && (
        <>
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            playsInline
            preload="auto"
            className="hidden"
            onLoadedData={onFrameReady}
            onSeeked={() => setFrameReady(true)}
            onError={() => setError('This video frame could not be decoded in the browser.')}
          />
          <canvas
            ref={canvasRef}
            onClick={onCanvasClick}
            className={`max-h-64 max-w-full rounded border border-slate-700 ${frameReady && points.length < 4 ? 'cursor-crosshair' : ''} ${frameReady ? '' : 'hidden'}`}
          />
          {frameReady && <p className="text-[10px] text-slate-400">{points.length < 4 ? <>Tap <strong className="text-white">{points.length + 1}. {CORNERS[points.length]}</strong>.</> : 'Four corners selected.'}</p>}
          {!!points.length && <button type="button" onClick={() => onChange([])} className="text-[10px] text-slate-400 underline">Reset corners</button>}
        </>
      )}
    </div>
  );
};
