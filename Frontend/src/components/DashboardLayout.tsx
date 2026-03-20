import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import AppHeader from '@/components/AppHeader';
import { motion } from 'framer-motion';

const DashboardLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background mesh-gradient">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-background/80 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - hidden on mobile unless open */}
      <div className={`${mobileOpen ? 'block' : 'hidden'} md:block`}>
        <AppSidebar collapsed={collapsed} setCollapsed={(v) => { setCollapsed(v); }} />
      </div>

      {/* Main content */}
      <motion.div
        initial={false}
        animate={{ marginLeft: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="min-h-screen hidden md:block"
        style={{ marginLeft: collapsed ? 72 : 260 }}
      >
        <AppHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </motion.div>

      {/* Mobile main content (no margin) */}
      <div className="md:hidden min-h-screen">
        <AppHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
