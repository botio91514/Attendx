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

export const useElapsedTime = (startTime: Date | null, breaks: any[] = []) => {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!startTime) {
      setElapsed('00:00:00');
      return;
    }

    const calculate = () => {
      const now = Date.now();
      let totalMs = now - startTime.getTime();

      // Subtract duration of completed breaks
      let breakMs = 0;
      let onBreak = false;
      let currentBreakStart = 0;

      breaks.forEach(b => {
        const start = new Date(b.breakStart).getTime();
        if (b.breakEnd) {
          breakMs += (new Date(b.breakEnd).getTime() - start);
        } else {
          onBreak = true;
          currentBreakStart = start;
        }
      });

      if (onBreak) {
        // If currently on break, the elapsed time should be fixed at (breakStart - startTime - previousBreaks)
        totalMs = currentBreakStart - startTime.getTime();
      }

      const diff = Math.floor((totalMs - breakMs) / 1000);
      const h = String(Math.floor(diff / 3600)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    };

    calculate();
    const id = setInterval(calculate, 1000);
    return () => clearInterval(id);
  }, [startTime, breaks]);

  return elapsed;
};
