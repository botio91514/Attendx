import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CircleDollarSign, 
  Loader2, 
  Wallet, 
  Calendar,
  IndianRupee,
  BadgeCheck,
  History,
  Info,
  ChevronRight,
  Download,
  Clock,
  LayoutDashboard
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/ExportButton';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const EmployeePayroll: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({
    month: (now.getMonth() + 1).toString().padStart(2, '0'),
    year: now.getFullYear().toString()
  });

  const fetchPayrollData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/payroll/my?month=${selectedMonth.month}&year=${selectedMonth.year}`);
      if (res.success) {
        setData(res.data);
        setIsFinalized(res.isFinalized);
      }
    } catch (error) {
      toast.error('Failed to load payroll details');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/payroll/my-history');
      if (res.success) {
        setHistory(res.data);
      }
    } catch (error) {
      console.error('Failed to load history');
    }
  };

  useEffect(() => {
    fetchPayrollData();
  }, [selectedMonth.month, selectedMonth.year]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="px-3 py-1 rounded-full bg-success/10 text-success text-[10px] font-bold border border-success/20 uppercase">Paid</span>;
      case 'finalized':
        return <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20 uppercase">Finalized</span>;
      default:
        return <span className="px-3 py-1 rounded-full bg-secondary text-muted-foreground text-[10px] font-bold border border-glass-border uppercase">Draft</span>;
    }
  };

  const monthName = new Date(parseInt(selectedMonth.year), parseInt(selectedMonth.month) - 1).toLocaleString('default', { month: 'long' });

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 pb-12">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <CircleDollarSign className="w-6 h-6 text-primary" /> My Payroll
          </h2>
          <p className="text-sm text-muted-foreground">View and track your salary details</p>
        </div>
        <div className="flex items-center gap-2">
           <select 
             value={selectedMonth.month} 
             onChange={e => setSelectedMonth({...selectedMonth, month: e.target.value})}
             className="input-floating py-2 w-auto bg-card"
           >
              {Array.from({length: 12}, (_, i) => {
                const m = (i + 1).toString().padStart(2, '0');
                const name = new Date(2000, i).toLocaleString('default', { month: 'long' });
                return <option key={m} value={m}>{name}</option>;
              })}
           </select>
           <select 
             value={selectedMonth.year} 
             onChange={e => setSelectedMonth({...selectedMonth, year: e.target.value})}
             className="input-floating py-2 w-auto bg-card"
           >
              {['2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
           </select>
        </div>
      </motion.div>

      {loading ? (
        <div className="p-20 flex flex-col items-center justify-center glass-card">
           <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
           <p className="text-sm text-muted-foreground">Calculating your statement...</p>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Card */}
          <motion.div variants={fadeUp} className="lg:col-span-2 space-y-6">
            <div className="glass-card overflow-hidden border-t-4 border-t-primary">
              <div className="p-6 border-b border-glass-border bg-primary/5 flex justify-between items-center">
                 <div>
                    <h3 className="text-lg font-bold text-foreground">{monthName} {selectedMonth.year}</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Salary Statement</p>
                 </div>
                 {getStatusBadge(data.status)}
              </div>
              
              <div className="p-8 flex flex-col items-center text-center justify-center border-b border-glass-border bg-gradient-to-b from-transparent to-primary/5">
                 <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 border border-primary/20">
                    <Wallet className="w-8 h-8" />
                 </div>
                 <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Take-home Salary</p>
                 <h4 className="text-4xl font-display font-bold text-foreground flex items-center gap-1">
                    <IndianRupee className="w-8 h-8" /> {data.netSalary.toLocaleString()}
                 </h4>
                 {data.paidAt && (
                   <p className="mt-4 text-xs font-medium text-success flex items-center gap-1.5 bg-success/5 px-4 py-2 rounded-full border border-success/10">
                      <BadgeCheck className="w-4 h-4" /> Disbursed on {new Date(data.paidAt).toLocaleDateString()} via {data.paymentMethod}
                   </p>
                 )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2">
                 <div className="p-6 border-r border-glass-border">
                    <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                       <Clock className="w-3.5 h-3.5" /> Attendance Summary
                    </h5>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Present Days</span>
                          <span className="font-bold text-success bg-success/10 px-2 py-0.5 rounded">{data.presentDays} Days</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Late Check-ins</span>
                          <span className="font-bold text-warning bg-warning/10 px-2 py-0.5 rounded">{data.lateDays} Times</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Half-days</span>
                          <span className="font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">{data.halfDays} Days</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Approved Leaves</span>
                          <span className="font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">{data.leaveDays || 0} Days</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Absences</span>
                          <span className="font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded">{data.absentDays} Days</span>
                       </div>
                    </div>
                 </div>
                 <div className="p-6">
                    <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                       <History className="w-3.5 h-3.5" /> Financial Breakdown
                    </h5>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Base Salary</span>
                          <span className="font-bold">₹{data.baseSalary.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Daily Rate</span>
                          <span className="font-bold">₹{data.dailyRate.toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Payable Days</span>
                          <span className="font-bold text-primary">{data.payableDays}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm pt-2 border-t border-glass-border">
                          <span className="text-muted-foreground">Gross Salary</span>
                          <span className="font-bold text-foreground">₹{Math.round(data.grossSalary).toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm text-success">
                          <span className="font-medium">Bonus / Additions</span>
                          <span className="font-bold">+{data.bonus.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm text-destructive">
                          <span className="font-medium">Deductions</span>
                          <span className="font-bold">-{data.deductions.toLocaleString()}</span>
                       </div>
                    </div>
                 </div>
              </div>
              
              {isFinalized && data.status !== 'draft' && (
                <div className="p-6 bg-secondary/30 border-t border-glass-border flex justify-between items-center">
                   <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Download className="w-4 h-4" /> Official Payslip is ready
                   </div>
                   <ExportButton 
                     type="payslip" 
                     employeeId={user?._id || ''}
                     dateRange={{
                       from: `${selectedMonth.year}-${selectedMonth.month}-01`,
                       to: `${selectedMonth.year}-${selectedMonth.month}-${new Date(parseInt(selectedMonth.year), parseInt(selectedMonth.month), 0).getDate()}`
                     }}
                     label="Download Payslip (PDF)"
                     className="bg-primary text-white hover:bg-primary/90 font-bold rounded-xl"
                   />
                </div>
              )}
            </div>

            <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl flex gap-3">
               <Info className="w-5 h-5 text-primary shrink-0" />
               <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong>Notice:</strong> Your net salary is calculated based on the 100% of your daily rate for Present and Late days, and 50% for Half-days. Approved leaves and holidays are counted as fully payable days.
               </p>
            </div>
          </motion.div>

          {/* Sidebar - History */}
          <motion.div variants={fadeUp} className="space-y-6">
            <div className="glass-card p-6 border-l-4 border-l-purple-500">
               <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-500" /> Payment History
               </h5>
               <div className="space-y-4">
                  {history.length > 0 ? history.slice(0, 5).map((h, i) => (
                    <button 
                      key={h._id} 
                      onClick={() => setSelectedMonth({ month: h.month.toString().padStart(2, '0'), year: h.year.toString() })}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary/50 transition-colors border border-transparent hover:border-glass-border group text-left"
                    >
                       <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-secondary text-muted-foreground group-hover:text-primary transition-colors">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                             <p className="text-sm font-bold text-foreground">
                                {new Date(h.year, h.month - 1).toLocaleString('default', { month: 'short' })} {h.year}
                             </p>
                             <p className="text-[10px] text-muted-foreground">₹{h.netSalary.toLocaleString()}</p>
                          </div>
                       </div>
                       <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  )) : (
                    <p className="text-xs text-center text-muted-foreground py-10">No previous records found.</p>
                  )}
               </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="p-20 text-center glass-card">
           <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
           <p className="text-muted-foreground">Fetching data...</p>
        </div>
      )}
    </motion.div>
  );
};

export default EmployeePayroll;
