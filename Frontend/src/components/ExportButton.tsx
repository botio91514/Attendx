import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

export interface ExportButtonProps {
  type: 'attendance' | 'payslip' | 'leave';
  employeeId?: string;
  dateRange: { from: string; to: string };
  label?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  bulk?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ 
  type, 
  employeeId, 
  dateRange, 
  label = 'Export PDF',
  variant = 'default',
  size = 'default',
  bulk = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to
      });
      if (type === 'payslip' && dateRange.from) {
        const d = new Date(dateRange.from);
        params.append('month', (d.getMonth() + 1).toString());
        params.append('year', d.getFullYear().toString());
      }
      
      let endpoint = '';
      if (bulk && type === 'attendance') {
        endpoint = `/export/attendance/all/bulk?${params}`;
      } else {
        if (!employeeId) {
          toast.error('Please select an employee first');
          setIsLoading(false);
          return;
        }
        endpoint = `/export/${type}/${employeeId}?${params}`;
      }
      
      const response = await fetch(
        `${API_URL}${endpoint}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Export failed');
      
      // Trigger browser download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_report_${bulk ? 'all' : employeeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('PDF downloaded successfully!');
    } catch (err) {
      toast.error('Failed to generate PDF. Try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleExport} 
      disabled={isLoading || (!bulk && !employeeId && type !== 'attendance')} 
      variant={variant} 
      size={size}
      className={variant === 'default' ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {isLoading ? 'Generating PDF...' : label}
    </Button>
  );
};
