package com.enrollment.application;

// Spring Boot imports - version 3.1.0
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

// OpenAPI documentation - version 2.1.0
import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.License;

// Logging - version 2.0.0
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Main Spring Boot application class for the Enrollment System Application Service.
 * Implements service discovery, API documentation, and performance monitoring capabilities.
 *
 * @version 1.0
 */
@SpringBootApplication
@EnableDiscoveryClient
@OpenAPIDefinition(
    info = @Info(
        title = "Enrollment Application Service API",
        version = "1.0",
        description = "REST API for processing enrollment applications with comprehensive workflow management",
        contact = @Contact(
            name = "Enrollment System Support",
            email = "support@enrollment.com"
        ),
        license = @License(
            name = "Proprietary",
            url = "https://enrollment.com/license"
        )
    )
)
public class Application {

    private static final Logger LOGGER = LoggerFactory.getLogger(Application.class);

    /**
     * Application entry point that bootstraps the Spring Boot application with
     * performance monitoring and service discovery capabilities.
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        long startTime = System.currentTimeMillis();
        LOGGER.info("Starting Enrollment Application Service...");

        try {
            // Configure Spring Boot application with optimized settings
            SpringApplication app = new SpringApplication(Application.class);
            app.setRegisterShutdownHook(true);
            
            // Add startup performance metrics
            app.addListeners(event -> {
                if (event instanceof org.springframework.boot.context.event.ApplicationStartedEvent) {
                    long duration = System.currentTimeMillis() - startTime;
                    LOGGER.info("Application started successfully in {} seconds", duration / 1000.0);
                }
            });

            // Launch the application
            app.run(args);

        } catch (Exception e) {
            LOGGER.error("Failed to start Application Service", e);
            System.exit(1);
        }
    }
}