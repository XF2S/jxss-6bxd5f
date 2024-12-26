package com.enrollment.reporting.models;

import com.enrollment.application.models.Application.ApplicationStatus;
import com.enrollment.workflow.models.WorkflowState;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Entity class representing a report in the enrollment system.
 * Provides comprehensive reporting capabilities with enhanced validation,
 * security features, and performance optimizations.
 * 
 * @version 1.0
 * @since 2024-01
 */
@Entity
@Table(
    name = "reports",
    indexes = {
        @Index(name = "idx_report_status", columnList = "status"),
        @Index(name = "idx_report_type", columnList = "type"),
        @Index(name = "idx_report_created_at", columnList = "created_at")
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Report {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportFormat format;

    @Column(columnDefinition = "TEXT")
    private String query;

    @Column(columnDefinition = "jsonb")
    private Map<String, Object> parameters;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;

    @Column(name = "file_path")
    private String filePath;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportStatus status;

    @Column(name = "execution_time_ms")
    private Long executionTimeMs;

    @Column(name = "row_count")
    private Integer rowCount;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Version
    private Integer version;

    /**
     * Creates a new Report instance with secure initialization
     */
    public static Report createNew(String name, ReportType type, ReportFormat format, String createdBy) {
        return Report.builder()
                .id(UUID.randomUUID())
                .name(name)
                .type(type)
                .format(format)
                .status(ReportStatus.PENDING)
                .createdBy(createdBy)
                .createdAt(LocalDateTime.now())
                .version(0)
                .build();
    }

    /**
     * Updates report status with comprehensive tracking
     */
    public void updateStatus(ReportStatus newStatus, String message) {
        validateStatusTransition(this.status, newStatus);
        this.status = newStatus;
        
        if (newStatus == ReportStatus.COMPLETED) {
            this.generatedAt = LocalDateTime.now();
        } else if (newStatus == ReportStatus.FAILED) {
            this.errorMessage = message;
        }
    }

    /**
     * Validates report configuration comprehensively
     */
    public ValidationResult validate() {
        ValidationResult result = new ValidationResult();

        // Validate required fields
        if (name == null || name.trim().isEmpty()) {
            result.addError("Name is required");
        }
        if (type == null) {
            result.addError("Report type is required");
        }
        if (format == null) {
            result.addError("Report format is required");
        }

        // Validate query if present
        if (query != null && !query.trim().isEmpty()) {
            validateQuery(query, result);
        }

        // Validate parameters
        if (parameters != null) {
            validateParameters(parameters, result);
        }

        return result;
    }

    private void validateStatusTransition(ReportStatus currentStatus, ReportStatus newStatus) {
        if (!isValidStatusTransition(currentStatus, newStatus)) {
            throw new IllegalStateException(
                String.format("Invalid status transition from %s to %s", currentStatus, newStatus)
            );
        }
    }

    private boolean isValidStatusTransition(ReportStatus current, ReportStatus next) {
        if (current == next) return true;
        
        switch (current) {
            case PENDING:
                return next == ReportStatus.GENERATING;
            case GENERATING:
                return next == ReportStatus.COMPLETED || next == ReportStatus.FAILED;
            case COMPLETED:
            case FAILED:
                return false;
            default:
                return false;
        }
    }

    private void validateQuery(String query, ValidationResult result) {
        if (query.length() > 10000) {
            result.addError("Query exceeds maximum length of 10000 characters");
        }
        // Add additional query validation logic here
    }

    private void validateParameters(Map<String, Object> params, ValidationResult result) {
        for (Map.Entry<String, Object> entry : params.entrySet()) {
            if (entry.getKey() == null || entry.getKey().trim().isEmpty()) {
                result.addError("Parameter key cannot be empty");
            }
            if (entry.getValue() == null) {
                result.addError("Parameter value cannot be null for key: " + entry.getKey());
            }
        }
    }
}

/**
 * Enum defining available report types
 */
public enum ReportType {
    APPLICATION_SUMMARY,
    WORKFLOW_ANALYTICS,
    ENROLLMENT_STATISTICS,
    CUSTOM
}

/**
 * Enum defining supported export formats
 */
public enum ReportFormat {
    PDF,
    EXCEL,
    CSV
}

/**
 * Enum defining report generation states
 */
public enum ReportStatus {
    PENDING,
    GENERATING,
    COMPLETED,
    FAILED
}

/**
 * Class for handling validation results
 */
@Data
class ValidationResult {
    private final List<String> errors = new ArrayList<>();
    
    public void addError(String error) {
        errors.add(error);
    }
    
    public boolean isValid() {
        return errors.isEmpty();
    }
}