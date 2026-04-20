import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Loader2, Info, FileText, Calendar, ShieldCheck, Flame, Palmtree, ArrowRight, Filter, Clock, User as UserIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const EmployeeNoticeBoard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [selectedNotice, setSelectedNotice] = useState<any>(null);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const res = await api.get('/announcements');
      if (res.success && Array.isArray(res.data)) {
        setNotices(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch notices', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const getCategoryIcon = (cat: string) => {
    switch(cat) {
      case 'policy': return <FileText className="w-5 h-5" />;
      case 'event': return <Calendar className="w-5 h-5" />;
      case 'holiday': return <Palmtree className="w-5 h-5" />;
      case 'safety': return <ShieldCheck className="w-5 h-5" />;
      case 'critical': return <Flame className="w-5 h-5" />;
      default: return <Megaphone className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (cat: string) => {
    switch(cat) {
      case 'policy': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'event': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      case 'holiday': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'safety': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'critical': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-primary bg-primary/10 border-primary/20';
    }
  };

  const filteredNotices = filter === 'all' 
    ? notices 
    : notices.filter(n => n.category === filter);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 pb-12">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" /> Company Notice Board
          </h2>
          <p className="text-sm text-muted-foreground">Stay updated with official global and team announcements</p>
        </div>
        <div className="flex items-center gap-2">
           <Filter className="w-4 h-4 text-muted-foreground mr-1" />
           <div className="flex bg-secondary/30 p-1 rounded-xl border border-glass-border overflow-x-auto no-scrollbar max-w-[300px] sm:max-w-none">
              {['all', 'policy', 'event', 'holiday', 'safety', 'critical', 'general'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    filter === cat ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
           </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNotices.length === 0 ? (
          <div className="col-span-full p-20 text-center glass-card text-muted-foreground flex flex-col items-center">
             <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
               <Megaphone className="w-8 h-8 opacity-50" />
             </div>
             <p className="text-lg font-bold">No announcements found</p>
             <p className="text-sm">Check back later for updates.</p>
          </div>
        ) : (
          filteredNotices.map((notice, idx) => (
            <div key={notice._id || idx} className="glass-card flex flex-col relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 h-full border-t-2 border-t-transparent hover:border-t-primary">
              <div className="p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2.5 rounded-xl border ${getCategoryColor(notice.category)} shadow-inner`}>
                    {getCategoryIcon(notice.category)}
                  </div>
                  {notice.priority === 'urgent' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-1 rounded-full animate-pulse">
                       <Flame className="w-3 h-3" /> URGENT
                    </span>
                  )}
                  {notice.priority === 'high' && notice.priority !== 'urgent' && (
                    <span className="text-[10px] font-bold text-warning bg-warning/10 px-2 py-1 rounded-full">
                       HIGH PRIORITY
                    </span>
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className="font-display font-bold text-lg text-foreground mb-3 group-hover:text-primary transition-colors">{notice.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-6">{notice.content}</p>
                </div>

                <div className="mt-8 pt-4 border-t border-glass-border flex flex-col gap-3">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                          {notice.createdBy?.name?.charAt(0) || 'A'}
                        </div>
                        <span className="text-xs font-bold text-foreground/80">{notice.createdBy?.name || 'Admin'}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground bg-secondary/30 px-2 py-1 rounded">
                        {new Date(notice.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric'})}
                      </span>
                   </div>
                   <button 
                      onClick={() => setSelectedNotice(notice)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-secondary/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-primary hover:text-white transition-all group-hover:bg-primary/10 group-hover:text-primary"
                   >
                      View Full Details <ArrowRight className="w-3 h-3" />
                   </button>
                </div>
              </div>
            </div>
          ))
        )}
      </motion.div>

      {/* Notice Detail Modal */}
      <Dialog open={!!selectedNotice} onOpenChange={() => setSelectedNotice(null)}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-none glass-card shadow-2xl flex flex-col max-h-[90vh]">
           {selectedNotice && (
             <>
                {/* Thin Priority Indicator at top */}
                <div className={`h-1.5 w-full shrink-0 ${
                  selectedNotice.priority === 'urgent' ? 'bg-destructive' :
                  selectedNotice.priority === 'high' ? 'bg-warning' :
                  selectedNotice.priority === 'medium' ? 'bg-primary' : 'bg-secondary'
                }`} />
                
                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
                   <div className="flex items-start gap-4 mb-8">
                      <div className={`p-3 rounded-2xl border shrink-0 ${getCategoryColor(selectedNotice.category)} shadow-lg shadow-black/5`}>
                        {getCategoryIcon(selectedNotice.category)}
                      </div>
                      <div>
                         <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{selectedNotice.category || 'General Notice'}</span>
                            {selectedNotice.priority === 'urgent' && (
                               <span className="flex items-center gap-1 text-[8px] font-black text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded uppercase border border-rose-500/20">
                                  Critical
                               </span>
                            )}
                         </div>
                         <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-tight tracking-tight">{selectedNotice.title}</h2>
                      </div>
                   </div>

                   <div className="space-y-8">
                      <div className="bg-secondary/15 p-6 sm:p-8 rounded-[2rem] border border-glass-border/50 relative">
                         {/* Subtle quote-like decoration */}
                         <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-background border border-glass-border flex items-center justify-center text-primary shadow-sm">
                            <Megaphone className="w-4 h-4" />
                         </div>
                         <p className="text-base sm:text-lg text-foreground/90 leading-relaxed whitespace-pre-line font-medium">
                           {selectedNotice.content}
                         </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-6 pt-6 border-t border-glass-border/50">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold border border-primary/10 text-xl shadow-inner">
                               {selectedNotice.createdBy?.name?.charAt(0) || 'A'}
                            </div>
                            <div>
                               <p className="text-sm font-black text-foreground tracking-tight">{selectedNotice.createdBy?.name || 'Authorized Admin'}</p>
                               <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-70">Official Broadcast</p>
                            </div>
                         </div>
                         
                         <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/80">
                               <Clock className="w-4 h-4 text-primary/60" /> {new Date(selectedNotice.createdAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                            </div>
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${
                               selectedNotice.priority === 'urgent' ? 'bg-destructive/10 text-destructive border-rose-500/30' :
                               selectedNotice.priority === 'high' ? 'bg-warning/10 text-warning border-warning/30' :
                               'bg-primary/10 text-primary border-primary/30'
                            }`}>
                               {selectedNotice.priority} Severity
                            </span>
                         </div>
                      </div>
                   </div>
                </div>
                
                {/* Fixed Footer */}
                <div className="bg-secondary/30 backdrop-blur-md p-4 sm:p-6 flex justify-end border-t border-glass-border/30 shrink-0">
                   <button 
                     onClick={() => setSelectedNotice(null)}
                     className="w-full sm:w-auto px-10 py-3 rounded-2xl bg-primary text-white font-bold text-sm shadow-xl shadow-primary/30 hover:scale-[1.02] transition-all active:scale-[0.98]"
                   >
                     Understood
                   </button>
                </div>
             </>
           )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default EmployeeNoticeBoard;
