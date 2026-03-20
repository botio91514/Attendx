import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Plus, Trash2, Loader2, Search, Info, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const Holidays: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    title: '',
    date: '',
    description: '',
    type: 'company'
  });

  // Deletion State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<any>(null);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const res = await api.get('/holidays');
      if (res.success && Array.isArray(res.data)) {
        setHolidays(res.data);
      }
    } catch (error) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.post('/holidays', newHoliday);
      if (res.success) {
        toast.success('Holiday added successfully');
        setShowAddForm(false);
        setNewHoliday({ title: '', date: '', description: '', type: 'company' });
        fetchHolidays();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add holiday');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!holidayToDelete) return;
    try {
      const res = await api.delete(`/holidays/${holidayToDelete._id}`);
      if (res.success) {
        toast.success(`${holidayToDelete.title} removed from calendar`);
        fetchHolidays();
      }
    } catch (error) {
      toast.error('Failed to remove holiday');
    } finally {
      setHolidayToDelete(null);
    }
  };

  const handleDelete = (holiday: any) => {
    setHolidayToDelete(holiday);
    setDeleteModalOpen(true);
  };

  const filtered = holidays.filter(h => 
    h.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 pb-12">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" /> Office Calendar
          </h2>
          <p className="text-sm text-muted-foreground">Manage official holidays and office closures</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="glow-button flex items-center gap-2 px-6 py-2.5 font-bold"
        >
          <Plus className="w-5 h-5" /> Add New Holiday
        </button>
      </motion.div>

      {/* Stats/Info */}
      <motion.div variants={fadeUp} className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3 text-sm text-muted-foreground">
        <Info className="w-5 h-5 text-primary shrink-0" />
        <p>Holidays defined here will prevent employees from being marked as "Absent" on these dates in the attendance stats.</p>
      </motion.div>

      {/* Add Form Modal Overlay */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => setShowAddForm(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative glass-card w-full max-w-lg p-6 sm:p-8"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Calendar className="text-primary w-6 h-6" /> Create New Holiday
              </h3>
              <form onSubmit={handleAddHoliday} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Holiday Title</label>
                  <input 
                    required type="text" value={newHoliday.title} 
                    onChange={e => setNewHoliday({...newHoliday, title: e.target.value})}
                    placeholder="e.g. Christmas Day" className="input-floating"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Date</label>
                  <input 
                    required type="date" value={newHoliday.date} 
                    onChange={e => setNewHoliday({...newHoliday, date: e.target.value})}
                    className="input-floating"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Type</label>
                  <select 
                    value={newHoliday.type} 
                    onChange={e => setNewHoliday({...newHoliday, type: e.target.value})}
                    className="input-floating bg-card"
                  >
                    <option value="national">National Holiday</option>
                    <option value="company">Company Holiday</option>
                    <option value="local">Local Holiday</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Description (Optional)</label>
                  <textarea 
                    value={newHoliday.description} 
                    onChange={e => setNewHoliday({...newHoliday, description: e.target.value})}
                    className="input-floating min-h-[100px]"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  <button type="submit" disabled={saving} className="glow-button-primary flex-1 py-3 font-bold flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    Confirm Holiday
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main List */}
      <motion.div variants={fadeUp} className="space-y-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="input-floating pl-10" placeholder="Search holidays..."
          />
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? (
             <div className="p-20 flex flex-col items-center justify-center space-y-4">
               <Loader2 className="w-10 h-10 animate-spin text-primary" />
               <p className="text-muted-foreground">Syncing calendar...</p>
             </div>
          ) : filtered.length === 0 ? (
            <div className="p-20 text-center text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No upcoming holidays found.</p>
            </div>
          ) : (
             <div className="divide-y divide-glass-border">
                {filtered.map(holiday => (
                   <div key={holiday._id} className="p-6 hover:bg-secondary/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                         <div className="flex flex-col items-center justify-center min-w-[60px] p-2 rounded-xl bg-primary/10 border border-primary/20">
                            <span className="text-xs font-bold text-primary uppercase">{new Date(holiday.date).toLocaleDateString([], { month: 'short' })}</span>
                            <span className="text-xl font-bold text-primary">{new Date(holiday.date).getDate()}</span>
                         </div>
                         <div>
                            <h4 className="font-bold text-foreground text-lg">{holiday.title}</h4>
                            <p className="text-sm text-muted-foreground">{holiday.description || 'Global office closure'}</p>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground mt-2 inline-block italic tracking-widest">{holiday.type} holiday</span>
                         </div>
                      </div>
                      <button 
                        onClick={() => handleDelete(holiday)}
                        className="p-3 text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                      >
                         <Trash2 className="w-5 h-5" />
                      </button>
                   </div>
                ))}
             </div>
          )}
        </div>
      </motion.div>

      {/* Security Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Remove Office Holiday?"
        message={`This will remove "${holidayToDelete?.title}" from the office calendar. System will no longer consider this day as a holiday for attendance stats.`}
        confirmWord="DELETE"
      />
    </motion.div>
  );
};

export default Holidays;
