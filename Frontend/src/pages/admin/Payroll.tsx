import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CircleDollarSign, Loader2, Download, Search, Filter, AlertCircle, Info, TrendingUp, Wallet, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const Payroll: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalPayout: 0,
    avgSalary: 0,
    staffCount: 0
  });

  const now = new Date();
  const [filters, setFilters] = useState({
    month: (now.getMonth() + 1).toString().padStart(2, '0'),
    year: now.getFullYear().toString(),
    search: ''
  });

  const fetchPayroll = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/payroll/admin/summary?month=${filters.month}&year=${filters.year}`);
      if (res.success && res.data) {
        setPayroll(res.data.payroll);
        
        let total = 0;
        res.data.payroll.forEach((p: any) => total += p.calculations.grossSalary);
        
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
          <p className="text-sm text-muted-foreground">Automated monthly payout calculations based on attendance</p>
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
                return <option key={m} value={m}>{name}</option>
              })}
           </select>
           <select 
             value={filters.year} 
             onChange={e => setFilters({...filters, year: e.target.value})}
             className="input-floating py-2 w-auto bg-card"
           >
              {['2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
           </select>
           <button className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <Download className="w-5 h-5" />
           </button>
        </div>
      </motion.div>

      {/* Overview Cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
         <div className="glass-card p-5 border-l-4 border-l-primary relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
               <div className="p-2 rounded-lg bg-primary/10 text-primary"><Wallet className="w-5 h-5" /></div>
               <span className="text-[10px] font-bold text-success flex items-center gap-1 uppercase bg-success/10 px-2 py-0.5 rounded-full"><TrendingUp className="w-3 h-3" /> Monthly Budget</span>
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Payouts</p>
            <p className="text-2xl font-display font-bold text-foreground">₹{stats.totalPayout.toLocaleString()}</p>
         </div>
         <div className="glass-card p-5 border-l-4 border-l-purple-500">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 w-fit mb-2"><ArrowUpRight className="w-5 h-5" /></div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Average Salary</p>
            <p className="text-2xl font-display font-bold text-foreground">₹{stats.avgSalary.toLocaleString()}</p>
         </div>
         <div className="glass-card p-5 border-l-4 border-l-blue-500">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 w-fit mb-2"><Filter className="w-5 h-5" /></div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Payable Staff</p>
            <p className="text-2xl font-display font-bold text-foreground">{stats.staffCount} Members</p>
         </div>
      </motion.div>

      <motion.div variants={fadeUp} className="space-y-4">
        <div className="relative max-w-xs">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
           <input 
             type="text" 
             value={filters.search} 
             onChange={e => setFilters({...filters, search: e.target.value})}
             className="input-floating pl-10" 
             placeholder="Search by name or ID..." 
           />
        </div>

        <div className="glass-card overflow-hidden">
           {loading ? (
             <div className="p-20 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Running automated calculations...</p>
             </div>
           ) : (
             <div className="overflow-x-auto">
                <table className="w-full">
                   <thead>
                      <tr className="border-b border-glass-border bg-secondary/30">
                         {['Employee', 'Base Pay', 'Attendance (P/H/A)', 'Net Payable', 'Gross Payout'].map(h => (
                           <th key={h} className="text-left text-xs font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider">{h}</th>
                         ))}
                      </tr>
                   </thead>
                   <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No records found for selected period.</td></tr>
                      ) : (
                        filtered.map(entry => (
                          <tr key={entry._id} className="border-b border-glass-border hover:bg-primary/5 transition-colors group">
                             <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-xs border border-primary/20">
                                      {entry.name.charAt(0)}
                                   </div>
                                   <div>
                                      <p className="text-sm font-bold text-foreground">{entry.name}</p>
                                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-tighter">{entry.employeeId}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-5 py-4 text-sm font-semibold text-muted-foreground">₹{entry.baseSalary.toLocaleString()}</td>
                             <td className="px-5 py-4">
                                <div className="flex gap-1.5 items-center">
                                   <div className="px-1.5 py-0.5 rounded bg-success/10 text-success text-[10px] font-bold border border-success/20" title="Present">{entry.stats.present}</div>
                                   <div className="px-1.5 py-0.5 rounded bg-warning/10 text-warning text-[10px] font-bold border border-warning/20" title="Half-days">{entry.stats.halfDay}</div>
                                   <div className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-bold border border-destructive/20" title="Absences">{entry.stats.absent}</div>
                                </div>
                             </td>
                             <td className="px-5 py-4 text-sm font-mono text-muted-foreground">{entry.calculations.payableDays} Days</td>
                             <td className="px-5 py-4">
                                <div className="flex flex-col">
                                   <span className="text-sm font-bold text-foreground">₹{entry.calculations.grossSalary.toLocaleString()}</span>
                                   <span className="text-[10px] text-muted-foreground italic">Rate: ₹{entry.calculations.dailyRate}/day</span>
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
              <strong>Calculation Logic:</strong> Monthly payouts are calculated by dividing the base salary by total possible working days (weekdays excluding holidays), then multiplying by effective present days (Present + 0.5 for Half-days). 
           </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Payroll;
