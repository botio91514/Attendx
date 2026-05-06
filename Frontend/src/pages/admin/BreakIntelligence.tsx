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
  Timer,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  User,
  History,
  ChevronDown,
  ChevronUp,
  Activity
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { getISTToday, formatISTTime, parseDBDate, getISTDateOnly } from '@/utils/dateUtils';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const BreakIntelligence: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalBreaks: 0,
    totalDurationMinutes: 0,
    averageBreakMinutes: 0,
    topUsers: [],
    policyLimit: 60
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0
  });

  const [filters, setFilters] = useState({
    from: getISTToday(),
    to: getISTToday(),
    employeeId: '',
    search: '',
    page: 1
  });

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${mins}m`;
    return `${mins}m (${h}h ${m}m)`;
  };

  const fetchBreaks = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (filters.from) query.append('from', filters.from);
      if (filters.to) query.append('to', filters.to);
      if (filters.employeeId) query.append('employeeId', filters.employeeId);
      if (filters.search) query.append('search', filters.search);
      query.append('page', filters.page.toString());
      query.append('limit', '20');

      const res = await api.get(`/attendance/admin/breaks?${query.toString()}`);
      if (res.success) {
        setRecords(res.data.breaks || []);
        setPagination(res.data.pagination || { page: 1, pages: 1, total: 0 });
        // Optional: If stats aren't aggregated by backend yet, we handle them or use existing ones.
        // For now, keeping stats from the previous structure if available.
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch (error) {
      toast.error('Failed to fetch break intelligence report');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchBreaks();
  }, [fetchBreaks]);

  const setPreset = (preset: string) => {
    const today = new Date();
    let from = getISTToday();
    let to = getISTToday();

    switch (preset) {
      case 'today':
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        from = yesterday.toISOString().split('T')[0];
        to = from;
        break;
      case '7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        from = sevenDaysAgo.toISOString().split('T')[0];
        break;
      case 'month':
        from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        break;
    }

    setFilters({ ...filters, from, to, page: 1 });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VIOLATION':
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Violation</span>
          </div>
        );
      case 'WARNING':
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Warning</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Policy</span>
          </div>
        );
    }
  };

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={{ show: { transition: { staggerChildren: 0.1 } } }} 
      className="space-y-6 pb-12"
      key="break-intel-root"
    >
      <motion.div key="header" variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Break Intelligence</h2>
          <p className="text-sm text-muted-foreground font-body">Attendance-centric break pattern analysis</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilters({ ...filters, from: getISTToday(), to: getISTToday(), employeeId: '', search: '' })}
            className="btn-secondary py-2"
          >
            Reset
          </button>
          <button onClick={fetchBreaks} className="nav-item p-2 border border-glass-border">
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </motion.div>

      {/* STATS GRID */}
      <motion.div key="stats-grid" variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          key="stat-total"
          icon={<History className="text-primary" />}
          label="Total Records"
          value={pagination.total}
          accentClass="text-primary"
          subtitle="Attendance Days"
        />
        <StatCard
          key="stat-avg"
          icon={<Timer className="text-warning" />}
          label="Average Duration"
          value={`${stats.averageBreakMinutes || 0}m`}
          accentClass="text-warning"
          subtitle={`Target: ${stats.policyLimit || 60}m`}
        />
        <StatCard
          key="stat-violations"
          icon={<AlertTriangle className="text-destructive" />}
          label="Policy Violations"
          value={stats.violationCount || 0}
          accentClass="text-destructive"
          subtitle="Filtered Set"
        />
        <StatCard
          key="stat-rest"
          icon={<TrendingDown className="text-success" />}
          label="Total Staff Rest"
          value={`${Math.round((stats.totalDurationMinutes || 0) / 60)}h`}
          accentClass="text-success"
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" key="main-content">
        {/* FILTERS PANEL */}
        <motion.div key="filters-panel" variants={fadeUp} className="lg:col-span-3 space-y-4">
          <div className="glass-card p-5 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" /> Filters
              </h3>
            </div>

            <div className="space-y-4">
              {/* PRESETS */}
              <div className="grid grid-cols-2 gap-2">
                {['today', 'yesterday', '7days', 'month'].map(p => (
                  <button
                    key={`preset-${p}`}
                    onClick={() => setPreset(p)}
                    className="text-[10px] font-bold uppercase tracking-wider py-1.5 px-2 rounded bg-secondary/50 hover:bg-primary/10 hover:text-primary transition-all border border-glass-border"
                  >
                    {p === '7days' ? 'Last 7D' : p}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Range</label>
                <div className="grid grid-cols-1 gap-2">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary opacity-50" />
                    <input
                      type="date"
                      value={filters.from}
                      onChange={e => setFilters({ ...filters, from: e.target.value, page: 1 })}
                      className="input-floating pl-10 py-2 text-xs"
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary opacity-50" />
                    <input
                      type="date"
                      value={filters.to}
                      onChange={e => setFilters({ ...filters, to: e.target.value, page: 1 })}
                      className="input-floating pl-10 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-glass-border">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Name or ID..."
                    value={filters.search}
                    className="input-floating pl-10"
                    onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* TOP USERS MINI-CARD */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Top Break Usage</h3>
            <div className="space-y-3">
              {stats.topUsers?.slice(0, 5).map((u: any, i: number) => (
                <div key={`topuser-${u.id || i}`} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-secondary flex items-center justify-center text-[9px] font-bold">
                      {i + 1}
                    </div>
                    <span className="text-xs font-medium text-foreground truncate max-w-[100px]">{u.name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-primary">
                    {u.total}m
                  </span>
                </div>
              ))}
              {(!stats.topUsers || stats.topUsers.length === 0) && (
                <p className="text-[10px] text-muted-foreground italic text-center py-2">No patterns detected</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* LOGS TABLE */}
        <motion.div key="logs-table-container" variants={fadeUp} className="lg:col-span-9 space-y-4">
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-glass-border">
                    <th className="text-left text-[10px] font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider">Employee</th>
                    <th className="text-left text-[10px] font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider text-center">Date</th>
                    <th className="text-left text-[10px] font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider">Total Duration</th>
                    <th className="text-left text-[10px] font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider text-center">Sessions</th>
                    <th className="text-left text-[10px] font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider text-center">Longest</th>
                    <th className="text-left text-[10px] font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border">
                  {loading && records.length === 0 ? (
                    <tr key="loading-row"><td colSpan={6} className="px-5 py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></td></tr>
                  ) : records.length === 0 ? (
                    <tr key="empty-row"><td colSpan={6} className="px-5 py-24 text-center text-muted-foreground font-body italic">No consolidated break logs found</td></tr>
                  ) : (
                    records.map((row: any, idx: number) => (
                      <tr 
                        key={`row-${row._id || idx}`}
                        className="hover:bg-secondary/10 transition-colors group border-b border-glass-border last:border-0"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-[10px] font-bold uppercase text-primary border border-primary/20 shrink-0">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-foreground truncate">{row.employee?.name || 'Unknown'}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{row.employee?.employeeId}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-muted-foreground text-center">{row.date}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${row.status === 'VIOLATION' ? 'text-red-500' : row.status === 'WARNING' ? 'text-orange-500' : 'text-emerald-500'}`}>
                              {formatDuration(row.totalDuration)}
                            </span>
                            <span className="text-[9px] text-muted-foreground uppercase tracking-tighter">Daily Aggregation</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="text-xs font-bold text-foreground bg-secondary/50 px-2.5 py-0.5 rounded-full border border-glass-border">
                            {row.sessionCount}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="text-xs font-mono text-muted-foreground">{row.longestBreak}m</span>
                        </td>
                        <td className="px-5 py-4">
                          {getStatusBadge(row.status)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="px-5 py-4 border-t border-glass-border flex items-center justify-between">
              <div className="flex flex-col">
                <p className="text-xs text-muted-foreground font-body">
                  Showing {records.length} of {pagination.total} records
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Attendance-centric consolidation active</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={filters.page === 1}
                  onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                  className="p-2 rounded-lg border border-glass-border disabled:opacity-30 hover:bg-secondary/50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold font-mono">
                  {filters.page} / {pagination.pages}
                </span>
                <button
                  disabled={filters.page === pagination.pages}
                  onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                  className="p-2 rounded-lg border border-glass-border disabled:opacity-30 hover:bg-secondary/50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default BreakIntelligence;
