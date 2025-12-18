'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

export type NotificationType = 'error' | 'warning' | 'info' | 'success';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  actionLabel?: string;
  actionUrl?: string;
}

interface NotificationContextType {
  notification: Notification | null;
  showNotification: (notification: Omit<Notification, 'id'>) => void;
  dismissNotification: (id: string) => void;
  // Convenience methods for common notification types
  success: (title: string, message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'message'>>) => void;
  error: (title: string, message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'message'>>) => void;
  warning: (title: string, message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'message'>>) => void;
  info: (title: string, message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'message'>>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Icon components for different notification types - colors match toast styling
const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="h-5 w-5" style={{ color: '#20DC8E' }} />; // emerald green
    case 'error':
      return <XCircle className="h-5 w-5" style={{ color: '#ef4444' }} />; // red-500
    case 'warning':
      return <AlertTriangle className="h-5 w-5" style={{ color: '#ef4444' }} />; // red-500
    case 'info':
      return <Info className="h-5 w-5" style={{ color: '#20DC8E' }} />; // emerald green
    default:
      return <Info className="h-5 w-5" style={{ color: '#20DC8E' }} />;
  }
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const showNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const { type, title, message, duration, actionLabel, actionUrl } = notification;

    const toastOptions: Parameters<typeof toast>[1] = {
      duration: duration || (type === 'error' ? 10000 : type === 'warning' ? 8000 : type === 'info' ? 6000 : 5000),
      icon: getNotificationIcon(type),
      description: message,
      ...(actionLabel && actionUrl && {
        action: {
          label: actionLabel,
          onClick: () => {
            // Use Next.js router if available, otherwise fallback to window.location
            if (typeof window !== 'undefined') {
              window.location.href = actionUrl;
            }
          },
        },
      }),
    };

    // Use appropriate toast method based on type
    switch (type) {
      case 'success':
        toast.success(title, toastOptions);
        break;
      case 'error':
        toast.error(title, toastOptions);
        break;
      case 'warning':
        toast.warning(title, toastOptions);
        break;
      case 'info':
        toast.info(title, toastOptions);
        break;
      default:
        toast(title, toastOptions);
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    toast.dismiss(id);
  }, []);

  // Convenience method for success notifications
  const success = useCallback((
    title: string, 
    message: string, 
    options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'message'>>
  ) => {
    showNotification({
      type: 'success',
      title,
      message,
      duration: 5000,
      ...options,
    });
  }, [showNotification]);

  // Convenience method for error notifications
  const error = useCallback((
    title: string, 
    message: string, 
    options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'message'>>
  ) => {
    showNotification({
      type: 'error',
      title,
      message,
      duration: 10000,
      ...options,
    });
  }, [showNotification]);

  // Convenience method for warning notifications
  const warning = useCallback((
    title: string, 
    message: string, 
    options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'message'>>
  ) => {
    showNotification({
      type: 'warning',
      title,
      message,
      duration: 8000,
      ...options,
    });
  }, [showNotification]);

  // Convenience method for info notifications
  const info = useCallback((
    title: string, 
    message: string, 
    options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'message'>>
  ) => {
    showNotification({
      type: 'info',
      title,
      message,
      duration: 6000,
      ...options,
    });
  }, [showNotification]);

  const value = {
    notification: null, // Keep for backward compatibility but not used
    showNotification,
    dismissNotification,
    success,
    error,
    warning,
    info,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

