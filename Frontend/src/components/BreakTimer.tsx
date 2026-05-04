import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Play, Square, Loader2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { parseDBDate } from '@/utils/dateUtils';

interface BreakStatus {
  hasCheckedIn: boolean;
  isOnBreak: boolean;
  breakTaken: boolean;
  breakStartTime: string | null;
  breakEndTime: string | null;
  breakDurationMinutes: number;
  policyDurationMinutes: number;
  exceededPolicy: boolean;
  remainingBreakMinutes: number;
}

interface BreakTimerProps {
  onStatusChange?: () => void;
}

const BreakTimer: React.FC<BreakTimerProps> = ({ onStatusChange }) => {
  const [status, setStatus] = useState<BreakStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0); // in seconds
  const breakStartTimeRef = useRef<string | null>(null);

  // Helper: calculate elapsed seconds from a start time string
  const calcElapsed = (startTimeStr: string) => {
    const start = parseDBDate(startTimeStr)!.getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - start) / 1000));
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/attendance/break/status');
      if (res.success) {
        setStatus(res.data);
        if (res.data.isOnBreak && res.data.breakStartTime) {
          breakStartTimeRef.current = res.data.breakStartTime;
          setElapsed(calcElapsed(res.data.breakStartTime));
        } else {
          breakStartTimeRef.current = null;
          setElapsed(0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch break status', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll every 60 seconds for server sync
    const pollId = setInterval(fetchStatus, 60000);
    return () => clearInterval(pollId);
  }, [fetchStatus]);

  // ✅ FIX: Re-sync timer when user returns to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && breakStartTimeRef.current) {
        // Instantly correct the elapsed time from the actual start time
        setElapsed(calcElapsed(breakStartTimeRef.current));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Timer Effect: calculate from startTime directly to prevent drift
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status?.isOnBreak && breakStartTimeRef.current) {
      interval = setInterval(() => {
        if (breakStartTimeRef.current) {
          setElapsed(calcElapsed(breakStartTimeRef.current));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status?.isOnBreak]);

  const handleStartBreak = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/break/start', {});
      if (res.success) {
        toast.success('Lunch break started');
        fetchStatus();
        if (onStatusChange) onStatusChange();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to start break');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndBreak = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/break/end', {});
      if (res.success) {
        toast.success('Lunch break ended');
        fetchStatus();
        if (onStatusChange) onStatusChange();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to end break');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !status || !status.hasCheckedIn) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const policySeconds = status.policyDurationMinutes * 60;
  const alreadyLoggedSeconds = (status.breakDurationMinutes || 0) * 60;
  const totalElapsedSeconds = alreadyLoggedSeconds + elapsed;
  const progressValue = Math.min(100, (totalElapsedSeconds / policySeconds) * 100);
  
  // Color coding logic
  const isExceeded = totalElapsedSeconds > policySeconds;
  const isNearEnd = totalElapsedSeconds > policySeconds - 600 && !isExceeded; // Last 10 mins
  
  const timerColorClass = isExceeded 
    ? 'text-destructive animate-pulse-subtle' 
    : isNearEnd 
      ? 'text-warning' 
      : 'text-success';

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {/* STATE 2: Checked In, Currently NOT on break */}
        {!status.isOnBreak && (
          <motion.div
            key="start-break"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`glass-card p-6 border-l-4 ${isExceeded ? 'border-l-destructive bg-destructive/5' : 'border-l-warning bg-warning/5'}`}
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                  isExceeded ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'
                }`}>
                  <Coffee className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {status.breakDurationMinutes > 0 ? '☕ Resume/Another Break' : '☕ Take Lunch Break'}
                  </h3>
                  <p className="text-sm text-muted-foreground font-body">
                    Used: <span className={`font-bold ${isExceeded ? 'text-destructive' : 'text-warning'}`}>{status.breakDurationMinutes}m</span> 
                    &nbsp;/ Limit: <span className="text-foreground font-bold">{status.policyDurationMinutes}m</span>
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleStartBreak}
                disabled={actionLoading}
                className={`${isExceeded ? 'glow-button-danger' : 'glow-button-warning'} flex items-center gap-3 px-8 shadow-xl disabled:opacity-50`}
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                {isExceeded ? 'START EXTRA BREAK' : 'START BREAK'}
              </button>
            </div>
          </motion.div>
        )}

        {/* STATE 3: Currently On Break */}
        {status.isOnBreak && (
          <motion.div
            key="on-break"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-8 border-primary/30 relative overflow-hidden"
          >
            {/* Background warning glow for exceeded state */}
            {isExceeded && (
              <div className="absolute inset-0 bg-destructive/5 animate-pulse" />
            )}

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="flex items-center gap-2 mb-6 bg-secondary/50 px-4 py-1.5 rounded-full border border-glass-border">
                <Clock className={`w-4 h-4 ${timerColorClass}`} />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Break Session Live</span>
              </div>

              <motion.div 
                key={Math.floor(totalElapsedSeconds)}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-6xl md:text-7xl font-mono font-bold tracking-tighter mb-4 ${timerColorClass}`}
              >
                {formatTime(totalElapsedSeconds)}
              </motion.div>

              <div className="w-full max-w-md space-y-3 mb-8">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <span>Allowed: {status.policyDurationMinutes}m</span>
                  <span>Total Used: {Math.floor(totalElapsedSeconds / 60)}m</span>
                </div>
                <Progress 
                  value={progressValue} 
                  className={`h-2.5 ${isExceeded ? 'bg-destructive/10' : ''}`}
                >
                  <div className={`h-full transition-all ${isExceeded ? 'bg-destructive' : isNearEnd ? 'bg-warning' : 'bg-success'}`} style={{ width: `${progressValue}%` }} />
                </Progress>
              </div>

              {isExceeded && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-destructive/10 border border-destructive/20 text-destructive px-6 py-3 rounded-xl flex items-center gap-3 mb-8 animate-shake"
                >
                  <AlertTriangle className="w-5 h-5" />
                  <p className="text-sm font-bold">
                    WARNING: Break limit exceeded! Please return immediately.
                  </p>
                </motion.div>
              )}

              <button
                onClick={handleEndBreak}
                disabled={actionLoading}
                className="glow-button flex items-center gap-3 px-12 py-4 text-lg font-bold shadow-2xl shadow-primary/20"
              >
                {actionLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Square className="w-6 h-6 fill-current" />}
                FINISH BREAK
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BreakTimer;
