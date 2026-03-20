import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Loader2, Info } from 'lucide-react';
import { api } from '@/lib/api';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const EmployeeNoticeBoard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<any[]>([]);

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
            <Megaphone className="w-6 h-6 text-purple-500" /> Company Notice Board
          </h2>
          <p className="text-sm text-muted-foreground">Stay updated with official global and team announcements</p>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {notices.length === 0 ? (
          <div className="col-span-full p-20 text-center glass-card text-muted-foreground flex flex-col items-center">
             <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
               <Megaphone className="w-8 h-8 opacity-50" />
             </div>
             <p className="text-lg font-bold">No active announcements</p>
             <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          notices.map((notice, idx) => (
            <div key={notice._id || idx} className="glass-card flex flex-col relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 hover:shadow-xl hover:shadow-purple-500/10 h-full">
              {/* Priority Bar Indicator */}
              <div className={`absolute left-0 top-0 w-1.5 h-full ${
                notice.priority === 'urgent' ? 'bg-destructive' :
                notice.priority === 'high' ? 'bg-warning' :
                notice.priority === 'medium' ? 'bg-primary' : 'bg-secondary'
              }`} />
              
              <div className="p-6 flex flex-col flex-1 pl-7">
                <div className="flex items-start justify-between mb-4 gap-4">
                  <h3 className="font-display font-bold text-lg text-foreground leading-tight">{notice.title}</h3>
                  {notice.priority === 'high' || notice.priority === 'urgent' ? (
                     <div className="shrink-0">
                       <span className="text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/20 px-2 py-1 rounded-full uppercase flex items-center gap-1 shadow-sm">
                         <Info className="w-3 h-3" /> Critical
                       </span>
                     </div>
                  ) : (
                     <span className={`shrink-0 text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border ${
                        notice.priority === 'medium' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-secondary text-muted-foreground border-glass-border'
                     }`}>
                        {notice.priority}
                     </span>
                  )}
                </div>
                
                <div className="flex-1 mb-6">
                   <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{notice.content}</p>
                </div>

                <div className="pt-4 mt-auto border-t border-glass-border flex items-center justify-between text-xs text-muted-foreground">
                   <div className="flex items-center gap-2">
                      <span className="font-bold uppercase tracking-wide text-[10px]">Posted By:</span>
                      <span className="font-bold text-foreground">{notice.createdBy?.name || 'Admin'}</span>
                   </div>
                   <span className="font-mono bg-secondary/50 px-2 py-1 rounded">
                     {new Date(notice.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric'})}
                   </span>
                </div>
              </div>
            </div>
          ))
        )}
      </motion.div>
    </motion.div>
  );
};

export default EmployeeNoticeBoard;
