import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Notification {
  _id: string;
  type: 'leave_request' | 'leave_approved' | 'leave_rejected' | 'check_in' | 'announcement' | 'break_alert';
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
  sender: {
    name: string;
    avatar?: string;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (silent?: boolean) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  markByType: (type: string | string[]) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const notificationsRef = useRef<Notification[]>([]);

  // Keep ref in sync for silent comparison in callbacks
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const fetchNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get('/notifications');
      if (res.success) {
        const newNotifications = res.data as Notification[];
        
        // 🚀 Detect New Notifications only if silent tracking is on
        if (silent && notificationsRef.current.length > 0) {
           const newUnread = newNotifications.filter(
             newN => !newN.isRead && !notificationsRef.current.some(oldN => oldN._id === newN._id)
           );
           
           if (newUnread.length > 0) {
              const latest = newUnread[0];
              toast(latest.title, {
                description: latest.message,
                action: latest.link ? {
                  label: 'View',
                  onClick: () => window.location.href = latest.link
                } : undefined,
                icon: '🔔'
              });
           }
        }
        
        setNotifications(newNotifications);
      }
    } catch (err) {
      console.error('Failed to fetch notifications');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []); // Dependencies removed to prevent re-creation loops

  const markAsRead = async (id: string) => {
    try {
      const res = await api.put(`/notifications/${id}/read`, {});
      if (res.success) {
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      }
    } catch (err) {
      toast.error('Failed to update notification');
    }
  };

  const markAllRead = async () => {
    try {
      const res = await api.put('/notifications/read-all', {});
      if (res.success) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
    } catch (err) {
      toast.error('Failed to update notifications');
    }
  };

  const markByType = async (type: string | string[]) => {
    try {
      const types = Array.isArray(type) ? type : [type];
      const targetIds = notificationsRef.current
        .filter(n => !n.isRead && types.includes(n.type))
        .map(n => n._id);
      
      if (targetIds.length === 0) return;

      // Mark local first for immediate feedback
      setNotifications(prev => prev.map(n => targetIds.includes(n._id) ? { ...n, isRead: true } : n));
      
      // Batch update on backend
      await Promise.all(targetIds.map(id => api.put(`/notifications/${id}/read`, {})));
    } catch (err) {
      console.error('Failed to mark types as read');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('attendx_token');
    if (!token) return;

    // Initial load
    fetchNotifications();

    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('attendx_token');
      if (currentToken) fetchNotifications(true);
    }, 10000); // Polling every 10s is sufficient and less heavy

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      fetchNotifications,
      markAsRead,
      markAllRead,
      markByType
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
