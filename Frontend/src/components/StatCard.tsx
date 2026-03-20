import React from 'react';
import { motion } from 'framer-motion';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  accentClass?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtitle, accentClass = 'text-primary' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="stat-card"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground font-body">{label}</p>
        <p className={`text-2xl font-bold font-mono mt-1 ${accentClass}`}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className={`text-xl ${accentClass}`}>{icon}</div>
    </div>
  </motion.div>
);

export default StatCard;
