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
  details: string;
  timestamp: string;
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
      const res = await api.get(`/audit?page=${page}&limit=50`);
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
    fetchLogs();
    fetchStats();
  }, []);

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
        <div className="flex items-center gap-2">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Filter by action or user..." 
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="input-floating pl-10 h-10 w-64"
              />
           </div>
           <button onClick={() => { fetchLogs(); fetchStats(); }} className="p-2.5 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
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
          value={stats.lastActivity ? formatDistanceToNow(new Date(stats.lastActivity), { addSuffix: true }) : 'Never'} 
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
                          <span className="text-xs font-bold text-foreground">{new Date(log.timestamp).toLocaleDateString()}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(log.timestamp).toLocaleTimeString()}</span>
                       </div>
                    </td>
                    <td className="px-5 py-4">
                       <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">{log.performedBy?.name.charAt(0)}</div>
                          <div className="flex flex-col">
                             <span className="text-xs font-bold text-foreground">{log.performedBy?.name}</span>
                             <span className="text-[9px] uppercase text-muted-foreground">{log.performedBy?.employeeId} • {log.performedBy?.role}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-5 py-4">
                       <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase border ${getActionStyle(log.action)}`}>
                          {log.action.replace(/_/g, ' ')}
                       </span>
                    </td>
                    <td className="px-5 py-4">
                       <p className="text-xs text-foreground/80 leading-relaxed max-w-xl">{log.details}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
      
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
