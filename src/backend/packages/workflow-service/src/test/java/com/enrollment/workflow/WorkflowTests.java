package com.enrollment.workflow;

import com.enrollment.workflow.models.WorkflowState;
import com.enrollment.workflow.services.WorkflowService;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.mockito.Mock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.async.AsyncTestExecutionException;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Comprehensive test suite for the Workflow Service covering state transitions,
 * resilience patterns, and performance metrics.
 * 
 * @version 1.0
 */
@SpringBootTest(classes = WorkflowApplication.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class WorkflowTests {

    @Autowired
    private WorkflowService workflowService;

    @MockBean
    private CircuitBreakerRegistry circuitBreakerRegistry;

    @Mock
    private CircuitBreaker circuitBreaker;

    private MeterRegistry meterRegistry;

    private static final Duration TEST_TIMEOUT = Duration.ofSeconds(10);
    private static final int CONCURRENT_WORKFLOWS = 5;

    @BeforeEach
    void setUp() {
        // Initialize metrics registry
        meterRegistry = new SimpleMeterRegistry();

        // Configure circuit breaker behavior
        when(circuitBreakerRegistry.circuitBreaker(anyString())).thenReturn(circuitBreaker);
        when(circuitBreaker.executeSupplier(any())).thenAnswer(i -> i.getArgument(0));
    }

    /**
     * Tests the successful creation and validation of a new workflow.
     */
    @Test
    void testWorkflowCreation() {
        // Create new workflow
        UUID applicationId = UUID.randomUUID();
        Optional<UUID> workflowId = workflowService.createWorkflow(applicationId);

        // Verify workflow creation
        assertTrue(workflowId.isPresent(), "Workflow should be created successfully");
        assertNotNull(workflowId.get(), "Workflow ID should not be null");

        // Verify initial state
        assertEquals(
            WorkflowState.CREATED,
            workflowService.getWorkflowStatus(workflowId.get()),
            "Initial workflow state should be CREATED"
        );
    }

    /**
     * Tests valid workflow state transitions through the complete lifecycle.
     */
    @Test
    void testValidStateTransitions() throws ExecutionException, InterruptedException, TimeoutException {
        // Create workflow
        UUID applicationId = UUID.randomUUID();
        UUID workflowId = workflowService.createWorkflow(applicationId).orElseThrow();

        // Test transitions through valid states
        CompletableFuture<Boolean> documentVerification = workflowService
            .transitionWorkflow(workflowId, WorkflowState.DOCUMENT_VERIFICATION)
            .thenCompose(result -> {
                assertTrue(result, "Transition to DOCUMENT_VERIFICATION should succeed");
                return workflowService.transitionWorkflow(workflowId, WorkflowState.ACADEMIC_REVIEW);
            })
            .thenCompose(result -> {
                assertTrue(result, "Transition to ACADEMIC_REVIEW should succeed");
                return workflowService.transitionWorkflow(workflowId, WorkflowState.FINAL_REVIEW);
            })
            .thenCompose(result -> {
                assertTrue(result, "Transition to FINAL_REVIEW should succeed");
                return workflowService.transitionWorkflow(workflowId, WorkflowState.APPROVED);
            });

        assertTrue(documentVerification.get(TEST_TIMEOUT.toSeconds(), TimeUnit.SECONDS),
            "Complete workflow transition sequence should succeed");
    }

    /**
     * Tests invalid workflow state transitions.
     */
    @Test
    void testInvalidStateTransitions() throws ExecutionException, InterruptedException {
        // Create workflow
        UUID applicationId = UUID.randomUUID();
        UUID workflowId = workflowService.createWorkflow(applicationId).orElseThrow();

        // Attempt invalid transition
        CompletableFuture<Boolean> invalidTransition = workflowService
            .transitionWorkflow(workflowId, WorkflowState.APPROVED);

        assertFalse(invalidTransition.get(), "Invalid state transition should fail");
    }

    /**
     * Tests asynchronous workflow processing with multiple concurrent workflows.
     */
    @Test
    void testAsyncWorkflowProcessing() throws InterruptedException {
        // Create multiple concurrent workflows
        CompletableFuture<?>[] workflows = new CompletableFuture[CONCURRENT_WORKFLOWS];
        
        for (int i = 0; i < CONCURRENT_WORKFLOWS; i++) {
            UUID applicationId = UUID.randomUUID();
            workflows[i] = workflowService.createWorkflow(applicationId)
                .map(workflowId -> workflowService.processAsync(workflowId))
                .orElseThrow();
        }

        // Wait for all workflows to complete
        CompletableFuture.allOf(workflows).join();

        // Verify metrics
        assertTrue(
            meterRegistry.get("workflow.processing.concurrent").gauge().value() <= CONCURRENT_WORKFLOWS,
            "Concurrent workflow count should not exceed limit"
        );
    }

    /**
     * Tests circuit breaker behavior under failure conditions.
     */
    @Test
    void testCircuitBreakerFailover() throws Exception {
        // Configure circuit breaker to fail
        when(circuitBreaker.executeSupplier(any()))
            .thenThrow(new RuntimeException("Simulated failure"));

        UUID workflowId = UUID.randomUUID();
        
        // Attempt operation that should trigger circuit breaker
        assertThrows(
            RuntimeException.class,
            () -> workflowService.transitionWorkflow(workflowId, WorkflowState.DOCUMENT_VERIFICATION)
                .get(TEST_TIMEOUT.toSeconds(), TimeUnit.SECONDS),
            "Circuit breaker should trigger on failure"
        );

        // Verify circuit breaker metrics
        verify(circuitBreaker, times(1)).executeSupplier(any());
    }

    /**
     * Tests SLA monitoring and metrics collection.
     */
    @Test
    void testSLAMonitoring() throws Exception {
        // Create workflow with SLA
        UUID applicationId = UUID.randomUUID();
        UUID workflowId = workflowService.createWorkflow(applicationId).orElseThrow();

        // Process workflow through stages
        workflowService.transitionWorkflow(workflowId, WorkflowState.DOCUMENT_VERIFICATION)
            .get(TEST_TIMEOUT.toSeconds(), TimeUnit.SECONDS);

        // Verify SLA metrics
        var slaMetrics = workflowService.getSLAMetrics(workflowId);
        assertNotNull(slaMetrics, "SLA metrics should be available");
        assertTrue(slaMetrics.isWithinThreshold(), "Workflow should be within SLA threshold");
    }

    /**
     * Tests optimistic locking handling for concurrent modifications.
     */
    @Test
    void testOptimisticLockingHandling() throws Exception {
        // Create workflow
        UUID applicationId = UUID.randomUUID();
        UUID workflowId = workflowService.createWorkflow(applicationId).orElseThrow();

        // Simulate concurrent modifications
        CompletableFuture<Boolean> transition1 = workflowService
            .transitionWorkflow(workflowId, WorkflowState.DOCUMENT_VERIFICATION);
        CompletableFuture<Boolean> transition2 = workflowService
            .transitionWorkflow(workflowId, WorkflowState.DOCUMENT_VERIFICATION);

        // Verify only one transition succeeds
        assertTrue(
            transition1.get(TEST_TIMEOUT.toSeconds(), TimeUnit.SECONDS) ^
            transition2.get(TEST_TIMEOUT.toSeconds(), TimeUnit.SECONDS),
            "Only one concurrent modification should succeed"
        );
    }
}