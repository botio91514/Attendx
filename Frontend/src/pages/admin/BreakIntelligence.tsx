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
  History
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { getISTToday, formatISTTime, parseDBDate } from '@/utils/dateUtils';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const BreakIntelligence: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [breaks, setBreaks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalBreaks: 0,
    totalDurationMinutes: 0,
    averageBreakMinutes: 0,
    topUsers: [],
    policyLimit: 30
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0
  });

  const [filters, setFilters] = useState({
    startDate: '', // Default to last 7 days in backend
    endDate: getISTToday(),
    department: 'All',
    userId: '',
    search: '',
    page: 1
  });

  const [policyLimit] = useState(60); // Standard break policy

  const fetchBreaks = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (filters.startDate) query.append('startDate', filters.startDate);
      if (filters.endDate) query.append('endDate', filters.endDate);
      if (filters.department !== 'All') query.append('department', filters.department);
      if (filters.userId) query.append('userId', filters.userId);
      if (filters.search) query.append('search', filters.search);
      query.append('page', filters.page.toString());
      query.append('limit', '50');

      const res = await api.get(`/attendance/admin/breaks?${query.toString()}`);
      if (res.success) {
        setBreaks(res.data.breaks || []);
        setStats(res.data.stats || {});
        setPagination(res.data.pagination || { page: 1, pages: 1, total: 0 });
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

  const getStatusBadge = (b: any) => {
    if (b.status === 'ongoing') {
      return (
        <span className="status-badge bg-warning/10 text-warning border border-warning/20 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-warning mr-1"></span>
          Live
        </span>
      );
    }
    if (b.duration > policyLimit) {
      return (
        <span className="status-badge bg-destructive/10 text-destructive border border-destructive/20">
          ⚠️ Violation
        </span>
      );
    }
    return (
      <span className="status-badge bg-success/10 text-success border border-success/20">
        ✅ Policy
      </span>
    );
  };

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 pb-12">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Break Intelligence</h2>
          <p className="text-sm text-muted-foreground font-body">Deep analysis of staff break patterns and compliance history</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilters({ ...filters, startDate: '', endDate: getISTToday(), department: 'All', userId: '' })}
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
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<History className="text-primary" />}
          label="Total Break Sessions"
          value={stats.totalBreaks}
          accentClass="text-primary"
          subtitle="Selected Period"
        />
        <StatCard
          icon={<Timer className="text-warning" />}
          label="Avg Break Time"
          value={`${stats.averageBreakMinutes}m`}
          accentClass="text-warning"
          subtitle={`Target: ${stats.policyLimit || 30}m`}
        />
        <StatCard
          icon={<AlertTriangle className="text-destructive" />}
          label="Excessive Breaks"
          value={breaks.filter(b => b.duration > policyLimit).length}
          accentClass="text-destructive"
        />
        <StatCard
          icon={<TrendingDown className="text-success" />}
          label="Total Hours Rest"
          value={`${Math.round(stats.totalDurationMinutes / 60)}h`}
          accentClass="text-success"
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FILTERS PANEL */}
        <motion.div variants={fadeUp} className="lg:col-span-3 space-y-4">
          <div className="glass-card p-5 space-y-6">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" /> Filters
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50" />
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={e => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
                    className="input-floating pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50" />
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={e => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
                    className="input-floating pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Department</label>
                <select
                  value={filters.department}
                  onChange={e => setFilters({ ...filters, department: e.target.value, page: 1 })}
                  className="input-floating"
                >
                  <option value="All">All Departments</option>
                  {['Sales', 'Tech', 'HR', 'Marketing', 'Operations'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Employee Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Enter Name..."
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
              {stats.topUsers?.map((u: any, i: number) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-[10px] font-bold">
                      {i + 1}
                    </div>
                    <span className="text-xs font-medium text-foreground truncate max-w-[100px]">{u.name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-primary group-hover:scale-110 transition-transform">
                    {Math.round(u.total)}m
                  </span>
                </div>
              ))}
              {(!stats.topUsers || stats.topUsers.length === 0) && (
                <p className="text-[10px] text-muted-foreground italic text-center py-2">No patterns detected yet</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* LOGS TABLE */}
        <motion.div variants={fadeUp} className="lg:col-span-9 space-y-4">
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-glass-border">
                    {['Date', 'Employee', 'Time Log', 'Duration', 'Status'].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border">
                  {loading && breaks.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></td></tr>
                  ) : breaks.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-24 text-center text-muted-foreground font-body italic">No break logs found for selected filters</td></tr>
                  ) : (
                    breaks.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-secondary/20 transition-colors group">
                        <td className="px-5 py-4 text-xs font-mono text-muted-foreground">{row.date}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold uppercase text-primary border border-primary/20 shrink-0">
                              <User className="w-3 h-3" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-foreground truncate">{row.employeeName}</span>
                              <span className="text-[10px] text-muted-foreground">{row.department}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-foreground">{formatISTTime(parseDBDate(row.startTime))}</span>
                            <span className="text-muted-foreground opacity-30">→</span>
                            <span className={row.status === 'ongoing' ? 'text-warning font-bold animate-pulse' : 'text-foreground'}>
                              {row.status === 'ongoing' ? 'LIVE' : formatISTTime(parseDBDate(row.endTime))}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm px-2 py-1 rounded-full font-bold ${row.duration > (stats.policyLimit || 30)
                                ? 'bg-red-50 text-red-600'
                                : 'bg-green-50 text-green-600'
                              }`}>
                              {row.duration}m
                            </span>
                            {row.duration > (stats.policyLimit || 30) && (
                              <span className="text-[10px] uppercase font-bold text-red-500 animate-pulse">
                                Violation
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {row.duration > stats.policyLimit ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-danger/10 text-danger border border-danger/20">
                              <AlertTriangle className="w-3 h-3" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Violation</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 text-success border border-success/20">
                              <CheckCircle2 className="w-3 h-3" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Policy</span>
                            </div>
                          )}
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
                  Showing {breaks.length} of {pagination.total} records
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Target: {stats.policyLimit}m</p>
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
