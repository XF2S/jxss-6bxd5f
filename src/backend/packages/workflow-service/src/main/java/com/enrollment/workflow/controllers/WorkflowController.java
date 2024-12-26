package com.enrollment.workflow.controllers;

import com.enrollment.workflow.services.WorkflowService;
import com.enrollment.workflow.models.WorkflowState;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.micrometer.core.annotation.Timed;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.hateoas.EntityModel;
import org.springframework.hateoas.Link;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * REST controller for managing enrollment workflow operations with enhanced security,
 * caching, rate limiting, and monitoring capabilities.
 *
 * @version 1.0
 * @since Spring Boot 3.x
 */
@RestController
@RequestMapping("/api/v1/workflow")
@Tag(name = "Workflow Management")
@Validated
public class WorkflowController {

    private static final Logger LOGGER = LoggerFactory.getLogger(WorkflowController.class);
    private static final String CACHE_NAME = "workflow-status";
    private static final String RATE_LIMITER = "workflow-api";

    private final WorkflowService workflowService;
    private final MeterRegistry meterRegistry;
    private final Timer createWorkflowTimer;
    private final Timer statusCheckTimer;

    /**
     * Initializes the workflow controller with required dependencies and metrics.
     */
    public WorkflowController(WorkflowService workflowService, MeterRegistry meterRegistry) {
        this.workflowService = workflowService;
        this.meterRegistry = meterRegistry;
        
        // Initialize performance metrics
        this.createWorkflowTimer = Timer.builder("workflow.create.time")
            .description("Time taken to create new workflows")
            .register(meterRegistry);
        this.statusCheckTimer = Timer.builder("workflow.status.time")
            .description("Time taken to check workflow status")
            .register(meterRegistry);
        
        LOGGER.info("WorkflowController initialized with metrics configuration");
    }

    /**
     * Creates a new workflow instance for an enrollment application.
     *
     * @param request The workflow creation request
     * @return ResponseEntity containing the created workflow instance
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('STAFF')")
    @RateLimiter(name = RATE_LIMITER)
    @Timed(value = "workflow.create", percentiles = {0.5, 0.95, 0.99})
    @Operation(summary = "Create new workflow", description = "Creates a new workflow instance for enrollment processing")
    public ResponseEntity<EntityModel<WorkflowInstance>> createWorkflow(
            @Valid @RequestBody WorkflowRequest request) {
        
        String traceId = UUID.randomUUID().toString();
        LOGGER.info("Creating new workflow. TraceId: {}, Request: {}", traceId, request);

        return createWorkflowTimer.record(() -> {
            try {
                Optional<UUID> workflowId = workflowService.createWorkflow(request.getApplicationId());
                
                if (workflowId.isPresent()) {
                    EntityModel<WorkflowInstance> resource = EntityModel.of(
                        workflowService.getWorkflowById(workflowId.get())
                            .orElseThrow(() -> new WorkflowNotFoundException(workflowId.get()))
                    );
                    
                    // Add HATEOAS links
                    resource.add(
                        Link.of("/api/v1/workflow/" + workflowId.get()).withSelfRel(),
                        Link.of("/api/v1/workflow/" + workflowId.get() + "/status").withRel("status"),
                        Link.of("/api/v1/workflow/" + workflowId.get() + "/transitions").withRel("transitions")
                    );

                    meterRegistry.counter("workflow.created").increment();
                    
                    LOGGER.info("Workflow created successfully. TraceId: {}, WorkflowId: {}", 
                        traceId, workflowId.get());
                        
                    return ResponseEntity.status(HttpStatus.CREATED).body(resource);
                }
                
                LOGGER.error("Failed to create workflow. TraceId: {}", traceId);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
                
            } catch (Exception e) {
                LOGGER.error("Error creating workflow. TraceId: {}, Error: {}", traceId, e.getMessage(), e);
                throw new WorkflowCreationException("Failed to create workflow", e);
            }
        });
    }

    /**
     * Retrieves the current status of a workflow instance.
     *
     * @param workflowId The ID of the workflow
     * @return ResponseEntity containing the workflow status
     */
    @GetMapping("/{workflowId}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'USER')")
    @Cacheable(value = CACHE_NAME, key = "#workflowId")
    @RateLimiter(name = RATE_LIMITER)
    @Timed(value = "workflow.status", percentiles = {0.5, 0.95, 0.99})
    @Operation(summary = "Get workflow status", description = "Retrieves current status of workflow instance")
    public ResponseEntity<EntityModel<WorkflowStatus>> getWorkflowStatus(
            @PathVariable @NotNull UUID workflowId) {
        
        String traceId = UUID.randomUUID().toString();
        LOGGER.info("Retrieving workflow status. TraceId: {}, WorkflowId: {}", traceId, workflowId);

        return statusCheckTimer.record(() -> {
            try {
                WorkflowStatus status = workflowService.getWorkflowStatus(workflowId)
                    .orElseThrow(() -> new WorkflowNotFoundException(workflowId));

                EntityModel<WorkflowStatus> resource = EntityModel.of(status);
                
                // Add HATEOAS links
                resource.add(
                    Link.of("/api/v1/workflow/" + workflowId).withRel("workflow"),
                    Link.of("/api/v1/workflow/" + workflowId + "/status").withSelfRel(),
                    Link.of("/api/v1/workflow/" + workflowId + "/history").withRel("history")
                );

                if (status.getState().getAllowedTransitions().size() > 0) {
                    resource.add(Link.of("/api/v1/workflow/" + workflowId + "/transition").withRel("transition"));
                }

                meterRegistry.counter("workflow.status.checked").increment();
                
                LOGGER.info("Workflow status retrieved successfully. TraceId: {}, Status: {}", 
                    traceId, status.getState());
                    
                return ResponseEntity.ok(resource);
                
            } catch (WorkflowNotFoundException e) {
                LOGGER.warn("Workflow not found. TraceId: {}, WorkflowId: {}", traceId, workflowId);
                return ResponseEntity.notFound().build();
                
            } catch (Exception e) {
                LOGGER.error("Error retrieving workflow status. TraceId: {}, Error: {}", 
                    traceId, e.getMessage(), e);
                throw new WorkflowOperationException("Failed to retrieve workflow status", e);
            }
        });
    }

    /**
     * Transitions a workflow to a new state.
     *
     * @param workflowId The ID of the workflow
     * @param request The transition request containing target state
     * @return ResponseEntity indicating transition success
     */
    @PostMapping("/{workflowId}/transition")
    @PreAuthorize("hasRole('ADMIN') or hasRole('STAFF')")
    @CacheEvict(value = CACHE_NAME, key = "#workflowId")
    @RateLimiter(name = RATE_LIMITER)
    @Timed(value = "workflow.transition", percentiles = {0.5, 0.95, 0.99})
    @Operation(summary = "Transition workflow", description = "Transitions workflow to a new state")
    public ResponseEntity<Void> transitionWorkflow(
            @PathVariable @NotNull UUID workflowId,
            @Valid @RequestBody WorkflowTransitionRequest request) {
        
        String traceId = UUID.randomUUID().toString();
        LOGGER.info("Transitioning workflow. TraceId: {}, WorkflowId: {}, TargetState: {}", 
            traceId, workflowId, request.getTargetState());

        try {
            CompletableFuture<Boolean> transitionFuture = 
                workflowService.transitionWorkflow(workflowId, request.getTargetState());

            boolean success = transitionFuture.get();
            
            if (success) {
                meterRegistry.counter("workflow.transition.success").increment();
                LOGGER.info("Workflow transitioned successfully. TraceId: {}", traceId);
                return ResponseEntity.ok().build();
            }
            
            LOGGER.warn("Workflow transition failed. TraceId: {}", traceId);
            return ResponseEntity.badRequest().build();
            
        } catch (Exception e) {
            LOGGER.error("Error transitioning workflow. TraceId: {}, Error: {}", 
                traceId, e.getMessage(), e);
            throw new WorkflowOperationException("Failed to transition workflow", e);
        }
    }
}