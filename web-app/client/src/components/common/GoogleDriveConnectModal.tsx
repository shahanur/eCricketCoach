import React, { useEffect, useRef, useState } from 'react';
import { Cloud, HardDrive, Check, X, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface GoogleDriveConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (accountEmail: string) => void;
  initialEmail?: string;
  userRoleLabel?: string;
}

export const GoogleDriveConnectModal: React.FC<GoogleDriveConnectModalProps> = ({
  isOpen,
  onClose,
  onConnected,
  userRoleLabel = 'Player / Coach'
}) => {
  const [authStep, setAuthStep] = useState<'PROMPT' | 'WAITING_FOR_GOOGLE' | 'SUCCESS'>('PROMPT');
  const [error, setError] = useState<string | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string>('');
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAuthStep('PROMPT');
    setError(null);
  }, [isOpen]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'GOOGLE_DRIVE_CONNECTED') {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setConnectedEmail(data.email || '');
        setAuthStep('SUCCESS');
        setTimeout(() => {
          onConnected(data.email || '');
          setAuthStep('PROMPT');
        }, 1100);
      } else if (data.type === 'GOOGLE_DRIVE_ERROR') {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setError(data.error || 'Unable to connect to Google Drive. Please try again.');
        setAuthStep('PROMPT');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onConnected]);

  if (!isOpen) return null;

  const handleStartOAuth = () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setError('You must be signed in to connect Google Drive.');
      return;
    }

    setError(null);
    setAuthStep('WAITING_FOR_GOOGLE');

    const width = 520;
    const height = 640;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      api.getGoogleDriveConnectUrl(),
      'googleDriveConnect',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    popupRef.current = popup;

    if (!popup) {
      setError('Popup was blocked by your browser. Please allow popups for this site and try again.');
      setAuthStep('PROMPT');
      return;
    }

    // Detect if the user closes the popup manually without completing the flow
    pollRef.current = window.setInterval(() => {
      if (popup.closed) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setAuthStep(prev => (prev === 'SUCCESS' ? prev : 'PROMPT'));
      }
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          disabled={authStep === 'WAITING_FOR_GOOGLE'}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg disabled:opacity-40 cursor-pointer p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Connect Google Drive</h3>
            <p className="text-xs text-slate-400">Vault for {userRoleLabel} video storage & AI pose sync</p>
          </div>
        </div>

        {authStep === 'PROMPT' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                Why connect your Google Drive?
              </p>
              <ul className="space-y-1.5 text-[11px] text-slate-400 pl-5 list-disc">
                <li>Securely browse your real video files via Google's official OAuth 2.0 consent screen</li>
                <li>Read-only access — eCricketCoach can only view and download video files you choose</li>
                <li>Instant retrieval for kinematic AI biomechanical pose analysis</li>
                <li>You can disconnect access at any time from Google Account settings</li>
              </ul>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartOAuth}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Sign in with Google</span>
              </button>
            </div>
          </div>
        )}

        {authStep === 'WAITING_FOR_GOOGLE' && (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-semibold text-white">Waiting for Google authorisation...</p>
            <p className="text-[11px] text-slate-400">Complete the sign-in and consent steps in the popup window</p>
          </div>
        )}

        {authStep === 'SUCCESS' && (
          <div className="py-6 text-center space-y-2 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-xl">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Google Drive Connected!</h4>
            <p className="text-xs text-slate-300 font-mono">{connectedEmail}</p>
            <p className="text-[11px] text-emerald-400">Vault synced and ready for AI video analysis</p>
          </div>
        )}
      </div>
    </div>
  );
};
