/**
 * @fileoverview Custom React hook for managing notifications in the enrollment system
 * Provides comprehensive functionality for sending, receiving, and managing prioritized
 * notifications with delivery tracking and analytics.
 * @version 1.0.0
 */

import { useState, useCallback, useMemo } from 'react'; // v18.0.0
import { useDispatch, useSelector } from 'react-redux'; // v9.0.0
import {
  NotificationApi,
  sendNotification,
  getNotifications,
  markNotificationAsRead,
  trackDeliveryStatus,
  retryNotification,
  getNotificationStats
} from '@/api/notification.api';
import {
  NotificationType,
  NotificationPriority,
  NotificationTemplate,
  NotificationStatus,
  EmailRequest,
  BulkSMSRequest
} from '@/types/notification.types';
import {
  actions,
  selectNotifications,
  selectUnreadCount,
  selectNotificationStats
} from '@/store/slices/notificationSlice';

/**
 * Interface for notification hook state
 */
interface NotificationHookState {
  loading: boolean;
  error: {
    message: string | null;
    code: string | null;
    details: Record<string, any> | null;
  };
}

/**
 * Custom hook for managing notifications with priority and delivery tracking
 * @returns Enhanced notification management interface
 */
export const useNotification = () => {
  const dispatch = useDispatch();
  
  // Local state for loading and error handling
  const [state, setState] = useState<NotificationHookState>({
    loading: false,
    error: {
      message: null,
      code: null,
      details: null
    }
  });

  // Select notifications state from Redux store
  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const statistics = useSelector(selectNotificationStats);

  /**
   * Sends a notification with priority handling and delivery tracking
   */
  const send = useCallback(async (
    type: NotificationType,
    template: NotificationTemplate,
    data: Record<string, any>,
    priority: NotificationPriority = NotificationPriority.MEDIUM
  ) => {
    setState(prev => ({ ...prev, loading: true, error: { message: null, code: null, details: null } }));

    try {
      const notificationData = {
        type,
        templateId: template,
        templateData: data,
        priority,
        metadata: {
          correlationId: crypto.randomUUID(),
          tags: [type, template, priority],
          analytics: {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          }
        }
      };

      const response = await sendNotification(notificationData);
      
      // Track delivery status
      const trackingInterval = setInterval(async () => {
        const status = await trackDeliveryStatus(response.messageId);
        if (status === NotificationStatus.DELIVERED || status === NotificationStatus.FAILED) {
          clearInterval(trackingInterval);
        }
      }, 5000);

      setState(prev => ({ ...prev, loading: false }));
      return response;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      }));
      throw error;
    }
  }, []);

  /**
   * Sends a bulk notification with batching and progress tracking
   */
  const sendBulk = useCallback(async (
    recipients: string[],
    template: NotificationTemplate,
    data: Record<string, any>,
    priority: NotificationPriority = NotificationPriority.LOW
  ) => {
    setState(prev => ({ ...prev, loading: true, error: { message: null, code: null, details: null } }));

    try {
      const bulkData = {
        recipients,
        templateId: template,
        templateData: data,
        priority,
        metadata: {
          correlationId: crypto.randomUUID(),
          tags: ['BULK', template, priority],
          analytics: {
            recipientCount: recipients.length,
            timestamp: new Date().toISOString()
          }
        }
      };

      const response = await sendNotification(bulkData);
      setState(prev => ({ ...prev, loading: false }));
      return response;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      }));
      throw error;
    }
  }, []);

  /**
   * Marks a notification as read and updates unread count
   */
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      dispatch(actions.updateUnreadCount(unreadCount - 1));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      }));
    }
  }, [dispatch, unreadCount]);

  /**
   * Retries a failed notification with exponential backoff
   */
  const retry = useCallback(async (notificationId: string) => {
    try {
      await retryNotification(notificationId);
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      }));
    }
  }, []);

  /**
   * Retrieves notification statistics and analytics
   */
  const getStats = useCallback(async (timeRange?: { start: Date; end: Date }) => {
    try {
      const stats = await getNotificationStats(timeRange);
      return stats;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      }));
      throw error;
    }
  }, []);

  // Memoized notification interface
  const notificationInterface = useMemo(() => ({
    // State
    notifications,
    unreadCount,
    loading: state.loading,
    error: state.error,
    statistics,

    // Actions
    send,
    sendBulk,
    markAsRead,
    retry,
    getStats,

    // Utility functions
    clearError: () => setState(prev => ({ ...prev, error: { message: null, code: null, details: null } }))
  }), [
    notifications,
    unreadCount,
    state.loading,
    state.error,
    statistics,
    send,
    sendBulk,
    markAsRead,
    retry,
    getStats
  ]);

  return notificationInterface;
};

export default useNotification;