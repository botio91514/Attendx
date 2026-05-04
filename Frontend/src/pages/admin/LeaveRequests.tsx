import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getStatusColor } from '@/utils/statusUtils';
import EmptyState from '@/components/EmptyState';
import { Check, X, Loader2, Download, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ExportButton } from '@/components/ExportButton';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { getISTToday } from '@/utils/dateUtils';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const tabs = ['Pending', 'Approved', 'Rejected', 'All'] as const;

const LeaveRequests: React.FC = () => {
  const { fetchNotifications } = useNotifications();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Pending');
  const [loading, setLoading] = useState(true);
  const [csvLoading, setCsvLoading] = useState(false);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [exportRange, setExportRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    to: getISTToday()
  });
  const [exportEmp, setExportEmp] = useState('');
  
  const uniqueEmployees = Array.from(new Map(leaves.map(l => [l.userId?._id, l.userId])).values()).filter(Boolean);

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

  const handleBulkLeaveCSV = async () => {
    try {
      setCsvLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/export/leave/all/csv?from=${exportRange.from}&to=${exportRange.to}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('CSV Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leave_report_${exportRange.from}_to_${exportRange.to}.csv`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); a.remove();
      toast.success('Leave CSV downloaded!');
    } catch { toast.error('Failed to export CSV'); }
    finally { setCsvLoading(false); }
  };

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
      <motion.div variants={fadeUp} className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Leave Requests</h2>
          <p className="text-sm text-muted-foreground">Review and manage employee leave applications</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
           <input type="date" value={exportRange.from} onChange={e => setExportRange({...exportRange, from: e.target.value})} className="input-floating" />
           <span className="text-muted-foreground opacity-50">-</span>
           <input type="date" value={exportRange.to} onChange={e => setExportRange({...exportRange, to: e.target.value})} className="input-floating" />
           <select value={exportEmp} onChange={e => setExportEmp(e.target.value)} className="input-floating bg-card max-w-[200px]">
              <option value="">Select Employee</option>
              {uniqueEmployees.map((emp: any) => (
                 <option key={emp._id} value={emp._id}>{emp.name}</option>
              ))}
           </select>
           <ExportButton type="leave" employeeId={exportEmp} dateRange={exportRange} label="Employee PDF" />
           <button
             onClick={handleBulkLeaveCSV}
             disabled={csvLoading}
             className="glow-button flex items-center gap-2 text-sm py-2 px-3"
           >
             {csvLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
             Bulk CSV
           </button>
        </div>
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
                {leave.attachment && (
                  <a 
                    href={leave.attachment} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                    title="View Medical Certificate"
                  >
                    <FileText className="w-4 h-4" />
                  </a>
                )}
              </div>
              <div className="flex flex-col gap-1 items-center">
                <span className="status-leave text-xs">{leave.leaveType}</span>
                {leave.isHalfDay && <span className="bg-amber-500/10 text-amber-500 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/20 uppercase">Half Day</span>}
              </div>
              <div className="flex flex-col items-end gap-1 px-4 border-l border-glass-border">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Engine Breakdown</span>
                <div className="flex gap-1">
                   {leave.clDays > 0 && <span className="px-1.5 py-0.5 rounded bg-success/10 text-success text-[10px] font-bold border border-success/20">{leave.clDays} CL</span>}
                   {leave.slDays > 0 && <span className="px-1.5 py-0.5 rounded bg-success/10 text-success text-[10px] font-bold border border-success/20">{leave.slDays} SL</span>}
                   {leave.rlDays > 0 && <span className="px-1.5 py-0.5 rounded bg-success/10 text-success text-[10px] font-bold border border-success/20">{leave.rlDays} RL</span>}
                   {leave.lwpDays > 0 && <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-bold border border-destructive/20">{leave.lwpDays} LWP</span>}
                </div>
              </div>
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
