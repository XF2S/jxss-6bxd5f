package com.enrollment.workflow.config;

import com.enrollment.workflow.models.WorkflowState;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import java.util.concurrent.RejectedExecutionHandler;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.Map;
import java.util.HashMap;
import java.time.Duration;

/**
 * Comprehensive workflow configuration for the enrollment system.
 * Provides configuration for async processing, state management, notifications,
 * and monitoring of enrollment workflows.
 * 
 * @version 1.0
 * @since Spring Boot 3.x
 */
@Configuration
@EnableAsync
@ConfigurationProperties(prefix = "workflow")
public class WorkflowConfig {

    private final ExecutorProperties executorProperties;
    private final StateProperties stateProperties;
    private final NotificationProperties notificationProperties;
    private final MonitoringProperties monitoringProperties;

    public WorkflowConfig() {
        this.executorProperties = new ExecutorProperties();
        this.stateProperties = new StateProperties();
        this.notificationProperties = new NotificationProperties();
        this.monitoringProperties = new MonitoringProperties();
    }

    /**
     * Configures the thread pool executor for workflow processing
     * with optimized settings for enrollment operations.
     */
    @Bean
    public ThreadPoolTaskExecutor workflowExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        
        // Set core pool size based on available processors
        executor.setCorePoolSize(executorProperties.getCorePoolSize());
        executor.setMaxPoolSize(executorProperties.getMaxPoolSize());
        executor.setQueueCapacity(executorProperties.getQueueCapacity());
        executor.setThreadNamePrefix("workflow-executor-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setAllowCoreThreadTimeOut(true);
        executor.setKeepAliveSeconds(60);
        
        executor.initialize();
        return executor;
    }

    /**
     * Configures the workflow state validator with comprehensive validation rules
     * and transition policies.
     */
    @Bean
    public WorkflowStateValidator workflowStateValidator() {
        WorkflowStateValidator validator = new WorkflowStateValidator();
        
        // Configure state timeouts
        Map<WorkflowState, Duration> stateTimeouts = new HashMap<>();
        stateTimeouts.put(WorkflowState.DOCUMENT_VERIFICATION, Duration.ofHours(48));
        stateTimeouts.put(WorkflowState.ACADEMIC_REVIEW, Duration.ofHours(72));
        stateTimeouts.put(WorkflowState.FINAL_REVIEW, Duration.ofHours(24));
        validator.setStateTimeouts(stateTimeouts);

        // Configure auto-transition rules
        validator.setAutoTransitionEnabled(stateProperties.isAutoTransitionEnabled());
        validator.setMaxRetries(stateProperties.getMaxRetries());
        validator.setRetryDelay(stateProperties.getRetryDelay());

        // Configure validation cache
        validator.setCacheSize(stateProperties.getValidationCacheSize());
        validator.setCacheTtl(stateProperties.getValidationCacheTtl());

        return validator;
    }

    /**
     * Configures the notification system for workflow state changes
     * and important events.
     */
    @Bean
    public NotificationConfig notificationConfig() {
        NotificationConfig config = new NotificationConfig();
        
        // Configure email notifications
        config.setEmailEnabled(notificationProperties.isEmailEnabled());
        config.setEmailTemplate(notificationProperties.getEmailTemplate());
        config.setEmailRetryCount(notificationProperties.getEmailRetryCount());

        // Configure SMS notifications
        config.setSmsEnabled(notificationProperties.isSmsEnabled());
        config.setSmsTemplate(notificationProperties.getSmsTemplate());
        config.setSmsRetryCount(notificationProperties.getSmsRetryCount());

        // Configure in-app notifications
        config.setInAppEnabled(notificationProperties.isInAppEnabled());
        config.setInAppTemplate(notificationProperties.getInAppTemplate());

        // Configure batch settings
        config.setBatchSize(notificationProperties.getBatchSize());
        config.setBatchInterval(notificationProperties.getBatchInterval());

        return config;
    }

    /**
     * Properties class for thread pool executor configuration
     */
    public static class ExecutorProperties {
        private int corePoolSize = Runtime.getRuntime().availableProcessors() * 2;
        private int maxPoolSize = corePoolSize * 4;
        private int queueCapacity = 500;

        // Getters and setters
        public int getCorePoolSize() { return corePoolSize; }
        public void setCorePoolSize(int corePoolSize) { this.corePoolSize = corePoolSize; }
        public int getMaxPoolSize() { return maxPoolSize; }
        public void setMaxPoolSize(int maxPoolSize) { this.maxPoolSize = maxPoolSize; }
        public int getQueueCapacity() { return queueCapacity; }
        public void setQueueCapacity(int queueCapacity) { this.queueCapacity = queueCapacity; }
    }

    /**
     * Properties class for workflow state configuration
     */
    public static class StateProperties {
        private boolean autoTransitionEnabled = true;
        private int maxRetries = 3;
        private Duration retryDelay = Duration.ofMinutes(5);
        private int validationCacheSize = 1000;
        private Duration validationCacheTtl = Duration.ofMinutes(30);

        // Getters and setters
        public boolean isAutoTransitionEnabled() { return autoTransitionEnabled; }
        public void setAutoTransitionEnabled(boolean autoTransitionEnabled) { this.autoTransitionEnabled = autoTransitionEnabled; }
        public int getMaxRetries() { return maxRetries; }
        public void setMaxRetries(int maxRetries) { this.maxRetries = maxRetries; }
        public Duration getRetryDelay() { return retryDelay; }
        public void setRetryDelay(Duration retryDelay) { this.retryDelay = retryDelay; }
        public int getValidationCacheSize() { return validationCacheSize; }
        public void setValidationCacheSize(int validationCacheSize) { this.validationCacheSize = validationCacheSize; }
        public Duration getValidationCacheTtl() { return validationCacheTtl; }
        public void setValidationCacheTtl(Duration validationCacheTtl) { this.validationCacheTtl = validationCacheTtl; }
    }

    /**
     * Properties class for notification configuration
     */
    public static class NotificationProperties {
        private boolean emailEnabled = true;
        private String emailTemplate = "default-email-template";
        private int emailRetryCount = 3;
        private boolean smsEnabled = true;
        private String smsTemplate = "default-sms-template";
        private int smsRetryCount = 3;
        private boolean inAppEnabled = true;
        private String inAppTemplate = "default-inapp-template";
        private int batchSize = 100;
        private Duration batchInterval = Duration.ofMinutes(5);

        // Getters and setters
        public boolean isEmailEnabled() { return emailEnabled; }
        public void setEmailEnabled(boolean emailEnabled) { this.emailEnabled = emailEnabled; }
        public String getEmailTemplate() { return emailTemplate; }
        public void setEmailTemplate(String emailTemplate) { this.emailTemplate = emailTemplate; }
        public int getEmailRetryCount() { return emailRetryCount; }
        public void setEmailRetryCount(int emailRetryCount) { this.emailRetryCount = emailRetryCount; }
        public boolean isSmsEnabled() { return smsEnabled; }
        public void setSmsEnabled(boolean smsEnabled) { this.smsEnabled = smsEnabled; }
        public String getSmsTemplate() { return smsTemplate; }
        public void setSmsTemplate(String smsTemplate) { this.smsTemplate = smsTemplate; }
        public int getSmsRetryCount() { return smsRetryCount; }
        public void setSmsRetryCount(int smsRetryCount) { this.smsRetryCount = smsRetryCount; }
        public boolean isInAppEnabled() { return inAppEnabled; }
        public void setInAppEnabled(boolean inAppEnabled) { this.inAppEnabled = inAppEnabled; }
        public String getInAppTemplate() { return inAppTemplate; }
        public void setInAppTemplate(String inAppTemplate) { this.inAppTemplate = inAppTemplate; }
        public int getBatchSize() { return batchSize; }
        public void setBatchSize(int batchSize) { this.batchSize = batchSize; }
        public Duration getBatchInterval() { return batchInterval; }
        public void setBatchInterval(Duration batchInterval) { this.batchInterval = batchInterval; }
    }

    /**
     * Properties class for monitoring configuration
     */
    public static class MonitoringProperties {
        private boolean slaMonitoringEnabled = true;
        private Duration slaWarningThreshold = Duration.ofHours(4);
        private Duration slaBreachThreshold = Duration.ofHours(8);
        private boolean metricsEnabled = true;
        private boolean alertingEnabled = true;

        // Getters and setters
        public boolean isSlaMonitoringEnabled() { return slaMonitoringEnabled; }
        public void setSlaMonitoringEnabled(boolean slaMonitoringEnabled) { this.slaMonitoringEnabled = slaMonitoringEnabled; }
        public Duration getSlaWarningThreshold() { return slaWarningThreshold; }
        public void setSlaWarningThreshold(Duration slaWarningThreshold) { this.slaWarningThreshold = slaWarningThreshold; }
        public Duration getSlaBreachThreshold() { return slaBreachThreshold; }
        public void setSlaBreachThreshold(Duration slaBreachThreshold) { this.slaBreachThreshold = slaBreachThreshold; }
        public boolean isMetricsEnabled() { return metricsEnabled; }
        public void setMetricsEnabled(boolean metricsEnabled) { this.metricsEnabled = metricsEnabled; }
        public boolean isAlertingEnabled() { return alertingEnabled; }
        public void setAlertingEnabled(boolean alertingEnabled) { this.alertingEnabled = alertingEnabled; }
    }
}