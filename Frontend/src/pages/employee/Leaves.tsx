import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStatusColor } from '@/utils/statusUtils';
import EmptyState from '@/components/EmptyState';
import { 
  Plus, 
  X, 
  Loader2, 
  Info, 
  Calendar, 
  History, 
  CalendarDays,
  Palmtree,
  Stethoscope,
  Church,
  Wallet
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const fadeUp = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };
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
          { type: 'Casual', id: 'casual', total: b.casual?.total ?? 12, accrued: b.casual?.accrued ?? 0, remaining: b.casual?.available ?? 0, used: b.casual?.used ?? 0, monthlyLimit: b.casual?.monthlyLimit ?? 1, icon: Palmtree, color: 'hsl(215, 80%, 60%)', bg: 'bg-blue-500/10' },
          { type: 'Sick', id: 'sick', total: b.sick?.total ?? 6, accrued: b.sick?.accrued ?? 0, remaining: b.sick?.available ?? 0, used: b.sick?.used ?? 0, monthlyLimit: 6, icon: Stethoscope, color: 'hsl(350, 80%, 60%)', bg: 'bg-rose-500/10' },
          { type: 'Religious', id: 'religious', total: b.religious?.total ?? 2, accrued: b.religious?.accrued ?? 0, remaining: b.religious?.available ?? 0, used: b.religious?.used ?? 0, icon: Church, color: 'hsl(40, 90%, 55%)', bg: 'bg-amber-500/10' },
          { type: 'LWP', id: 'unpaid', total: 'Unlimited', accrued: '∞', remaining: '∞', used: b.unpaid?.used ?? 0, icon: Wallet, color: 'hsl(160, 70%, 45%)', bg: 'bg-emerald-500/10' }
        ];
        setBalances(balanceArray);
      }
    } catch (error) {
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
        toast.success(res.message);
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
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    try {
      const res = await api.put(`/leave/cancel/${id}`, {});
      if (res.success) {
        toast.success('Request cancelled');
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Cancellation failed');
    }
  };

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading Records...</p>
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="space-y-8 pb-12">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-display font-bold text-foreground">Leave Center</h2>
           </div>
           <p className="text-sm text-muted-foreground">Monitor and manage your yearly time-off quota</p>
        </div>
        <button 
          onClick={() => setDrawerOpen(true)} 
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-2xl shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" /> Apply For Leave
        </button>
      </motion.div>

      {/* Modern Balance Row */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {balances.map((lb: any, i) => (
           <div key={i} className="glass-card p-5 relative overflow-hidden group border-none shadow-sm hover:shadow-md transition-all">
              <div className={`absolute top-0 right-0 w-24 h-24 blur-[40px] rounded-full opacity-10 group-hover:opacity-20 transition-opacity translate-x-1/2 -translate-y-1/2`} style={{ backgroundColor: lb.color }} />
              
              <div className="flex justify-between items-start mb-6">
                 <div className={`w-12 h-12 rounded-2xl ${lb.bg} flex items-center justify-center`}>
                    <lb.icon className="w-6 h-6" style={{ color: lb.color }} />
                 </div>
                 <div className="text-right">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Status</span>
                    <span className={`text-[11px] font-bold ${lb.remaining === 0 && lb.id !== 'unpaid' ? 'text-destructive' : 'text-success'} uppercase`}>
                       {lb.id === 'unpaid' ? 'Active' : `${lb.remaining} Left`}
                    </span>
                 </div>
              </div>

              <h4 className="text-sm font-bold text-foreground mb-4">{lb.type}</h4>
              
              <div className="space-y-4">
                 <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-bold text-muted-foreground uppercase">Accrued</span>
                       <span className="text-sm font-bold">
                          {lb.id === 'unpaid' ? '∞' : `${lb.accrued}d`}
                       </span>
                    </div>
                    <div className="text-right flex flex-col">
                       <span className="text-[10px] font-bold text-muted-foreground uppercase">Used</span>
                       <span className="text-sm font-bold text-destructive">{lb.used}d</span>
                    </div>
                 </div>

                 <div className="relative h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: lb.id === 'unpaid' ? '100%' : `${(lb.used / (lb.accrued || 1)) * 100}%` }}
                       className="absolute h-full inset-0 rounded-full"
                       style={{ backgroundColor: lb.id === 'unpaid' ? lb.color : (lb.used >= lb.accrued ? 'red' : lb.color) }}
                    />
                 </div>
                 
                 <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground uppercase">
                    <span>Yearly Cap: {lb.total}</span>
                    <span className="text-primary/70 italic">
                       {lb.monthlyLimit ? `Limit: ${lb.monthlyLimit}d/mo` : 'Auto-Accrue'}
                    </span>
                 </div>
              </div>
           </div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
         {/* History Table */}
         <motion.div variants={fadeUp} className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-2">
               <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" /> Application History
               </h3>
               <div className="flex gap-1 bg-secondary/30 p-1 rounded-xl border border-glass-border">
                  {tabs.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                        activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
               </div>
            </div>

            <div className="glass-card overflow-hidden border-none shadow-sm">
               <div className="overflow-x-auto">
                 <table className="w-full">
                   <thead>
                     <tr className="bg-secondary/50">
                       {['Category', 'Duration', 'Days', 'Status', ''].map(h => (
                         <th key={h} className="text-left text-[10px] font-bold text-muted-foreground px-5 py-4 uppercase tracking-widest">{h}</th>
                       ))}
                     </tr>
                   </thead>
                   <tbody>
                     {filtered.length === 0 ? (
                       <tr><td colSpan={5} className="py-20 text-center"><EmptyState message="No records found in this category" /></td></tr>
                     ) : (
                       filtered.map(leave => (
                         <tr key={leave._id} className="border-b border-glass-border hover:bg-secondary/20 transition-colors group">
                           <td className="px-5 py-5">
                              <div className="flex items-center gap-3">
                                 <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold uppercase ${
                                   leave.leaveType === 'sick' ? 'bg-rose-500/10 text-rose-500' :
                                   leave.leaveType === 'casual' ? 'bg-blue-500/10 text-blue-500' :
                                   leave.leaveType === 'religious' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                                 }`}>
                                    {leave.leaveType?.charAt(0)}
                                 </div>
                                 <span className="text-xs font-bold text-foreground capitalize">{leave.leaveType}</span>
                              </div>
                           </td>
                           <td className="px-5 py-5">
                              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                                 <span className="opacity-70">{formatDate(leave.startDate)}</span>
                                 <div className="w-4 h-[1px] bg-muted-foreground opacity-30" />
                                 <span className="opacity-70">{formatDate(leave.endDate)}</span>
                              </div>
                           </td>
                            <td className="px-5 py-5">
                               <div className="flex flex-col gap-1">
                                  <span className="text-xs text-foreground font-bold">{leave.totalDays}d</span>
                                  {leave.status === 'approved' && (
                                    <div className="flex flex-wrap gap-1">
                                      {leave.clDays > 0 && <span className="text-[8px] bg-blue-500/10 text-blue-500 px-1 rounded uppercase font-bold">CL:{leave.clDays}</span>}
                                      {leave.slDays > 0 && <span className="text-[8px] bg-rose-500/10 text-rose-500 px-1 rounded uppercase font-bold">SL:{leave.slDays}</span>}
                                      {leave.rlDays > 0 && <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1 rounded uppercase font-bold">RL:{leave.rlDays}</span>}
                                      {leave.lwpDays > 0 && <span className="text-[8px] bg-destructive/10 text-destructive px-1 rounded uppercase font-bold">LWP:{leave.lwpDays}</span>}
                                    </div>
                                  )}
                               </div>
                            </td>
                            <td className="px-5 py-5"><span className={`${getStatusColor(leave.status)} text-[10px] font-bold uppercase rounded-full px-2.5 py-1`}>{leave.status}</span></td>
                           <td className="px-5 py-5 text-right">
                             {leave.status === 'pending' ? (
                               <button onClick={() => handleCancel(leave._id)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Cancel Request">
                                  <X className="w-4 h-4" />
                               </button>
                             ) : <div className="w-8" />}
                           </td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
         </motion.div>

         {/* Right Sidebar - Guide */}
         <motion.div variants={fadeUp} className="space-y-6">
            <div className="p-6 rounded-3xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground relative overflow-hidden group">
               <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
               <Calendar className="w-8 h-8 mb-4 opacity-80" />
               <h4 className="text-lg font-bold mb-2 font-display">Strict Leave Policy</h4>
               <p className="text-xs opacity-70 leading-relaxed mb-6">
                 Limits: **1.0 Casual Leave** per month & **6.0 Sick Leave** per year. Excess days are automatically converted to LWP.
               </p>
               <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase border-t border-white/10 pt-3">
                     <span className="opacity-60">Sync Logic</span>
                     <span>Auto-Conversion to LWP</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                     <span className="opacity-60">LWP</span>
                     <span>Unlimited</span>
                  </div>
               </div>
            </div>

            <div className="p-5 rounded-3xl bg-card border border-glass-border">
               <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><Info className="w-3.5 h-3.5" /></div>
                  <h5 className="text-xs font-bold uppercase tracking-widest text-foreground">Pro Tip</h5>
               </div>
               <p className="text-[11px] text-muted-foreground leading-relaxed italic">"Always apply for sick leave within 24 hours of your absence to ensure smooth payroll processing."</p>
            </div>
         </motion.div>
      </div>

      {/* Modern Request Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-background/80 backdrop-blur-md z-50" onClick={() => setDrawerOpen(false)} />
            <motion.div
              initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 200 }}
              className="fixed right-2 top-2 bottom-2 w-full max-w-lg bg-card border border-glass-border rounded-[40px] z-50 p-10 shadow-2xl overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-10">
                <div>
                   <h3 className="text-2xl font-display font-bold text-foreground">Request Leave</h3>
                   <div className="w-8 h-1 bg-primary rounded-full mt-1" />
                </div>
                <button onClick={() => setDrawerOpen(false)} className="p-3 rounded-2xl bg-secondary hover:bg-secondary/70 transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <form className="space-y-8" onSubmit={handleSubmit}>
                <div className="space-y-3">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pl-1">Leave Category</label>
                   <div className="grid grid-cols-2 gap-3">
                     {balances.map(b => (
                       <button
                          key={b.id}
                          type="button"
                          onClick={() => setFormData({...formData, type: b.id})}
                          className={`p-5 rounded-3xl border text-left transition-all relative overflow-hidden group ${
                            formData.type === b.id ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-secondary/30 border-transparent hover:border-muted-foreground/20'
                          }`}
                       >
                          <b.icon className={`w-5 h-5 mb-2 transition-transform duration-300 ${formData.type === b.id ? 'scale-110' : 'group-hover:scale-110'}`} style={{ color: b.color }} />
                          <p className="text-xs font-bold text-foreground capitalize">{b.id}</p>
                          <p className="text-[9px] text-muted-foreground uppercase font-bold">{b.remaining} days left</p>
                       </button>
                     ))}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1 leading-none">From Date</label>
                    <input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="input-floating rounded-2xl py-4 bg-secondary/30 font-bold border-transparent" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1 leading-none">To Date</label>
                    <input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="input-floating rounded-2xl py-4 bg-secondary/30 font-bold border-transparent" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1 leading-none">Detailed Reason</label>
                  <textarea value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} className="input-floating rounded-3xl min-h-[140px] bg-secondary/30 resize-none py-4 border-transparent" placeholder="Tell us why you need this leave..." required />
                </div>

                {/* Real-time Breakdown Preview */}
                {formData.startDate && formData.endDate && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 rounded-3xl bg-primary/5 border border-primary/20 space-y-3">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-primary">Allocation Preview</h5>
                    <div className="grid grid-cols-2 gap-3">
                      {(() => {
                        const start = new Date(formData.startDate);
                        const end = new Date(formData.endDate);
                        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;
                        
                        // Simple working day count (simplified frontend version)
                        let count = 0;
                        let curr = new Date(start);
                        while(curr <= end) {
                          if (curr.getDay() !== 0) count++; // Not Sunday
                          curr.setDate(curr.getDate() + 1);
                        }

                        // Project distribution based on Strict Policy
                        const balanceObj = balances.find(b => b.id === (formData.type === 'unpaid' ? 'unpaid' : formData.type));
                        const monthlyLimit = balanceObj?.monthlyLimit || (formData.type === 'casual' ? 1 : formData.type === 'sick' ? 6 : 99);
                        const yearlyRemaining = Number(balanceObj?.remaining || 0);

                        let paid = 0;
                        let lwp = 0;
                        
                        if (formData.type === 'unpaid') {
                          lwp = count;
                        } else {
                          // Max paid is the minimum of (requested days, monthly limit, and yearly remaining)
                          // Note: This is an estimate as we don't know this month's prior usage here
                          const limitToUse = Math.min(monthlyLimit, yearlyRemaining);
                          paid = Math.min(count, limitToUse);
                          lwp = Math.max(0, count - paid);
                        }

                        return (
                          <>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Requested:</span>
                              <span className="font-bold text-foreground">{count} Days</span>
                            </div>
                            <div className="col-span-2 border-t border-primary/10 pt-2 space-y-1">
                              {paid > 0 && <div className="flex justify-between text-[11px]"><span className="text-success">✔ {formData.type.charAt(0).toUpperCase() + formData.type.slice(1)} (Paid)</span><span className="font-mono">{paid}d</span></div>}
                              {lwp > 0 && <div className="flex justify-between text-[11px]"><span className="text-destructive font-bold">❌ LWP (Unpaid)</span><span className="font-mono font-bold">{lwp}d</span></div>}
                              
                              {paid === 0 && lwp === count && formData.type !== 'unpaid' && (
                                <p className="text-[9px] text-amber-500 font-bold mt-1 uppercase italic">⚠️ Quota exhausted! Entire request will be LWP.</p>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}

                <div className="pt-6">
                   <button type="submit" disabled={submitLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full py-5 rounded-[24px] font-bold text-lg shadow-2xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex justify-center">
                     {submitLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Confirm Selection'}
                   </button>
                   <p className="text-center text-[10px] text-muted-foreground mt-4 uppercase font-bold tracking-tighter">Request will be sent to the administrator for review</p>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LeavesPage;
