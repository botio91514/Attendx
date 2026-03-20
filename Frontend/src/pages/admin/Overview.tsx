import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import StatCard from '@/components/StatCard';
import { Users, UserCheck, Palmtree, AlertTriangle, Loader2, Calendar, CircleDollarSign, Clock, Activity, ClipboardList } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { api } from '@/lib/api';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const AdminOverview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    onLeave: 0,
    lateToday: 0,
    presentRate: '0%',
    leaveRate: '0%',
    lateRate: '0%',
    totalPayout: 0,
    isHoliday: false,
    holidayTitle: ''
  });
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);

  const fetchAdminStats = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear().toString();

      const [empRes, attendanceRes, holidayRes, payrollRes, checkinRes, leavesRes] = await Promise.all([
        api.get('/employees'),
        api.get('/attendance/admin/stats'),
        api.get('/holidays'),
        api.get(`/payroll/admin/summary?month=${month}&year=${year}`),
        api.get(`/attendance/admin/all?date=${now.toISOString().split('T')[0]}&limit=50`),
        api.get('/leave/admin/all')
      ]);

      let totalEmp = 0;
      if (empRes.success && empRes.data) {
        totalEmp = empRes.data.pagination.total;
      }

      if (checkinRes.success && checkinRes.data && Array.isArray(checkinRes.data.attendance)) {
         const staffOnly = checkinRes.data.attendance
            .filter((r: any) => r.userId && r.userId.role !== 'admin' && r.checkIn)
            .sort((a: any, b: any) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime())
            .slice(0, 5);
         setRecentCheckins(staffOnly);
      }

      if (leavesRes.success && leavesRes.data && Array.isArray(leavesRes.data.leaves)) {
         const pending = leavesRes.data.leaves
            .filter((l: any) => l.status === 'pending')
            .sort((a: any, b: any) => new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime())
            .slice(0, 5);
         setPendingLeaves(pending);
      }

      let isHoliday = false;
      let holidayTitle = '';
      if (holidayRes.success && Array.isArray(holidayRes.data)) {
        const today = new Date().toISOString().split('T')[0];
        const todayHoliday = holidayRes.data.find((h: any) => h.date.split('T')[0] === today);
        if (todayHoliday) {
          isHoliday = true;
          holidayTitle = todayHoliday.title;
        }
      }

      if (attendanceRes.success && attendanceRes.data && attendanceRes.data.stats) {
        const { present = 0, absent = 0, late = 0 } = attendanceRes.data.stats;
        const presentToday = present + late;

        let totalPayout = 0;
        if (payrollRes.success && payrollRes.data) {
          payrollRes.data.payroll.forEach((p: any) => totalPayout += p.calculations.grossSalary);
        }

        setStats({
          totalEmployees: totalEmp,
          presentToday: presentToday,
          onLeave: isHoliday ? 0 : absent,
          lateToday: late,
          presentRate: totalEmp > 0 ? `${((presentToday / totalEmp) * 100).toFixed(1)}%` : '0%',
          leaveRate: (totalEmp > 0 && !isHoliday) ? `${((absent / totalEmp) * 100).toFixed(1)}%` : '0%',
          lateRate: totalEmp > 0 ? `${((late / totalEmp) * 100).toFixed(1)}%` : '0%',
          totalPayout,
          isHoliday,
          holidayTitle
        });
      }
    } catch (error) {
      console.error('Failed to fetch admin stats', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminStats();
  }, []);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h2 className="text-2xl font-display font-bold text-foreground">Admin Overview</h2>
        <p className="text-sm text-muted-foreground">Organization-wide attendance insights</p>
      </motion.div>

      {stats.isHoliday && (
        <motion.div variants={fadeUp} className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-primary">Office Closed: {stats.holidayTitle}</h4>
            <p className="text-xs text-muted-foreground">Attendance tracking is paused for today's holiday.</p>
          </div>
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={<Users />} label="Total Employees" value={stats.totalEmployees?.toString() || '0'} subtitle="Active workforce" accentClass="text-primary" />
        <StatCard icon={<UserCheck />} label="Present Today" value={stats.presentToday?.toString() || '0'} subtitle={stats.presentRate} accentClass="text-success" />
        <StatCard icon={<Palmtree />} label="Absentees" value={stats.onLeave?.toString() || '0'} subtitle={stats.leaveRate} accentClass="text-warning" />
        <StatCard icon={<AlertTriangle />} label="Late Today" value={stats.lateToday?.toString() || '0'} subtitle={stats.lateRate} accentClass="text-destructive" />
        <StatCard icon={<CircleDollarSign />} label="Est. Payout" value={`₹${stats.totalPayout.toLocaleString()}`} subtitle="Current Month" accentClass="text-purple-500" />
      </motion.div>

      <motion.div variants={fadeUp} className="mt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
             <Activity className="w-5 h-5 text-primary" />
             <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-success rounded-full animate-pulse-ring"></span>
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">Live Action Center</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Check-ins Panel */}
          <motion.div variants={fadeUp} className="glass-card flex flex-col overflow-hidden">
            <div className="p-5 border-b border-glass-border flex items-center justify-between bg-primary/5">
              <h3 className="font-display font-medium text-foreground flex items-center gap-2">
                 <Clock className="w-5 h-5 text-primary" /> Recent Check-ins
              </h3>
              <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-md uppercase tracking-widest">Real-time</span>
            </div>
            <div className="p-4 flex-1">
              {recentCheckins.length === 0 ? (
                 <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground/30">
                       <UserCheck className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium">No activity yet today</p>
                 </div>
              ) : (
                 <div className="space-y-3">
                   {recentCheckins.map((record, i) => (
                     <div key={i} className="flex items-center justify-between p-3 hover:bg-secondary/40 rounded-xl transition-all border border-transparent hover:border-glass-border group">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner border border-primary/20 group-hover:scale-110 transition-transform">
                             {record.userId?.name?.charAt(0) || 'U'}
                           </div>
                           <div>
                             <p className="text-sm font-bold text-foreground leading-tight">{record.userId?.name || 'Unknown'}</p>
                             <p className="text-[11px] text-muted-foreground mt-0.5">{record.userId?.department || 'Operations'}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-sm font-mono font-bold text-foreground">{new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                           <span className={`status-${record.status} text-[9px] uppercase tracking-tighter mt-1`}>{record.status}</span>
                        </div>
                     </div>
                   ))}
                 </div>
              )}
            </div>
          </motion.div>
          
          {/* Action Queue Panel */}
          <motion.div variants={fadeUp} className="glass-card flex flex-col overflow-hidden">
            <div className="p-5 border-b border-glass-border flex items-center justify-between bg-warning/5">
              <h3 className="font-display font-medium text-foreground flex items-center gap-2">
                 <AlertTriangle className="w-5 h-5 text-warning" /> Pending Approvals
              </h3>
              <span className="text-[10px] font-bold bg-warning/20 text-warning px-2 py-0.5 rounded-md uppercase tracking-widest">{pendingLeaves.length} Active</span>
            </div>
            <div className="p-4 flex-1">
              {pendingLeaves.length === 0 ? (
                 <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground/30">
                       <ClipboardList className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium">Clear queue! No pending leaves.</p>
                 </div>
              ) : (
                 <div className="space-y-3">
                   {pendingLeaves.map((leave, i) => (
                     <div key={i} className="flex items-center justify-between p-3 hover:bg-secondary/40 rounded-xl transition-all border border-transparent hover:border-glass-border group">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning font-bold shadow-inner border border-warning/20 group-hover:scale-110 transition-transform">
                             {leave.userId?.name?.charAt(0) || 'L'}
                           </div>
                           <div>
                             <p className="text-sm font-bold text-foreground leading-tight">{leave.userId?.name || 'Unknown'}</p>
                             <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">{leave.totalDays} Days ({leave.leaveType})</p>
                           </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                           <span className="text-[10px] font-mono text-muted-foreground hidden sm:block">
                             {new Date(leave.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                           </span>
                           <a href="/admin/leaves" className="text-xs font-bold bg-primary shadow-lg shadow-primary/20 text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-all active:scale-95 cursor-pointer inline-block">Review</a>
                        </div>
                     </div>
                   ))}
                 </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminOverview;
