import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StatCard from '@/components/StatCard';
import {
  Coffee,
  Clock,
  AlertTriangle,
  Calendar,
  Search,
  Filter,
  RotateCcw,
  Loader2,
  CheckCircle2,
  Users,
  Timer
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { getISTToday, formatISTTime } from '@/utils/dateUtils';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const AdminBreakHistory: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [breaks, setBreaks] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalToday: 0,
    activeCount: 0,
    exceededCount: 0,
    avgDuration: 0
  });
  const [policyLimit, setPolicyLimit] = useState(60);

  const [filters, setFilters] = useState({
    date: getISTToday(),
    employeeId: '',
    exceededOnly: false
  });

  const fetchBreaks = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (filters.date) query.append('date', filters.date);
      if (filters.employeeId) query.append('employeeId', filters.employeeId);
      if (filters.exceededOnly) query.append('exceededOnly', 'true');

      const res = await api.get(`/attendance/admin/breaks?${query.toString()}`);
      if (res.success) {
        setBreaks(res.data.breaks || []);
        if (res.data.policyLimit) setPolicyLimit(res.data.policyLimit);

        // Calculate basic stats for display
        const total = res.data.breaks.length;
        const active = res.data.breaks.filter((b: any) => b.break.isOnBreak).length;
        const currentLimit = res.data.policyLimit || policyLimit;
        const exceeded = res.data.breaks.filter((b: any) => b.break.durationMinutes > currentLimit).length;
        const completed = res.data.breaks.filter((b: any) => !b.break.isOnBreak);
        const avg = completed.length > 0
          ? completed.reduce((acc: number, curr: any) => acc + (curr.break.durationMinutes || 0), 0) / completed.length
          : 0;

        setStats({
          totalToday: total,
          activeCount: active,
          exceededCount: exceeded,
          avgDuration: Math.round(avg)
        });
      }
    } catch (error) {
      toast.error('Failed to fetch break history');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchBreaks();
    const interval = setInterval(fetchBreaks, 30000); // Auto-refresh for live status
    return () => clearInterval(interval);
  }, [fetchBreaks]);

  const activeBreaks = breaks.filter(b => b.break.isOnBreak);

  const getStatusBadge = (b: any) => {
    if (b.break.isOnBreak) {
      return (
        <span className="status-badge bg-warning/10 text-warning border border-warning/20 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-warning mr-1"></span>
          Active
        </span>
      );
    }
    if (b.break.durationMinutes > policyLimit) {
      return (
        <span className="status-badge bg-destructive/10 text-destructive border border-destructive/20">
          ⚠️ Exceeded
        </span>
      );
    }
    return (
      <span className="status-badge bg-success/10 text-success border border-success/20">
        ✅ Within Policy
      </span>
    );
  };

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 pb-12">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Break Track</h2>
          <p className="text-sm text-muted-foreground font-body">Monitor staff lunch breaks and policy compliance in real-time</p>
        </div>
        <button onClick={fetchBreaks} className="nav-item p-2 border border-glass-border">
          <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* STATS ROW */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Coffee />} label="Total Breaks (Selected Day)" value={stats.totalToday} accentClass="text-primary" />
        <StatCard icon={<Timer />} label="Currently On Break" value={stats.activeCount} accentClass="text-warning" subtitle="Real-time count" />
        <StatCard icon={<AlertTriangle />} label="Policy Violations" value={stats.exceededCount} accentClass="text-destructive" />
        <StatCard icon={<Clock />} label="Avg Duration" value={`${stats.avgDuration}m`} accentClass="text-success" />
      </motion.div>

      {/* LIVE SECTION */}
      {activeBreaks.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning animate-pulse"></span>
            Currently On Break
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeBreaks.map((b, i) => {
              const nowIST = new Date().getTime() + (5.5 * 60 * 60 * 1000);
              const startTime = new Date(b.break.startTime).getTime();
              const elapsed = Math.floor((nowIST - startTime) / 60000);
              const exceeded = elapsed > policyLimit;
              return (
                <motion.div
                  key={i}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`glass-card p-4 flex items-center gap-4 border-l-4 ${exceeded ? 'border-l-destructive shadow-lg shadow-destructive/10' : 'border-l-warning'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-glass-border shrink-0">
                    {b.userId?.avatar ? <img src={b.userId.avatar} alt="" className="w-full h-full object-cover" /> : b.userId?.name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate text-foreground">{b.userId?.name}</p>
                    <p className={`text-xs font-mono font-bold ${exceeded ? 'text-destructive' : 'text-warning'}`}>
                      {elapsed}m elapsed
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* FILTERS */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-12 gap-4 glass-card p-4">
        <div className="relative md:col-span-4">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50" />
          <input
            type="date"
            value={filters.date}
            onChange={e => setFilters({ ...filters, date: e.target.value })}
            className="input-floating pl-10"
          />
        </div>
        <div className="relative md:col-span-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employee ID..."
            value={filters.employeeId}
            onChange={e => setFilters({ ...filters, employeeId: e.target.value })}
            className="input-floating pl-10"
          />
        </div>
        <div className="flex items-center gap-3 md:col-span-3 px-2">
          <input
            type="checkbox"
            id="exceededOnly"
            checked={filters.exceededOnly}
            onChange={e => setFilters({ ...filters, exceededOnly: e.target.checked })}
            className="w-4 h-4 rounded border-glass-border bg-secondary text-primary focus:ring-primary h-4 w-4"
          />
          <label htmlFor="exceededOnly" className="text-sm font-bold text-muted-foreground cursor-pointer select-none">
            Violations Only
          </label>
        </div>
      </motion.div>

      {/* TABLE */}
      <motion.div variants={fadeUp} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-glass-border">
                {['Employee', 'Department', 'Start (IST)', 'End (IST)', 'Duration', 'Status', 'Over'].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {loading && breaks.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></td></tr>
              ) : breaks.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-24 text-center text-muted-foreground font-body italic">No break logs found for this filter</td></tr>
              ) : (
                breaks.map((row: any, i: number) => {
                  const b = row.break;
                  return (
                    <tr key={i} className="hover:bg-secondary/20 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold uppercase text-primary border border-primary/20 shrink-0">
                            {row.userId?.avatar ? <img src={row.userId.avatar} className="w-full h-full object-cover rounded-full" alt="" /> : row.userId?.name?.charAt(0)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-foreground truncate">{row.userId?.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{row.userId?.employeeId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-muted-foreground">{row.userId?.department || '--'}</td>
                      <td className="px-5 py-4 text-xs font-mono text-foreground">
                        {formatISTTime(b.startTime)}
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-foreground">
                        {b.isOnBreak ? <span className="text-warning">On Break 🔴</span> : b.endTime ? formatISTTime(b.endTime) : '--'}
                      </td>
                      <td className="px-5 py-4 text-sm font-mono font-bold text-primary">
                        {b.isOnBreak ? '--' : `${b.durationMinutes}m`}
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(row)}</td>
                      <td className="px-5 py-4">
                        {b.durationMinutes > policyLimit && (
                          <span className="text-xs font-bold text-destructive font-mono">
                            +{b.durationMinutes - policyLimit}m
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminBreakHistory;
