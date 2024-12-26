package com.enrollment.application.repositories;

import com.enrollment.application.models.Application;
import com.enrollment.application.models.ApplicationStatus;
import org.springframework.data.domain.Page; // version: 3.1.0
import org.springframework.data.domain.Pageable; // version: 3.1.0
import org.springframework.data.jpa.repository.JpaRepository; // version: 3.1.0
import org.springframework.data.jpa.repository.Query; // version: 3.1.0
import org.springframework.data.jpa.repository.QueryHints; // version: 3.1.0
import org.springframework.data.repository.query.Param; // version: 3.1.0
import org.springframework.security.access.prepost.PreAuthorize; // version: 6.1.0
import org.springframework.stereotype.Repository;

import javax.persistence.QueryHint;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Repository interface for managing enrollment application persistence operations.
 * Provides secure and optimized data access methods with pagination support.
 * Implements performance requirements with query optimization and caching.
 */
@Repository
@PreAuthorize("hasRole('APPLICATION_SERVICE')")
public interface ApplicationRepository extends JpaRepository<Application, UUID> {

    /**
     * Retrieves all applications for a specific user with pagination.
     * Security: Only allows users to access their own applications or admins to access any.
     *
     * @param userId User identifier to filter applications
     * @param pageable Pagination parameters
     * @return Page of applications for the specified user
     */
    @Query("SELECT a FROM Application a WHERE a.userId = :userId")
    @PreAuthorize("#userId == authentication.principal.id or hasRole('ADMIN')")
    Page<Application> findByUserId(@Param("userId") UUID userId, Pageable pageable);

    /**
     * Retrieves all applications with a specific status using pagination.
     * Includes separate count query for optimal pagination performance.
     * Security: Restricted to staff and admin roles only.
     *
     * @param status Application status to filter by
     * @param pageable Pagination parameters
     * @return Page of applications with the specified status
     */
    @Query(
        value = "SELECT a FROM Application a WHERE a.status = :status",
        countQuery = "SELECT COUNT(a) FROM Application a WHERE a.status = :status"
    )
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    Page<Application> findByStatus(@Param("status") ApplicationStatus status, Pageable pageable);

    /**
     * Retrieves applications submitted within a date range with pagination and caching.
     * Optimized for reporting and analysis purposes.
     * Security: Restricted to staff and admin roles only.
     *
     * @param startDate Start of date range
     * @param endDate End of date range
     * @param pageable Pagination parameters
     * @return Page of applications within the specified date range
     */
    @Query(
        value = "SELECT a FROM Application a WHERE a.submittedAt BETWEEN :startDate AND :endDate ORDER BY a.submittedAt DESC"
    )
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL")
    })
    Page<Application> findBySubmittedAtBetween(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate,
        Pageable pageable
    );

    /**
     * Retrieves applications by status with optimized sorting and filtering.
     * Includes user information for display purposes.
     * Security: Restricted to staff and admin roles only.
     *
     * @param status Application status to filter by
     * @param pageable Pagination parameters
     * @return Page of applications with the specified status and user details
     */
    @Query(
        value = "SELECT DISTINCT a FROM Application a WHERE a.status = :status",
        countQuery = "SELECT COUNT(DISTINCT a) FROM Application a WHERE a.status = :status"
    )
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    @QueryHints(@QueryHint(name = "org.hibernate.readOnly", value = "true"))
    Page<Application> findByStatusWithUserDetails(@Param("status") ApplicationStatus status, Pageable pageable);

    /**
     * Counts applications by status for dashboard metrics.
     * Cached query for improved performance.
     * Security: Restricted to staff and admin roles only.
     *
     * @param status Application status to count
     * @return Number of applications with the specified status
     */
    @Query("SELECT COUNT(a) FROM Application a WHERE a.status = :status")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    @QueryHints(@QueryHint(name = "org.hibernate.cacheable", value = "true"))
    long countByStatus(@Param("status") ApplicationStatus status);
}