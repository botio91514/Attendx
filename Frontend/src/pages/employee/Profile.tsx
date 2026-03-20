import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { Camera, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const fields = [
    { label: 'Full Name', value: user?.name },
    { label: 'Email', value: user?.email },
    { label: 'Employee ID', value: user?.employeeId || 'N/A' },
    { label: 'Department', value: user?.department || 'N/A' },
    { label: 'Designation', value: user?.designation || 'N/A' },
    { label: 'Joined Date', value: user?.joinedDate ? new Date(user.joinedDate).toLocaleDateString() : (user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A') },
  ];

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      return toast.error("New passwords don't match");
    }

    setLoading(true);
    try {
      const res = await api.put('/auth/change-password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });

      if (res.success) {
        toast.success('Password updated successfully');
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 max-w-5xl mx-auto w-full pb-8">
      <motion.div variants={fadeUp}>
        <h2 className="text-2xl font-display font-bold text-foreground">My Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your personal information and security</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Avatar Card) */}
        <motion.div variants={fadeUp} className="lg:col-span-1">
          <div className="glass-card p-8 flex flex-col items-center text-center">
            <div className="relative mb-5">
              <div className="w-28 h-28 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-4xl font-display shadow-inner">
                {user?.name?.charAt(0)}
              </div>
              <button className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg hover:scale-105 transition-transform">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-xl font-display font-bold text-foreground mb-1">{user?.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{user?.designation && user?.department ? `${user?.designation} • ${user?.department}` : user?.email}</p>
            <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary capitalize font-medium">{user?.role}</span>
          </div>
        </motion.div>
        
        {/* Right Column (Info + Password) */}
        <motion.div variants={fadeUp} className="lg:col-span-2 space-y-6">
          {/* Info Grid */}
          <div className="glass-card p-6 sm:p-8">
            <h3 className="font-display font-semibold text-foreground mb-6 text-lg border-b border-glass-border pb-3">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
              {fields.map(f => (
                <div key={f.label}>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">{f.label}</label>
                  <p className="text-sm text-foreground font-medium">{f.value || 'N/A'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Change Password */}
          <div className="glass-card p-6 sm:p-8">
            <h3 className="font-display font-semibold text-foreground mb-6 text-lg border-b border-glass-border pb-3">Change Password</h3>
            <form className="space-y-5 max-w-md" onSubmit={handlePasswordUpdate}>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Current Password</label>
                <input 
                  type="password" 
                  className="input-floating" 
                  placeholder="••••••••" 
                  value={formData.currentPassword}
                  onChange={e => setFormData({ ...formData, currentPassword: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">New Password</label>
                  <input 
                    type="password" 
                    className="input-floating" 
                    placeholder="••••••••" 
                    value={formData.newPassword}
                    onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Confirm Password</label>
                  <input 
                    type="password" 
                    className="input-floating" 
                    placeholder="••••••••" 
                    value={formData.confirmPassword}
                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="glow-button flex items-center gap-2 text-sm justify-center w-full sm:w-auto">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ProfilePage;
