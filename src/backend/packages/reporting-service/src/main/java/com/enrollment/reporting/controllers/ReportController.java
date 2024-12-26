package com.enrollment.reporting.controllers;

import com.enrollment.reporting.models.Report;
import com.enrollment.reporting.models.Report.ReportType;
import com.enrollment.reporting.models.Report.ReportFormat;
import com.enrollment.reporting.models.Report.ReportStatus;
import com.enrollment.reporting.services.ReportGenerationService;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;

/**
 * REST controller for managing report generation and analytics in the enrollment system.
 * Provides endpoints for creating reports, tracking status, and accessing analytics data.
 *
 * @version 1.0
 * @since 2024-01
 */
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
@Slf4j
@Validated
@Tag(name = "Reports", description = "Report generation and analytics endpoints")
public class ReportController {

    private final ReportGenerationService reportGenerationService;

    /**
     * Creates a new report generation request.
     *
     * @param request Report creation request details
     * @return ResponseEntity containing the created report
     */
    @PostMapping
    @Operation(summary = "Create new report", description = "Initiates generation of a new report")
    @SecurityRequirement(name = "bearer-token")
    @RateLimiter(name = "reportCreation")
    public ResponseEntity<Report> createReport(@Valid @RequestBody CreateReportRequest request) {
        log.info("Received report generation request: {}", request);

        Report report = Report.createNew(
            request.getName(),
            request.getType(),
            request.getFormat(),
            request.getCreatedBy()
        );

        // Set additional parameters if provided
        if (request.getQuery() != null) {
            report.setQuery(request.getQuery());
        }
        if (request.getParameters() != null) {
            report.setParameters(request.getParameters());
        }
        if (request.getDescription() != null) {
            report.setDescription(request.getDescription());
        }

        // Validate report configuration
        ValidationResult validation = report.validate();
        if (!validation.isValid()) {
            log.warn("Invalid report configuration: {}", validation.getErrors());
            throw new InvalidReportConfigurationException(validation.getErrors());
        }

        // Initiate async report generation
        CompletableFuture<Report> futureReport = reportGenerationService.generateReport(report);
        
        log.info("Report generation initiated with ID: {}", report.getId());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(report);
    }

    /**
     * Retrieves real-time analytics dashboard data with caching.
     *
     * @param request Analytics request parameters
     * @return ResponseEntity containing dashboard analytics data
     */
    @GetMapping("/analytics-dashboard")
    @Operation(summary = "Get analytics dashboard data", description = "Retrieves real-time analytics dashboard data")
    @SecurityRequirement(name = "bearer-token")
    @Cacheable(value = "analyticsCache", key = "#request", unless = "#result == null")
    @RateLimiter(name = "analytics")
    public ResponseEntity<AnalyticsDashboardData> getAnalyticsDashboardData(
            @Valid @RequestBody AnalyticsRequest request) {
        log.info("Retrieving analytics dashboard data for request: {}", request);

        try {
            AnalyticsDashboardData data = reportGenerationService.getAnalyticsDashboardData(
                request.getStartDate(),
                request.getEndDate(),
                request.getFilters()
            );

            log.debug("Retrieved analytics dashboard data: {}", data);
            return ResponseEntity.ok(data);
        } catch (Exception e) {
            log.error("Error retrieving analytics dashboard data", e);
            throw new AnalyticsRetrievalException("Failed to retrieve analytics data", e);
        }
    }

    /**
     * Retrieves a paginated list of reports with caching.
     *
     * @param pageable Pagination parameters
     * @return ResponseEntity containing paginated list of reports
     */
    @GetMapping
    @Operation(summary = "List reports", description = "Retrieves a paginated list of reports")
    @SecurityRequirement(name = "bearer-token")
    @Cacheable(value = "reportsCache", key = "#pageable", unless = "#result == null")
    @RateLimiter(name = "reportsList")
    public ResponseEntity<Page<Report>> listReports(
            @Parameter(description = "Pagination parameters") Pageable pageable,
            @Parameter(description = "Filter by report type") @RequestParam(required = false) ReportType type,
            @Parameter(description = "Filter by status") @RequestParam(required = false) ReportStatus status) {
        log.info("Retrieving reports list with pagination: {}, type: {}, status: {}", pageable, type, status);

        try {
            Page<Report> reports = reportGenerationService.listReports(pageable, type, status);
            log.debug("Retrieved {} reports", reports.getTotalElements());
            return ResponseEntity.ok(reports);
        } catch (Exception e) {
            log.error("Error retrieving reports list", e);
            throw new ReportRetrievalException("Failed to retrieve reports", e);
        }
    }

    /**
     * Retrieves the current status of a report.
     *
     * @param reportId ID of the report to check
     * @return ResponseEntity containing report status
     */
    @GetMapping("/{reportId}")
    @Operation(summary = "Get report status", description = "Retrieves the current status of a report")
    @SecurityRequirement(name = "bearer-token")
    @RateLimiter(name = "reportStatus")
    public ResponseEntity<Report> getReportStatus(
            @Parameter(description = "Report ID") @PathVariable String reportId) {
        log.info("Checking status for report ID: {}", reportId);

        try {
            Report report = reportGenerationService.getReportStatus(reportId);
            if (report == null) {
                log.warn("Report not found with ID: {}", reportId);
                return ResponseEntity.notFound().build();
            }

            log.debug("Retrieved status for report ID {}: {}", reportId, report.getStatus());
            return ResponseEntity.ok(report);
        } catch (Exception e) {
            log.error("Error retrieving report status for ID: {}", reportId, e);
            throw new ReportRetrievalException("Failed to retrieve report status", e);
        }
    }

    /**
     * Cancels a pending or in-progress report generation.
     *
     * @param reportId ID of the report to cancel
     * @return ResponseEntity with cancellation result
     */
    @DeleteMapping("/{reportId}")
    @Operation(summary = "Cancel report", description = "Cancels a pending or in-progress report generation")
    @SecurityRequirement(name = "bearer-token")
    @RateLimiter(name = "reportCancellation")
    public ResponseEntity<Void> cancelReport(
            @Parameter(description = "Report ID") @PathVariable String reportId) {
        log.info("Cancelling report with ID: {}", reportId);

        try {
            boolean cancelled = reportGenerationService.cancelReport(reportId);
            if (!cancelled) {
                log.warn("Report cancellation failed for ID: {}", reportId);
                return ResponseEntity.badRequest().build();
            }

            log.info("Successfully cancelled report with ID: {}", reportId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error cancelling report with ID: {}", reportId, e);
            throw new ReportCancellationException("Failed to cancel report", e);
        }
    }
}