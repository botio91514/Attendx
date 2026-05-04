import { useState, useEffect } from 'react';
import { parseDBDate } from '@/utils/dateUtils';

export const useClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateString = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return { now, timeString, dateString };
};

/**
 * 🚀 Centralized Working Timer Hook
 * Eliminates the 00:00:00 / 5.5-hour drift bug by using parseDBDate
 * Subtracts break time automatically if provided
 */
export const useWorkingTimer = (
  checkInTime: string | Date | null, 
  breaks: any[] = [], 
  isOnBreak: boolean = false, 
  breakStartTime: string | null = null
) => {
  const [elapsed, setElapsed] = useState('00:00:00');
  const [totalSeconds, setTotalSeconds] = useState(0);

  useEffect(() => {
    if (!checkInTime) {
      setElapsed('00:00:00');
      setTotalSeconds(0);
      return;
    }

    const calculate = () => {
      const now = new Date();
      
      // 🛡️ Step 1: Parse check-in safely (Ignore 'Z' to treat as Local Wall-Clock)
      const start = parseDBDate(checkInTime);
      if (!start) return;

      // 🛡️ Step 2: Calculate Gross Elapsed Time
      let grossSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);

      // 🛡️ Step 3: Handle active break (Freeze timer at break start)
      if (isOnBreak && breakStartTime) {
        const breakStart = parseDBDate(breakStartTime);
        if (breakStart) {
          grossSeconds = Math.floor((breakStart.getTime() - start.getTime()) / 1000);
        }
      }

      // 🛡️ Step 4: Deduct completed breaks
      let breakSeconds = 0;
      breaks.forEach(b => {
        if (typeof b === 'number') {
          breakSeconds += (b * 60);
        } else if (b.breakStart && b.breakEnd) {
          const s = parseDBDate(b.breakStart);
          const e = parseDBDate(b.breakEnd);
          if (s && e) {
            breakSeconds += Math.floor((e.getTime() - s.getTime()) / 1000);
          }
        }
      });

      const netSeconds = Math.max(0, grossSeconds - breakSeconds);
      setTotalSeconds(netSeconds);

      // 🛡️ Step 5: Format to HH:mm:ss
      const h = String(Math.floor(netSeconds / 3600)).padStart(2, '0');
      const m = String(Math.floor((netSeconds % 3600) / 60)).padStart(2, '0');
      const s = String(netSeconds % 60).padStart(2, '0');
      
      setElapsed(`${h}:${m}:${s}`);
    };

    calculate();
    const id = setInterval(calculate, 1000);
    return () => clearInterval(id);
  }, [checkInTime, breaks, isOnBreak, breakStartTime]);

  return { elapsed, totalSeconds };
};

// Legacy alias for compatibility
export const useElapsedTime = useWorkingTimer;
