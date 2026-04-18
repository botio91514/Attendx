import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CircleDollarSign, 
  Loader2, 
  Download, 
  Search, 
  Filter, 
  AlertCircle, 
  Info, 
  TrendingUp, 
  Wallet, 
  ArrowUpRight, 
  FileText,
  Lock,
  CheckCircle2,
  Clock,
  Settings2,
  RotateCcw,
  XCircle,
  BadgeCheck
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ExportButton } from '@/components/ExportButton';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const Payroll: React.FC = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [isFinalized, setIsFinalized] = useState(false);
  const [stats, setStats] = useState({
    totalPayout: 0,
    avgSalary: 0,
    staffCount: 0
  });

  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  // Adjustment Modal State
  const [adjustmentRecord, setAdjustmentRecord] = useState<any>(null);
  const [adjustmentForm, setAdjustmentForm] = useState({ 
    bonus: 0, 
    deductions: 0, 
    notes: '', 
    paymentMethod: 'Bank Transfer',
    transactionId: ''
  });

  const now = new Date();
  const [filters, setFilters] = useState({
    month: (now.getMonth() + 1).toString().padStart(2, '0'),
    year: now.getFullYear().toString(),
    search: ''
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const totalSelectedAmount = payroll
    .filter(p => selectedIds.includes(p._id))
    .reduce((acc, p) => acc + (p.calculations.netSalary || p.calculations.grossAmount), 0);

  const fetchPayroll = async () => {
    try {
      setLoading(true);
      setSelectedIds([]); 
      const res = await api.get(`/payroll/admin/summary?month=${filters.month}&year=${filters.year}`);
      if (res.success && res.data) {
        setPayroll(res.data.payroll);
        setIsFinalized(res.data.isFinalized);
        
        let total = 0;
        res.data.payroll.forEach((p: any) => total += p.calculations.netSalary || p.calculations.grossAmount);
        
        setStats({
          totalPayout: total,
          staffCount: res.data.totalStaff,
          avgSalary: res.data.totalStaff > 0 ? Math.round(total / res.data.totalStaff) : 0
        });
      }
    } catch (error) {
      toast.error('Failed to calculate payroll');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [filters.month, filters.year]);

  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);

  const handleProcessPayroll = async () => {
    setShowFinalizeDialog(false);
    const processingToast = toast.promise(
      api.post('/payroll/admin/process', {
        month: parseInt(filters.month),
        year: parseInt(filters.year),
        items: payroll
      }),
      {
        loading: 'Freezing payroll records and generating database snapshots...',
        success: (res: any) => {
          fetchPayroll();
          return res.message || 'Payroll locked successfully! 🔓';
        },
        error: (err: any) => err.message || 'Failed to lock payroll records.'
      }
    );

    try {
      setProcessing(true);
      await processingToast;
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleUnlock = async () => {
    setShowUnlockDialog(false);
    const unlockToast = toast.promise(
      api.delete('/payroll/admin/unlock', {
        month: parseInt(filters.month),
        year: parseInt(filters.year)
      }),
      {
        loading: 'Reverting records to live dynamic mode...',
        success: (res: any) => {
          fetchPayroll();
          return res.message || 'Month successfully unlocked! 🔓';
        },
        error: (err: any) => err.message || 'Unlock failed'
      }
    );

    try {
      setProcessing(true);
      await unlockToast;
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const [localProcessing, setLocalProcessing] = useState<string | null>(null);

  const handleUpdateStatus = async (id: string, status: 'paid' | 'finalized') => {
    try {
      setLocalProcessing(id);
      const res = await api.put(`/payroll/admin/${id}`, { status });
      if (res.success) {
        toast.success(`Marked as ${status}`);
        fetchPayroll();
      }
    } catch (error: any) {
      toast.error('Update failed');
    } finally {
      setLocalProcessing(null);
    }
  };

  const handleAdjustmentSubmit = async () => {
    try {
      const res = await api.put(`/payroll/admin/${adjustmentRecord._id}`, adjustmentForm);
      if (res.success) {
        toast.success('Adjustments saved');
        setAdjustmentRecord(null);
        fetchPayroll();
      }
    } catch (error: any) {
      toast.error('Update failed');
    }
  };

  const handleBulkPay = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Mark ${selectedIds.length} employees as paid and send notifications?`)) return;

    try {
      setProcessing(true);
      const res = await api.put('/payroll/admin/bulk-pay', { ids: selectedIds });
      if (res.success) {
        toast.success(res.message);
        fetchPayroll();
      }
    } catch (error: any) {
      toast.error('Bulk payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    const selectable = filtered.filter(p => isFinalized && p.status !== 'paid');
    if (selectedIds.length > 0 && selectedIds.length >= selectable.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectable.map(p => p._id));
    }
  };

  const handlePayrollCSV = async () => {
    try {
      setCsvLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(
        `${API_URL}/export/payroll/all/csv?month=${filters.month}&year=${filters.year}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll_${filters.year}_${filters.month}.csv`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); a.remove();
      toast.success('Payroll CSV downloaded!');
    } catch { toast.error('Failed to export CSV'); }
    finally { setCsvLoading(false); }
  };

  const filtered = payroll.filter(p => 
    p.name.toLowerCase().includes(filters.search.toLowerCase()) ||
    p.employeeId.toLowerCase().includes(filters.search.toLowerCase())
  );

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 pb-12">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <CircleDollarSign className="w-6 h-6 text-primary" /> Payroll Management
          </h2>
          <p className="text-sm text-muted-foreground">{isFinalized ? '✅ Historical records for this month are locked' : '⚡ Generating live preview based on active attendance'}</p>
        </div>
        <div className="flex items-center gap-2">
           <select 
             value={filters.month} 
             onChange={e => setFilters({...filters, month: e.target.value})}
             className="input-floating py-2 w-auto bg-card"
           >
              {Array.from({length: 12}, (_, i) => {
                const m = (i + 1).toString().padStart(2, '0');
                const name = new Date(2000, i).toLocaleString('default', { month: 'long' });
                return <option key={m} value={m}>{name}</option>;
              })}
           </select>
           <select 
             value={filters.year} 
             onChange={e => setFilters({...filters, year: e.target.value})}
             className="input-floating py-2 w-auto bg-card"
           >
              {['2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
           </select>
           <button
             onClick={handlePayrollCSV}
             disabled={csvLoading}
             title="Download Payroll CSV"
             className="p-2.5 rounded-xl bg-success/10 text-success hover:bg-success/20 transition-colors"
           >
             {csvLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
           </button>
           {isFinalized ? (
            <div className="flex items-center gap-2">
               <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-secondary px-4 py-2 rounded-xl border border-glass-border shadow-sm">
                 <Lock className="w-4 h-4 text-primary" /> MONTH LOCKED
               </div>
               <Button onClick={() => setShowUnlockDialog(true)} variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 rounded-xl px-3 font-semibold text-xs">
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Unlock
               </Button>
            </div>
          ) : (
            <Button onClick={() => setShowFinalizeDialog(true)} disabled={processing} className="rounded-xl px-6 bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20">
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              Finalize Month
            </Button>
          )}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
         <div className="glass-card p-5 border-l-4 border-l-primary relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
               <div className="p-2 rounded-lg bg-primary/10 text-primary"><Wallet className="w-5 h-5" /></div>
               <span className="text-[10px] font-bold text-success flex items-center gap-1 uppercase bg-success/10 px-2 py-0.5 rounded-full"><TrendingUp className="w-3 h-3" /> Monthly Budget</span>
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Net Payout</p>
            <p className="text-2xl font-display font-bold text-foreground">{formatCurrency(stats.totalPayout)}</p>
         </div>
         <div className="glass-card p-5 border-l-4 border-l-purple-500">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 w-fit mb-2"><ArrowUpRight className="w-5 h-5" /></div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Avg Take-home</p>
            <p className="text-2xl font-display font-bold text-foreground">{formatCurrency(stats.avgSalary)}</p>
         </div>
         <div className="glass-card p-5 border-l-4 border-l-blue-500">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 w-fit mb-2"><Filter className="w-5 h-5" /></div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Calculated For</p>
            <p className="text-2xl font-display font-bold text-foreground">{stats.staffCount} Records</p>
         </div>
      </motion.div>

      <motion.div variants={fadeUp} className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
             <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text" 
                  value={filters.search} 
                  onChange={e => setFilters({...filters, search: e.target.value})}
                  className="input-floating pl-10" 
                  placeholder="Search by name or ID..." 
                />
             </div>
             {selectedIds.length > 0 && (
               <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Selected Total</span>
                    <span className="text-sm font-bold text-success leading-none">{formatCurrency(totalSelectedAmount)}</span>
                 </div>
                 <Button onClick={handleBulkPay} size="sm" className="bg-success hover:bg-success/90 text-white rounded-xl font-bold shadow-lg shadow-success/20">
                    Mark {selectedIds.length} as Paid
                 </Button>
               </motion.div>
             )}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
           {loading ? (
             <div className="p-20 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Retrieving payroll records...</p>
             </div>
           ) : (
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead>
                      <tr className="border-b border-glass-border bg-secondary/30">
                         <th className="px-5 py-4 w-10">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.length === filtered.length && filtered.length > 0} 
                              onChange={toggleSelectAll} 
                              className="rounded border-glass-border text-primary w-4 h-4"
                            />
                         </th>
                         {['Employee', 'Paid/LWP', 'Atnd Summary', 'Gross/Ded.', 'Net Salary', 'Status', 'Actions'].map(h => (
                           <th key={h} className="text-[10px] font-bold text-muted-foreground px-5 py-4 uppercase tracking-widest">{h}</th>
                         ))}
                      </tr>
                   </thead>
                   <tbody>
                      {filtered.map(entry => (
                        <tr key={entry._id} className="border-b border-glass-border hover:bg-primary/5 transition-colors cursor-pointer" onClick={() => setSelectedEntry(entry)}>
                           <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={selectedIds.includes(entry._id)}
                                onChange={() => {
                                  if (!isFinalized) return toast.info('Finalize month first');
                                  if (entry.status === 'paid') return;
                                  setSelectedIds(prev => prev.includes(entry._id) ? prev.filter(id => id !== entry._id) : [...prev, entry._id]);
                                }}
                                className="rounded border-glass-border text-primary w-4 h-4 cursor-pointer"
                              />
                           </td>
                           <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px]">{entry.name?.charAt(0)}</div>
                                 <div>
                                    <p className="text-xs font-bold text-foreground">{entry.name}</p>
                                    <p className="text-[9px] font-mono text-muted-foreground uppercase">{entry.employeeId}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="px-5 py-4">
                              <div className="flex flex-col">
                                 <div className="flex items-center gap-1">
                                    <span className="text-success font-bold text-xs">{entry.calculations.payableDays} Paid</span>
                                    <span className="text-muted-foreground opacity-30 text-[10px]">/</span>
                                    <span className="text-destructive font-bold text-xs">{entry.stats.lwp || 0} LWP</span>
                                 </div>
                                 <div className="flex gap-1 mt-0.5" title={`Breakdown: ${entry.stats.cl} Casual, ${entry.stats.sl} Sick, ${entry.stats.rl || 0} Religious, ${entry.stats.lwp || 0} LWP`}>
                                    {entry.stats.cl > 0 && <span className="text-[8px] px-1 bg-blue-500/10 text-blue-500 rounded border border-blue-500/10">CL:{entry.stats.cl}</span>}
                                    {entry.stats.sl > 0 && <span className="text-[8px] px-1 bg-rose-500/10 text-rose-500 rounded border border-rose-500/10">SL:{entry.stats.sl}</span>}
                                    {entry.stats.rl > 0 && <span className="text-[8px] px-1 bg-amber-500/10 text-amber-500 rounded border border-amber-500/10">RL:{entry.stats.rl}</span>}
                                    {entry.stats.lwp > 0 && <span className="text-[8px] px-1 bg-destructive/10 text-destructive rounded border border-destructive/10">LWP:{entry.stats.lwp}</span>}
                                 </div>
                              </div>
                           </td>
                           <td className="px-5 py-4">
                              <div className="flex gap-2 items-center">
                                 <div className="flex flex-col">
                                    <span className="text-[9px] uppercase font-bold text-muted-foreground">Work</span>
                                    <span className="text-xs font-medium">{entry.stats.present}P {entry.stats.halfDay}H</span>
                                 </div>
                                 <div className="w-[1px] h-5 bg-glass-border" />
                                 <div className="flex flex-col">
                                    <span className="text-[9px] uppercase font-bold text-muted-foreground">Rate</span>
                                    <span className="text-xs font-mono">{formatCurrency(entry.calculations.dailyRate)}</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-5 py-4 text-xs font-bold text-foreground">
                              <div className="flex flex-col">
                                 <span className="text-primary tracking-tight">{formatCurrency(entry.calculations.grossAmount)}</span>
                                 <span className="text-destructive tracking-tight">-{formatCurrency(entry.calculations.deductionAmount)}</span>
                              </div>
                           </td>
                           <td className="px-5 py-4">
                              <span className="text-sm font-bold text-foreground">{formatCurrency(entry.calculations.netSalary || entry.calculations.grossAmount || 0)}</span>
                           </td>
                           <td className="px-5 py-4">
                              {entry.status === 'paid' ? (
                                <span className="text-[9px] font-bold text-success uppercase px-2 py-0.5 bg-success/10 rounded-full border border-success/20">Paid</span>
                              ) : entry.status === 'finalized' ? (
                                <span className="text-[9px] font-bold text-primary uppercase px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">Ready</span>
                              ) : (
                                <span className="text-[9px] font-bold text-muted-foreground uppercase px-2 py-0.5 bg-secondary rounded-full border border-glass-border">Draft</span>
                              )}
                           </td>
                           <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                              <div className="flex gap-2">
                                 {isFinalized && entry.status !== 'paid' && (
                                   <button onClick={() => handleUpdateStatus(entry._id, 'paid')} className="p-1.5 rounded bg-success/10 text-success hover:bg-success hover:text-white transition-all border border-success/10"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                                 )}
                                 <ExportButton type="payslip" employeeId={typeof entry.userId === 'object' ? entry.userId._id : entry.userId} dateRange={{ from: `${filters.year}-${filters.month}-01`, to: `${filters.year}-${filters.month}-31` }} label="" variant="ghost" size="sm" className="h-8 w-8 p-0" />
                              </div>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           )}
        </div>
      </motion.div>

      {/* FULL DETAIL MODAL (TRANSPARENCY FOCUS) */}
      <Dialog open={!!selectedEntry} onOpenChange={val => !val && setSelectedEntry(null)}>
        <DialogContent className="max-w-xl rounded-[32px] overflow-hidden p-0 border-none shadow-2xl">
          <div className="p-8 bg-primary/5 border-b border-glass-border">
             <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold">{selectedEntry?.name?.charAt(0)}</div>
                   <div>
                      <h3 className="text-lg font-bold">{selectedEntry?.name}</h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">{selectedEntry?.employeeId}</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Take Home Pay</p>
                   <p className="text-3xl font-display font-bold text-primary">{formatCurrency(selectedEntry?.calculations?.netSalary)}</p>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-card border border-glass-border">
                   <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Base Salary</p>
                   <p className="font-bold">{formatCurrency(selectedEntry?.baseSalary)}</p>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-glass-border">
                   <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Daily Rate</p>
                   <p className="font-bold">{formatCurrency(selectedEntry?.calculations?.dailyRate)}</p>
                </div>
             </div>
          </div>
          
          <div className="p-8 space-y-6 max-h-[50vh] overflow-y-auto">
             <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                   <BadgeCheck className="w-3.5 h-3.5 text-success" /> Payable Breakdown
                </h4>
                <div className="space-y-2">
                   <div className="flex justify-between text-sm"><span>Present Days ({selectedEntry?.stats?.present} × full)</span><span className="font-bold">{selectedEntry?.stats?.present}d</span></div>
                   <div className="flex justify-between text-sm"><span>Half-days ({selectedEntry?.stats?.halfDay} × 0.5)</span><span className="font-bold">{selectedEntry?.stats?.halfDay * 0.5}d</span></div>
                   <div className="flex justify-between text-sm px-2 py-1 bg-success/5 rounded border border-success/10">
                      <span>Approved Paid Leaves</span>
                      <span className="font-bold">{selectedEntry?.stats?.leave}d</span>
                   </div>
                   <div className="flex justify-between text-[11px] text-muted-foreground italic pl-4">
                      <span>(CL:{selectedEntry?.stats?.cl}, SL:{selectedEntry?.stats?.sl}, RL:{selectedEntry?.stats?.rl})</span>
                   </div>
                   <div className="flex justify-between text-sm pt-2 border-t border-glass-border font-bold text-success"><span>Total Paid Credits</span><span>{selectedEntry?.calculations?.payableDays}d</span></div>
                </div>
             </div>

             <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                   <XCircle className="w-3.5 h-3.5 text-destructive" /> Deduction Breakdown
                </h4>
                <div className="space-y-2">
                   <div className="flex justify-between text-sm bg-destructive/5 p-2 rounded border border-destructive/10">
                      <span className="text-destructive font-bold uppercase text-[10px]">LWP Penalty ({selectedEntry?.stats?.lwp || 0} days)</span>
                      <span className="font-bold text-destructive">-{formatCurrency((selectedEntry?.stats?.lwp || 0) * (selectedEntry?.calculations?.dailyRate || 0))}</span>
                   </div>
                   <div className="flex justify-between text-[10px] text-muted-foreground pl-2 italic">
                      <span>Calculation: {selectedEntry?.stats?.lwp || 0} × {formatCurrency(selectedEntry?.calculations?.dailyRate)}</span>
                   </div>
                </div>
             </div>
          </div>

          <div className="p-6 bg-secondary/30 flex gap-4">
             <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setSelectedEntry(null)}>Close View</Button>
             <ExportButton 
                type="payslip" 
                employeeId={typeof selectedEntry?.userId === 'object' ? selectedEntry?.userId._id : selectedEntry?.userId} 
                dateRange={{ from: `${filters.year}-${filters.month}-01`, to: `${filters.year}-${filters.month}-31` }} 
                label="Generate Preview PDF" 
                className="flex-[1.5] bg-primary rounded-xl font-bold"
             />
          </div>
        </DialogContent>
      </Dialog>

      {/* FINALIZE CONFIRMATION DIALOG */}
      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent className="sm:max-w-[400px] rounded-[24px] p-6 text-center border-none shadow-2xl">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
             <Lock className="w-8 h-8 text-primary" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Finalize Payroll?</DialogTitle>
            <DialogDescription className="text-center pt-2">
               This will <strong>freeze</strong> all attendance records for {filters.month}/{filters.year}. Record status will be captured for audits.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-6">
            <Button className="w-full rounded-xl bg-primary h-12 text-md font-bold" onClick={handleProcessPayroll}>Confirm & Freeze</Button>
            <Button variant="ghost" className="w-full rounded-xl h-12" onClick={() => setShowFinalizeDialog(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Payroll;
