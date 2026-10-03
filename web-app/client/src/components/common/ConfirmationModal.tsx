import React from 'react';
import { AlertCircle, CheckCircle2, HelpCircle, Info, X } from 'lucide-react';

export type ConfirmationType = 'confirm' | 'success' | 'warning' | 'info' | 'danger';

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  type?: ConfirmationType;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  type = 'confirm',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  showCancel = false,
  onConfirm,
  onCancel,
  onClose
}) => {
  if (!isOpen) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-6 h-6 text-emerald-400" />;
      case 'warning':
      case 'danger':
        return <AlertCircle className="w-6 h-6 text-rose-400" />;
      case 'info':
        return <Info className="w-6 h-6 text-cyan-400" />;
      case 'confirm':
      default:
        return <HelpCircle className="w-6 h-6 text-amber-400" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500/10 border-emerald-500/30';
      case 'warning':
      case 'danger':
        return 'bg-rose-500/10 border-rose-500/30';
      case 'info':
        return 'bg-cyan-500/10 border-cyan-500/30';
      case 'confirm':
      default:
        return 'bg-amber-500/10 border-amber-500/30';
    }
  };

  const getConfirmButtonClasses = () => {
    switch (type) {
      case 'danger':
      case 'warning':
        return 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-rose-500/20';
      case 'info':
        return 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 shadow-cyan-500/20';
      case 'success':
      case 'confirm':
      default:
        return 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${getIconBg()}`}>
            {getIcon()}
          </div>
          <div className="space-y-1 pr-6">
            <h3 className="text-base font-bold text-white leading-snug">{title}</h3>
            <div className="text-xs text-slate-300 leading-relaxed">{message}</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          {showCancel && (
            <button
              type="button"
              onClick={() => {
                if (onCancel) onCancel();
                else if (onClose) onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent hover:border-slate-700 transition"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition flex items-center gap-1.5 ${getConfirmButtonClasses()}`}
          >
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
