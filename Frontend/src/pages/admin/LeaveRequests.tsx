import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getStatusColor } from '@/utils/statusUtils';
import EmptyState from '@/components/EmptyState';
import { Check, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useNotifications } from '@/context/NotificationContext';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const tabs = ['Pending', 'Approved', 'Rejected', 'All'] as const;

const LeaveRequests: React.FC = () => {
  const { fetchNotifications } = useNotifications();
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Pending');
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<any[]>([]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get('/leave/admin/all');
      if (res.success && res.data && Array.isArray(res.data.leaves)) {
        setLeaves(res.data.leaves);
      }
    } catch (error) {
      console.error('Failed to fetch leave requests', error);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await api.put(`/leave/admin/${id}/${action}`, {});
      if (res.success) {
        toast.success(`Leave ${action}d successfully`);
        fetchLeaves();
        fetchNotifications(true); // Force refresh counts immediately
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} leave`);
    }
  };

  const filtered = Array.isArray(leaves) 
    ? (activeTab === 'All'
        ? leaves
        : leaves.filter(l => l.status.toLowerCase() === activeTab.toLowerCase()))
    : [];

  const pendingCount = leaves.filter(l => l.status === 'pending').length;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6">
      <motion.div variants={fadeUp}>
        <h2 className="text-2xl font-display font-bold text-foreground">Leave Requests</h2>
        <p className="text-sm text-muted-foreground">Review and manage employee leave applications</p>
      </motion.div>

      <motion.div variants={fadeUp} className="flex gap-1 p-1 glass-card w-fit">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
            {tab === 'Pending' && pendingCount > 0 && (
              <span className="ml-1.5 text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </motion.div>

      {filtered.length === 0 ? (
        <EmptyState message="No leave requests" />
      ) : (
        <motion.div variants={fadeUp} className="grid gap-4">
          {filtered.map(leave => (
            <div key={leave._id} className="glass-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {leave.userId?.name?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{leave.userId?.name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{leave.reason}</p>
                </div>
              </div>
              <span className="status-leave text-xs">{leave.leaveType}</span>
              <span className="text-sm font-mono text-muted-foreground">{formatDate(leave.startDate)} → {formatDate(leave.endDate)}</span>
              <span className="text-sm font-mono text-foreground">{leave.totalDays}d</span>
              <span className={getStatusColor(leave.status)}>{leave.status}</span>
              {leave.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleAction(leave._id, 'approve')} className="glow-button-success py-1.5 px-3 text-xs flex items-center gap-1"><Check className="w-3 h-3" /> Approve</button>
                  <button onClick={() => handleAction(leave._id, 'reject')} className="glow-button-danger py-1.5 px-3 text-xs flex items-center gap-1"><X className="w-3 h-3" /> Reject</button>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
};

export default LeaveRequests;
