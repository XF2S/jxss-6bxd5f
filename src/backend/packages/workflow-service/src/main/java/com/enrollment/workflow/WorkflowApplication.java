package com.enrollment.workflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.beans.factory.annotation.Autowired;
import com.enrollment.workflow.config.WorkflowConfig;
import java.util.concurrent.ThreadPoolTaskExecutor;
import javax.annotation.PreDestroy;

/**
 * Main Spring Boot application class for the Workflow Service that manages enrollment
 * application state transitions, automated workflows, and process automation.
 * 
 * Features:
 * - Enhanced startup validation
 * - Comprehensive monitoring
 * - Graceful shutdown handling
 * - Service discovery integration
 * - Workflow state management
 * 
 * @version 1.0
 * @since Spring Boot 3.x
 */
@SpringBootApplication
@EnableDiscoveryClient
public class WorkflowApplication {

    private static final Logger LOGGER = LoggerFactory.getLogger(WorkflowApplication.class);
    
    @Autowired
    private WorkflowConfig workflowConfig;
    
    @Autowired
    private ThreadPoolTaskExecutor workflowExecutor;

    /**
     * Main entry point for the Workflow Service application.
     * Initializes the Spring Boot application with enhanced startup validation
     * and monitoring capabilities.
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        LOGGER.info("Initializing Workflow Service...");
        
        try {
            ConfigurableApplicationContext context = SpringApplication.run(WorkflowApplication.class, args);
            LOGGER.info("Workflow Service initialization completed successfully");
            
            // Register shutdown hook for graceful termination
            context.registerShutdownHook();
            
        } catch (Exception e) {
            LOGGER.error("Failed to start Workflow Service", e);
            System.exit(1);
        }
    }

    /**
     * Performs post-startup validation and initialization.
     * Executed after the application context is fully started.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        LOGGER.info("Performing post-startup validation...");
        
        try {
            // Validate workflow executor configuration
            validateExecutorConfiguration();
            
            // Validate workflow state configuration
            validateStateConfiguration();
            
            // Initialize workflow monitoring
            initializeMonitoring();
            
            LOGGER.info("Post-startup validation completed successfully");
            
        } catch (Exception e) {
            LOGGER.error("Post-startup validation failed", e);
            throw e; // Fail fast if validation fails
        }
    }

    /**
     * Validates the workflow executor configuration.
     * Ensures proper thread pool settings and execution policies.
     */
    private void validateExecutorConfiguration() {
        LOGGER.debug("Validating workflow executor configuration...");
        
        if (workflowExecutor == null) {
            throw new IllegalStateException("Workflow executor not properly initialized");
        }
        
        // Log executor configuration
        LOGGER.info("Workflow executor configuration: corePoolSize={}, maxPoolSize={}, queueCapacity={}",
            workflowExecutor.getCorePoolSize(),
            workflowExecutor.getMaxPoolSize(),
            workflowExecutor.getQueueCapacity());
    }

    /**
     * Validates the workflow state configuration.
     * Ensures proper state transitions and validation rules.
     */
    private void validateStateConfiguration() {
        LOGGER.debug("Validating workflow state configuration...");
        
        if (workflowConfig == null) {
            throw new IllegalStateException("Workflow configuration not properly initialized");
        }
        
        // Validate state validator configuration
        var stateValidator = workflowConfig.workflowStateValidator();
        if (stateValidator == null) {
            throw new IllegalStateException("Workflow state validator not properly initialized");
        }
        
        LOGGER.info("Workflow state configuration validated successfully");
    }

    /**
     * Initializes monitoring for workflow processing.
     * Sets up metrics collection and performance monitoring.
     */
    private void initializeMonitoring() {
        LOGGER.debug("Initializing workflow monitoring...");
        
        // Initialize metrics collection
        initializeMetrics();
        
        // Initialize performance monitoring
        initializePerformanceMonitoring();
        
        LOGGER.info("Workflow monitoring initialized successfully");
    }

    /**
     * Initializes metrics collection for workflow processing.
     */
    private void initializeMetrics() {
        // Initialize workflow processing metrics
        LOGGER.debug("Initializing workflow metrics collection...");
        // Metrics initialization logic would go here
    }

    /**
     * Initializes performance monitoring for workflow processing.
     */
    private void initializePerformanceMonitoring() {
        // Initialize performance monitoring
        LOGGER.debug("Initializing performance monitoring...");
        // Performance monitoring initialization logic would go here
    }

    /**
     * Handles graceful shutdown of the Workflow Service.
     * Ensures proper cleanup of resources and completion of in-flight workflows.
     */
    @PreDestroy
    public void onShutdown() {
        LOGGER.info("Initiating graceful shutdown of Workflow Service...");
        
        try {
            // Shutdown workflow executor gracefully
            if (workflowExecutor != null) {
                workflowExecutor.shutdown();
                LOGGER.info("Workflow executor shutdown completed");
            }
            
            LOGGER.info("Workflow Service shutdown completed successfully");
            
        } catch (Exception e) {
            LOGGER.error("Error during Workflow Service shutdown", e);
            // Continue with shutdown despite errors
        }
    }
}