import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Building2, 
  Calendar, 
  CreditCard, 
  Save, 
  Loader2, 
  ChevronLeft,
  Briefcase,
  TrendingUp,
  Activity,
  History,
  AlertCircle,
  IndianRupee,
  AtSign
} from 'lucide-react';
import { toast } from 'sonner';

const AdminEmployeeProfilePage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Admin Editable Data
    const [adminData, setAdminData] = useState({
        name: '',
        email: '',
        department: '',
        role: 'employee',
        baseSalary: 0,
        joiningDate: '',
        isActive: true,
        phone: '',
        address: ''
    });

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const BASE_URL = API_URL.replace('/api', '');

    useEffect(() => {
        if (id) fetchEmployeeProfile();
    }, [id]);

    const fetchEmployeeProfile = async () => {
        try {
            const token = localStorage.getItem('attendx_token');
            const res = await fetch(`${API_URL}/profile/employee/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setProfile(data.data);
                const p = data.data;
                setAdminData({
                    name: p.name || '',
                    email: p.email || '',
                    department: p.department || '',
                    role: p.role || 'employee',
                    baseSalary: p.baseSalary || 0,
                    joiningDate: p.joiningDate ? new Date(p.joiningDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '',
                    isActive: p.isActive !== undefined ? p.isActive : true,
                    phone: p.phone || '',
                    address: p.address || ''
                });
            } else {
                toast.error(data.message);
                navigate('/admin');
            }
        } catch (err) {
            toast.error('Failed to load employee profile');
        } finally {
            setLoading(false);
        }
    };

    const handleAdminUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const token = localStorage.getItem('attendx_token');
            const res = await fetch(`${API_URL}/profile/employee/${id}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(adminData)
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Employee profile updated successfully');
                setProfile(data.data);
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            toast.error('Update failed');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen bg-background/50">
            <div className="flex items-center gap-4 mb-2">
                <button 
                  onClick={() => navigate(-1)}
                  className="p-2 hover:bg-card rounded-xl transition-colors text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div>
                   <h1 className="text-2xl font-display font-bold text-foreground">Employee Administration</h1>
                   <p className="text-xs text-muted-foreground font-body">Managing profile of {profile?.name}</p>
                </div>
            </div>

            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
                {/* LHS: Overview Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-card p-8 flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full border-4 border-glass-border bg-secondary overflow-hidden shadow-2xl relative group">
                            {profile?.profilePhoto ? (
                                <img src={`${BASE_URL}/${profile?.profilePhoto}`} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-12 h-12 text-muted-foreground m-auto mt-6" />
                            )}
                            <div className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-background ${profile?.isActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 border-red-500/50'}`} />
                        </div>
                        <h2 className="mt-6 text-xl font-display font-bold">{profile?.name}</h2>
                        <div className="mt-2 px-3 py-0.5 bg-indigo-500/10 text-indigo-500 text-[10px] font-bold rounded uppercase tracking-widest border border-indigo-500/20">
                            {profile?.role} • {profile?.department}
                        </div>
                        <p className="mt-3 text-xs font-mono text-muted-foreground">{profile?.employeeId}</p>
                    </div>

                    {/* Attendance Summary Panel */}
                    <div className="glass-card p-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            This Month's Attendance
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/10 text-center">
                                <p className="text-emerald-500 font-bold text-lg leading-tight">{profile?.attendanceSummary?.present || 0}</p>
                                <p className="text-[8px] text-emerald-500/60 uppercase font-black">Present</p>
                            </div>
                            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/10 text-center">
                                <p className="text-amber-500 font-bold text-lg leading-tight">{profile?.attendanceSummary?.late || 0}</p>
                                <p className="text-[8px] text-amber-500/60 uppercase font-black">Late</p>
                            </div>
                            <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/10 text-center">
                                <p className="text-red-500 font-bold text-lg leading-tight">{profile?.attendanceSummary?.absent || 0}</p>
                                <p className="text-[8px] text-red-500/60 uppercase font-black">Absent</p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6 space-y-4">
                       <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-white/5 pb-2">Status Management</h3>
                       <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-glass-border">
                           <div className="flex items-center gap-3">
                               <ShieldCheck className={`w-5 h-5 ${adminData.isActive ? 'text-emerald-500' : 'text-red-500'}`} />
                               <div>
                                   <p className="text-xs font-bold text-foreground">Employee Status</p>
                                   <p className="text-[10px] text-muted-foreground">{adminData.isActive ? 'Active Staff' : 'Deactivated'}</p>
                               </div>
                           </div>
                           <button 
                             onClick={() => setAdminData({ ...adminData, isActive: !adminData.isActive })}
                             className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                               adminData.isActive 
                               ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' 
                               : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
                             }`}
                           >
                             {adminData.isActive ? 'Deactivate' : 'Activate'}
                           </button>
                       </div>
                    </div>
                </div>

                {/* RHS: Admin Edits Section */}
                <div className="lg:col-span-2">
                    <div className="glass-card p-8 min-h-full">
                        <div className="flex items-center gap-3 mb-8">
                           <ShieldCheck className="w-6 h-6 text-indigo-500" />
                           <h3 className="text-xl font-display font-bold">Privileged Profile Controls</h3>
                        </div>

                        <form onSubmit={handleAdminUpdate} className="space-y-8">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                               <div className="space-y-1.5">
                                   <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                       <AtSign className="w-3 h-3" /> Full Legal Name
                                   </label>
                                   <input 
                                     value={adminData.name}
                                     onChange={e => setAdminData({ ...adminData, name: e.target.value })}
                                     className="input-floating" 
                                     placeholder="e.g. Rahul Sharma"
                                   />
                               </div>
                               <div className="space-y-1.5">
                                   <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                       <Mail className="w-3 h-3" /> Corporate Email
                                   </label>
                                   <input 
                                     value={adminData.email}
                                     onChange={e => setAdminData({ ...adminData, email: e.target.value })}
                                     className="input-floating" 
                                     placeholder="email@company.com"
                                   />
                               </div>
                               <div className="space-y-1.5">
                                   <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                       <Building2 className="w-3 h-3" /> Assigned Department
                                   </label>
                                   <select 
                                     value={adminData.department}
                                     onChange={e => setAdminData({ ...adminData, department: e.target.value })}
                                     className="input-floating"
                                   >
                                       <option value="">Select Department</option>
                                       <option value="IT">IT & Tech</option>
                                       <option value="HR">Human Resources</option>
                                       <option value="Finance">Finance</option>
                                       <option value="Sales">Sales & Marketing</option>
                                       <option value="Admin">Administration</option>
                                   </select>
                               </div>
                               <div className="space-y-1.5">
                                   <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                       <Briefcase className="w-3 h-3" /> System Role
                                   </label>
                                   <select 
                                     value={adminData.role}
                                     onChange={e => setAdminData({ ...adminData, role: e.target.value })}
                                     className="input-floating"
                                   >
                                       <option value="employee">Employee</option>
                                       <option value="admin">Administrator</option>
                                   </select>
                               </div>
                               <div className="space-y-1.5">
                                   <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                       <IndianRupee className="w-3 h-3" /> CTC (Monthly Base Salary)
                                   </label>
                                   <input 
                                     type="number"
                                     value={adminData.baseSalary}
                                     onChange={e => setAdminData({ ...adminData, baseSalary: Number(e.target.value) })}
                                     className="input-floating" 
                                   />
                               </div>
                               <div className="space-y-1.5">
                                   <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                       <Calendar className="w-3 h-3" /> Onboarding Date
                                   </label>
                                   <input 
                                     type="date"
                                     value={adminData.joiningDate}
                                     onChange={e => setAdminData({ ...adminData, joiningDate: e.target.value })}
                                     className="input-floating" 
                                   />
                               </div>
                           </div>

                           <div className="pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-8">
                                 <div className="space-y-1.5">
                                     <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                         <Phone className="w-3 h-3" /> Mobile Number
                                     </label>
                                     <input 
                                       value={adminData.phone}
                                       onChange={e => setAdminData({ ...adminData, phone: e.target.value })}
                                       className="input-floating text-sm" 
                                     />
                                 </div>
                                 <div className="space-y-1.5">
                                     <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                         <MapPin className="w-3 h-3" /> Current Address
                                     </label>
                                     <input 
                                       value={adminData.address}
                                       onChange={e => setAdminData({ ...adminData, address: e.target.value })}
                                       className="input-floating text-sm" 
                                     />
                                 </div>
                               </div>

                            {/* Bank Details Section (Read Only) */}
                            <div className="pt-6 border-t border-white/5 space-y-6">
                              <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">Payroll & Bank Information</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="p-4 rounded-xl bg-secondary/20 border border-glass-border">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Bank Name</p>
                                    <p className="text-sm font-bold text-foreground">{profile?.bankDetails?.bankName || 'Not Set'}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-secondary/20 border border-glass-border">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Account Holder</p>
                                    <p className="text-sm font-bold text-foreground">{profile?.bankDetails?.accountHolderName || 'Not Set'}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-secondary/20 border border-glass-border">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">IFSC Code</p>
                                    <p className="text-sm font-bold text-foreground font-mono">{profile?.bankDetails?.ifscCode || 'Not Set'}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-secondary/20 border border-glass-border">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Account Number</p>
                                    <p className="text-sm font-bold text-primary font-mono tracking-widest">{profile?.bankDetails?.accountNumber || '••••••••••••'}</p>
                                </div>
                              </div>
                            </div>

                           <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex gap-3 text-indigo-400/80 italic text-xs mb-8 font-body">
                              <AlertCircle className="w-5 h-5 shrink-0" />
                              <p>Note: Updating these fields will instantly trigger a secure email notification to the employee to maintain data integrity and transparency.</p>
                           </div>

                           <div className="flex gap-4">
                               <button 
                                 type="submit" 
                                 disabled={isSaving}
                                 className="glow-button flex-1 flex items-center justify-center gap-2 h-12"
                               >
                                 {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                 {isSaving ? 'Synchronizing Data...' : 'Commit & Save Profile Changes'}
                               </button>
                           </div>
                        </form>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AdminEmployeeProfilePage;
