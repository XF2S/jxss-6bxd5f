/**
 * @fileoverview Type definitions for notification-related data structures and interfaces
 * @version 1.0.0
 */

/**
 * Defines available notification types supported by the system
 */
export enum NotificationType {
    EMAIL = 'EMAIL',
    SMS = 'SMS',
    SYSTEM = 'SYSTEM'
}

/**
 * Defines notification priority levels for message handling and delivery
 */
export enum NotificationPriority {
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
    LOW = 'LOW'
}

/**
 * Available notification template identifiers for various system events
 */
export enum NotificationTemplate {
    APPLICATION_SUBMITTED = 'APPLICATION_SUBMITTED',
    APPLICATION_APPROVED = 'APPLICATION_APPROVED',
    APPLICATION_REJECTED = 'APPLICATION_REJECTED',
    DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
    DOCUMENT_VERIFIED = 'DOCUMENT_VERIFIED',
    DOCUMENT_REJECTED = 'DOCUMENT_REJECTED',
    STATUS_UPDATE = 'STATUS_UPDATE',
    WELCOME = 'WELCOME',
    PASSWORD_RESET = 'PASSWORD_RESET',
    ACCOUNT_VERIFICATION = 'ACCOUNT_VERIFICATION'
}

/**
 * Notification delivery status types for tracking message state
 */
export enum NotificationStatus {
    PENDING = 'PENDING',
    SENT = 'SENT',
    DELIVERED = 'DELIVERED',
    FAILED = 'FAILED'
}

/**
 * Type definition for template validation functions
 */
export type ValidatorFn = (value: any) => boolean;

/**
 * Interface for template validation configuration
 */
export interface TemplateValidation {
    readonly requiredFields: readonly string[];
    readonly optionalFields: readonly string[];
    readonly fieldValidators: readonly Record<string, ValidatorFn>;
    version: string;
}

/**
 * Interface for notification tracking and analytics metadata
 */
export interface NotificationMetadata {
    correlationId: string;
    readonly tags: readonly string[];
    analytics: Record<string, any>;
}

/**
 * Enhanced email request interface with priority and metadata support
 */
export interface EmailRequest {
    to: string;
    templateId: NotificationTemplate;
    templateData: Record<string, any>;
    priority: NotificationPriority;
    metadata: NotificationMetadata;
}

/**
 * Bulk SMS request interface for handling multiple recipients
 */
export interface BulkSMSRequest {
    readonly phoneNumbers: readonly string[];
    templateId: NotificationTemplate;
    templateData: Record<string, any>;
    priority: NotificationPriority;
    metadata: NotificationMetadata;
}

/**
 * Bulk SMS response interface with detailed status information
 */
export interface BulkSMSResponse {
    successCount: number;
    failedCount: number;
    readonly errors: readonly string[];
    readonly messageSids: readonly string[];
}

/**
 * Type guard to check if a template ID is valid
 */
export const isValidTemplate = (template: string): template is NotificationTemplate => {
    return Object.values(NotificationTemplate).includes(template as NotificationTemplate);
};

/**
 * Type guard to check if a notification priority is valid
 */
export const isValidPriority = (priority: string): priority is NotificationPriority => {
    return Object.values(NotificationPriority).includes(priority as NotificationPriority);
};

/**
 * Type guard to check if a notification type is valid
 */
export const isValidNotificationType = (type: string): type is NotificationType => {
    return Object.values(NotificationType).includes(type as NotificationType);
};