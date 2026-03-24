import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw, Search, Loader2 } from 'lucide-react';
import { useClock } from '@/hooks/useClock';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const LiveAttendance: React.FC = () => {
  const { timeString } = useClock();
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<any[]>([]);

  const fetchLiveAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/attendance/admin/all?date=${selectedDate}&limit=100`);
      if (res.success && Array.isArray(res.data.attendance)) {
        setRecords(res.data.attendance);
      }
    } catch (error) {
      toast.error('Failed to load live attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveAttendance();
  }, [selectedDate]);

  const filtered = records.filter(r =>
    (dept === 'All' || r.userId?.department === dept) &&
    (r.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.userId?.employeeId?.toLowerCase().includes(search.toLowerCase()))
  );

  const departments = ['All', ...new Set(records.map(r => r.userId?.department).filter(Boolean))];

  const getStatusBadge = (status: string) => {
    const colors: any = {
      present: 'bg-success/10 text-success border-success/20',
      late: 'bg-warning/10 text-warning border-warning/20',
      absent: 'bg-destructive/10 text-destructive border-destructive/20',
      'half-day': 'bg-primary/10 text-primary border-primary/20',
      leave: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
    };
    return `px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${colors[status] || 'bg-secondary text-muted-foreground'}`;
  };

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Live Attendance</h2>
          <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
            {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-floating text-xs w-auto py-1.5 px-3 uppercase font-bold text-muted-foreground"
          />
          <button onClick={fetchLiveAttendance} className="nav-item p-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="glow-button flex items-center gap-2 text-sm py-2"><Download className="w-4 h-4" /> Export</button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-floating pl-10"
            placeholder="Search employee..."
          />
        </div>
        <select value={dept} onChange={e => setDept(e.target.value)} className="input-floating w-auto px-4 py-2 bg-card">
          {departments.map(d => <option key={d}>{d}</option>)}
        </select>
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeUp} className="glass-card overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Refreshing live feed...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-glass-border">
                  {['Employee', 'Department', 'Check-in', 'Check-out', 'Breaks', 'Status'].map(h => (
                    <th key={h} className="text-left text-xs font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-20 text-center text-muted-foreground">
                      No matching employee records found for {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, i) => (
                    <tr key={i} className={`border-b border-glass-border hover:bg-secondary/30 transition-colors group ${row.isVirtual ? 'opacity-80' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold uppercase border shadow-sm ${row.status === 'present' ? 'bg-success/20 text-success border-success/30' : row.status === 'late' ? 'bg-warning/20 text-warning border-warning/30' : row.status === 'leave' ? 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                            {row.userId?.name?.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-foreground font-bold">{row.userId?.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{row.userId?.employeeId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground font-medium">{row.userId?.department}</td>
                      <td className="px-5 py-4 text-sm font-mono text-foreground">
                        {row.checkIn ? new Date(row.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                         row.status === 'leave' ? <span className="text-[10px] italic">ON LEAVE</span> : '--:--'}
                      </td>
                      <td className="px-5 py-4 text-sm font-mono text-foreground">
                        {row.checkOut ? new Date(row.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </td>
                      <td className="px-5 py-4 text-sm font-mono text-muted-foreground">
                        {row.breaks?.length || 0} breaks
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={getStatusBadge(row.status)}>{row.status}</span>
                          {row.leaveType && <span className="text-[9px] uppercase font-bold text-muted-foreground/60 pl-1">{row.leaveType}</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default LiveAttendance;
