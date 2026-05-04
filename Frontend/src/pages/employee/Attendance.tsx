import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getStatusColor } from '@/utils/statusUtils';
import EmptyState from '@/components/EmptyState';
import { Download, ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, List, CheckCircle2, XCircle, Clock, Palmtree } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatISTDate, formatISTTime, getISTToday } from '@/utils/dateUtils';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/admin');
    }
  }, [user, navigate]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const m = currentDate.getMonth() + 1;
      const y = currentDate.getFullYear();
      const res = await api.get(`/attendance/history?month=${m}&year=${y}&limit=31`);
      console.log('Attendance data received:', res.data.attendance);
      if (res.success && res.data && Array.isArray(res.data.attendance)) {
        setAttendance(res.data.attendance);
      }
    } catch (error) {
      console.error('Failed to fetch attendance', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [currentDate]);

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const getSummary = () => {
    let p = 0, a = 0, la = 0, le = 0, h = 0, hd = 0;
    
    attendance.forEach(row => {
      const isSunday = new Date(row.date).getDay() === 0;
      // Use the same priority logic as the UI
      const finalStatus = row.status === 'leave' ? 'leave' : isSunday ? 'holiday' : (row.status || 'absent');
      
      if (finalStatus === 'present') p++;
      else if (finalStatus === 'absent') a++;
      else if (finalStatus === 'late') la++;
      else if (finalStatus === 'leave') le++;
      else if (finalStatus === 'holiday') h++;
      else if (finalStatus === 'half-day') hd++;
    });
    
    return {
      present: p,
      absent: a,
      late: la,
      leave: le,
      holiday: h,
      halfDay: hd
    };
  };

  const summary = getSummary();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB');
  };

  const formatDay = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long' });
  };

  const formatTime = (timeStr: string | null) => {
    return formatISTTime(timeStr);
  };

  const formatWorkingHours = (minutes: number | null | undefined) => {
    if (!minutes) return '0h 0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const lastMonthDays = new Date(year, month, 0).getDate();

    const days = [];
    
    // Previous Month Days (Padding) — Show 30th/31st etc.
    for (let i = firstDay - 1; i >= 0; i--) {
      const pmDay = lastMonthDays - i;
      days.push(
        <div key={`prev-${pmDay}`} className="min-h-[100px] sm:min-h-[120px] p-2 md:p-3 relative rounded-2xl border border-glass-border/10 bg-secondary/5 opacity-30">
          <span className="absolute top-2 left-3 text-xs font-bold text-muted-foreground/30">{pmDay}</span>
        </div>
      );
    }

    // Current Month Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const record = attendance.find(a => a.date.startsWith(dateStr));
      const isToday = getISTToday() === dateStr;
      const isSunday = new Date(year, month, d).getDay() === 0;

      let bgClass = "bg-secondary/10 border-glass-border/30";
      let IconNode = null;

      // Primary Logic: Leave takes highest priority, followed by Sunday/Holiday
      if (record?.status === 'leave') { 
        bgClass = "bg-indigo-500/10 border-indigo-500/30 shadow-[inset_0_0_20px_rgba(var(--indigo-500),0.05)]"; 
        IconNode = <Palmtree className="w-10 h-10 text-indigo-500/20 absolute inset-0 m-auto pointer-events-none" />; 
      }
      else if (isSunday) {
        bgClass = "bg-indigo-500/10 border-indigo-500/30 shadow-[inset_0_0_20px_rgba(var(--indigo-500),0.05)]";
        IconNode = <span className="absolute inset-0 m-auto flex items-center justify-center opacity-20 pointer-events-none text-4xl">⭐</span>;
      }
      else if (record) {
        if (record.status === 'present') { 
          bgClass = "bg-success/10 border-success/30 shadow-[inset_0_0_20px_rgba(var(--success),0.05)]"; 
          IconNode = <CheckCircle2 className="w-8 h-8 text-success/20 absolute inset-0 m-auto pointer-events-none" />; 
        }
        else if (record.status === 'absent') { 
          bgClass = "bg-destructive/10 border-destructive/30 shadow-[inset_0_0_20px_rgba(var(--destructive),0.05)]"; 
          IconNode = <XCircle className="w-8 h-8 text-destructive/20 absolute inset-0 m-auto pointer-events-none" />; 
        }
        else if (record.status === 'late') { 
          bgClass = "bg-warning/10 border-warning/30 shadow-[inset_0_0_20px_rgba(var(--warning),0.05)]"; 
          IconNode = <Clock className="w-8 h-8 text-warning/20 absolute inset-0 m-auto pointer-events-none" />; 
        }
        else if (record.status === 'half-day') { 
          bgClass = "bg-primary/10 border-primary/30 shadow-[inset_0_0_20px_rgba(var(--primary),0.05)]"; 
          IconNode = <CheckCircle2 className="w-8 h-8 text-primary/20 absolute inset-0 m-auto pointer-events-none" />; 
        }
        else if (record.status === 'holiday') {
          bgClass = "bg-indigo-500/10 border-indigo-500/30 shadow-[inset_0_0_20px_rgba(var(--indigo-500),0.05)]";
          IconNode = <span className="absolute inset-0 m-auto flex items-center justify-center opacity-20 pointer-events-none text-4xl">⭐</span>;
        }
      }

      days.push(
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: d * 0.01 }} key={d} className={`min-h-[100px] sm:min-h-[120px] p-2 md:p-3 relative transition-all duration-300 rounded-2xl border group hover:scale-[1.03] hover:z-20 hover:shadow-2xl ${bgClass} ${isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}>
          <span className={`absolute top-2 left-3 text-xs md:text-sm font-bold z-10 ${isToday ? 'text-primary' : isSunday ? 'text-indigo-400' : 'text-foreground/70'}`}>{d}</span>

          {IconNode}

          {record || isSunday ? (
            <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1 z-10 w-fit max-w-full">
              {/* Detailed Status Label */}
              <div className="flex flex-col gap-0.5">
                <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded backdrop-blur-md w-fit truncate ${record?.status === 'leave' ? 'bg-indigo-500/40 text-white' : isSunday ? 'bg-indigo-500/40 text-white' : record?.status === 'present' ? 'bg-success/20 text-success' : record?.status === 'absent' ? 'bg-destructive/20 text-destructive' : record?.status === 'late' ? 'bg-warning/20 text-warning' : 'bg-primary/20 text-primary'}`}>
                  {record?.status === 'leave' ? (record?.leaveType || 'LEAVE') : 
                   isSunday && !record?.checkIn ? 'Holiday' : 
                   (record?.status || 'Absent')}
                </span>
                
                {/* Credit Value (1, 0.5, 0) */}
                {!isSunday && (
                  <span className="text-[8px] font-bold text-foreground/40 pl-1 uppercase tracking-tighter">
                    Value: {record?.status === 'present' || record?.status === 'late' ? '1.0' : 
                            record?.status === 'half-day' ? '0.5' : 
                            record?.status === 'leave' ? '0.0 (On Leave)' : '0.0'}
                  </span>
                )}
              </div>

              {record?.checkIn && (
                <span className="text-[9px] font-mono font-medium text-foreground/50 hidden sm:block pl-1">
                  In: {formatISTTime(record.checkIn)}
                </span>
              )}
            </div>
          ) : null}
        </motion.div>
      );
    }

    return (
      <div className="flex flex-col flex-1 gap-2">
        {/* Calendar Header Row */}
        <div className="grid grid-cols-7 gap-2 md:gap-3 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-secondary/30 rounded-xl p-2 text-center text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest">{day}</div>
          ))}
        </div>
        {/* Calendar Box Grid */}
        <div className="grid grid-cols-7 gap-2 md:gap-3 flex-1 pb-4">
          {days}
        </div>
      </div>
    );
  };

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Attendance History</h2>
          <p className="text-sm text-muted-foreground">Visualize and track your daily performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-secondary/50 rounded-lg p-1 border border-glass-border">
            <button onClick={() => setView('calendar')} className={`p-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${view === 'calendar' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <CalendarIcon className="w-4 h-4" /> <span className="hidden sm:inline">Calendar</span>
            </button>
            <button onClick={() => setView('list')} className={`p-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${view === 'list' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <List className="w-4 h-4" /> <span className="hidden sm:inline">List</span>
            </button>
          </div>

          <div className="flex items-center bg-card border border-glass-border rounded-lg overflow-hidden shrink-0">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-secondary/50 hover:text-primary transition-colors disabled:opacity-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 font-bold text-sm min-w-[120px] text-center">
              {currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
            </div>
            <button onClick={handleNextMonth} disabled={currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear()} className="p-2 hover:bg-secondary/50 hover:text-primary transition-colors disabled:opacity-20">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={() => {
              const m = currentDate.getMonth() + 1;
              const y = currentDate.getFullYear();
              const from = `${y}-${String(m).padStart(2, '0')}-01`;
              const lastDay = new Date(y, m, 0);
              const to = formatISTDate(lastDay);
              window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/export/attendance/all/csv?from=${from}&to=${to}`, '_blank');
            }}
            className="glow-button flex items-center justify-center gap-2 text-sm py-2 shrink-0"
          >
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </motion.div>

      {/* Primary Summary Metrics */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card p-5 border-success/20 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-success/10 rounded-full blur-2xl group-hover:bg-success/20 transition-colors" />
          <div className="flex flex-col relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Present</span>
            </div>
            <p className="text-4xl font-mono font-bold text-foreground relative z-10 drop-shadow-sm">{summary.present}</p>
          </div>
        </div>
        <div className="glass-card p-5 border-destructive/20 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-destructive/10 rounded-full blur-2xl group-hover:bg-destructive/20 transition-colors" />
          <div className="flex flex-col relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-destructive" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Absent</span>
            </div>
            <p className="text-4xl font-mono font-bold text-foreground relative z-10 drop-shadow-sm">{summary.absent}</p>
          </div>
        </div>
        <div className="glass-card p-5 border-warning/20 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-warning/10 rounded-full blur-2xl group-hover:bg-warning/20 transition-colors" />
          <div className="flex flex-col relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-warning" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Late</span>
            </div>
            <p className="text-4xl font-mono font-bold text-foreground relative z-10 drop-shadow-sm">{summary.late}</p>
          </div>
        </div>
        <div className="glass-card p-5 border-indigo-500/20 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors" />
          <div className="flex flex-col relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Palmtree className="w-5 h-5 text-indigo-500" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Leave</span>
            </div>
            <p className="text-4xl font-mono font-bold text-foreground relative z-10 drop-shadow-sm">{summary.leave}</p>
          </div>
        </div>
        <div className="glass-card p-5 border-primary/20 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors" />
          <div className="flex flex-col relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Half-Day</span>
            </div>
            <p className="text-4xl font-mono font-bold text-foreground relative z-10 drop-shadow-sm">{summary.halfDay}</p>
          </div>
        </div>
        <div className="glass-card p-5 border-indigo-500/20 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors" />
          <div className="flex flex-col relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-indigo-500 text-lg">⭐</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Holidays</span>
            </div>
            <p className="text-4xl font-mono font-bold text-foreground relative z-10 drop-shadow-sm">{summary.holiday}</p>
          </div>
        </div>
      </motion.div>

      {/* Display Area */}
      <motion.div variants={fadeUp} className={`glass-card min-h-[400px] flex flex-col overflow-visible ${view === 'calendar' ? 'p-2 sm:p-6 !bg-transparent !border-none !shadow-none' : ''}`}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[300px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-2">Loading history...</p>
          </div>
        ) : view === 'calendar' ? (
          renderCalendar()
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full">
              <thead>
                <tr className="border-b border-glass-border">
                  {['Date', 'Day', 'Check-in', 'Check-out', 'Hours', 'Breaks', 'Status'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3 uppercase tracking-wider bg-secondary/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attendance.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-16"><EmptyState /></td></tr>
                ) : (
                  attendance.map((row, i) => {
                    const isSunday = new Date(row.date).getDay() === 0;
                    const displayStatus = row.status === 'leave' ? (row.leaveType || 'LEAVE') : 
                                         isSunday && !row.checkIn ? 'Holiday' : 
                                         (row.status || 'Absent');
                    
                    return (
                      <tr key={i} className="border-b border-glass-border hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-4 text-sm font-mono text-foreground font-semibold">{formatDate(row.date)}</td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{formatDay(row.date)}</td>
                        <td className="px-4 py-4 text-sm font-mono text-foreground">{formatTime(row.checkIn)}</td>
                        <td className="px-4 py-4 text-sm font-mono text-muted-foreground">{formatTime(row.checkOut)}</td>
                        <td className="px-4 py-4 text-sm font-mono text-foreground">{formatWorkingHours(row.totalWorkingHours)}</td>
                        <td className="px-4 py-4 text-sm font-mono text-muted-foreground">{row.totalBreakTime || 0} min</td>
                        <td className="px-4 py-4">
                          <span className={`${getStatusColor(isSunday ? 'holiday' : row.status)} px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider`}>
                            {displayStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AttendancePage;
