// @package zod v3.22.0
import { z } from 'zod';

/**
 * Enumeration of all possible states in the enrollment workflow
 * Represents the complete lifecycle of an enrollment application
 */
export enum WorkflowState {
  CREATED = 'CREATED',
  DOCUMENT_VERIFICATION = 'DOCUMENT_VERIFICATION',
  ACADEMIC_REVIEW = 'ACADEMIC_REVIEW',
  FINAL_REVIEW = 'FINAL_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED'
}

/**
 * Zod schema for validating workflow states
 */
export const WorkflowStateSchema = z.nativeEnum(WorkflowState);

/**
 * Interface for workflow state transition requests
 * Used when requesting a state change in the workflow
 */
export interface WorkflowTransitionRequest {
  targetState: WorkflowState;
  comment: string;
  updatedBy: string;
  metadata: Record<string, unknown>;
}

/**
 * Zod schema for validating workflow transition requests
 */
export const WorkflowTransitionRequestSchema = z.object({
  targetState: WorkflowStateSchema,
  comment: z.string().min(1).max(1000),
  updatedBy: z.string().uuid(),
  metadata: z.record(z.unknown())
});

/**
 * Interface for workflow state history entries
 * Tracks the complete history of state changes with timing information
 */
export interface WorkflowStateHistory {
  id: string;
  state: WorkflowState;
  comment: string;
  updatedBy: string;
  timestamp: Date;
  duration: number; // Duration in milliseconds
  metadata: Record<string, unknown>;
}

/**
 * Zod schema for validating workflow state history entries
 */
export const WorkflowStateHistorySchema = z.object({
  id: z.string().uuid(),
  state: WorkflowStateSchema,
  comment: z.string().min(1).max(1000),
  updatedBy: z.string().uuid(),
  timestamp: z.date(),
  duration: z.number().min(0),
  metadata: z.record(z.unknown())
});

/**
 * Main workflow interface containing current state and history
 * Represents the complete workflow instance for an enrollment application
 */
export interface Workflow {
  id: string;
  applicationId: string;
  currentState: WorkflowState;
  history: WorkflowStateHistory[];
  pendingActions: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Zod schema for validating complete workflow objects
 */
export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  currentState: WorkflowStateSchema,
  history: z.array(WorkflowStateHistorySchema),
  pendingActions: z.array(z.string()),
  metadata: z.record(z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Interface for workflow API responses
 * Includes validation details and error information
 */
export interface WorkflowResponse {
  data: Workflow;
  message: string;
  success: boolean;
  errorCode: string;
  validationErrors: Record<string, string[]>;
}

/**
 * Zod schema for validating workflow API responses
 */
export const WorkflowResponseSchema = z.object({
  data: WorkflowSchema,
  message: z.string(),
  success: z.boolean(),
  errorCode: z.string().optional(),
  validationErrors: z.record(z.array(z.string())).optional()
});

/**
 * Type guard to check if a value is a valid WorkflowState
 */
export const isWorkflowState = (value: unknown): value is WorkflowState => {
  return WorkflowStateSchema.safeParse(value).success;
};

/**
 * Type guard to check if a value is a valid Workflow object
 */
export const isWorkflow = (value: unknown): value is Workflow => {
  return WorkflowSchema.safeParse(value).success;
};

/**
 * Allowed workflow state transitions map
 * Defines valid state transitions for workflow validation
 */
export const ALLOWED_WORKFLOW_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  [WorkflowState.CREATED]: [WorkflowState.DOCUMENT_VERIFICATION],
  [WorkflowState.DOCUMENT_VERIFICATION]: [WorkflowState.ACADEMIC_REVIEW, WorkflowState.REJECTED],
  [WorkflowState.ACADEMIC_REVIEW]: [WorkflowState.FINAL_REVIEW, WorkflowState.REJECTED],
  [WorkflowState.FINAL_REVIEW]: [WorkflowState.APPROVED, WorkflowState.REJECTED],
  [WorkflowState.APPROVED]: [WorkflowState.COMPLETED],
  [WorkflowState.REJECTED]: [],
  [WorkflowState.COMPLETED]: []
};

/**
 * Validates if a workflow state transition is allowed
 * @param currentState Current workflow state
 * @param targetState Desired target state
 * @returns boolean indicating if the transition is valid
 */
export const isValidStateTransition = (
  currentState: WorkflowState,
  targetState: WorkflowState
): boolean => {
  const allowedTransitions = ALLOWED_WORKFLOW_TRANSITIONS[currentState];
  return allowedTransitions.includes(targetState);
};