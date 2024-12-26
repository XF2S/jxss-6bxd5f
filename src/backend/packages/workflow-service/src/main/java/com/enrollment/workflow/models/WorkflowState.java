package com.enrollment.workflow.models;

import com.enrollment.application.models.ApplicationStatus;
import java.util.Set;
import java.util.EnumSet;
import java.util.Collections;

/**
 * Enumeration defining the enrollment workflow state machine with strictly enforced transitions.
 * Implements a state machine pattern to manage the lifecycle of enrollment applications.
 * Each state maps to a corresponding ApplicationStatus and defines valid state transitions.
 */
public enum WorkflowState {
    // Initial state when application is first submitted
    CREATED(ApplicationStatus.SUBMITTED),
    
    // Document verification phase
    DOCUMENT_VERIFICATION(ApplicationStatus.UNDER_REVIEW),
    
    // Academic review phase
    ACADEMIC_REVIEW(ApplicationStatus.UNDER_REVIEW),
    
    // Final review phase
    FINAL_REVIEW(ApplicationStatus.UNDER_REVIEW),
    
    // Application approved state
    APPROVED(ApplicationStatus.APPROVED),
    
    // Application rejected state
    REJECTED(ApplicationStatus.REJECTED),
    
    // Final completion state
    COMPLETED(ApplicationStatus.APPROVED);

    // Mapping to corresponding application status
    private final ApplicationStatus applicationStatus;
    
    // Set of allowed state transitions
    private final Set<WorkflowState> allowedTransitions;

    /**
     * Constructor to initialize workflow state with application status mapping
     * and define allowed transitions.
     *
     * @param applicationStatus The corresponding application status for this workflow state
     */
    WorkflowState(ApplicationStatus applicationStatus) {
        this.applicationStatus = applicationStatus;
        
        // Initialize transitions set using EnumSet for efficiency
        Set<WorkflowState> transitions = EnumSet.noneOf(WorkflowState.class);
        
        // Define allowed transitions for each state
        switch (this) {
            case CREATED:
                transitions.add(DOCUMENT_VERIFICATION);
                transitions.add(REJECTED);
                break;
                
            case DOCUMENT_VERIFICATION:
                transitions.add(ACADEMIC_REVIEW);
                transitions.add(REJECTED);
                break;
                
            case ACADEMIC_REVIEW:
                transitions.add(FINAL_REVIEW);
                transitions.add(REJECTED);
                break;
                
            case FINAL_REVIEW:
                transitions.add(APPROVED);
                transitions.add(REJECTED);
                break;
                
            case APPROVED:
                transitions.add(COMPLETED);
                break;
                
            case REJECTED:
                // No further transitions allowed from rejected state
                break;
                
            case COMPLETED:
                // No further transitions allowed from completed state
                break;
        }
        
        // Make transitions set immutable
        this.allowedTransitions = Collections.unmodifiableSet(transitions);
    }

    /**
     * Retrieves the immutable set of valid next states from the current state.
     *
     * @return Unmodifiable set of valid next workflow states
     */
    public Set<WorkflowState> getAllowedTransitions() {
        return this.allowedTransitions;
    }

    /**
     * Validates if a transition to the target state is allowed from current state.
     *
     * @param targetState The state to transition to
     * @return true if transition is valid, false otherwise
     * @throws IllegalArgumentException if targetState is null
     */
    public boolean isValidTransition(WorkflowState targetState) {
        if (targetState == null) {
            throw new IllegalArgumentException("Target state cannot be null");
        }
        return this.allowedTransitions.contains(targetState);
    }

    /**
     * Maps the current workflow state to its corresponding application status.
     *
     * @return Application status corresponding to current workflow state
     */
    public ApplicationStatus getApplicationStatus() {
        return this.applicationStatus;
    }
}