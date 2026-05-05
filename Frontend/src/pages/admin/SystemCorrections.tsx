import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Calendar, Clock, Coffee, CheckSquare, Save, AlertTriangle, 
  Plus, Trash2, ArrowRight, ShieldCheck, Zap, 
  History, Info, ChevronRight, LayoutList
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

// 🛡️ Rule: Strip 'Z' to prevent browser timezone shifting (IST-as-UTC strategy)
const parseDBDate = (dateString: string) => {
  if (!dateString) return '';
  return dateString.replace('Z', '').substring(0, 16); // "YYYY-MM-DDTHH:mm"
};

const SystemCorrections: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [targetDate, setTargetDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    checkIn: '', checkOut: '', status: '', notes: '', breaks: [] as any[]
  });

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data.employees || []);
    } catch (err) { console.error('Failed to fetch employees'); }
  };

  const loadRecord = async (empId: string, date: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance/admin/all?date=${date}`);
      const data = (res.data.attendance || []).find((r: any) => r.userId?._id === empId || r.userId === empId);
      
      if (data) {
        setFormData({
          checkIn: parseDBDate(data.checkIn),
          checkOut: parseDBDate(data.checkOut),
          status: data.status || 'absent',
          notes: data.notes || '',
          breaks: (data.breaks || []).map((b: any) => ({
            ...b,
            breakStart: parseDBDate(b.breakStart),
            breakEnd: parseDBDate(b.breakEnd)
          }))
        });
      } else {
        setFormData({ checkIn: '', checkOut: '', status: 'absent', notes: '', breaks: [] });
      }

      const taskRes = await api.get('/tasks/admin/all');
      const empTasks = (taskRes.data.tasks || []).filter((t: any) => 
        (t.assignedTo?._id === empId || t.assignedTo === empId) && 
        (t.date === date || (t.createdAt && t.createdAt.startsWith(date)))
      );
      setTasks(empTasks);
    } catch (err) { toast.error('Failed to sync records'); }
    finally { setLoading(false); }
  };

  const handleOverride = async () => {
    if (!selectedEmp) return;

    // 🛡️ Data Integrity Check
    if (formData.checkIn && formData.checkOut) {
       if (new Date(formData.checkOut) < new Date(formData.checkIn)) {
          toast.error('System Logic Violation: Check-Out cannot be before Check-In.');
          return;
       }
    }

    setSaving(true);
    try {
      await api.post('/admin/attendance/override', { 
        userId: selectedEmp._id, 
        date: targetDate, 
        ...formData 
      });
      toast.success('System Overwritten Successfully');
      loadRecord(selectedEmp._id, targetDate);
    } catch (err) { toast.error('Override Failed'); }
    finally { setSaving(false); }
  };

  const updateBreak = (index: number, field: string, value: string) => {
     setFormData(prev => {
        const b = [...prev.breaks];
        b[index][field] = value;
        return { ...prev, breaks: b };
     });
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 pb-12">
      {/* Header - Same as Reports.tsx */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-display font-bold text-foreground">System Corrections</h2>
           <p className="text-sm text-muted-foreground">Administrative override console for manual record adjustments</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="px-4 py-2 bg-primary/10 rounded-xl border border-primary/20 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Admin Power Mode</span>
           </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Staff Selector (Standard System Style) */}
        <motion.div variants={fadeUp} className="lg:col-span-3 space-y-4 flex flex-col h-full min-h-[600px]">
           <div className="glass-card p-4 flex flex-col h-full">
              <div className="relative mb-4">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                 <input 
                   type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                   placeholder="Search employee..."
                   className="input-floating pl-10 h-10"
                 />
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                 {filteredEmployees.map((emp) => (
                    <button
                      key={emp._id}
                      onClick={() => { setSelectedEmp(emp); loadRecord(emp._id, targetDate); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${
                        selectedEmp?._id === emp._id 
                          ? 'bg-primary text-white border-primary shadow-lg shadow-primary/10' 
                          : 'bg-secondary/30 border-glass-border hover:bg-secondary/50'
                      }`}
                    >
                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${selectedEmp?._id === emp._id ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
                          {emp.name.charAt(0)}
                       </div>
                       <div className="text-left flex-1 min-w-0">
                          <p className="text-sm font-bold truncate leading-tight">{emp.name}</p>
                          <p className={`text-[10px] font-mono ${selectedEmp?._id === emp._id ? 'text-white/60' : 'text-muted-foreground'}`}>{emp.employeeId}</p>
                       </div>
                    </button>
                 ))}
              </div>
           </div>
        </motion.div>

        {/* Right: Interface Deck */}
        <motion.div variants={fadeUp} className="lg:col-span-9 space-y-6">
           <AnimatePresence mode="wait">
              {!selectedEmp ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card flex flex-col items-center justify-center p-20 text-center opacity-30 border-dashed border-2">
                   <LayoutList className="w-12 h-12 mb-4" />
                   <p className="text-lg font-bold">Awaiting Target Selection</p>
                   <p className="text-sm">Select an employee from the explorer to begin correction.</p>
                </motion.div>
              ) : (
                <motion.div 
                   key={selectedEmp._id}
                   initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                   className="space-y-6"
                >
                   {/* Context Sub-Bar */}
                   <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4 border-l-4 border-primary">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold border border-primary/20">
                            {selectedEmp.name.charAt(0)}
                         </div>
                         <div>
                            <h4 className="text-lg font-bold">{selectedEmp.name}</h4>
                            <p className="text-xs text-muted-foreground uppercase">{selectedEmp.designation} • {selectedEmp.department}</p>
                         </div>
                      </div>
                      <div className="flex flex-col items-end">
                         <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Target Date</label>
                         <input 
                           type="date" value={targetDate} 
                           onChange={(e) => { setTargetDate(e.target.value); loadRecord(selectedEmp._id, e.target.value); }}
                           className="input-floating h-9 px-3 w-40"
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* SHIFT TIMINGS */}
                      <div className="glass-card p-6 space-y-6">
                         <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2 border-b border-glass-border pb-3">
                            <Clock className="w-4 h-4" /> Shift Configuration
                         </h3>
                         <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                               <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2 px-1">
                                     <ArrowRight className="w-3 h-3 text-success" /> Manual Check-In
                                  </label>
                                  <input type="datetime-local" value={formData.checkIn} onChange={(e) => setFormData({...formData, checkIn: e.target.value})} className="input-floating h-10 px-3 font-mono text-xs" />
                               </div>
                               <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2 px-1">
                                     <ArrowRight className="w-3 h-3 text-destructive rotate-180" /> Manual Check-Out
                                  </label>
                                  <input type="datetime-local" value={formData.checkOut} onChange={(e) => setFormData({...formData, checkOut: e.target.value})} className="input-floating h-10 px-3 font-mono text-xs" />
                               </div>
                               <div className="space-y-1.5 pt-2">
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Integrity Status Override</label>
                                  <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="input-floating h-10 px-3 bg-card font-bold">
                                     <option value="present">Automatic System Check</option>
                                     <option value="absent">Forced Absence</option>
                                     <option value="late">Force Late Arrival</option>
                                     <option value="half-day">Force Half-Day</option>
                                     <option value="leave">Officer on Leave</option>
                                     <option value="holiday">Public Holiday</option>
                                  </select>
                               </div>
                            </div>
                         </div>
                      </div>

                      {/* BREAK EDITOR */}
                      <div className="glass-card p-6 flex flex-col h-full">
                         <div className="flex items-center justify-between mb-4 border-b border-glass-border pb-3">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                               <Coffee className="w-4 h-4" /> Break Timeline
                            </h3>
                            <button onClick={() => setFormData({...formData, breaks: [...formData.breaks, { breakStart: format(new Date(), "yyyy-MM-dd'T'HH:mm"), breakEnd: '', duration: 0 }]})} className="p-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-all shadow-sm shadow-primary/10">
                               <Plus className="w-4 h-4" />
                            </button>
                         </div>
                         <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1 max-h-[300px]">
                            {formData.breaks.length === 0 ? (
                               <div className="flex flex-col items-center justify-center h-40 opacity-20 italic space-y-2">
                                  <Coffee className="w-8 h-8" />
                                  <span className="text-[10px] uppercase font-bold tracking-widest">No Break Activity Found</span>
                               </div>
                            ) : (
                               formData.breaks.map((br, i) => (
                                  <div key={i} className="p-4 bg-secondary/30 rounded-xl border border-glass-border relative group shadow-sm">
                                     <button onClick={() => { let b = [...formData.breaks]; b.splice(i,1); setFormData({...formData, breaks: b}); }} className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10">
                                        <Trash2 className="w-3 h-3" />
                                     </button>
                                     <div className="space-y-3">
                                        <input type="datetime-local" value={br.breakStart} onChange={(e) => updateBreak(i,'breakStart', e.target.value)} className="bg-transparent border-none text-[10px] font-mono p-0 outline-none w-full font-bold focus:text-primary transition-colors" />
                                        <div className="h-[1px] bg-glass-border w-full opacity-50 border-dashed border-b" />
                                        <input type="datetime-local" value={br.breakEnd} onChange={(e) => updateBreak(i,'breakEnd', e.target.value)} className="bg-transparent border-none text-[10px] font-mono p-0 outline-none w-full font-bold opacity-60 focus:opacity-100 focus:text-primary transition-all" />
                                     </div>
                                  </div>
                               ))
                            )}
                         </div>
                      </div>
                   </div>

                   {/* REASONING & OUTPUT */}
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2 glass-card p-6 space-y-4">
                         <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2 border-b border-glass-border pb-3">
                            <History className="w-4 h-4" /> Correction Protocol Notes
                         </h3>
                         <textarea 
                            value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                            placeholder="State the justification for this system overwrite... (Internal Audit Use)"
                            className="input-floating min-h-[140px] text-sm p-4 w-full"
                         />
                      </div>
                      <div className="glass-card p-6 space-y-4">
                         <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2 border-b border-glass-border pb-3">
                            <CheckSquare className="w-4 h-4" /> Task Load
                         </h3>
                         <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                            {tasks.length === 0 ? (
                               <div className="p-4 border border-dashed border-glass-border rounded-xl text-center opacity-30 italic text-[10px]">Zero Task Entropy Detected</div>
                            ) : (
                               tasks.map(t => (
                                  <div key={t._id} className="p-2.5 bg-secondary/50 rounded-lg border border-glass-border flex items-center justify-between gap-3">
                                     <span className="text-[10px] font-bold truncate leading-none uppercase">{t.title}</span>
                                     <span className="text-[9px] font-black text-primary opacity-60 shrink-0">{Math.floor(t.totalTime / 60)}m</span>
                                  </div>
                               ))
                            )}
                         </div>
                      </div>
                   </div>

                   {/* FORCE COMMIT BUTTON */}
                   <button 
                     onClick={handleOverride} disabled={saving}
                     className="w-full glow-button bg-primary text-white py-6 rounded-2xl flex items-center justify-center gap-4 text-xl font-bold shadow-2xl transition-all disabled:opacity-50 disabled:cursor-wait active:scale-[0.98]"
                   >
                      {saving ? (
                        <Zap className="w-8 h-8 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-8 h-8" />
                      )}
                      <div className="text-left">
                         <p className="leading-none text-lg">Verify & Commit System Overwrite</p>
                         <p className="text-[10px] font-normal opacity-70 tracking-widest uppercase mt-0.5">Authorizing Immutable Audit Mutation</p>
                      </div>
                   </button>
                </motion.div>
              )}
           </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SystemCorrections;
