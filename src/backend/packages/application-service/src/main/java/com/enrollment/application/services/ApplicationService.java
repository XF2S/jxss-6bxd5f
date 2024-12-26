package com.enrollment.application.services;

import com.enrollment.application.models.Application;
import com.enrollment.application.models.ApplicationStatus;
import com.enrollment.application.repositories.ApplicationRepository;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker; // version: 1.7.0
import io.github.resilience4j.retry.annotation.Retry; // version: 1.7.0
import org.slf4j.Logger; // version: 1.7.36
import org.slf4j.LoggerFactory;
import org.springframework.cache.CacheManager; // version: 3.1.0
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.core.task.AsyncTaskExecutor; // version: 3.1.0

import javax.validation.Valid;
import javax.validation.ValidationException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * Core service implementing business logic for enrollment application processing.
 * Provides enhanced security, validation, and performance optimizations.
 */
@Service
@Validated
@Transactional(readOnly = true)
public class ApplicationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ApplicationService.class);
    private static final int MAX_RETRY_ATTEMPTS = 3;
    private static final Duration CACHE_DURATION = Duration.ofMinutes(15);
    private static final String CIRCUIT_BREAKER_NAME = "applicationService";

    private final ApplicationRepository applicationRepository;
    private final WorkflowService workflowService;
    private final NotificationService notificationService;
    private final CacheManager cacheManager;
    private final AsyncTaskExecutor asyncExecutor;

    public ApplicationService(
            ApplicationRepository applicationRepository,
            WorkflowService workflowService,
            NotificationService notificationService,
            CacheManager cacheManager,
            AsyncTaskExecutor asyncExecutor) {
        this.applicationRepository = applicationRepository;
        this.workflowService = workflowService;
        this.notificationService = notificationService;
        this.cacheManager = cacheManager;
        this.asyncExecutor = asyncExecutor;
    }

    /**
     * Creates a new enrollment application with enhanced validation and security checks.
     *
     * @param userId User identifier
     * @param formData Application form data
     * @return Created application instance
     * @throws ValidationException if form data is invalid
     */
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME)
    public Application createApplication(UUID userId, @Valid Map<String, Object> formData) {
        LOGGER.info("Creating new application for user: {}", userId);
        
        validateFormData(formData);
        
        Application application = new Application();
        application.setUserId(userId);
        application.setFormData(formData);
        
        String correlationId = UUID.randomUUID().toString();
        LOGGER.debug("Generated correlation ID: {} for application", correlationId);
        
        try {
            application = applicationRepository.save(application);
            
            // Async workflow initialization
            CompletableFuture.runAsync(() -> 
                initializeWorkflow(application, correlationId), asyncExecutor);
            
            // Cache the new application
            cacheApplication(application);
            
            return application;
        } catch (Exception e) {
            LOGGER.error("Failed to create application for user: {}", userId, e);
            throw new ApplicationProcessingException("Failed to create application", e);
        }
    }

    /**
     * Submits an application for review with comprehensive validation.
     *
     * @param applicationId Application identifier
     * @return Updated application instance
     * @throws ValidationException if application is invalid
     */
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME)
    @Retry(name = CIRCUIT_BREAKER_NAME, maxAttempts = MAX_RETRY_ATTEMPTS)
    public Application submitApplication(UUID applicationId) {
        LOGGER.info("Submitting application: {}", applicationId);
        
        Application application = applicationRepository.findById(applicationId)
            .orElseThrow(() -> new ApplicationNotFoundException(applicationId));
            
        validateApplicationForSubmission(application);
        
        try {
            application.updateStatus(ApplicationStatus.SUBMITTED, "Application submitted for review");
            application.setSubmittedAt(LocalDateTime.now());
            
            application = applicationRepository.save(application);
            
            // Async notification
            CompletableFuture.runAsync(() -> 
                notifySubmission(application), asyncExecutor);
            
            // Update cache
            cacheApplication(application);
            
            return application;
        } catch (Exception e) {
            LOGGER.error("Failed to submit application: {}", applicationId, e);
            throw new ApplicationProcessingException("Failed to submit application", e);
        }
    }

    /**
     * Retrieves applications for a user with pagination support.
     *
     * @param userId User identifier
     * @param page Page number
     * @param size Page size
     * @return Page of applications
     */
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME)
    public Page<Application> getApplicationsByUser(UUID userId, int page, int size) {
        LOGGER.debug("Retrieving applications for user: {}", userId);
        
        try {
            Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
            return applicationRepository.findByUserId(userId, pageable);
        } catch (Exception e) {
            LOGGER.error("Failed to retrieve applications for user: {}", userId, e);
            throw new ApplicationProcessingException("Failed to retrieve applications", e);
        }
    }

    /**
     * Updates application status with validation and notification.
     *
     * @param applicationId Application identifier
     * @param newStatus New status
     * @param comment Status change comment
     * @return Updated application instance
     */
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME)
    public Application updateApplicationStatus(UUID applicationId, ApplicationStatus newStatus, String comment) {
        LOGGER.info("Updating status for application: {} to: {}", applicationId, newStatus);
        
        Application application = applicationRepository.findById(applicationId)
            .orElseThrow(() -> new ApplicationNotFoundException(applicationId));
            
        try {
            application.updateStatus(newStatus, comment);
            application = applicationRepository.save(application);
            
            // Async notification
            CompletableFuture.runAsync(() -> 
                notifyStatusChange(application, comment), asyncExecutor);
            
            // Update cache
            cacheApplication(application);
            
            return application;
        } catch (Exception e) {
            LOGGER.error("Failed to update status for application: {}", applicationId, e);
            throw new ApplicationProcessingException("Failed to update application status", e);
        }
    }

    // Private helper methods

    private void validateFormData(Map<String, Object> formData) {
        if (formData == null || formData.isEmpty()) {
            throw new ValidationException("Form data cannot be empty");
        }
        // Additional validation logic
    }

    private void validateApplicationForSubmission(Application application) {
        if (application.getStatus() != ApplicationStatus.DRAFT) {
            throw new ValidationException("Only applications in DRAFT status can be submitted");
        }
        // Additional validation logic
    }

    @Async
    private void initializeWorkflow(Application application, String correlationId) {
        try {
            workflowService.initializeWorkflow(application.getId(), correlationId);
        } catch (Exception e) {
            LOGGER.error("Failed to initialize workflow for application: {}", application.getId(), e);
            // Handle failure
        }
    }

    @Async
    private void notifySubmission(Application application) {
        try {
            notificationService.sendSubmissionNotification(application);
        } catch (Exception e) {
            LOGGER.error("Failed to send submission notification for application: {}", application.getId(), e);
            // Handle failure
        }
    }

    @Async
    private void notifyStatusChange(Application application, String comment) {
        try {
            notificationService.sendStatusChangeNotification(application, comment);
        } catch (Exception e) {
            LOGGER.error("Failed to send status change notification for application: {}", application.getId(), e);
            // Handle failure
        }
    }

    private void cacheApplication(Application application) {
        cacheManager.getCache("applications")
            .put(application.getId(), application);
    }
}