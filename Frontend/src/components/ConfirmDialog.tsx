import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ShieldAlert } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmWord?: string;
  confirmLabel?: string;
  type?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmWord = 'DELETE',
  confirmLabel = 'Delete Permanently',
  type = 'danger'
}) => {
  const [userInput, setUserInput] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUserInput('');
      setIsError(false);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (userInput.trim().toUpperCase() === confirmWord.toUpperCase()) {
      onConfirm();
      onClose();
    } else {
      setIsError(true);
      setTimeout(() => setIsError(false), 500);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`relative w-full max-w-md glass-card p-8 border-t-4 shadow-2xl ${
              type === 'danger' ? 'border-t-destructive' : 
              type === 'warning' ? 'border-t-warning' : 'border-t-primary'
            }`}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className={`p-3 rounded-2xl ${
                type === 'danger' ? 'bg-destructive/10 text-destructive' : 
                type === 'warning' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
              }`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-display font-bold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-secondary/30 rounded-xl border border-glass-border">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                  Please type <span className="text-foreground">"{confirmWord}"</span> to confirm
                </label>
                <input
                  autoFocus
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                  placeholder={`Type ${confirmWord} here...`}
                  className={`input-floating font-mono text-sm uppercase px-4 py-3 border-glass-border transition-all ${
                    isError ? 'border-destructive bg-destructive/5 animate-shake' : ''
                  }`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl font-bold bg-secondary hover:bg-secondary/80 text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`flex-[1.5] py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    type === 'danger' ? 'glow-button-danger' : 
                    type === 'warning' ? 'glow-button-warning' : 'glow-button-primary'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
