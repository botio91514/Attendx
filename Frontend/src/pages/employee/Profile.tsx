import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, MapPin, Phone, Mail, ShieldCheck, Building2, Calendar, 
  CreditCard, Lock, Eye, EyeOff, Info, AlertTriangle, Save, 
  CheckCircle2, Terminal, Activity, History, Briefcase, Loader2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ProfilePhotoUploader from '@/components/ProfilePhotoUploader';
import { toast } from 'sonner';

/**
 * Enhanced Profile Page for AttendX
 * Features Personal Info, Bank/Payroll Details, Password Management, and Account Audit
 */
const ProfilePage: React.FC = () => {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'bank' | 'password' | 'account'>('personal');
  const [showMasked, setShowMasked] = useState(true);
  
  // Form States
  const [personalData, setPersonalData] = useState({ phone: '', address: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '' });
  const [bankData, setBankData] = useState({ accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('attendx_token');
      const res = await fetch(`${API_URL}/profile/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setPersonalData({
          phone: data.data.phone || '',
          address: data.data.address || '',
          emergencyName: data.data.emergencyContact?.name || '',
          emergencyPhone: data.data.emergencyContact?.phone || '',
          emergencyRelation: data.data.emergencyContact?.relationship || ''
        });
        if (data.data.bankDetails) {
            setBankData({
                accountHolderName: data.data.bankDetails.accountHolderName || '',
                bankName: data.data.bankDetails.bankName || '',
                accountNumber: data.data.bankDetails.accountNumber || '',
                ifscCode: data.data.bankDetails.ifscCode || ''
            });
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = localStorage.getItem('attendx_token');
      const res = await fetch(`${API_URL}/profile/me`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: personalData.phone,
          address: personalData.address,
          emergencyContact: {
            name: personalData.emergencyName,
            phone: personalData.emergencyPhone,
            relationship: personalData.emergencyRelation
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Personal info updated');
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

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        const token = localStorage.getItem('attendx_token');
        const res = await fetch(`${API_URL}/profile/me/bank`, {
          method: 'PUT',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bankData)
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Bank details saved for payroll');
          setBankData(prev => ({ ...prev, accountNumber: data.data.accountNumber })); // Keep masked
        } else {
          toast.error(data.message);
        }
    } catch (err) {
        toast.error('Bank update failed');
    } finally {
        setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
        return toast.error("New passwords don't match");
    }
    setIsSaving(true);
    try {
        const token = localStorage.getItem('attendx_token');
        const res = await fetch(`${API_URL}/profile/me/password`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(passwordData)
        });
        const data = await res.json();
        if (data.success) {
            toast.success('Password updated. Redirecting to login...');
            setTimeout(() => {
                localStorage.clear();
                window.location.href = '/login';
            }, 2000);
        } else {
            toast.error(data.message);
        }
    } catch (err) {
        toast.error('Password change failed');
    } finally {
        setIsSaving(false);
    }
  };

  if (loading) return (
    <div className="p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Syncing profile with database...</p>
    </div>
  );

  const adminTabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'password', label: 'Security', icon: Lock }
  ];

  const employeeTabs = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'bank', label: 'Bank Details', icon: CreditCard },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'account', label: 'Account', icon: ShieldCheck }
  ];

  const tabs = profile?.role === 'admin' ? adminTabs : employeeTabs;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen bg-background/50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row gap-8"
      >
        {/* Left Column: Sidebar Card */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="glass-card p-8 flex flex-col items-center text-center">
            <ProfilePhotoUploader 
              currentPhoto={profile?.profilePhoto} 
              onUploadSuccess={(url) => setProfile({ ...profile, profilePhoto: url })}
            />
            
            <h1 className="mt-6 text-2xl font-display font-bold text-foreground">{profile?.name}</h1>
            <div className="mt-2 flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3" />
              {profile?.role}
            </div>
            
            <div className="mt-6 w-full space-y-4 text-sm font-body border-t border-glass-border pt-6">
              {profile?.role === 'employee' && (
                <>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{profile?.department}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Briefcase className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{profile?.designation}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Terminal className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-mono">{profile?.employeeId}</span>
                  </div>
                </>
              )}
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>Account Created: {new Date(profile?.createdAt || Date.now()).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          </div>

          {profile?.role === 'employee' && (
            <div className="glass-card p-6 grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-center">
                  <Activity className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                  <p className="text-[10px] uppercase tracking-wider text-emerald-500/70 font-bold">Status</p>
                  <p className="text-sm font-bold text-emerald-500 uppercase">{profile?.isActive ? 'Active' : 'Inactive'}</p>
              </div>
              <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-center">
                  <History className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                  <p className="text-[10px] uppercase tracking-wider text-indigo-500/70 font-bold">Shift</p>
                  <p className="text-sm font-bold text-indigo-500 uppercase">General</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Content Tabs */}
        <div className="w-full lg:w-2/3">
          <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-body font-medium transition-all duration-300 ${
                  activeTab === tab.id 
                  ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                  : 'bg-card text-muted-foreground hover:bg-secondary'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'animate-pulse' : ''}`} />
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="glass-card p-8 min-h-[500px]"
            >
              {activeTab === 'personal' && (
                <form onSubmit={handleUpdatePersonal} className="space-y-8">
                  <div className="flex items-center gap-3 mb-2">
                    <User className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-display font-bold">Personal Information</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5 focus-within:opacity-100 opacity-60">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Full Name (Locked)</label>
                      <input value={profile?.name} disabled className="input-floating bg-slate-900/10 cursor-not-allowed" />
                    </div>
                    <div className="space-y-1.5 focus-within:opacity-100 opacity-60">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Address (Locked)</label>
                      <input value={profile?.email} disabled className="input-floating bg-slate-900/10 cursor-not-allowed" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone Number</label>
                      <input 
                        type="text" 
                        value={personalData.phone} 
                        onChange={e => setPersonalData({ ...personalData, phone: e.target.value })}
                        className="input-floating" 
                        placeholder="10-digit mobile number" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Permanent Address</label>
                      <input 
                        type="text" 
                        value={personalData.address} 
                        onChange={e => setPersonalData({ ...personalData, address: e.target.value })}
                        className="input-floating" 
                        placeholder="House no, Street, City" 
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-glass-border">
                    <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-indigo-400 font-display uppercase tracking-widest text-xs">
                      Emergency Contact Info
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact Name</label>
                        <input 
                          type="text" 
                          value={personalData.emergencyName}
                          onChange={e => setPersonalData({ ...personalData, emergencyName: e.target.value })}
                          className="input-floating text-sm" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mobile Number</label>
                        <input 
                          type="text" 
                          value={personalData.emergencyPhone}
                          onChange={e => setPersonalData({ ...personalData, emergencyPhone: e.target.value })}
                          className="input-floating text-sm" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Relationship</label>
                        <input 
                          type="text" 
                          value={personalData.emergencyRelation}
                          onChange={e => setPersonalData({ ...personalData, emergencyRelation: e.target.value })}
                          className="input-floating text-sm" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="glow-button flex items-center gap-2 px-8 h-12"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {isSaving ? 'Updating...' : 'Sync Profile Info'}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'bank' && (
                <form onSubmit={handleUpdateBank} className="space-y-8">
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-display font-bold">Payroll & Disbursements</h2>
                  </div>

                  <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 flex gap-4 text-amber-500">
                    <AlertTriangle className="w-6 h-6 shrink-0" />
                    <p className="text-sm font-body leading-relaxed">Review your bank details carefully. These are used directly for monthly salary processing. Errors may result in disbursement delays.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1.5 text-indigo-400">
                      <label className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">Full Bank Name</label>
                      <input 
                        value={bankData.bankName} 
                        onChange={e => setBankData({ ...bankData, bankName: e.target.value })}
                        className="input-floating border-indigo-500/30" 
                      />
                    </div>
                    <div className="space-y-1.5 text-indigo-400">
                      <label className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">Name on Passbook</label>
                      <input 
                        value={bankData.accountHolderName} 
                        onChange={e => setBankData({ ...bankData, accountHolderName: e.target.value })}
                        className="input-floating border-indigo-500/30" 
                      />
                    </div>
                    <div className="space-y-1.5 text-indigo-400 relative">
                      <label className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">Account Number</label>
                      <input 
                        type={showMasked ? "text" : "password"}
                        value={bankData.accountNumber} 
                        onChange={e => setBankData({ ...bankData, accountNumber: e.target.value })}
                        className="input-floating border-indigo-500/30 pr-12 focus:ring-0" 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowMasked(!showMasked)}
                        className="absolute right-4 top-10 text-muted-foreground hover:text-indigo-400 transition-colors"
                      >
                        {showMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="space-y-1.5 text-indigo-400">
                      <label className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">IFSC Code</label>
                      <input 
                        value={bankData.ifscCode} 
                        onChange={e => setBankData({ ...bankData, ifscCode: e.target.value.toUpperCase() })}
                        className="input-floating border-indigo-500/30" 
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-6">
                    <button type="submit" disabled={isSaving} className="glow-button flex items-center gap-2 px-10 h-12">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {isSaving ? 'Verifying...' : 'Authenticate & Save'}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'password' && (
                <form onSubmit={handleUpdatePassword} className="space-y-8">
                  <div className="flex items-center gap-3 mb-2">
                    <Lock className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-display font-bold">Security Controls</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Current Password</label>
                        <div className="relative">
                          <input 
                            type={showCurrentPass ? "text" : "password"} 
                            value={passwordData.currentPassword}
                            onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                            className="input-floating pr-12 bg-slate-900/30" 
                            placeholder="••••••••" 
                          />
                          <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-4 top-4 text-muted-foreground">
                            {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">New Access Key</label>
                        <div className="relative">
                          <input 
                            type={showNewPass ? "text" : "password"} 
                            value={passwordData.newPassword}
                            onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            className="input-floating pr-12 bg-slate-900/30" 
                            placeholder="Min 8 characters" 
                          />
                          <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-4 top-4 text-muted-foreground">
                            {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Verify New Key</label>
                        <div className="relative">
                            <input 
                                type={showConfirmPass ? "text" : "password"} 
                                value={passwordData.confirmPassword}
                                onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                className="input-floating pr-12 bg-slate-900/30" 
                                placeholder="Repeat characters" 
                            />
                            <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-4 top-4 text-muted-foreground">
                                {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                      </div>
                      <button type="submit" disabled={isSaving} className="glow-button w-full h-12 flex items-center justify-center gap-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        {isSaving ? 'Processing...' : 'Secure Account'}
                      </button>
                    </div>

                    <div className="space-y-6 p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 font-display">Identity Protection</h3>
                      <ul className="space-y-4 text-xs font-body text-muted-foreground">
                        <li className="flex items-center gap-3">
                          <CheckCircle2 className={`w-4 h-4 ${passwordData.newPassword.length >= 8 ? 'text-emerald-500' : 'text-slate-700'}`} /> 8+ Characters length
                        </li>
                        <li className="flex items-center gap-3">
                          <CheckCircle2 className={`w-4 h-4 ${/[A-Z]/.test(passwordData.newPassword) ? 'text-emerald-500' : 'text-slate-700'}`} /> At least one Uppercase [A-Z]
                        </li>
                        <li className="flex items-center gap-3">
                          <CheckCircle2 className={`w-4 h-4 ${/[!@#$%^&*]/.test(passwordData.newPassword) ? 'text-emerald-500' : 'text-slate-700'}`} /> One Special Character [#@!]
                        </li>
                        <li className="flex items-center gap-3 text-indigo-400/80 leading-relaxed font-body italic mt-4 border-t border-white/5 pt-4">
                           Note: For your protection, all active sessions will be terminated.
                        </li>
                      </ul>
                    </div>
                  </div>
                </form>
              )}

              {activeTab === 'account' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="flex items-center gap-3 mb-2">
                    <ShieldCheck className="w-6 h-6 text-emerald-500" />
                    <h2 className="text-xl font-display font-bold">Authentication Registry</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6 border-r border-white/5 pr-8">
                       <div className="space-y-1.5">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Corporate Email Identity</p>
                         <p className="text-foreground flex items-center gap-2 font-display text-lg">
                           {profile?.email} <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                         </p>
                       </div>
                       <div className="space-y-1.5">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">System Permissions</p>
                         <div className="flex flex-wrap gap-2 mt-2">
                            <span className="px-3 py-1 bg-slate-900 text-primary text-[9px] font-mono rounded-lg border border-primary/20">RW_ATTENDANCE</span>
                            <span className="px-3 py-1 bg-slate-900 text-primary text-[9px] font-mono rounded-lg border border-primary/20">REQ_LEAVE</span>
                            <span className="px-3 py-1 bg-slate-900 text-primary text-[9px] font-mono rounded-lg border border-primary/20">VIEW_PAYROLL</span>
                         </div>
                       </div>
                    </div>

                    <div className="space-y-6 lg:pl-4">
                       <div className="space-y-1.5">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Initial Registration</p>
                         <p className="text-foreground font-display text-lg">{new Date(profile?.createdAt).toLocaleString('en-IN')}</p>
                       </div>
                       <div className="space-y-1.5">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Global Access Region</p>
                         <p className="text-foreground font-display flex items-center gap-2 text-md">
                           <MapPin className="w-4 h-4 text-primary" /> India (Asia/Kolkata)
                         </p>
                       </div>
                    </div>
                  </div>

                  <div className="mt-12 p-8 bg-red-500/5 rounded-3xl border border-red-500/10 text-center relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                         <AlertTriangle className="w-20 h-20 text-red-500" />
                      </div>
                      <p className="text-red-500/80 text-xs font-body mb-4 max-w-md mx-auto">
                        Company policies prohibit manual account deactivation by staff. 
                        To initiate exit procedures, please contact your HR Business Partner.
                      </p>
                      <button className="px-8 py-2 bg-red-500/10 text-red-500/50 text-[10px] font-bold uppercase rounded-2xl border border-red-500/10 cursor-not-allowed">
                        Corporate Lock Active
                      </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfilePage;
