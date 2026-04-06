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
  error: string | null;
  fetchNotifications: (silent?: boolean) => Promise<void>;
  retryFetch: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  markByType: (type: string | string[]) => Promise<void>;
}

interface ApiResponse {
  success: boolean;
  data: Notification[];
  message?: string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const notificationsRef = useRef<Notification[]>([]);
  const isFetchingRef = useRef(false);
  const failureCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Keep ref in sync for silent comparison in callbacks
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchNotifications = useCallback(async (silent = false): Promise<void> => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const loadingTimeout = !silent 
      ? setTimeout(() => setLoading(false), 10000) 
      : null;

    try {
      if (!silent) setLoading(true);
      const res = await api.get('/notifications') as ApiResponse;
      
      if (!isMountedRef.current) return;

      if (res.success) {
        const newNotifications = res.data;
        setError(null);
        failureCountRef.current = 0;
        
        if (silent && notificationsRef.current.length > 0) {
          const newUnread = newNotifications.filter(
            newN => !newN.isRead && 
            !notificationsRef.current.some(oldN => oldN._id === newN._id)
          );
          
          if (newUnread.length > 0) {
            // Play notification sound
            try {
              const audio = new Audio('/notification-sound.mp3');
              audio.volume = 0.3;
              audio.play().catch(() => {});
            } catch {}

            // Show toast for ALL new notifications
            newUnread.forEach(notification => {
              toast(notification.title, {
                description: notification.message,
                action: notification.link ? {
                  label: 'View',
                  onClick: () => window.location.href = notification.link
                } : undefined,
                icon: '🔔'
              });
            });
          }
        }
        
        setNotifications(newNotifications);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Failed to fetch notifications:', err);
        setError('Failed to load notifications');
        failureCountRef.current++;
      }
    } finally {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      isFetchingRef.current = false;
      if (isMountedRef.current && !silent) setLoading(false);
    }
  }, []);

  const fetchRef = useRef(fetchNotifications);
  useEffect(() => {
    fetchRef.current = fetchNotifications;
  }, [fetchNotifications]);

  const retryFetch = useCallback(() => {
    setError(null);
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    const previousNotifications = [...notificationsRef.current];
    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      const res = await api.put(`/notifications/${id}/read`, {});
      if (!res.success) {
        setNotifications(previousNotifications);
        toast.error('Failed to update notification');
      }
    } catch (err) {
      setNotifications(previousNotifications);
      toast.error('Failed to update notification');
    }
  };

  const markAllRead = async () => {
    const previousNotifications = [...notificationsRef.current];
    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      const res = await api.put('/notifications/read-all', {});
      if (!res.success) {
        setNotifications(previousNotifications);
        toast.error('Failed to update notifications');
      }
    } catch (err) {
      setNotifications(previousNotifications);
      toast.error('Failed to update notifications');
    }
  };

  const markByType = async (type: string | string[]) => {
    const previousNotifications = [...notificationsRef.current];
    try {
      const types = Array.isArray(type) ? type : [type];
      const targetIds = notificationsRef.current
        .filter(n => !n.isRead && types.includes(n.type))
        .map(n => n._id);
      
      if (targetIds.length === 0) return;

      // Optimistic update
      setNotifications(prev => prev.map(n => targetIds.includes(n._id) ? { ...n, isRead: true } : n));
      
      const results = await Promise.allSettled(
        targetIds.map(id => api.put(`/notifications/${id}/read`, {}))
      );

      const hasFailure = results.some(r => r.status === 'rejected');
      if (hasFailure) {
        setNotifications(previousNotifications);
        toast.error('Failed to mark some notifications as read');
      }
    } catch (err) {
      setNotifications(previousNotifications);
      console.error('Failed to mark types as read');
    }
  };

  // Main Effect for Initial Load and Polling
  useEffect(() => {
    const token = localStorage.getItem('attendx_token');
    if (!token) return;

    // Initial load with retry
    let retryCount = 3;
    const initialLoad = async () => {
      while (retryCount > 0) {
        try {
          await fetchRef.current();
          break;
        } catch {
          retryCount--;
          if (retryCount > 0) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
    };
    initialLoad();

    // Setup recurring polling with dynamic interval
    let pollingTimeout: NodeJS.Timeout;
    
    const poll = () => {
      const currentToken = localStorage.getItem('attendx_token');
      if (currentToken) {
        fetchRef.current(true);
      }
      
      const nextInterval = Math.min(10000 * Math.pow(2, failureCountRef.current), 60000);
      pollingTimeout = setTimeout(poll, nextInterval);
    };

    pollingTimeout = setTimeout(poll, 10000);

    return () => clearTimeout(pollingTimeout);
  }, []);

  // Effect for Auth changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'attendx_token') {
        if (e.newValue) {
          fetchRef.current();
        } else {
          setNotifications([]);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Effect for Visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const token = localStorage.getItem('attendx_token');
        if (token) fetchRef.current(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      error,
      fetchNotifications,
      retryFetch,
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
