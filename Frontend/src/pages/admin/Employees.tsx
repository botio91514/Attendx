import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, X, Pencil, Loader2, Save, UserPlus, Shield, User, Trash2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('All');
  const [totalCount, setTotalCount] = useState(0);

  // Deletion State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  // Drawer & Form State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    designation: '',
    role: 'employee',
    employeeId: '',
    baseSalary: 0
  });

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (dept !== 'All') queryParams.append('department', dept);

      const res = await api.get(`/employees?${queryParams.toString()}`);
      if (res.success && res.data) {
        setEmployees(res.data.employees);
        setTotalCount(res.data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to fetch employees', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [dept]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const departments = ['Human Resources', 'Engineering', 'Design', 'Marketing', 'Finance'];

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      department: '',
      designation: '',
      role: 'employee',
      employeeId: '',
      baseSalary: 0
    });
    setSelectedUser(null);
    setIsEditing(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsEditing(false);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (emp: any) => {
    setFormData({
      name: emp.name || '',
      email: emp.email || '',
      password: '', // Don't show password
      department: emp.department || '',
      designation: emp.designation || '',
      role: emp.role || 'employee',
      employeeId: emp.employeeId || '',
      baseSalary: emp.baseSalary || 0
    });
    setSelectedUser(emp);
    setIsEditing(true);
    setDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitLoading(true);
      if (isEditing) {
        // UPDATE (CRUD - U)
        const updateData = { ...formData };
        if (!updateData.password) delete (updateData as any).password;

        const res = await api.put(`/employees/${selectedUser._id}`, updateData);
        if (res.success) {
          toast.success('Employee updated successfully');
          setDrawerOpen(false);
          fetchEmployees();
        }
      } else {
        // CREATE (CRUD - C)
        const res = await api.post('/auth/register', formData);
        if (res.success) {
          toast.success('Employee registered successfully');
          setDrawerOpen(false);
          fetchEmployees();
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Operation failed');
    } finally {
      setSubmitLoading(false);
    }
  };


  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const res = await api.delete(`/employees/${userToDelete._id}`);
      if (res.success) {
        toast.success(`${userToDelete.name} deleted from database permanently`);
        fetchEmployees();
      }
    } catch (error: any) {
      toast.error(error.message || 'Deletion failed');
    } finally {
      setUserToDelete(null);
    }
  };

  const handlePermanentDelete = (emp: any) => {
    setUserToDelete(emp);
    setDeleteModalOpen(true);
  };

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="space-y-6 relative min-h-screen">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Employee Management</h2>
          <p className="text-sm text-muted-foreground">{totalCount} total employees in your workforce</p>
        </div>
        <button onClick={handleOpenCreate} className="glow-button flex items-center gap-2 text-sm py-2.5 px-5">
          <UserPlus className="w-4 h-4" /> Add New Employee
        </button>
      </motion.div>

      {/* Filters (CRUD - R filters) */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs cursor-text">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-floating pl-10" placeholder="Search by name, email or ID..." />
        </div>
        <select value={dept} onChange={e => setDept(e.target.value)} className="input-floating w-auto">
          <option value="All">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </motion.div>

      {/* Table (CRUD - R) */}
      <motion.div variants={fadeUp} className="glass-card overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[400px]">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground animate-pulse">Fetching employee records...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-glass-border">
                  {['Employee', 'Employee ID', 'Department', 'Designation', 'Base Salary', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-bold text-muted-foreground px-5 py-4 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center opacity-40">
                        <User className="w-12 h-12 mb-2" />
                        <p>No employees found matching your criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  employees.map(emp => (
                    <tr key={emp._id} className="border-b border-glass-border hover:bg-primary/5 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold border border-primary/20">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm text-foreground font-semibold group-hover:text-primary transition-colors">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-mono text-muted-foreground">{emp.employeeId}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{emp.department}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{emp.designation}</td>
                      <td className="px-5 py-4 text-sm font-bold text-foreground">
                        ₹{emp.baseSalary?.toLocaleString() || '0'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenEdit(emp)} className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Edit Profile">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handlePermanentDelete(emp)} className="p-2 rounded-lg hover:bg-destructive/20 text-destructive transition-colors" title="DELETE PERMANENTLY">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Security Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Permanent Employee Deletion"
        message={`This will permanently remove ${userToDelete?.name} and all their history from the database. This action is irreversible.`}
        confirmWord="DELETE"
      />

      {/* CRUD Modal (Create & Update) */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card border border-glass-border z-[101] p-8 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
                    {isEditing ? <Pencil className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-success" />}
                    {isEditing ? 'Edit Employee Profile' : 'Register New Employee'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isEditing ? 'Update personnel details and system role' : 'Fill in the information below to add a member to your workforce'}
                  </p>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="p-2 hover:bg-secondary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* ID & Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Full Name</label>
                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input-floating" placeholder="John Doe" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Employee ID</label>
                    <input required value={formData.employeeId} onChange={e => setFormData({ ...formData, employeeId: e.target.value })} className="input-floating font-mono uppercase" placeholder="GST-001" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">System Role</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFormData({ ...formData, role: 'employee' })} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${formData.role === 'employee' ? 'border-primary bg-primary/10 text-primary' : 'border-glass-border'}`}>
                        <User className="w-3 h-3" /> Staff
                      </button>
                      <button type="button" onClick={() => setFormData({ ...formData, role: 'admin' })} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${formData.role === 'admin' ? 'border-warning bg-warning/10 text-warning' : 'border-glass-border'}`}>
                        <Shield className="w-3 h-3" /> Admin
                      </button>
                    </div>
                  </div>
                </div>

                {/* Credentials */}
                <div className="p-4 bg-secondary/50 rounded-xl space-y-4 border border-glass-border">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Work Email</label>
                    <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="input-floating bg-background" placeholder="john@company.com" disabled={isEditing} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                      {isEditing ? 'Update Password (leave blank to keep current)' : 'Account Password'}
                    </label>
                    <input required={!isEditing} type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="input-floating bg-background" placeholder="••••••••" />
                  </div>
                </div>

                {/* Org Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Department</label>
                    <select required value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} className="input-floating">
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Designation</label>
                    <input required value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} className="input-floating" placeholder="Senior Developer" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Monthly Base Salary (₹)</label>
                    <input
                      required
                      type="number"
                      value={formData.baseSalary}
                      onChange={e => setFormData({ ...formData, baseSalary: parseInt(e.target.value) || 0 })}
                      className="input-floating"
                      placeholder="e.g. 50000"
                    />
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  <button type="button" onClick={() => setDrawerOpen(false)} className="flex-1 py-3 px-4 rounded-xl font-bold bg-secondary hover:bg-secondary/80 text-foreground transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitLoading} className="flex-[2] py-3 px-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    {submitLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : isEditing ? <Save className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                    {isEditing ? 'Save Changes' : 'Register Employee'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Employees;
