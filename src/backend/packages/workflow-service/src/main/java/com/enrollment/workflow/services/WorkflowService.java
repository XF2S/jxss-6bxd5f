package com.enrollment.workflow.services;

import com.enrollment.workflow.models.WorkflowState;
import com.enrollment.workflow.config.WorkflowConfig;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import com.codahale.metrics.MetricRegistry;
import com.codahale.metrics.Timer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Core service class that manages enrollment application workflow processing,
 * state transitions, assignments, and notifications with enhanced resilience patterns.
 *
 * @version 1.0
 * @since Spring Boot 3.x
 */
@Service
@Transactional(isolation = Isolation.REPEATABLE_READ)
public class WorkflowService {

    private static final Logger LOGGER = LoggerFactory.getLogger(WorkflowService.class);
    private static final String CIRCUIT_BREAKER_NAME = "workflowTransition";
    private static final int MAX_RETRIES = 3;
    private static final Duration RETRY_DELAY = Duration.ofSeconds(5);

    private final WorkflowConfig workflowConfig;
    private final ThreadPoolTaskExecutor workflowExecutor;
    private final CircuitBreakerRegistry circuitBreakerRegistry;
    private final MetricRegistry metricRegistry;
    private final Timer workflowCreationTimer;
    private final Timer workflowTransitionTimer;

    /**
     * Initializes the workflow service with enhanced configuration and monitoring.
     */
    public WorkflowService(
            WorkflowConfig workflowConfig,
            CircuitBreakerRegistry circuitBreakerRegistry,
            MetricRegistry metricRegistry) {
        this.workflowConfig = workflowConfig;
        this.circuitBreakerRegistry = circuitBreakerRegistry;
        this.metricRegistry = metricRegistry;
        
        // Initialize thread pool executor
        this.workflowExecutor = workflowConfig.workflowExecutor();
        
        // Initialize metrics
        this.workflowCreationTimer = metricRegistry.timer("workflow.creation.time");
        this.workflowTransitionTimer = metricRegistry.timer("workflow.transition.time");
        
        // Configure circuit breaker
        CircuitBreaker.Config circuitBreakerConfig = CircuitBreaker.Config.custom()
            .failureRateThreshold(50)
            .waitDurationInOpenState(Duration.ofSeconds(60))
            .permittedNumberOfCallsInHalfOpenState(10)
            .slidingWindowSize(100)
            .build();
        
        circuitBreakerRegistry.addConfiguration(CIRCUIT_BREAKER_NAME, circuitBreakerConfig);
        
        LOGGER.info("WorkflowService initialized with enhanced resilience patterns");
    }

    /**
     * Creates a new workflow instance with enhanced validation and monitoring.
     *
     * @param applicationId The ID of the application to create workflow for
     * @return Optional containing the created workflow instance ID
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Optional<UUID> createWorkflow(UUID applicationId) {
        final Timer.Context timerContext = workflowCreationTimer.time();
        
        try {
            LOGGER.info("Creating new workflow for application: {}", applicationId);
            
            // Validate application ID
            if (applicationId == null) {
                throw new IllegalArgumentException("Application ID cannot be null");
            }

            // Create workflow instance with initial state
            WorkflowInstance workflow = WorkflowInstance.builder()
                .id(UUID.randomUUID())
                .applicationId(applicationId)
                .state(WorkflowState.CREATED)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .version(1L)
                .build();

            // Persist workflow with retry mechanism
            return persistWorkflowWithRetry(workflow)
                .map(savedWorkflow -> {
                    // Initialize SLA monitoring
                    initializeSlaMonitoring(savedWorkflow);
                    
                    // Send creation notification
                    sendWorkflowNotification(savedWorkflow, "Workflow created");
                    
                    return savedWorkflow.getId();
                });
        } catch (Exception e) {
            LOGGER.error("Error creating workflow for application: {}", applicationId, e);
            throw new WorkflowException("Failed to create workflow", e);
        } finally {
            timerContext.stop();
        }
    }

    /**
     * Transitions workflow state with enhanced resilience and monitoring.
     *
     * @param workflowId The ID of the workflow to transition
     * @param targetState The target state to transition to
     * @return CompletableFuture<Boolean> indicating transition success
     */
    @Async
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME)
    public CompletableFuture<Boolean> transitionWorkflow(UUID workflowId, WorkflowState targetState) {
        final Timer.Context timerContext = workflowTransitionTimer.time();
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                LOGGER.info("Transitioning workflow {} to state: {}", workflowId, targetState);
                
                // Load workflow with optimistic locking
                WorkflowInstance workflow = loadWorkflowWithRetry(workflowId)
                    .orElseThrow(() -> new WorkflowNotFoundException(workflowId));

                // Validate state transition
                if (!workflow.getState().isValidTransition(targetState)) {
                    LOGGER.warn("Invalid state transition from {} to {} for workflow {}", 
                        workflow.getState(), targetState, workflowId);
                    return false;
                }

                // Update workflow state
                workflow.setState(targetState);
                workflow.setUpdatedAt(Instant.now());
                workflow.incrementVersion();

                // Persist updated workflow
                return persistWorkflowWithRetry(workflow)
                    .map(savedWorkflow -> {
                        // Update SLA monitoring
                        updateSlaMonitoring(savedWorkflow);
                        
                        // Send transition notification
                        sendWorkflowNotification(savedWorkflow, 
                            String.format("Workflow transitioned to %s", targetState));
                        
                        return true;
                    })
                    .orElse(false);

            } catch (Exception e) {
                LOGGER.error("Error transitioning workflow {} to state {}", workflowId, targetState, e);
                throw new WorkflowException("Failed to transition workflow", e);
            } finally {
                timerContext.stop();
            }
        }, workflowExecutor);
    }

    /**
     * Persists workflow instance with retry mechanism.
     */
    private Optional<WorkflowInstance> persistWorkflowWithRetry(WorkflowInstance workflow) {
        int attempts = 0;
        while (attempts < MAX_RETRIES) {
            try {
                return Optional.of(workflowRepository.save(workflow));
            } catch (Exception e) {
                attempts++;
                if (attempts == MAX_RETRIES) {
                    LOGGER.error("Failed to persist workflow after {} attempts", MAX_RETRIES, e);
                    throw e;
                }
                try {
                    Thread.sleep(RETRY_DELAY.toMillis());
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new WorkflowException("Interrupted while retrying workflow persistence", ie);
                }
            }
        }
        return Optional.empty();
    }

    /**
     * Loads workflow instance with retry mechanism.
     */
    private Optional<WorkflowInstance> loadWorkflowWithRetry(UUID workflowId) {
        int attempts = 0;
        while (attempts < MAX_RETRIES) {
            try {
                return workflowRepository.findById(workflowId);
            } catch (Exception e) {
                attempts++;
                if (attempts == MAX_RETRIES) {
                    LOGGER.error("Failed to load workflow after {} attempts", MAX_RETRIES, e);
                    throw e;
                }
                try {
                    Thread.sleep(RETRY_DELAY.toMillis());
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new WorkflowException("Interrupted while retrying workflow load", ie);
                }
            }
        }
        return Optional.empty();
    }

    /**
     * Initializes SLA monitoring for a workflow instance.
     */
    private void initializeSlaMonitoring(WorkflowInstance workflow) {
        metricRegistry.counter(
            String.format("workflow.state.%s", workflow.getState())).inc();
    }

    /**
     * Updates SLA monitoring for a workflow instance.
     */
    private void updateSlaMonitoring(WorkflowInstance workflow) {
        metricRegistry.counter(
            String.format("workflow.state.%s", workflow.getState())).inc();
        metricRegistry.timer(
            String.format("workflow.state.%s.duration", workflow.getState()))
            .update(Duration.between(workflow.getCreatedAt(), Instant.now()));
    }

    /**
     * Sends workflow notifications with batching support.
     */
    private void sendWorkflowNotification(WorkflowInstance workflow, String message) {
        workflowConfig.notificationConfig().sendNotification(
            workflow.getId(),
            workflow.getApplicationId(),
            message,
            workflow.getState()
        );
    }
}