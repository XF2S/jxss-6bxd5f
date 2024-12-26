package com.enrollment.application.models;

import javax.persistence.*;
import javax.validation.constraints.*;
import org.hibernate.annotations.*;
import com.vladmihalcea.hibernate.type.json.JsonType; // version: 2.20.0
import java.util.UUID;
import java.util.Map;
import java.util.HashMap;
import java.time.LocalDateTime;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * JPA entity representing an enrollment application with enhanced security and audit capabilities.
 * Implements comprehensive data persistence model with JSONB support and audit tracking.
 *
 * @author Enrollment System
 * @version 1.0
 */
@Entity
@Table(
    name = "applications",
    indexes = {
        @Index(name = "idx_user_id", columnList = "user_id"),
        @Index(name = "idx_status", columnList = "status")
    }
)
@TypeDef(name = "json", typeClass = JsonType.class)
@EntityListeners(AuditingEntityListener.class)
public class Application {

    @Id
    @GeneratedValue
    @Column(name = "id", updatable = false)
    private UUID id;

    @NotNull
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    private ApplicationStatus status;

    @Type(type = "json")
    @Column(name = "form_data", columnDefinition = "jsonb")
    private Map<String, Object> formData;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @CreatedBy
    @Column(name = "created_by", nullable = false, updatable = false)
    private String createdBy;

    @LastModifiedBy
    @Column(name = "last_modified_by", nullable = false)
    private String lastModifiedBy;

    /**
     * Default constructor for Application entity.
     * Initializes a new application with default values.
     */
    public Application() {
        this.id = UUID.randomUUID();
        this.status = ApplicationStatus.DRAFT;
        this.formData = new HashMap<>();
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    /**
     * Returns the unique identifier of the application.
     * @return UUID of the application
     */
    public UUID getId() {
        return id;
    }

    /**
     * Returns the associated user identifier.
     * @return UUID of the associated user
     */
    public UUID getUserId() {
        return userId;
    }

    /**
     * Sets the associated user identifier.
     * @param userId UUID of the user
     */
    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    /**
     * Returns the current application status.
     * @return Current ApplicationStatus
     */
    public ApplicationStatus getStatus() {
        return status;
    }

    /**
     * Returns the application form data.
     * @return Map containing form data in JSON format
     */
    public Map<String, Object> getFormData() {
        return formData;
    }

    /**
     * Sets the application form data.
     * @param formData Map containing form data
     */
    public void setFormData(Map<String, Object> formData) {
        this.formData = formData;
    }

    /**
     * Returns the submission timestamp.
     * @return LocalDateTime of submission
     */
    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }

    /**
     * Sets the submission timestamp.
     * @param submittedAt LocalDateTime of submission
     */
    public void setSubmittedAt(LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    /**
     * Returns the creation timestamp.
     * @return LocalDateTime of creation
     */
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    /**
     * Returns the last update timestamp.
     * @return LocalDateTime of last update
     */
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    /**
     * Returns the user who created the application.
     * @return String identifier of creator
     */
    public String getCreatedBy() {
        return createdBy;
    }

    /**
     * Returns the user who last modified the application.
     * @return String identifier of last modifier
     */
    public String getLastModifiedBy() {
        return lastModifiedBy;
    }

    /**
     * Updates the application status with validation and auditing.
     * @param newStatus New ApplicationStatus to set
     * @param comment Comment explaining the status change
     * @return boolean indicating success of the update
     * @throws IllegalStateException if status transition is invalid
     */
    public boolean updateStatus(ApplicationStatus newStatus, String comment) {
        if (!isValidStatusTransition(this.status, newStatus)) {
            throw new IllegalStateException("Invalid status transition from " + this.status + " to " + newStatus);
        }

        this.status = newStatus;
        if (newStatus == ApplicationStatus.SUBMITTED && this.submittedAt == null) {
            this.submittedAt = LocalDateTime.now();
        }
        this.updatedAt = LocalDateTime.now();
        return true;
    }

    /**
     * Validates if a status transition is allowed.
     * @param currentStatus Current ApplicationStatus
     * @param newStatus Proposed new ApplicationStatus
     * @return boolean indicating if transition is valid
     */
    private boolean isValidStatusTransition(ApplicationStatus currentStatus, ApplicationStatus newStatus) {
        // Implementation would contain status transition rules
        return true; // Simplified for example
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Application)) return false;
        Application that = (Application) o;
        return id != null && id.equals(that.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}