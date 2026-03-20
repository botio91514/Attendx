import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Palmtree, Loader2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const EmployeeHolidays: React.FC = () => {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchHolidays = async () => {
    try {
      const res = await api.get('/holidays');
      if (res.success && Array.isArray(res.data)) {
        // Sort by date ascending
        const sorted = res.data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setHolidays(sorted);
      }
    } catch (error) {
       toast.error('Failed to fetch holidays');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const filteredHolidays = holidays.filter(h => 
    h.title.toLowerCase().includes(search.toLowerCase()) ||
    h.type.toLowerCase().includes(search.toLowerCase())
  );

  const upcomingHolidays = filteredHolidays.filter(h => {
    const d = new Date(h.date);
    d.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    return d >= today;
  });

  const pastHolidays = filteredHolidays.filter(h => {
    const d = new Date(h.date);
    d.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    return d < today;
  });

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 max-w-6xl mx-auto w-full pb-8">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Office Holidays</h2>
          <p className="text-sm text-muted-foreground">Official company closures and public holidays</p>
        </div>
        <div className="relative w-full sm:w-64">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
           <input 
             type="text" 
             placeholder="Search holidays..." 
             className="w-full pl-9 h-10 bg-card border border-glass-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
             value={search}
             onChange={(e) => setSearch(e.target.value)}
           />
        </div>
      </motion.div>

      {/* Upcoming Holidays */}
      {upcomingHolidays.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Palmtree className="w-5 h-5 text-success" />
            <h3 className="font-display font-bold text-lg text-foreground">Upcoming</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingHolidays.map((holiday, i) => {
               const d = new Date(holiday.date);
               return (
                  <div key={i} className="glass-card p-5 relative overflow-hidden group border-success/20 hover:border-success/50 transition-colors">
                     <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-success/10 transition-colors" />
                     <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                           <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{holiday.type}</p>
                           <h4 className="text-lg font-bold text-foreground">{holiday.title}</h4>
                        </div>
                        <div className="text-right flex-shrink-0">
                           <span className="text-3xl font-mono font-bold text-success/80 block leading-none">{d.getDate()}</span>
                           <span className="text-xs font-bold text-success uppercase">{d.toLocaleDateString([], { month: 'short' })}</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 text-sm text-muted-foreground relative z-10">
                        <Calendar className="w-4 h-4" />
                        <span>{d.toLocaleDateString([], { weekday: 'long', year: 'numeric' })}</span>
                     </div>
                  </div>
               )
            })}
          </div>
        </motion.div>
      )}

      {/* Past Holidays */}
      {pastHolidays.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-4 mt-8 opacity-70 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2 mb-2 pt-6 border-t border-glass-border">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-display font-bold text-lg text-foreground">Past Holidays</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastHolidays.map((holiday, i) => {
               const d = new Date(holiday.date);
               return (
                  <div key={i} className="glass-card p-4 grayscale group hover:grayscale-0 transition-all duration-300">
                     <div className="flex justify-between items-center">
                        <div>
                           <h4 className="font-bold text-sm text-foreground mb-1">{holiday.title}</h4>
                           <p className="text-xs text-muted-foreground">{d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-secondary text-muted-foreground uppercase">{holiday.type}</span>
                     </div>
                  </div>
               )
            })}
          </div>
        </motion.div>
      )}

      {filteredHolidays.length === 0 && !loading && (
         <motion.div variants={fadeUp} className="glass-card p-12 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No holidays found</p>
            <p className="text-sm">We couldn't find anything matching your search query.</p>
         </motion.div>
      )}
    </motion.div>
  );
};

export default EmployeeHolidays;
