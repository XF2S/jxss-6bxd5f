/**
 * @fileoverview Redux slice for managing notification state in the Enrollment System
 * Implements comprehensive notification handling with priority queuing, batch operations,
 * and delivery status tracking.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'; // v2.0.0
import {
  NotificationType,
  NotificationTemplate,
  NotificationStatus,
  NotificationPriority,
  EmailRequest,
  BulkEmailRequest
} from '@/types/notification.types';
import {
  sendEmail,
  sendBulkEmails,
  sendSMS,
  checkDeliveryStatus,
  retryNotification
} from '@/api/notification.api';

/**
 * Interface for notification state management
 */
interface NotificationState {
  notifications: Array<{
    id: string;
    type: NotificationType;
    template: NotificationTemplate;
    status: NotificationStatus;
    priority: NotificationPriority;
    metadata: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  }>;
  priorityQueue: Array<{
    id: string;
    priority: NotificationPriority;
    scheduledTime: string;
  }>;
  batchOperations: Array<{
    id: string;
    status: NotificationStatus;
    totalCount: number;
    successCount: number;
    failureCount: number;
    startTime: string;
    endTime?: string;
  }>;
  loading: boolean;
  error: {
    message: string | null;
    code: string | null;
    details: Record<string, any> | null;
    retryable: boolean;
  };
  lastSentMessageId: string | null;
  deliveryStatus: {
    status: NotificationStatus | null;
    timestamp: string | null;
    metadata: Record<string, any> | null;
    retryCount: number;
  };
  statistics: {
    totalSent: number;
    successCount: number;
    failureCount: number;
    retryCount: number;
  };
}

/**
 * Initial state for notification management
 */
const initialState: NotificationState = {
  notifications: [],
  priorityQueue: [],
  batchOperations: [],
  loading: false,
  error: {
    message: null,
    code: null,
    details: null,
    retryable: false
  },
  lastSentMessageId: null,
  deliveryStatus: {
    status: null,
    timestamp: null,
    metadata: null,
    retryCount: 0
  },
  statistics: {
    totalSent: 0,
    successCount: 0,
    failureCount: 0,
    retryCount: 0
  }
};

/**
 * Async thunk for sending email notifications with priority handling
 */
export const sendEmailNotification = createAsyncThunk(
  'notifications/sendEmail',
  async (request: EmailRequest, { rejectWithValue }) => {
    try {
      const response = await sendEmail(request);
      return response;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code,
        details: error.details,
        retryable: error.code?.startsWith('5')
      });
    }
  }
);

/**
 * Async thunk for sending bulk email notifications with batching
 */
export const sendBulkEmailNotification = createAsyncThunk(
  'notifications/sendBulkEmail',
  async (request: BulkEmailRequest, { rejectWithValue }) => {
    try {
      const response = await sendBulkEmails(request);
      return response;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code,
        details: error.details,
        retryable: error.code?.startsWith('5')
      });
    }
  }
);

/**
 * Notification slice with comprehensive state management
 */
const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = {
        message: null,
        code: null,
        details: null,
        retryable: false
      };
    },
    updateDeliveryStatus: (state, action) => {
      state.deliveryStatus = {
        ...state.deliveryStatus,
        ...action.payload
      };
    },
    resetStatistics: (state) => {
      state.statistics = {
        totalSent: 0,
        successCount: 0,
        failureCount: 0,
        retryCount: 0
      };
    }
  },
  extraReducers: (builder) => {
    builder
      // Send Email Notification
      .addCase(sendEmailNotification.pending, (state) => {
        state.loading = true;
        state.error.message = null;
      })
      .addCase(sendEmailNotification.fulfilled, (state, action) => {
        state.loading = false;
        state.lastSentMessageId = action.payload.messageId;
        state.statistics.totalSent++;
        state.statistics.successCount++;
        state.notifications.push({
          id: action.payload.messageId,
          type: NotificationType.EMAIL,
          template: action.meta.arg.templateId,
          status: NotificationStatus.SENT,
          priority: action.meta.arg.priority,
          metadata: action.payload.metadata,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      })
      .addCase(sendEmailNotification.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as any;
        state.statistics.failureCount++;
      })
      // Send Bulk Email Notification
      .addCase(sendBulkEmailNotification.pending, (state) => {
        state.loading = true;
        state.error.message = null;
      })
      .addCase(sendBulkEmailNotification.fulfilled, (state, action) => {
        state.loading = false;
        state.statistics.totalSent += action.payload.successCount;
        state.statistics.successCount += action.payload.successCount;
        state.statistics.failureCount += action.payload.failureCount;
        state.batchOperations.push({
          id: crypto.randomUUID(),
          status: NotificationStatus.SENT,
          totalCount: action.payload.successCount + action.payload.failureCount,
          successCount: action.payload.successCount,
          failureCount: action.payload.failureCount,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString()
        });
      })
      .addCase(sendBulkEmailNotification.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as any;
      });
  }
});

/**
 * Memoized selectors for notification state
 */
export const selectNotificationStats = createSelector(
  [(state: { notifications: NotificationState }) => state.notifications],
  (notifications) => notifications.statistics
);

export const selectPriorityQueue = createSelector(
  [(state: { notifications: NotificationState }) => state.notifications],
  (notifications) => notifications.priorityQueue
);

export const selectBatchOperations = createSelector(
  [(state: { notifications: NotificationState }) => state.notifications],
  (notifications) => notifications.batchOperations
);

export const { clearError, updateDeliveryStatus, resetStatistics } = notificationSlice.actions;

export default notificationSlice.reducer;