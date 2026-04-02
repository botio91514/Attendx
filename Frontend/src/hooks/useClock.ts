import { useState, useEffect } from 'react';

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

export const useElapsedTime = (startTime: Date | null, breaks: any[] = [], isOnBreak: boolean = false, breakStartTime: string | null = null) => {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!startTime) {
      setElapsed('00:00:00');
      return;
    }

    const calculateSnapshot = () => {
      const now = new Date();
      
      // Calculate raw elapsed since check-in
      let totalElapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

      // Handle active break pausing (Fix: freeze the timer completely)
      if (isOnBreak) {
        // Use provided start time, or fallback to current 'now' (freeze point)
        const freezeDate = breakStartTime ? new Date(breakStartTime) : now;
        totalElapsedSeconds = Math.floor((freezeDate.getTime() - startTime.getTime()) / 1000);
      }

      // Calculate total duration of all COMPLETED breaks inside the breaks array
      let completedBreakSeconds = 0;
      breaks.forEach(b => {
         // Handle both old array format and simple total minutes if passed
         if (typeof b === 'number') {
           completedBreakSeconds += (b * 60);
         } else if (b.breakStart && b.breakEnd) {
           completedBreakSeconds += Math.floor((new Date(b.breakEnd).getTime() - new Date(b.breakStart).getTime()) / 1000);
         }
      });

      const netWorkingSeconds = Math.max(0, totalElapsedSeconds - completedBreakSeconds);
      
      const h = String(Math.floor(netWorkingSeconds / 3600)).padStart(2, '0');
      const m = String(Math.floor((netWorkingSeconds % 3600) / 60)).padStart(2, '0');
      const s = String(netWorkingSeconds % 60).padStart(2, '0');
      
      setElapsed(`${h}:${m}:${s}`);
    };

    calculateSnapshot();
    const id = setInterval(calculateSnapshot, 1000);
    return () => clearInterval(id);
  }, [startTime, breaks, isOnBreak, breakStartTime]);

  return elapsed;
};
