package com.enrollment.application.controllers;

import com.enrollment.application.models.Application;
import com.enrollment.application.models.ApplicationStatus;
import com.enrollment.application.services.ApplicationService;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter; // version: 2.1.0
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.util.Map;
import java.util.UUID;

/**
 * REST controller implementing the API endpoints for enrollment application management.
 * Provides secure, optimized endpoints with comprehensive documentation.
 */
@RestController
@RequestMapping("/api/" + ApplicationController.API_VERSION)
@Validated
@Tag(name = "Application Management", description = "APIs for enrollment application processing")
@CrossOrigin(origins = "${app.cors.allowed-origins}")
public class ApplicationController {

    private static final Logger LOGGER = LoggerFactory.getLogger(ApplicationController.class);
    private static final String API_VERSION = "v1";
    private static final String CACHE_NAME = "applications";
    private static final int CACHE_TTL_SECONDS = 900; // 15 minutes

    private final ApplicationService applicationService;

    public ApplicationController(ApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    /**
     * Creates a new enrollment application with validation and rate limiting.
     *
     * @param formData Application form data
     * @param userId User identifier
     * @return Created application with 201 status
     */
    @PostMapping(
        path = "/applications",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    @Operation(summary = "Create new application", description = "Creates a new enrollment application")
    @PreAuthorize("hasRole('APPLICANT')")
    @RateLimiter(name = "applicationCreation")
    @ApiResponse(responseCode = "201", description = "Application created successfully")
    @ApiResponse(responseCode = "400", description = "Invalid form data")
    @ApiResponse(responseCode = "429", description = "Too many requests")
    public ResponseEntity<Application> createApplication(
            @Valid @RequestBody Map<String, Object> formData,
            @Parameter(description = "User ID") @RequestHeader("X-User-ID") UUID userId) {
        
        LOGGER.info("Creating new application for user: {}", userId);
        String correlationId = UUID.randomUUID().toString();
        LOGGER.debug("Correlation ID: {}", correlationId);

        Application application = applicationService.createApplication(userId, formData);

        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Correlation-ID", correlationId);
        headers.add("Cache-Control", "no-cache");

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .headers(headers)
                .body(application);
    }

    /**
     * Submits an application for review with validation.
     *
     * @param applicationId Application identifier
     * @return Updated application with 200 status
     */
    @PostMapping("/applications/{applicationId}/submit")
    @Operation(summary = "Submit application for review")
    @PreAuthorize("hasRole('APPLICANT')")
    @RateLimiter(name = "applicationSubmission")
    @ApiResponse(responseCode = "200", description = "Application submitted successfully")
    @ApiResponse(responseCode = "404", description = "Application not found")
    @ApiResponse(responseCode = "429", description = "Too many requests")
    public ResponseEntity<Application> submitApplication(
            @PathVariable UUID applicationId) {
        
        LOGGER.info("Submitting application: {}", applicationId);
        String correlationId = UUID.randomUUID().toString();
        LOGGER.debug("Correlation ID: {}", correlationId);

        Application application = applicationService.submitApplication(applicationId);

        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Correlation-ID", correlationId);
        headers.add("Cache-Control", "no-cache");

        return ResponseEntity
                .ok()
                .headers(headers)
                .body(application);
    }

    /**
     * Retrieves all applications for a user with pagination and caching.
     *
     * @param userId User identifier
     * @param pageable Pagination parameters
     * @return Page of applications
     */
    @GetMapping("/applications")
    @Operation(summary = "Get user applications")
    @PreAuthorize("hasAnyRole('APPLICANT', 'STAFF')")
    @Cacheable(value = CACHE_NAME, key = "#userId + '_' + #pageable")
    @ApiResponse(responseCode = "200", description = "Applications retrieved successfully")
    @ApiResponse(responseCode = "403", description = "Unauthorized access")
    public ResponseEntity<Page<Application>> getApplicationsByUser(
            @Parameter(description = "User ID") @RequestHeader("X-User-ID") UUID userId,
            @Parameter(description = "Pagination parameters") Pageable pageable) {
        
        LOGGER.info("Retrieving applications for user: {}", userId);
        String correlationId = UUID.randomUUID().toString();
        LOGGER.debug("Correlation ID: {}", correlationId);

        Page<Application> applications = applicationService.getApplicationsByUser(
                userId, pageable.getPageNumber(), pageable.getPageSize());

        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Correlation-ID", correlationId);
        headers.add("Cache-Control", "max-age=" + CACHE_TTL_SECONDS);

        return ResponseEntity
                .ok()
                .headers(headers)
                .body(applications);
    }

    /**
     * Updates the status of an application with validation and notifications.
     *
     * @param applicationId Application identifier
     * @param newStatus New application status
     * @param comments Status update comments
     * @return Updated application
     */
    @PatchMapping("/applications/{applicationId}/status")
    @Operation(summary = "Update application status")
    @PreAuthorize("hasRole('STAFF')")
    @RateLimiter(name = "statusUpdate")
    @ApiResponse(responseCode = "200", description = "Status updated successfully")
    @ApiResponse(responseCode = "400", description = "Invalid status transition")
    @ApiResponse(responseCode = "404", description = "Application not found")
    public ResponseEntity<Application> updateApplicationStatus(
            @PathVariable UUID applicationId,
            @Valid @NotNull @RequestBody ApplicationStatus newStatus,
            @RequestParam(required = false) String comments) {
        
        LOGGER.info("Updating status for application: {} to: {}", applicationId, newStatus);
        String correlationId = UUID.randomUUID().toString();
        LOGGER.debug("Correlation ID: {}", correlationId);

        Application application = applicationService.updateApplicationStatus(
                applicationId, newStatus, comments);

        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Correlation-ID", correlationId);
        headers.add("Cache-Control", "no-cache");

        return ResponseEntity
                .ok()
                .headers(headers)
                .body(application);
    }
}