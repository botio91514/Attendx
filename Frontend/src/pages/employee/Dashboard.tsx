import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StatCard from '@/components/StatCard';
import { useClock, useElapsedTime } from '@/hooks/useClock';
import { getStatusColor } from '@/utils/statusUtils';
import {
  CheckCircle2, Clock, CalendarDays, Palmtree, Play, Pause,
  Square, Coffee, Loader2, Activity, History, Info
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const { timeString } = useClock();
  const [status, setStatus] = useState<'idle' | 'working' | 'break' | 'completed'>('idle');
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [todayBreaks, setTodayBreaks] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({
    todayStatus: 'Not Checked In',
    checkInDisplay: '--:--',
    hoursWorked: '0h 0m',
    daysPresent: '0',
    leaveBalance: '0',
    holiday: null as string | null
  });
  const [upcomingHolidays, setUpcomingHolidays] = useState<any[]>([]);

  const [officeSettings, setOfficeSettings] = useState<any>(null);

  const elapsed = useElapsedTime(checkInTime, todayBreaks);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [todayRes, balanceRes, historyRes, settingsRes, holidayRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/leave/balance'),
        api.get('/attendance/history?limit=7'),
        api.get('/settings'),
        api.get('/holidays')
      ]);

      if (settingsRes.success) {
        setOfficeSettings(settingsRes.data);
      }

      if (holidayRes.success && Array.isArray(holidayRes.data)) {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayHoliday = holidayRes.data.find((h: any) => h.date.split('T')[0] === todayStr);
        if (todayHoliday) {
          setStats(prev => ({ ...prev, holiday: todayHoliday.title }));
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0); // Start of today to include today's holidays if they haven't passed
        const upcoming = holidayRes.data
          .filter((h: any) => new Date(h.date) > now)
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 3);
        setUpcomingHolidays(upcoming);
      }

      if (todayRes.success && todayRes.data && todayRes.data.attendance) {
        const attendance = todayRes.data.attendance;
        if (attendance.checkIn && !attendance.checkOut) {
          const lastBreak = attendance.breaks?.[attendance.breaks.length - 1];
          if (lastBreak && !lastBreak.breakEnd) {
            setStatus('break');
          } else {
            setStatus('working');
          }
          setCheckInTime(new Date(attendance.checkIn));
        } else if (attendance.checkOut) {
          setStatus('completed');
          setCheckInTime(null);
        } else {
          setStatus('idle');
          setCheckInTime(null);
        }

        setStats(prev => ({
          ...prev,
          todayStatus: attendance.status
            ? attendance.status.charAt(0).toUpperCase() + attendance.status.slice(1)
            : 'Not Checked In',
          checkInDisplay: attendance.checkIn ? new Date(attendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
        }));
        setTodayBreaks(attendance.breaks || []);
      }

      if (balanceRes.success && balanceRes.data && balanceRes.data.balance) {
        const casualRemaining = balanceRes.data.balance.casual.remaining;
        setStats(prev => ({
          ...prev,
          leaveBalance: casualRemaining.toString()
        }));
      }

      if (historyRes.success && historyRes.data && Array.isArray(historyRes.data.attendance)) {
        setHistory(historyRes.data.attendance);
        setStats(prev => ({
          ...prev,
          daysPresent: historyRes.data.pagination.total.toString()
        }));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const activities = useMemo(() => {
    const list: any[] = [];
    if (checkInTime) list.push({ type: 'Check-in', time: stats.checkInDisplay, icon: <Play className="w-3 h-3" />, color: 'text-success' });
    todayBreaks.forEach((b, i) => {
      list.push({ type: 'Break Start', time: new Date(b.breakStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), icon: <Pause className="w-3 h-3" />, color: 'text-warning' });
      if (b.breakEnd) {
        list.push({ type: 'Break End', time: new Date(b.breakEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), icon: <Coffee className="w-3 h-3" />, color: 'text-primary' });
      }
    });
    return list.reverse();
  }, [checkInTime, todayBreaks, stats.checkInDisplay]);

  // Actions
  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/checkin', {});
      if (res.success) {
        toast.success('Successfully checked in');
        fetchDashboardData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBreak = async () => {
    try {
      setActionLoading(true);
      const endpoint = status === 'break' ? '/attendance/break/end' : '/attendance/break/start';
      const res = await api.post(endpoint, {});
      if (res.success) {
        toast.success(status === 'break' ? 'Break ended' : 'Break started');
        fetchDashboardData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/checkout', {});
      if (res.success) {
        toast.success('Successfully checked out');
        fetchDashboardData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground animate-pulse">Establishing secure connection...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 pb-8">
      {/* Personalized Header */}
      <motion.div variants={fadeUp} className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner group overflow-hidden">
             {user?.avatar ? (
               <img src={user.avatar} alt="Profile" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
             ) : (
               <span className="text-2xl font-bold">{user?.name?.charAt(0) || 'U'}</span>
             )}
           </div>
           <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                 {(() => {
                   const hr = new Date().getHours();
                   if (hr < 12) return 'Good Morning';
                   if (hr < 17) return 'Good Afternoon';
                   return 'Good Evening';
                 })()}, <span className="text-primary">{user?.name?.split(' ')[0]}!</span>
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                 <CalendarDays className="w-4 h-4" /> 
                 {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
           </div>
        </div>
        <div className="hidden lg:block text-right">
           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Corporate ID</p>
           <p className="text-sm font-mono font-bold text-foreground bg-secondary/50 px-3 py-1 rounded-lg border border-glass-border">{user?.employeeId || 'GST-PRO'}</p>
        </div>
      </motion.div>

      {stats.holiday && (
        <motion.div variants={fadeUp} className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-primary">Happy {stats.holiday}!</h4>
            <p className="text-xs text-muted-foreground">Today is an official office holiday. Enjoy your day off!</p>
          </div>
        </motion.div>
      )}

      {/* Header Stat Row */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<CheckCircle2 />}
          label="Today Status"
          value={stats.todayStatus}
          subtitle={stats.todayStatus === 'Not Checked In' ? 'Awaiting start' : `Started at ${stats.checkInDisplay}`}
          accentClass={
            stats.todayStatus === 'Late' ? 'text-warning' :
              stats.todayStatus === 'Absent' ? 'text-destructive' :
                'text-success'
          }
        />
        <StatCard icon={<Clock />} label="Net Working Time" value={status !== 'idle' ? elapsed : '00:00:00'} subtitle={status === 'working' ? 'Tracking live' : status === 'break' ? 'Paused (Break)' : 'Standby'} accentClass="text-primary" />
        <StatCard icon={<CalendarDays />} label="Monthly Presence" value={stats.daysPresent} subtitle="Active workdays" accentClass="text-foreground" />
        <StatCard icon={<Palmtree />} label="Leave Credits" value={stats.leaveBalance} subtitle="Available casual leave" accentClass="text-warning" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Control Panel */}
        <motion.div variants={fadeUp} className="lg:col-span-2 space-y-6">
          <div className="glass-card p-8 relative overflow-hidden group">
            {/* Dynamic background glow */}
            <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] transition-colors duration-700 ${status === 'working' ? 'bg-success/20' : status === 'break' ? 'bg-warning/20' : 'bg-primary/10'
              }`} />

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="flex items-center gap-2 mb-4 bg-secondary/50 px-4 py-1 rounded-full border border-glass-border">
                <Activity className={`w-4 h-4 ${status === 'working' ? 'text-success animate-pulse' : 'text-muted-foreground'}`} />
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Session Live</span>
              </div>

              <p className="text-6xl md:text-7xl font-mono font-bold text-foreground tracking-tighter mb-4 drop-shadow-sm">{timeString}</p>

              <div className="flex flex-col items-center mb-10">
                <span className={`text-sm font-bold px-3 py-1 rounded-md mb-2 ${
                    status === 'working' ? 'bg-success/10 text-success' : 
                    status === 'break' ? 'bg-warning/10 text-warning' : 
                    status === 'completed' ? 'bg-primary/10 text-primary border border-primary/20' : 
                    'bg-secondary text-muted-foreground'
                  }`}>
                  {status === 'idle' ? 'STANDBY MODE' : status === 'working' ? 'CURRENTLY WORKING' : status === 'completed' ? 'SHIFT COMPLETED' : 'ON BREAK'}
                </span>
                {status !== 'idle' && status !== 'completed' && (
                  <p className="text-3xl font-mono font-bold text-primary">{elapsed}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-4 justify-center">
                <AnimatePresence mode="wait">
                  {actionLoading ? (
                    <div className="flex items-center gap-3 px-8 py-3 bg-secondary/50 rounded-xl border border-glass-border">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-sm font-medium">Processing...</span>
                    </div>
                  ) : status === 'completed' ? (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
                       <div className="flex items-center gap-3 px-10 py-4 bg-primary/10 text-primary rounded-xl border border-primary/30 font-bold shadow-lg shadow-primary/10 tracking-widest uppercase">
                         <CheckCircle2 className="w-6 h-6" /> Shift Logged For Today
                       </div>
                    </motion.div>
                  ) : status === 'idle' ? (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      onClick={handleCheckIn}
                      className="glow-button-success flex items-center gap-3 text-lg px-10 py-4 font-bold shadow-xl shadow-success/20"
                    >
                      <Play className="fill-current w-5 h-5" /> START WORKDAY
                    </motion.button>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-4 justify-center">
                      <button onClick={handleBreak} className="glow-button-warning flex items-center gap-2 px-6 py-3 font-semibold">
                        {status === 'break' ? <><Play className="w-5 h-5 fill-current" /> RESUME WORK</> : <><Coffee className="w-5 h-5" /> TAKE A BREAK</>}
                      </button>
                      <button onClick={handleCheckOut} className="glow-button-danger flex items-center gap-2 px-6 py-3 font-semibold">
                        <Square className="w-5 h-5 fill-current" /> FINISH DAY
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Sidebar Panel: Today's Activity & Insights */}
        <motion.div variants={fadeUp} className="space-y-6">
          <div className="glass-card p-6 flex-1 h-fit">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 rounded-lg bg-warning/10 text-warning"><History className="w-5 h-5" /></div>
              <h3 className="font-display font-bold text-foreground">Today's Activity</h3>
            </div>

            <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-glass-border">
              {activities.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-3 opacity-20">
                    <Activity className="w-6 h-6" />
                  </div>
                  <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                </div>
              ) : (
                activities.map((act, i) => (
                  <div key={i} className="relative pl-8 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-card border border-glass-border flex items-center justify-center z-10">
                      <div className={`w-2 h-2 rounded-full bg-current ${act.color}`} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-foreground">{act.type}</span>
                      <span className="text-xs font-mono text-muted-foreground italic">{act.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass-card p-5 bg-primary/5 border-primary/20">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground mb-1">On-time Perk</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Checking in before <span className="text-foreground font-bold">{officeSettings?.officeStartTime || '09:15'} AM</span> helps you maintain a perfect monthly attendance rate.
                </p>
              </div>
            </div>
          </div>

          {upcomingHolidays.length > 0 && (
            <div className="glass-card p-5 border-glass-border">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-success/10 text-success">
                  <Palmtree className="w-4 h-4" />
                </div>
                <h3 className="font-display font-bold text-foreground">Upcoming Holidays</h3>
              </div>
              <div className="space-y-3">
                {upcomingHolidays.map((holiday, idx) => {
                  const d = new Date(holiday.date);
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-glass-border group hover:bg-primary/5 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{holiday.title}</p>
                        <p className="text-xs text-muted-foreground">{d.toLocaleDateString([], { weekday: 'long' })}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-success bg-success/10 px-2.5 py-1 rounded-md">
                          {d.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default EmployeeDashboard;
