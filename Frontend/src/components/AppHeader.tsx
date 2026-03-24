import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useClock } from '@/hooks/useClock';
import { getGreeting } from '@/utils/statusUtils';
import { Bell, Menu, Check, Trash, Megaphone, Clock, Calendar, CheckCircle, X } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/context/NotificationContext';

interface AppHeaderProps {
  onMenuClick?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onMenuClick }) => {
  const { user } = useAuth();
  const { timeString, dateString } = useClock();
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsReadLocal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markAsRead(id);
  };

  const handleNotificationClick = (n: any) => {
    if (!n.isRead) markAsRead(n._id);
    if (n.link) navigate(n.link);
    setIsOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'leave_request': return <Calendar className="w-4 h-4 text-warning" />;
      case 'leave_approved': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'check_in': return <Clock className="w-4 h-4 text-primary" />;
      case 'announcement': return <Megaphone className="w-4 h-4 text-purple-500" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <header className="h-16 border-b border-glass-border bg-card/50 backdrop-blur-lg flex items-center justify-between px-4 md:px-6 relative z-30">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="md:hidden text-muted-foreground hover:text-foreground">
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-display font-bold text-foreground">
            {getGreeting()}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-xs text-muted-foreground font-body">{dateString}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-mono text-muted-foreground hidden sm:block">{timeString}</span>
        
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`relative p-2 rounded-lg transition-colors ${isOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-pulse border-2 border-white shadow-lg z-10">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isOpen && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute right-0 mt-3 w-80 sm:w-96 bg-card border border-glass-border shadow-2xl rounded-2xl overflow-hidden z-50 origin-top-right backdrop-blur-xl"
              >
                <div className="p-4 border-b border-glass-border flex justify-between items-center bg-secondary/30">
                   <h3 className="font-bold text-foreground">Notifications</h3>
                   <div className="flex gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-[10px] font-bold text-primary uppercase hover:underline">Mark all read</button>
                      )}
                      <button onClick={() => setIsOpen(false)} className="md:hidden"><X className="w-4 h-4" /></button>
                   </div>
                </div>

                <div className="max-h-[70vh] overflow-y-auto">
                   {loading ? (
                     <div className="p-10 flex flex-col items-center justify-center opacity-50">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                        <p className="text-xs">Loading alerts...</p>
                     </div>
                   ) : notifications.length === 0 ? (
                     <div className="p-12 text-center">
                        <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-20" />
                        <p className="text-sm text-muted-foreground">All caught up! No recent alerts.</p>
                     </div>
                   ) : (
                     <div className="divide-y divide-glass-border">
                        {notifications.map((n) => (
                           <div 
                             key={n._id} 
                             onClick={() => handleNotificationClick(n)}
                             className={`p-4 hover:bg-primary/5 cursor-pointer transition-colors relative group ${!n.isRead ? 'bg-primary/[0.03]' : ''}`}
                           >
                              {!n.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                              <div className="flex gap-3">
                                 <div className={`p-2 rounded-xl h-fit ${!n.isRead ? 'bg-primary/10' : 'bg-secondary'}`}>
                                    {getIcon(n.type)}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                       <p className={`text-sm font-bold truncate ${!n.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                                       <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                       </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                                       {n.message}
                                    </p>
                                    <div className="flex items-center justify-between mt-1">
                                       <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                          <div className="w-4 h-4 rounded-full bg-secondary overflow-hidden">
                                             {n.sender?.avatar ? <img src={n.sender.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px]">{n.sender?.name?.charAt(0)}</div>}
                                          </div>
                                          <span className="text-[10px] font-medium truncate max-w-[80px]">{n.sender?.name}</span>
                                       </div>
                                       
                                       <div className="flex items-center gap-2">
                                          {n.link && (
                                            <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 opacity-0 group-hover:opacity-100 transition-all">
                                               View Details
                                            </span>
                                          )}
                                          {!n.isRead && (
                                            <button 
                                              onClick={(e) => handleMarkAsReadLocal(n._id, e)}
                                              className="p-1 rounded-md hover:bg-primary/20 text-primary transition-colors bg-primary/5"
                                              title="Mark as read"
                                            >
                                               <Check className="w-4 h-4" />
                                            </button>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                   )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm border border-primary/20">
          {user?.name?.charAt(0)}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
