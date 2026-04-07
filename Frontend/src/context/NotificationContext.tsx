import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';

// Validate real MongoDB ObjectId
const isValidMongoId = (id: string): boolean => {
  if (!id) return false;
  if (id.startsWith('temp_')) return false;
  if (id.length !== 24) return false;
  if (!/^[a-fA-F0-9]{24}$/.test(id)) return false;
  return true;
};

interface Notification {
  _id: string;
  type: 'leave_request' | 'leave_approved' | 'leave_rejected' | 'check_in' | 'announcement' | 'break_alert' | 'task_assigned' | 'task_completed';
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
  isSocketConnected: boolean;
}

interface ApiResponse {
  success: boolean;
  data: Notification[];
  message?: string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const cached = sessionStorage.getItem('attendx_notifications');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  useEffect(() => {
    try {
      // Never cache temp notifications
      const toCache = notifications
        .filter(n => isValidMongoId(n._id))
        .slice(0, 50);
      sessionStorage.setItem('attendx_notifications', JSON.stringify(toCache));
    } catch {}
  }, [notifications]);
  
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
        
        if (newNotifications.length > 0) {
          setNotifications(prev => {
            // Remove any temp notifications that now
            // have real counterparts from DB
            const realIds = new Set(
              newNotifications.map(n => n._id)
            );
            const remainingTemps = prev.filter(n => 
              n._id.startsWith('temp_') && 
              !realIds.has(n._id)
            );
            // Real notifications + any still-pending temps
            return [...newNotifications, ...remainingTemps];
          });
        } else if (
          newNotifications.length === 0 && 
          notificationsRef.current.filter(
            n => !n._id.startsWith('temp_')
          ).length === 0
        ) {
          setNotifications([]);
        }
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
    // Skip invalid or temp IDs
    if (!isValidMongoId(id)) return;
    
    const previousNotifications = [...notificationsRef.current];
    try {
      setNotifications(prev => 
        prev.map(n => n._id === id 
          ? { ...n, isRead: true } : n
        )
      );
      const res = await api.put(
        `/notifications/${id}/read`, {}
      );
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
      // Optimistic update for ALL notifications in UI
      setNotifications(prev => 
        prev.map(n => ({ ...n, isRead: true }))
      );
      
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
        .filter(n => 
          !n.isRead && 
          types.includes(n.type) &&
          isValidMongoId(n._id)  // ← only real IDs
        )
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

  // --- SOCKET CONNECTION EFFECT ---
  useEffect(() => {
    let connectionTimeout: NodeJS.Timeout;
    let socket: any;

    const tryConnect = () => {
      const token = localStorage.getItem('attendx_token');
      
      if (!token) {
        connectionTimeout = setTimeout(tryConnect, 500);
        return;
      }

      socket = connectSocket(token);

      socket.on('connect', () => {
        setIsSocketConnected(true);
        console.log('Socket connected ✅');
        
        fetchRef.current(true);

        let fastPollCount = 0;
        const fastPoll = setInterval(() => {
          fetchRef.current(true);
          fastPollCount++;
          if (fastPollCount >= 3) {
            clearInterval(fastPoll);
          }
        }, 30000);
      });

      socket.on('disconnect', (reason: string) => {
        setIsSocketConnected(false);
        console.log('Socket disconnected:', reason);
      });

      socket.on('connect_error', (err: Error) => {
        console.error('Socket connection failed:', err.message);
        setIsSocketConnected(false);
      });

    // === NOTIFICATION EVENTS ===

    socket.on('notification:new', (data) => {
      const tempId = `temp_${Date.now()}`;
      
      // Step 1: Add to UI instantly with temp ID
      setNotifications(prev => [{
        _id: tempId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link || '',
        isRead: false,
        createdAt: data.timestamp || new Date().toISOString(),
        sender: { name: 'AttendX System' }
      }, ...prev]);

      // Step 2: Show toast
      toast(data.title, {
        description: data.message,
        icon: '🔔',
        action: data.link ? {
          label: 'View',
          onClick: () => window.location.href = data.link
        } : undefined
      });

      // Step 3: Play sound safely
      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch {}

      // Step 4: After 2 seconds fetch real notifications
      // This REPLACES temp ID with real MongoDB ID
      // All subsequent markAsRead calls use real ID
      setTimeout(() => {
        if (isMountedRef.current) {
          fetchRef.current(true);
        }
      }, 2000);
    });

    // Leave status changed
    socket.on('leave:statusChanged', (data) => {
      // Trigger a silent fetch to sync leave data
      fetchRef.current(true);
    });

    // New broadcast notice
    socket.on('notice:broadcast', (data) => {
      toast(`📢 ${data.title}`, {
        description: data.content.substring(0, 80) + '...',
        duration: 8000,  // longer for announcements
        action: {
          label: 'View',
          onClick: () => window.location.href = '/notices'
        }
      });
    });

    // Break exceeded alert
    socket.on('break:exceeded', (data) => {
      toast.warning('⚠️ Break Time Exceeded!', {
        description: `You have been on break for ${data.elapsedMinutes} minutes. Allowed: ${data.allowedMinutes} minutes.`,
        duration: 10000,
        action: {
          label: 'Return Now',
          onClick: () => window.location.href = '/dashboard'
        }
      });
    });
    };

    tryConnect();

    // Cleanup on unmount
    return () => {
      clearTimeout(connectionTimeout);
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('notification:new');
        socket.off('leave:statusChanged');
        socket.off('notice:broadcast');
        socket.off('break:exceeded');
        disconnectSocket();
      }
    };
  }, []); // runs once on mount

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
      
      const nextInterval = Math.min(60000 * Math.pow(2, failureCountRef.current), 60000);
      pollingTimeout = setTimeout(poll, nextInterval);
    };

    pollingTimeout = setTimeout(poll, 60000);

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
      markByType,
      isSocketConnected
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
