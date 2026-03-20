import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStatusColor } from '@/utils/statusUtils';
import EmptyState from '@/components/EmptyState';
import { Plus, X, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const tabs = ['All', 'Pending', 'Approved', 'Rejected'] as const;

const LeavesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('All');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    type: 'casual',
    startDate: '',
    endDate: '',
    reason: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [leavesRes, balanceRes] = await Promise.all([
        api.get('/leave/my'),
        api.get('/leave/balance')
      ]);

      if (leavesRes.success && leavesRes.data && Array.isArray(leavesRes.data.leaves)) {
        setLeaves(leavesRes.data.leaves);
      }
      if (balanceRes.success && balanceRes.data && balanceRes.data.balance) {
        const b = balanceRes.data.balance;
        const balanceArray = [
          { type: 'Casual Leave', total: b.casual.total, remaining: b.casual.remaining },
          { type: 'Sick Leave', total: b.sick.total, remaining: b.sick.remaining },
          { type: 'Earned Leave', total: b.earned.total, remaining: b.earned.remaining }
        ];
        setBalances(balanceArray);
      }
    } catch (error) {
      console.error('Failed to fetch leave data', error);
      toast.error('Failed to load leave records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = Array.isArray(leaves) 
    ? (activeTab === 'All' 
        ? leaves 
        : leaves.filter(l => l.status.toLowerCase() === activeTab.toLowerCase()))
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitLoading(true);
      const res = await api.post('/leave/apply', {
        leaveType: formData.type,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason
      });
      if (res.success) {
        toast.success('Leave application submitted');
        setDrawerOpen(false);
        fetchData();
        setFormData({ type: 'casual', startDate: '', endDate: '', reason: '' });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await api.put(`/leave/cancel/${id}`, {});
      if (res.success) {
        toast.success('Leave cancelled successfully');
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel leave');
    }
  };

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">My Leaves</h2>
          <p className="text-sm text-muted-foreground">Manage your leave applications</p>
        </div>
        <button onClick={() => setDrawerOpen(true)} className="glow-button flex items-center gap-2 text-sm py-2">
          <Plus className="w-4 h-4" /> Apply Leave
        </button>
      </motion.div>

      {/* Balance Cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {balances.map((lb, i) => {
          const used = lb.total - lb.remaining;
          const data = [
             { name: 'Remaining', value: lb.remaining },
             { name: 'Used', value: used }
          ];
          
          const primaryColor = lb.type === 'Casual Leave' ? 'hsl(244,94%,69%)' : lb.type === 'Sick Leave' ? 'hsl(348,86%,65%)' : 'hsl(165,100%,42%)';
          
          return (
            <div key={i} className="glass-card p-6 flex flex-col relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 shadow-lg hover:shadow-xl">
              <div className="absolute -right-10 -top-10 w-40 h-40 blur-[50px] rounded-full opacity-20 transition-opacity group-hover:opacity-40" style={{ backgroundColor: primaryColor }} />
              
              <div className="flex justify-between items-center mb-2 relative z-10 w-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner border border-white/5" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                    {lb.type === 'Casual Leave' ? '🏖️' : lb.type === 'Sick Leave' ? '🏥' : '⭐'}
                  </div>
                  <span className="text-base font-display font-bold text-foreground">{lb.type}</span>
                </div>
              </div>

              <div className="h-48 w-full relative z-10 my-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={8}
                    >
                      <Cell fill={primaryColor} className="drop-shadow-md" />
                      <Cell fill="hsl(var(--secondary))" opacity={0.5} />
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsla(0,0%,100%,0.1)', padding: '8px 12px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))', fontSize: '12px', fontWeight: 'bold' }}
                      cursor={false}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center Value Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-5xl font-mono font-bold drop-shadow-sm" style={{ color: primaryColor }}>{lb.remaining}</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Days Left</span>
                </div>
              </div>

              <div className="w-full flex justify-between items-center z-10 bg-secondary/30 rounded-xl p-3.5 border border-glass-border">
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase text-[10px] tracking-wider mb-1 font-bold">Total Supply</span>
                  <span className="text-foreground text-sm font-mono font-bold">{lb.total} <span className="text-xs text-muted-foreground font-sans font-normal">Days</span></span>
                </div>
                <div className="w-px h-8 bg-glass-border/80" />
                <div className="flex flex-col text-right">
                  <span className="text-muted-foreground uppercase text-[10px] tracking-wider mb-1 font-bold">Days Used</span>
                  <span className="text-foreground text-sm font-mono font-bold">{used} <span className="text-xs text-muted-foreground font-sans font-normal">Days</span></span>
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Tabs */}
      <motion.div variants={fadeUp} className="flex gap-1 p-1 glass-card w-fit">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
            {tab === 'Pending' && <span className="ml-1.5 text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">
              {leaves.filter(l => l.status === 'pending').length}
            </span>}
          </button>
        ))}
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeUp} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-glass-border">
                {['Type', 'From → To', 'Days', 'Status', 'Remark', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><EmptyState message="No leave records" /></td></tr>
              ) : (
                filtered.map(leave => (
                  <tr key={leave._id} className="border-b border-glass-border hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3"><span className="status-leave">{leave.type}</span></td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{formatDate(leave.startDate)} → {formatDate(leave.endDate)}</td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{leave.totalDays}</td>
                    <td className="px-4 py-3"><span className={getStatusColor(leave.status)}>{leave.status}</span></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{leave.comment || '—'}</td>
                    <td className="px-4 py-3">
                      {leave.status === 'pending' && (
                        <button onClick={() => handleCancel(leave._id)} className="text-xs text-destructive hover:underline">Cancel</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Apply Leave Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50" onClick={() => setDrawerOpen(false)} />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-glass-border z-50 p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-display font-bold text-foreground">Apply Leave</h3>
                <button onClick={() => setDrawerOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              </div>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Leave Type</label>
                  <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="input-floating">
                    <option value="casual">Casual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="earned">Earned Leave</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">From</label>
                    <input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="input-floating font-mono" required />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">To</label>
                    <input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="input-floating font-mono" required />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Reason</label>
                  <textarea value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} className="input-floating min-h-[100px] resize-none" placeholder="Describe your reason..." required />
                </div>
                <button type="submit" disabled={submitLoading} className="glow-button w-full flex justify-center">
                  {submitLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Application'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LeavesPage;
