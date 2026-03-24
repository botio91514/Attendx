import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Clock, CalendarDays, User, LogOut, Sun, Moon,
  Users, Activity, FileText, ClipboardList, ChevronLeft, ChevronRight, Zap, UserPlus, Settings as SettingsIcon,
  Calendar, Megaphone, CircleDollarSign, Palmtree
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';

const employeeNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Attendance', icon: Clock, path: '/attendance' },
  { label: 'My Leaves', icon: Palmtree, path: '/leaves' },
  { label: 'Holidays', icon: CalendarDays, path: '/holidays' },
  { label: 'Notice Board', icon: Megaphone, path: '/notices' },
  { label: 'Profile', icon: User, path: '/profile' },
];

const adminNav = [
  { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
  { label: 'Live Status', icon: Activity, path: '/admin/live' },
  { label: 'Leave Requests', icon: ClipboardList, path: '/admin/leaves' },
  { label: 'Attendance Reports', icon: FileText, path: '/admin/reports' },
  { label: 'Employees', icon: Users, path: '/admin/employees' },
  { label: 'Register Employee', icon: UserPlus, path: '/admin/register' },
  { label: 'Payroll', icon: CircleDollarSign, path: '/admin/payroll' },
  { label: 'Notice Board', icon: Megaphone, path: '/admin/announcements' },
  { label: 'Office Calendar', icon: Calendar, path: '/admin/holidays' },
  { label: 'Office Settings', icon: SettingsIcon, path: '/admin/settings' },
];

interface AppSidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const AppSidebar: React.FC<AppSidebarProps> = ({ collapsed, setCollapsed }) => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const { notifications } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = user?.role === 'admin' ? adminNav : employeeNav;

  const getUnreadCountForItem = (path: string) => {
    if (!notifications) return 0;
    const unread = notifications.filter(n => !n.isRead);

    if (path === '/admin/leaves') return unread.filter(n => n.type === 'leave_request').length;
    if (path === '/admin/live') return unread.filter(n => n.type === 'check_in').length;
    if (path === '/admin/announcements') return unread.filter(n => n.type === 'announcement').length;
    if (path === '/leaves') return unread.filter(n => n.type === 'leave_approved' || n.type === 'leave_rejected').length;
    if (path === '/notices') return unread.filter(n => n.type === 'announcement').length;

    return 0;
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="h-screen bg-sidebar border-r border-sidebar-border flex flex-col fixed left-0 top-0 z-40"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-primary-foreground" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="font-display font-bold text-lg text-foreground whitespace-nowrap overflow-hidden"
            >
              AttendX
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* User info */}
      {!collapsed && (
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {user?.name?.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{user?.role}</span>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full ${active ? 'nav-item-active' : 'nav-item'}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 flex justify-between items-center overflow-hidden"
                  >
                    <span className="whitespace-nowrap text-sm">{item.label}</span>
                    {getUnreadCountForItem(item.path) > 0 && (
                      <span className="bg-red-500 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center ml-2 border border-white/20 animate-pulse-subtle shadow-lg">
                        {getUnreadCountForItem(item.path)}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              {collapsed && getUnreadCountForItem(item.path) > 0 && (
                <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white animate-pulse-subtle shadow-sm"></div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        <button onClick={toggleTheme} className="nav-item w-full">
          {theme === 'dark' ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
          {!collapsed && <span className="text-sm">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button onClick={logout} className="nav-item w-full text-destructive hover:text-destructive">
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-glass-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </motion.aside>
  );
};

export default AppSidebar;
