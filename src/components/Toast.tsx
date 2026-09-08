import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: () => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: 'fi-rr-check-circle text-emerald-500 bg-emerald-50',
    error: 'fi-rr-cross-circle text-rose-500 bg-rose-50',
    info: 'fi-rr-info text-sky-500 bg-sky-50',
    warning: 'fi-rr-warning text-amber-500 bg-amber-50',
  };

  const borderColors = {
    success: 'border-emerald-100',
    error: 'border-rose-100',
    info: 'border-sky-100',
    warning: 'border-amber-100',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
      className={`pointer-events-auto flex items-start gap-3 p-4 bg-white border ${borderColors[toast.type]} rounded-2xl shadow-xl shadow-slate-100/80 w-full`}
    >
      <div className={`p-2 rounded-xl flex items-center justify-center ${icons[toast.type].split(' ')[1]} ${icons[toast.type].split(' ')[2]}`}>
        <i className={`fi ${icons[toast.type].split(' ')[0]} text-lg`} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-slate-900 text-sm">{toast.title}</h4>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition-colors"
      >
        <i className="fi fi-rr-cross text-[10px]" />
      </button>
    </motion.div>
  );
};
