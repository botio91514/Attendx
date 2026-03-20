import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import StatCard from '@/components/StatCard';
import { Download, Clock, Users, BarChart3, TrendingUp, Loader2, Calendar, Search, Filter, RotateCcw, ChevronLeft, ChevronRight, List, CheckCircle2, XCircle, Palmtree } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const DEPARTMENTS = ['Engineering', 'Design', 'Marketing', 'Human Resources', 'Finance', 'Operations', 'Sales'];

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  const [filters, setFilters] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
    department: '',
    search: '',
    status: 'all'
  });

  const fetchReport = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();

      if (viewMode === 'calendar' && selectedEmp) {
        const m = currentDate.getMonth() + 1;
        const y = currentDate.getFullYear();
        query.append('from', `${y}-${String(m).padStart(2, '0')}-01`);
        query.append('to', `${y}-${String(m).padStart(2, '0')}-31`);
        query.append('userId', selectedEmp._id);
      } else {
        if (filters.from) query.append('from', filters.from);
        if (filters.to) query.append('to', filters.to);
        if (filters.department) query.append('department', filters.department);
      }

      const res = await api.get(`/attendance/admin/report?${query.toString()}`);
      if (res.success) {
        const attendance = res.data.attendance || [];
        setData({
          ...res.data,
          attendance: attendance.filter((r: any) => r.userId?.role !== 'admin')
        });
      }
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [filters.from, filters.to, filters.department, viewMode, currentDate, selectedEmp?._id]);

  const filteredAttendance = useMemo(() => {
    if (!data?.attendance) return [];
    if (viewMode === 'calendar') return data.attendance;

    return data.attendance.filter((row: any) => {
      const matchesSearch = !filters.search ||
        row.userId?.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        row.userId?.employeeId?.toLowerCase().includes(filters.search.toLowerCase());

      const matchesStatus = filters.status === 'all' || row.status === filters.status;

      return matchesSearch && matchesStatus;
    });
  }, [data, filters.search, filters.status, viewMode]);

  const getStatusBadge = (status: string) => {
    const colors: any = {
      present: 'bg-success/10 text-success border-success/20',
      late: 'bg-warning/10 text-warning border-warning/20',
      absent: 'bg-destructive/10 text-destructive border-destructive/20',
      'half-day': 'bg-primary/10 text-primary border-primary/20',
      leave: 'bg-primary/10 text-primary border-primary/20'
    };
    return `px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${colors[status] || 'bg-secondary text-muted-foreground'}`;
  };

  const setDatePreset = (days: number) => {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFilters(prev => ({ ...prev, from, to }));
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-4 rounded-xl opacity-0"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const record = data?.attendance?.find((a: any) => a.date === dateStr);
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      let bgClass = "bg-secondary/5 border-glass-border/20";
      let IconNode = null;

      if (record) {
        if (record.status === 'present') { bgClass = "bg-success/5 border-success/20"; IconNode = <CheckCircle2 className="w-8 h-8 text-success/10 absolute inset-0 m-auto" />; }
        else if (record.status === 'absent') { bgClass = "bg-destructive/5 border-destructive/20"; IconNode = <XCircle className="w-8 h-8 text-destructive/10 absolute inset-0 m-auto" />; }
        else if (record.status === 'late') { bgClass = "bg-warning/5 border-warning/20"; IconNode = <Clock className="w-8 h-8 text-warning/10 absolute inset-0 m-auto" />; }
        else if (record.status === 'leave') { bgClass = "bg-primary/5 border-primary/20"; IconNode = <Palmtree className="w-8 h-8 text-primary/10 absolute inset-0 m-auto" />; }
      }

      days.push(
        <div key={d} className={`min-h-[100px] p-3 relative rounded-xl border transition-all ${bgClass} ${isToday ? 'ring-1 ring-primary shadow-lg shadow-primary/5' : ''}`}>
          <span className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{d}</span>
          {IconNode}
          {record && (
            <div className="mt-auto flex flex-col gap-1 z-10 relative">
              <span className={getStatusBadge(record.status)}>{record.status}</span>
              {record.checkIn && <span className="text-[10px] font-mono text-foreground">In: {new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-[10px] font-bold text-muted-foreground uppercase opacity-50 px-2 py-1">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>
      </div>
    );
  };

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 pb-12">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {viewMode === 'calendar' && (
            <button onClick={() => setViewMode('list')} className="p-2 hover:bg-secondary rounded-lg transition-colors border border-glass-border">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              {viewMode === 'calendar' ? `${selectedEmp?.name}'s Attendance` : 'Attendance Reports'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {viewMode === 'calendar' ? `Monthly history for ${selectedEmp?.employeeId}` : 'Comprehensive analytics for your staff performance'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {viewMode === 'calendar' ? (
            <div className="flex items-center bg-card border border-glass-border rounded-lg overflow-hidden shadow-sm">
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-secondary transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <div className="px-4 py-1.5 font-bold text-sm min-w-[140px] text-center border-x border-glass-border">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </div>
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-secondary transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          ) : (
            <>
              <button onClick={fetchReport} className="nav-item p-2" title="Refresh"><RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
              <button className="glow-button flex items-center gap-2 text-sm py-2 px-4 shadow-primary/10 transition-all"><Download className="w-4 h-4" /> Export CSV</button>
            </>
          )}
        </div>
      </motion.div>

      {viewMode === 'list' ? (
        <>
          <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
            {[{ label: 'Today', d: 0 }, { label: 'Yesterday', d: 1 }, { label: 'Last 7 Days', d: 7 }, { label: 'Last 30 Days', d: 30 }].map(p => (
              <button key={p.label} onClick={() => setDatePreset(p.d)} className="px-3 py-1.5 rounded-lg bg-secondary/50 text-xs font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all border border-glass-border">{p.label}</button>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 glass-card p-4">
            <div className="relative lg:col-span-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="Search employee..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} className="input-floating pl-10" />
            </div>

            <div className="flex items-center gap-2 lg:col-span-4">
              <div className="relative flex-1"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50" /><input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} className="input-floating pl-10 w-full font-mono text-xs" /></div>
              <span className="text-muted-foreground text-xs opacity-50 shrink-0">to</span>
              <div className="relative flex-1"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50" /><input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} className="input-floating pl-10 w-full font-mono text-xs" /></div>
            </div>

            <div className="lg:col-span-2">
              <select value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })} className="input-floating w-full bg-card">
                <option value="">Departments</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="lg:col-span-3">
              <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="input-floating w-full bg-card font-bold">
                <option value="all">All Statuses</option>
                <option value="present" className="text-success">Present</option>
                <option value="late" className="text-warning">Late</option>
                <option value="absent" className="text-destructive">Absent</option>
                <option value="half-day" className="text-primary">Half Day</option>
              </select>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<Users />} label="Record Count" value={filteredAttendance.length.toString()} accentClass="text-primary" />
            <StatCard icon={<Clock />} label="Avg Hours" value={data?.stats?.avgWorkingHours ? data.stats.avgWorkingHours.toFixed(1) + 'h' : '0h'} accentClass="text-success" />
            <StatCard icon={<BarChart3 />} label="Total Present" value={data?.stats?.present?.toString() || '0'} accentClass="text-foreground" />
            <StatCard icon={<TrendingUp />} label="On-Time Rate" value={data?.stats?.late != null && data?.attendance?.length > 0 ? (100 - (data.stats.late / data.attendance.length * 100)).toFixed(1) + '%' : '100%'} accentClass="text-warning" />
          </motion.div>

          <motion.div variants={fadeUp} className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-glass-border">
                    {['Employee', 'Date', 'Day', 'Check-in', 'Check-out', 'Hours', 'Status', 'Action'].map(h => (
                      <th key={h} className="text-left text-xs font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-5 py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></td></tr>
                  ) : filteredAttendance.length === 0 ? (
                    <tr><td colSpan={8} className="px-5 py-24 text-center text-muted-foreground">No records found</td></tr>
                  ) : (
                    filteredAttendance.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-glass-border hover:bg-secondary/20 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold uppercase text-primary border border-primary/20">{row.userId?.name?.charAt(0)}</div>
                            <div className="flex flex-col"><span className="text-sm font-bold text-foreground">{row.userId?.name}</span><span className="text-[10px] text-muted-foreground font-mono">{row.userId?.employeeId}</span></div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm font-mono text-foreground">{row.date}</td>
                        <td className="px-5 py-4 text-xs text-muted-foreground font-medium">{new Date(row.date).toLocaleDateString([], { weekday: 'long' })}</td>
                        <td className="px-5 py-4 text-sm font-mono text-foreground">{row.checkIn ? new Date(row.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                        <td className="px-5 py-4 text-sm font-mono text-foreground">{row.checkOut ? new Date(row.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                        <td className="px-5 py-4 text-sm font-mono text-foreground font-bold text-primary">{(row.totalWorkingHours / 60).toFixed(1)}h</td>
                        <td className="px-5 py-4"><span className={getStatusBadge(row.status)}>{row.status}</span></td>
                        <td className="px-5 py-4 text-right">
                          <button onClick={() => { setSelectedEmp(row.userId); setViewMode('calendar'); }} className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-all" title="Detailed Calendar View"><Calendar className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      ) : (
        <motion.div variants={fadeUp} className="glass-card p-4 sm:p-8 min-h-[500px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground mt-2 font-medium tracking-wide">Syncing Monthly Records...</p>
            </div>
          ) : renderCalendar()}
        </motion.div>
      )}
    </motion.div>
  );
};

export default Reports;
