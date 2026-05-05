import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Loader2, Search, Filter, Clock, User as UserIcon, Activity, ExternalLink, ShieldCheck, AlertCircle, UserCog, History } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface AuditEntry {
  _id: string;
  action: string;
  module: string;
  details: string;
  createdAt: string;
  before?: any;
  after?: any;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  };
  targetUser?: {
    name: string;
  };
  performedBy: {
    name: string;
    employeeId: string;
    role: string;
  };
}

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const AuditLogs: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [filter, setFilter] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    activeAdmins: 0,
    lastActivity: null as string | null
  });

  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const [filters, setFilters] = useState({
    module: '',
    startDate: '',
    endDate: ''
  });

  const fetchStats = async () => {
    try {
      const res = await api.get('/audit/stats');
      if (res.success) setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch audit stats', error);
    }
  };

  const fetchLogs = async (page = 1) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(filters.module && { module: filters.module }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      });
      
      const res = await api.get(`/audit?${queryParams.toString()}`);
      if (res.success) {
        setLogs(res.data.logs);
        setPagination(res.data.pagination);
      }
    } catch (error) {
      toast.error('Failed to retrieve security logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
    fetchStats();
  }, [filters]);

  const getActionStyle = (action: string) => {
    if (action.includes('DELETE')) return 'bg-destructive/10 text-destructive border-destructive/20';
    if (action.includes('UPDATE') || action.includes('UNLOCK')) return 'bg-warning/10 text-warning border-warning/20';
    if (action.includes('REGISTER') || action.includes('CREATE')) return 'bg-success/10 text-success border-success/20';
    return 'bg-primary/10 text-primary border-primary/20';
  };

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(filter.toLowerCase()) ||
    log.details.toLowerCase().includes(filter.toLowerCase()) ||
    log.performedBy?.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 pb-12">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" /> Security Audit Logs
          </h2>
          <p className="text-sm text-muted-foreground">Traceable history of all administrative mutations and policy changes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search action or user..." 
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="input-floating pl-10 h-10 w-48"
              />
           </div>
           
           <select 
             value={filters.module} 
             onChange={e => setFilters({...filters, module: e.target.value})}
             className="input-floating h-10 w-32 py-0 text-xs"
           >
              <option value="">All Modules</option>
              <option value="attendance">Attendance</option>
              <option value="leave">Leave</option>
              <option value="payroll">Payroll</option>
              <option value="settings">Settings</option>
              <option value="employee">Employee</option>
           </select>

           <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={filters.startDate}
                onChange={e => setFilters({...filters, startDate: e.target.value})}
                className="input-floating h-10 w-32 py-0 text-xs"
              />
              <span className="text-muted-foreground">-</span>
              <input 
                type="date" 
                value={filters.endDate}
                onChange={e => setFilters({...filters, endDate: e.target.value})}
                className="input-floating h-10 w-32 py-0 text-xs"
              />
           </div>

           <button onClick={() => { fetchLogs(1); fetchStats(); }} className="p-2.5 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
              <Activity className="w-4 h-4 text-muted-foreground" />
           </button>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<ShieldCheck />} 
          label="Total Security Events" 
          value={stats.total} 
          subtitle="All recorded actions" 
          accentClass="text-primary" 
        />
        <StatCard 
          icon={<AlertCircle />} 
          label="Critical Mutations" 
          value={stats.critical} 
          subtitle="Deletions & Policy Changes" 
          accentClass="text-destructive" 
        />
        <StatCard 
          icon={<UserCog />} 
          label="Active Auditors" 
          value={stats.activeAdmins} 
          subtitle="Admins active today" 
          accentClass="text-warning" 
        />
        <StatCard 
          icon={<History />} 
          label="Last System Activity" 
          value={stats.lastActivity ? formatDistanceToNow(new Date(stats.lastActivity), { addSuffix: true }) : 'No Activity'} 
          subtitle="Time since last entry" 
          accentClass="text-success" 
        />
      </motion.div>

      <motion.div variants={fadeUp} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-glass-border bg-secondary/30">
                {['Timestamp', 'Performed By', 'Action Type', 'Detailed Evidence'].map(h => (
                  <th key={h} className="text-[10px] font-bold text-muted-foreground px-5 py-4 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={4} className="py-20 text-center text-muted-foreground italic">No security logs found matching filters.</td></tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log._id} className="border-b border-glass-border hover:bg-secondary/10 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                       <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-foreground">{new Date(log.createdAt).toLocaleDateString()}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(log.createdAt).toLocaleTimeString()}</span>
                       </div>
                    </td>
                    <td className="px-5 py-4">
                       <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                            {log.performedBy?.name?.charAt(0) || '?'}
                          </div>
                          <div className="flex flex-col">
                             <span className="text-xs font-bold text-foreground">{log.performedBy?.name || 'Unknown User'}</span>
                             <span className="text-[9px] uppercase text-muted-foreground">
                               {log.performedBy?.employeeId || 'SYSTEM'} • {log.performedBy?.role || 'Service'}
                             </span>
                          </div>
                       </div>
                    </td>
                    <td className="px-5 py-4">
                       <div className="flex flex-col gap-1.5">
                          <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase border w-fit ${getActionStyle(log.action)}`}>
                             {log.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{log.module}</span>
                       </div>
                    </td>
                    <td className="px-5 py-4">
                       <div className="flex items-start justify-between gap-4">
                          <div className="flex flex-col gap-1.5">
                             <p className="text-xs text-foreground/80 leading-relaxed max-w-xl">
                               {log.details}
                               {log.targetUser && (
                                 <span className="ml-1 text-[10px] font-bold text-primary italic">
                                   — (Target: {log.targetUser.name})
                                 </span>
                               )}
                             </p>
                          </div>
                          {(log.before || log.after) && (
                            <button 
                              onClick={() => setSelectedLog(log)}
                              className="px-2 py-1 rounded bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-all flex items-center gap-1 shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" /> View Changes
                            </button>
                          )}
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Diff View Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
           >
              <div className="px-6 py-4 border-b border-glass-border flex justify-between items-center bg-secondary/30">
                 <div>
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                       <ShieldCheck className="w-5 h-5 text-success" /> Mutation Evidence: {selectedLog.action}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                       Logged at {new Date(selectedLog.createdAt).toLocaleString()} by {selectedLog.performedBy?.name || 'System'}
                    </p>
                 </div>
                 <button 
                   onClick={() => setSelectedLog(null)}
                   className="p-2 hover:bg-secondary rounded-lg transition-colors"
                 >
                    <AlertCircle className="w-5 h-5 text-muted-foreground rotate-45" />
                 </button>
              </div>

              <div className="flex-1 overflow-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-background/50">
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-destructive" /> PRE-MUTATION STATE
                    </h4>
                    <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/10 font-mono text-[10px] text-foreground/70 overflow-auto max-h-[50vh]">
                       <pre>{JSON.stringify(selectedLog.before || { message: "No data available" }, null, 2)}</pre>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-success" /> POST-MUTATION STATE
                    </h4>
                    <div className="p-4 rounded-xl bg-success/5 border border-success/10 font-mono text-[10px] text-foreground/70 overflow-auto max-h-[50vh]">
                       <pre>{JSON.stringify(selectedLog.after || { message: "No data available" }, null, 2)}</pre>
                    </div>
                 </div>
              </div>

              <div className="px-6 py-4 border-t border-glass-border bg-secondary/30 flex justify-between items-center">
                 <div className="flex gap-4">
                    <div className="flex flex-col">
                       <span className="text-[8px] font-bold text-muted-foreground uppercase">IP Address</span>
                       <span className="text-[10px] font-mono text-foreground">{selectedLog.metadata?.ipAddress || 'Unknown'}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[8px] font-bold text-muted-foreground uppercase">User Agent</span>
                       <span className="text-[10px] font-mono text-foreground truncate max-w-[300px]">{selectedLog.metadata?.userAgent || 'Unknown'}</span>
                    </div>
                 </div>
                 <button 
                   onClick={() => setSelectedLog(null)}
                   className="px-6 py-2 rounded-xl bg-secondary text-xs font-bold hover:bg-secondary/80 transition-all"
                 >
                    Close Evidence
                 </button>
              </div>
           </motion.div>
        </div>
      )}
      
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
           {Array.from({ length: pagination.pages }, (_, i) => (
             <button 
               key={i+1} 
               onClick={() => fetchLogs(i+1)}
               className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pagination.page === i+1 ? 'bg-primary text-white shadow-lg' : 'bg-card border border-glass-border hover:bg-secondary'}`}
             >
               {i+1}
             </button>
           ))}
        </div>
      )}
    </motion.div>
  );
};

export default AuditLogs;
