import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Plus, Trash2, Loader2, Search, Info, AlertCircle, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const Announcements: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNotice, setNewNotice] = useState({
    title: '',
    content: '',
    priority: 'medium',
    targetRole: 'all'
  });

  // Deletion State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<any>(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/announcements/admin/all');
      if (res.success && Array.isArray(res.data)) {
        setAnnouncements(res.data);
      }
    } catch (error) {
      toast.error('Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleAddNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.post('/announcements', newNotice);
      if (res.success) {
        toast.success('Announcement posted successfully');
        setShowAddForm(false);
        setNewNotice({ title: '', content: '', priority: 'medium', targetRole: 'all' });
        fetchAnnouncements();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to post announcement');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!noticeToDelete) return;
    try {
      const res = await api.delete(`/announcements/${noticeToDelete._id}`);
      if (res.success) {
        toast.success('Announcement universally removed');
        fetchAnnouncements();
      }
    } catch (error) {
      toast.error('Failed to remove announcement');
    } finally {
      setNoticeToDelete(null);
    }
  };

  const handleDelete = (notice: any) => {
    setNoticeToDelete(notice);
    setDeleteModalOpen(true);
  };

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'urgent': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'high': return 'bg-warning/10 text-warning border-warning/20';
      case 'medium': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-secondary text-muted-foreground border-glass-border';
    }
  };

  const filtered = announcements.filter(a => 
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 pb-12">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" /> Company Notice Board
          </h2>
          <p className="text-sm text-muted-foreground">Post global or targeted announcements to the entire team</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="glow-button flex items-center gap-2 px-6 py-2.5 font-bold"
        >
          <Plus className="w-5 h-5" /> Post New Announcement
        </button>
      </motion.div>

      {/* Add Form Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowAddForm(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative glass-card w-full max-w-lg p-6 sm:p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Megaphone className="text-primary w-6 h-6" /> New Announcement
              </h3>
              <form onSubmit={handleAddNotice} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Notice Title</label>
                  <input required type="text" value={newNotice.title} onChange={e => setNewNotice({...newNotice, title: e.target.value})} className="input-floating" placeholder="e.g. Office Closure Next Friday" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Priority</label>
                  <select value={newNotice.priority} onChange={e => setNewNotice({...newNotice, priority: e.target.value})} className="input-floating bg-card">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Target Audience</label>
                  <select value={newNotice.targetRole} onChange={e => setNewNotice({...newNotice, targetRole: e.target.value})} className="input-floating bg-card">
                    <option value="all">Everyone</option>
                    <option value="employee">Staff Only</option>
                    <option value="admin">Administrators Only</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Message Body</label>
                  <textarea required value={newNotice.content} onChange={e => setNewNotice({...newNotice, content: e.target.value})} className="input-floating min-h-[120px]" placeholder="Write your announcement details here..." />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 text-sm font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                  <button type="submit" disabled={saving} className="glow-button-primary flex-1 py-3 font-bold flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Megaphone className="w-5 h-5" />}
                    Broadcast Notice
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div variants={fadeUp} className="space-y-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="input-floating pl-10" placeholder="Search announcements..." />
        </div>

        <div className="grid gap-4">
          {loading ? (
             <div className="p-20 flex flex-col items-center justify-center glass-card">
               <Loader2 className="w-10 h-10 animate-spin text-primary" />
             </div>
          ) : filtered.length === 0 ? (
            <div className="p-20 text-center glass-card text-muted-foreground">No notices found.</div>
          ) : (
            filtered.map(notice => (
              <div key={notice._id} className="glass-card p-6 flex flex-col md:flex-row gap-6 relative overflow-hidden group">
                 {/* Priority indicator bar */}
                 <div className={`absolute top-0 left-0 bottom-0 w-1 ${
                   notice.priority === 'urgent' ? 'bg-destructive' :
                   notice.priority === 'high' ? 'bg-warning' :
                   notice.priority === 'medium' ? 'bg-primary' : 'bg-secondary'
                 }`} />

                 <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                       <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getPriorityColor(notice.priority)}`}>
                          {notice.priority}
                       </span>
                       <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground border border-glass-border">
                          For: {notice.targetRole}
                       </span>
                       <span className="text-xs text-muted-foreground italic">
                          {new Date(notice.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                       </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{notice.title}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{notice.content}</p>
                 </div>
                 
                 <div className="flex flex-col items-end justify-between gap-4">
                    <button 
                      onClick={() => handleDelete(notice._id)}
                      className="p-3 text-destructive hover:bg-destructive/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    >
                       <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase opacity-60">
                       By {notice.createdBy?.name || 'Admin'}
                    </div>
                 </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* Security Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Permanently Remove Announcement?"
        message={`This will universally remove "${noticeToDelete?.title}" from all employee notice boards. This action cannot be reversed.`}
        confirmWord="DELETE"
      />
    </motion.div>
  );
};

export default Announcements;
