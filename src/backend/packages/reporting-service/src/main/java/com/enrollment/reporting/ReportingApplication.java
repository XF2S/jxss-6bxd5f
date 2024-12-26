package com.enrollment.reporting;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.enrollment.reporting.config.ReportingConfig;

/**
 * Main application class for the Reporting Service with enhanced operational capabilities.
 * Provides comprehensive reporting functionality with performance optimization and monitoring.
 *
 * @version 1.0
 * @since 2024-01
 */
@SpringBootApplication
@EnableAsync
@EnableScheduling
@ConfigurationProperties(prefix = "reporting")
@Import(ReportingConfig.class)
public class ReportingApplication implements HealthIndicator {

    private static final Logger LOGGER = LoggerFactory.getLogger(ReportingApplication.class);
    
    private Integer shutdownTimeout = 60; // Default shutdown timeout in seconds
    private Integer maxPoolSize = Runtime.getRuntime().availableProcessors() * 2;
    private Boolean healthCheckEnabled = true;

    @Autowired
    private Environment environment;
    
    @Autowired
    private ThreadPoolTaskExecutor reportTaskExecutor;

    /**
     * Application entry point with enhanced error handling and logging
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        LOGGER.info("Initializing Reporting Service...");
        try {
            // Configure system properties for performance optimization
            System.setProperty("spring.output.ansi.enabled", "ALWAYS");
            System.setProperty("server.tomcat.max-threads", "200");
            System.setProperty("spring.jmx.enabled", "true");

            // Initialize Spring Boot application with custom configuration
            SpringApplication app = new SpringApplication(ReportingApplication.class);
            app.addListeners(new ApplicationStartupListener());
            app.run(args);

            LOGGER.info("Reporting Service started successfully");
        } catch (Exception e) {
            LOGGER.error("Failed to start Reporting Service", e);
            System.exit(1);
        }
    }

    /**
     * Configures graceful shutdown hooks for the application
     */
    @PostConstruct
    private void configureShutdown() {
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            LOGGER.info("Initiating graceful shutdown of Reporting Service...");
            try {
                // Graceful shutdown of task executor
                reportTaskExecutor.setWaitForTasksToCompleteOnShutdown(true);
                reportTaskExecutor.setAwaitTerminationSeconds(shutdownTimeout);
                
                // Additional cleanup procedures
                LOGGER.info("Completing pending report generation tasks...");
                reportTaskExecutor.shutdown();
                
                LOGGER.info("Reporting Service shutdown completed successfully");
            } catch (Exception e) {
                LOGGER.error("Error during Reporting Service shutdown", e);
            }
        }, "shutdown-hook"));
    }

    /**
     * Implements health check endpoint for monitoring
     *
     * @return Health status of the application
     */
    @Override
    public Health health() {
        if (!healthCheckEnabled) {
            return Health.unknown().build();
        }

        try {
            // Check thread pool health
            boolean executorHealthy = reportTaskExecutor.getThreadPoolExecutor().getActiveCount() < maxPoolSize;
            
            // Check system resources
            long freeMemory = Runtime.getRuntime().freeMemory() / (1024 * 1024);
            boolean memoryHealthy = freeMemory > 100; // Minimum 100MB free memory
            
            if (executorHealthy && memoryHealthy) {
                return Health.up()
                    .withDetail("threadPool", reportTaskExecutor.getThreadPoolExecutor().toString())
                    .withDetail("freeMemoryMB", freeMemory)
                    .withDetail("activeProfile", environment.getActiveProfiles()[0])
                    .build();
            } else {
                return Health.down()
                    .withDetail("threadPool", reportTaskExecutor.getThreadPoolExecutor().toString())
                    .withDetail("freeMemoryMB", freeMemory)
                    .build();
            }
        } catch (Exception e) {
            LOGGER.error("Health check failed", e);
            return Health.down()
                .withException(e)
                .build();
        }
    }

    // Getters and setters for configuration properties
    public Integer getShutdownTimeout() {
        return shutdownTimeout;
    }

    public void setShutdownTimeout(Integer shutdownTimeout) {
        this.shutdownTimeout = shutdownTimeout;
    }

    public Integer getMaxPoolSize() {
        return maxPoolSize;
    }

    public void setMaxPoolSize(Integer maxPoolSize) {
        this.maxPoolSize = maxPoolSize;
    }

    public Boolean getHealthCheckEnabled() {
        return healthCheckEnabled;
    }

    public void setHealthCheckEnabled(Boolean healthCheckEnabled) {
        this.healthCheckEnabled = healthCheckEnabled;
    }
}