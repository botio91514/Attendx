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
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ExportButton } from '@/components/ExportButton';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
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

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const totalSelectedAmount = payroll
    .filter(p => selectedIds.includes(p._id))
    .reduce((acc, p) => acc + (p.calculations.netSalary || p.calculations.grossSalary), 0);

  const fetchPayroll = async () => {
    try {
      setLoading(true);
      setSelectedIds([]); // Reset selection on fetch
      const res = await api.get(`/payroll/admin/summary?month=${filters.month}&year=${filters.year}`);
      if (res.success && res.data) {
        setPayroll(res.data.payroll);
        setIsFinalized(res.data.isFinalized);
        
        let total = 0;
        res.data.payroll.forEach((p: any) => total += p.calculations.netSalary || p.calculations.grossSalary);
        
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
        error: (err: any) => err.message || 'Failed to lock payroll records. Please try again.'
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
      setProcessing(processing => false);
      setProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    // Only select items that CAN be selected (finalized and not yet paid)
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

      <motion.div variants={fadeUp} className="space-y-4">
      {/* Overview Cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
         <div className="glass-card p-5 border-l-4 border-l-primary relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
               <div className="p-2 rounded-lg bg-primary/10 text-primary"><Wallet className="w-5 h-5" /></div>
               <span className="text-[10px] font-bold text-success flex items-center gap-1 uppercase bg-success/10 px-2 py-0.5 rounded-full"><TrendingUp className="w-3 h-3" /> Monthly Budget</span>
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Net Payout</p>
            <p className="text-2xl font-display font-bold text-foreground">₹{stats.totalPayout.toLocaleString()}</p>
         </div>
         <div className="glass-card p-5 border-l-4 border-l-purple-500">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 w-fit mb-2"><ArrowUpRight className="w-5 h-5" /></div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Avg Take-home</p>
            <p className="text-2xl font-display font-bold text-foreground">₹{stats.avgSalary.toLocaleString()}</p>
         </div>
         <div className="glass-card p-5 border-l-4 border-l-blue-500">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 w-fit mb-2"><Filter className="w-5 h-5" /></div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Calculated For</p>
            <p className="text-2xl font-display font-bold text-foreground">{stats.staffCount} Records</p>
         </div>
      </motion.div>
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
                    <span className="text-sm font-bold text-success leading-none">₹{totalSelectedAmount.toLocaleString()}</span>
                 </div>
                 <Button onClick={handleBulkPay} size="sm" className="bg-success hover:bg-success/90 text-white rounded-xl font-bold shadow-lg shadow-success/20">
                    Mark {selectedIds.length} as Paid
                 </Button>
               </motion.div>
             )}
          </div>
          {isFinalized && (
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-lg border border-glass-border">
              <Lock className="w-3.5 h-3.5" /> MONTH LOCKED
            </div>
          )}
        </div>

        <div className="glass-card overflow-hidden">
           {loading ? (
             <div className="p-20 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Retrieving payroll records...</p>
             </div>
           ) : (
             <div className="overflow-x-auto">
                <table className="w-full">
                   <thead>
                      <tr className="border-b border-glass-border bg-secondary/30">
                         <th className="px-5 py-4 w-10 text-center">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.length === filtered.length && filtered.length > 0} 
                              onChange={toggleSelectAll} 
                              className="rounded border-glass-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                            />
                         </th>
                         {['Employee', 'Base Pay', 'Atnd/Rate', 'Adjustments', 'Net Salary', 'Status', 'Actions'].map(h => (
                           <th key={h} className="text-left text-xs font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider">{h}</th>
                         ))}
                      </tr>
                   </thead>
                   <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">No records found for selected period.</td></tr>
                      ) : (
                        filtered.map((entry, index) => (
                          <tr key={entry._id} className={`border-b border-glass-border hover:bg-primary/5 transition-colors group ${selectedIds.includes(entry._id) ? 'bg-primary/5' : ''}`}>
                             <td className="px-5 py-4 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={selectedIds.includes(entry._id)}
                                  onChange={() => {
                                    if (!isFinalized) {
                                      toast.info('Click "Finalize Month" first to enable selection');
                                      return;
                                    }
                                    if (entry.status === 'paid') return;
                                    
                                    if (selectedIds.includes(entry._id)) {
                                      setSelectedIds(selectedIds.filter(id => id !== entry._id));
                                    } else {
                                      setSelectedIds([...selectedIds, entry._id]);
                                    }
                                  }}
                                  className="rounded border-glass-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                                />
                             </td>
                             <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-xs border border-primary/20 shrink-0">
                                      {entry.name?.charAt(0)}
                                   </div>
                                   <div className="min-w-0">
                                      <p className="text-sm font-bold text-foreground truncate">{entry.name}</p>
                                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-tighter">{entry.employeeId}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-5 py-4 text-sm font-semibold text-muted-foreground">₹{entry.baseSalary.toLocaleString()}</td>
                             <td className="px-5 py-4">
                                <div className="flex flex-col gap-0.5">
                                   <div className="flex gap-1.5 items-center">
                                      <div className="px-1.5 py-0.5 rounded bg-success/10 text-success text-[10px] font-bold border border-success/20" title="Present">{entry.stats.present}P</div>
                                      <div className="px-1.5 py-0.5 rounded bg-warning/10 text-warning text-[10px] font-bold border border-warning/20" title="Half-days">{entry.stats.halfDay}H</div>
                                      <div className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-bold border border-destructive/20" title="Absences">{entry.stats.absent}A</div>
                                   </div>
                                   <span className="text-[10px] font-mono text-muted-foreground">₹{entry.calculations.dailyRate}/day</span>
                                </div>
                             </td>
                             <td className="px-5 py-4">
                               <div className="flex flex-col text-xs">
                                 <span className="text-success font-bold">+{entry.calculations.bonus || 0} Bonus</span>
                                 <span className="text-destructive font-bold">-{entry.calculations.deductions || 0} Ded.</span>
                               </div>
                             </td>
                             <td className="px-5 py-4">
                                <span className="text-sm font-bold text-primary">₹{(entry.calculations.netSalary || entry.calculations.grossSalary).toLocaleString()}</span>
                             </td>
                             <td className="px-5 py-4">
                               {entry.status === 'paid' ? (
                                 <div className="flex items-center gap-1.5 text-success font-bold text-[10px] uppercase px-2 py-1 bg-success/10 border border-success/20 rounded-full w-fit">
                                   <CheckCircle2 className="w-3 h-3" /> Paid
                                 </div>
                               ) : entry.status === 'finalized' ? (
                                 <div className="flex items-center gap-1.5 text-primary font-bold text-[10px] uppercase px-2 py-1 bg-primary/10 border border-primary/20 rounded-full w-fit">
                                   <Clock className="w-3 h-3" /> Ready
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-1.5 text-muted-foreground font-bold text-[10px] uppercase px-2 py-1 bg-secondary border border-glass-border rounded-full w-fit">
                                   Draft
                                 </div>
                               )}
                             </td>
                             <td className="px-5 py-4">
                               <div className="flex items-center gap-1.5">
                                 {isFinalized ? (
                                   <>
                                     {entry.status !== 'paid' ? (
                                       <button 
                                         onClick={() => handleUpdateStatus(entry._id, 'paid')}
                                         disabled={localProcessing === entry._id}
                                         className="p-2 rounded-lg bg-success/10 text-success hover:bg-success hover:text-white transition-all shadow-sm border border-success/20 disabled:opacity-50"
                                         title="Mark as Paid"
                                       >
                                         {localProcessing === entry._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                       </button>
                                     ) : (
                                        <div className="p-2 rounded-lg bg-success/5 text-success/50 border border-success/10" title="Already Paid">
                                          <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                     )}
                                     <button 
                                       onClick={() => {
                                         setAdjustmentRecord(entry);
                                         setAdjustmentForm({ 
                                           bonus: entry.calculations.bonus || 0, 
                                           deductions: entry.calculations.deductions || 0, 
                                           notes: entry.notes || '',
                                           paymentMethod: entry.paymentMethod || 'Bank Transfer',
                                           transactionId: entry.transactionId || '' 
                                         });
                                       }}
                                       className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm border border-primary/20"
                                       title="Edit Adjustments (Bonus/Deductions)"
                                     >
                                       <Settings2 className="w-4 h-4" />
                                     </button>
                                   </>
                                 ) : (
                                   <div className="flex items-center gap-1.5 opacity-30 grayscale cursor-not-allowed" title="Finalize month first to enable adjustments">
                                      <div className="p-2 rounded-lg bg-secondary border border-glass-border">
                                        <CheckCircle2 className="w-4 h-4" />
                                      </div>
                                      <div className="p-2 rounded-lg bg-secondary border border-glass-border">
                                        <Settings2 className="w-4 h-4" />
                                      </div>
                                   </div>
                                 )}
                                 <ExportButton 
                                   type="payslip" 
                                   employeeId={typeof entry.userId === 'object' ? entry.userId._id : (entry.userId || entry._id)} 
                                   dateRange={{
                                     from: `${filters.year}-${filters.month}-01`, 
                                     to: `${filters.year}-${filters.month}-${new Date(parseInt(filters.year), parseInt(filters.month), 0).getDate()}`
                                   }} 
                                   label="" 
                                   variant="ghost" 
                                   size="icon"
                                   className="hover:bg-primary/10 text-muted-foreground"
                                 />
                               </div>
                             </td>
                          </tr>
                        ))
                      )}
                   </tbody>
                </table>
             </div>
           )}
        </div>
        
        <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl flex gap-3">
           <Info className="w-5 h-5 text-primary shrink-0" />
           <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Payroll Workflow:</strong> In Draft mode, values refresh live based on attendance and approved leaves. Once you click <strong>Finalize</strong>, records are <strong>frozen</strong>. You can then add bonuses/deductions manually and mark individual payments as completed.
           </p>
        </div>
      </motion.div>

      {/* ADJUSTMENT MODAL */}
      <Dialog open={!!adjustmentRecord} onOpenChange={val => !val && setAdjustmentRecord(null)}>
        <DialogContent className="sm:max-w-[450px] rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Adjust Payroll</DialogTitle>
            <DialogDescription>Modify earnings and payment records for {adjustmentRecord?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bonus (₹)</label>
                <Input 
                  type="number" 
                  value={adjustmentForm.bonus}
                  onChange={e => setAdjustmentForm({...adjustmentForm, bonus: parseInt(e.target.value) || 0})}
                  className="rounded-xl border-glass-border font-bold text-success"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Deductions (₹)</label>
                <Input 
                  type="number" 
                  value={adjustmentForm.deductions}
                  onChange={e => setAdjustmentForm({...adjustmentForm, deductions: parseInt(e.target.value) || 0})}
                  className="rounded-xl border-glass-border font-bold text-destructive"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment Method</label>
                  <select 
                    value={adjustmentForm.paymentMethod}
                    onChange={e => setAdjustmentForm({...adjustmentForm, paymentMethod: e.target.value})}
                    className="flex h-10 w-full rounded-xl border border-glass-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  >
                     {['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Other'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transaction ID</label>
                  <Input 
                    placeholder="Ref No..."
                    value={adjustmentForm.transactionId}
                    onChange={e => setAdjustmentForm({...adjustmentForm, transactionId: e.target.value})}
                    className="rounded-xl border-glass-border"
                  />
               </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Internal Notes</label>
              <Input 
                placeholder="Reason for adjustment..."
                value={adjustmentForm.notes}
                onChange={e => setAdjustmentForm({...adjustmentForm, notes: e.target.value})}
                className="rounded-xl border-glass-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setAdjustmentRecord(null)}>Cancel</Button>
            <Button className="rounded-xl bg-primary" onClick={handleAdjustmentSubmit}>Save Changes</Button>
          </DialogFooter>
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
               This will <strong>freeze</strong> all attendance records for {filters.month}/{filters.year}. 
               You will only be able to make manual adjustments like bonuses and deductions after this.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-6">
            <Button className="w-full rounded-xl bg-primary h-12 text-md font-bold" onClick={handleProcessPayroll}>
               Yes, Freeze & Finalize
            </Button>
            <Button variant="ghost" className="w-full rounded-xl h-12 text-muted-foreground font-semibold" onClick={() => setShowFinalizeDialog(false)}>
               Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* UNLOCK CONFIRMATION DIALOG */}
      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent className="sm:max-w-[400px] rounded-[24px] p-6 text-center border-none shadow-2xl">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-destructive/20">
             <RotateCcw className="w-8 h-8 text-destructive" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Unlock Month?</DialogTitle>
            <DialogDescription className="text-center pt-2">
               Warning: This will <strong>delete</strong> all manual adjustments (bonuses/deductions) and revert to live dynamic calculations.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-6">
            <Button className="w-full rounded-xl bg-destructive h-12 text-md font-bold text-white hover:bg-destructive/90" onClick={handleUnlock}>
               Yes, Revert to Draft
            </Button>
            <Button variant="ghost" className="w-full rounded-xl h-12 text-muted-foreground font-semibold" onClick={() => setShowUnlockDialog(false)}>
               Keep Locked
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Payroll;
