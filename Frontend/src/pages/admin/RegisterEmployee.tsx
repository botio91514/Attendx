import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, User, Mail, Lock, Building, UserCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const RegisterEmployee: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    designation: '',
    role: 'employee'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/register', formData);
      if (response.success) {
        toast.success('Employee registered successfully');
        setFormData({
          name: '',
          email: '',
          password: '',
          department: '',
          designation: '',
          role: 'employee'
        });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to register employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-display font-bold text-foreground">Register New Employee</h2>
        <p className="text-sm text-muted-foreground">Create a new account for an employee or administrator.</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="w-4 h-4" /> Full Name
              </label>
              <input
                type="text"
                required
                className="input-floating"
                placeholder="John Doe"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email address
              </label>
              <input
                type="email"
                required
                className="input-floating"
                placeholder="john.doe@company.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Lock className="w-4 h-4" /> Default Password
              </label>
              <input
                type="password"
                required
                className="input-floating"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> User Role
              </label>
              <select
                className="input-floating"
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building className="w-4 h-4" /> Department
              </label>
              <input
                type="text"
                className="input-floating"
                placeholder="Engineering"
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building className="w-4 h-4" /> Designation
              </label>
              <input
                type="text"
                className="input-floating"
                placeholder="Software Engineer"
                value={formData.designation}
                onChange={e => setFormData({ ...formData, designation: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="glow-button w-full sm:w-auto px-8 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {loading ? 'Creating Account...' : 'Register Employee'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default RegisterEmployee;
