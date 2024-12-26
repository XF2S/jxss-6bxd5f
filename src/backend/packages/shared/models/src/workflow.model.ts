// External imports with versions
import { z } from 'zod'; // v3.0.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// Internal imports
import { ApplicationStatus } from './application.model';

/**
 * Enum defining all possible workflow states
 */
export enum WorkflowState {
  CREATED = 'CREATED',
  DOCUMENT_VERIFICATION = 'DOCUMENT_VERIFICATION',
  ACADEMIC_REVIEW = 'ACADEMIC_REVIEW',
  FINAL_REVIEW = 'FINAL_REVIEW',
  COMPLETED = 'COMPLETED'
}

/**
 * Interface defining workflow state history entries
 */
interface WorkflowStateHistory {
  state: WorkflowState;
  timestamp: Date;
  userId: string;
  metadata: Record<string, any>;
}

/**
 * Interface for workflow metrics tracking
 */
interface WorkflowMetrics {
  timeInState: Record<WorkflowState, number>;
  totalTransitions: number;
  assignmentHistory: Array<{
    userId: string;
    role: string;
    timestamp: Date;
  }>;
}

/**
 * Interface for state transition definitions
 */
interface WorkflowStateTransition {
  targetState: WorkflowState;
  requiredRole: string;
  requiredMetadata: string[];
  validationRules: Array<(metadata: Record<string, any>) => boolean>;
}

/**
 * State transition configuration map
 */
const STATE_TRANSITIONS: Record<WorkflowState, WorkflowStateTransition[]> = {
  [WorkflowState.CREATED]: [
    {
      targetState: WorkflowState.DOCUMENT_VERIFICATION,
      requiredRole: 'DOCUMENT_VERIFIER',
      requiredMetadata: ['applicationId'],
      validationRules: []
    }
  ],
  [WorkflowState.DOCUMENT_VERIFICATION]: [
    {
      targetState: WorkflowState.ACADEMIC_REVIEW,
      requiredRole: 'DOCUMENT_VERIFIER',
      requiredMetadata: ['documentsVerified', 'verificationNotes'],
      validationRules: [(metadata) => metadata.documentsVerified === true]
    }
  ],
  [WorkflowState.ACADEMIC_REVIEW]: [
    {
      targetState: WorkflowState.FINAL_REVIEW,
      requiredRole: 'ACADEMIC_REVIEWER',
      requiredMetadata: ['academicEvaluation', 'reviewNotes'],
      validationRules: [(metadata) => !!metadata.academicEvaluation]
    }
  ],
  [WorkflowState.FINAL_REVIEW]: [
    {
      targetState: WorkflowState.COMPLETED,
      requiredRole: 'SENIOR_REVIEWER',
      requiredMetadata: ['finalDecision', 'decisionNotes'],
      validationRules: [(metadata) => !!metadata.finalDecision]
    }
  ],
  [WorkflowState.COMPLETED]: []
};

/**
 * Zod schema for workflow validation
 */
export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  currentState: z.nativeEnum(WorkflowState),
  assignedTo: z.string().uuid().optional(),
  stateHistory: z.array(z.object({
    state: z.nativeEnum(WorkflowState),
    timestamp: z.date(),
    userId: z.string().uuid(),
    metadata: z.record(z.any())
  })),
  metadata: z.record(z.any()),
  metrics: z.object({
    timeInState: z.record(z.number()),
    totalTransitions: z.number(),
    assignmentHistory: z.array(z.object({
      userId: z.string().uuid(),
      role: z.string(),
      timestamp: z.date()
    }))
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Decorator for metadata validation
 */
function validateMetadata(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const [currentState, targetState, metadata] = args;
    const transition = STATE_TRANSITIONS[currentState]?.find(t => t.targetState === targetState);
    
    if (!transition) {
      return false;
    }

    const hasRequiredMetadata = transition.requiredMetadata.every(key => key in metadata);
    const validationPassed = transition.validationRules.every(rule => rule(metadata));

    return hasRequiredMetadata && validationPassed && await originalMethod.apply(this, args);
  };
}

/**
 * Core workflow instance class
 */
@Entity()
@ValidateWorkflow()
export class WorkflowInstance {
  public readonly id: string;
  public readonly applicationId: string;
  public currentState: WorkflowState;
  public assignedTo?: string;
  public stateHistory: WorkflowStateHistory[];
  public metadata: Record<string, any>;
  public metrics: WorkflowMetrics;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(data: Partial<WorkflowInstance>) {
    this.id = data.id || uuidv4();
    this.applicationId = data.applicationId;
    this.currentState = data.currentState || WorkflowState.CREATED;
    this.assignedTo = data.assignedTo;
    this.stateHistory = data.stateHistory || [{
      state: this.currentState,
      timestamp: new Date(),
      userId: data.assignedTo,
      metadata: {}
    }];
    this.metadata = data.metadata || {};
    this.metrics = data.metrics || {
      timeInState: Object.values(WorkflowState).reduce((acc, state) => ({
        ...acc,
        [state]: 0
      }), {}),
      totalTransitions: 0,
      assignmentHistory: []
    };
    this.createdAt = new Date();
    this.updatedAt = new Date();

    WorkflowSchema.parse(this);
  }

  /**
   * Validates and executes state transition
   */
  @TransactionScope()
  @AuditLog()
  public async transition(newState: WorkflowState, transitionMetadata: Record<string, any>): Promise<boolean> {
    const isValid = await this.isValidTransition(this.currentState, newState, transitionMetadata);
    
    if (!isValid) {
      return false;
    }

    const previousState = this.currentState;
    this.currentState = newState;
    this.metadata = { ...this.metadata, ...transitionMetadata };
    
    this.stateHistory.push({
      state: newState,
      timestamp: new Date(),
      userId: this.assignedTo,
      metadata: transitionMetadata
    });

    this.metrics.totalTransitions++;
    this.updateMetrics(previousState);
    this.updatedAt = new Date();

    return true;
  }

  /**
   * Assigns workflow to a user
   */
  @ValidateAssignment()
  @AuditLog()
  public async assign(userId: string, role: string): Promise<void> {
    this.assignedTo = userId;
    this.metrics.assignmentHistory.push({
      userId,
      role,
      timestamp: new Date()
    });
    this.updatedAt = new Date();
  }

  /**
   * Validates state transition
   */
  @validateMetadata
  private async isValidTransition(
    currentState: WorkflowState,
    targetState: WorkflowState,
    metadata: Record<string, any>
  ): Promise<boolean> {
    return STATE_TRANSITIONS[currentState]?.some(t => t.targetState === targetState) || false;
  }

  /**
   * Returns possible next states from current state
   */
  public getNextStates(): WorkflowStateTransition[] {
    return STATE_TRANSITIONS[this.currentState] || [];
  }

  /**
   * Updates workflow metrics
   */
  private updateMetrics(previousState: WorkflowState): void {
    const now = new Date();
    const timeInPreviousState = now.getTime() - this.updatedAt.getTime();
    this.metrics.timeInState[previousState] += timeInPreviousState;
  }
}