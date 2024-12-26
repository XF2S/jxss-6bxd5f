import React, { useEffect, useMemo, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form'; // v7.0.0
import { zodResolver } from '@hookform/resolvers/zod'; // v3.0.0
import { 
  Stepper, 
  Step, 
  StepLabel, 
  Button, 
  CircularProgress,
  Box,
  Paper,
  Typography,
  Alert,
  useTheme,
  useMediaQuery 
} from '@mui/material'; // v5.0.0
import debounce from 'lodash/debounce'; // v4.17.21

import {
  Application,
  ApplicationFormData,
  ApplicationStatus,
  applicationFormDataSchema
} from '@/types/application.types';
import { validateField, validateForm, ValidationResult } from '@/utils/validation.utils';
import { VALIDATION_RULES } from '@/constants/validation.constants';

// Form step components (imported separately for code splitting)
const PersonalInfoStep = React.lazy(() => import('./steps/PersonalInfoStep'));
const AcademicInfoStep = React.lazy(() => import('./steps/AcademicInfoStep'));
const ProgramInfoStep = React.lazy(() => import('./steps/ProgramInfoStep'));
const DocumentUploadStep = React.lazy(() => import('./steps/DocumentUploadStep'));
const ReviewStep = React.lazy(() => import('./steps/ReviewStep'));

// Form step configuration
const FORM_STEPS = [
  { label: 'Personal Information', component: PersonalInfoStep },
  { label: 'Academic Background', component: AcademicInfoStep },
  { label: 'Program Selection', component: ProgramInfoStep },
  { label: 'Document Upload', component: DocumentUploadStep },
  { label: 'Review & Submit', component: ReviewStep }
];

interface ApplicationFormProps {
  onSubmit: (application: Application) => Promise<void>;
  onSaveDraft: (formData: ApplicationFormData) => Promise<void>;
  initialData?: ApplicationFormData;
  validationRules?: typeof VALIDATION_RULES;
}

export const ApplicationForm: React.FC<ApplicationFormProps> = ({
  onSubmit,
  onSaveDraft,
  initialData,
  validationRules = VALIDATION_RULES
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [formProgress, setFormProgress] = useState<number[]>(new Array(FORM_STEPS.length).fill(0));

  // Initialize form with react-hook-form and zod validation
  const methods = useForm<ApplicationFormData>({
    defaultValues: initialData,
    resolver: zodResolver(applicationFormDataSchema),
    mode: 'onChange'
  });

  const { handleSubmit, watch, formState: { errors, isDirty } } = methods;

  // Watch form changes for auto-save
  const formValues = watch();

  // Debounced auto-save function
  const debouncedSave = useMemo(
    () => debounce(async (data: ApplicationFormData) => {
      if (isDirty) {
        setIsSaving(true);
        try {
          await onSaveDraft(data);
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 2000),
    [onSaveDraft]
  );

  // Auto-save effect
  useEffect(() => {
    debouncedSave(formValues);
    return () => debouncedSave.cancel();
  }, [formValues, debouncedSave]);

  // Real-time field validation
  const validateFieldWithRules = async (
    fieldName: string,
    value: any
  ): Promise<ValidationResult> => {
    const [section, field] = fieldName.split('.');
    const rules = validationRules[section]?.[field];
    
    if (!rules) return { isValid: true, errors: {}, metadata: { timestamp: Date.now(), field: fieldName, validationType: [], locale: 'en' }, performanceMetrics: { duration: 0, cached: false, asyncValidation: false } };

    return validateField(fieldName, value, rules, {
      async: true,
      cache: true
    });
  };

  // Handle step navigation
  const handleNext = async () => {
    const currentStepValid = await validateStepFields(activeStep);
    if (currentStepValid) {
      setActiveStep((prev) => Math.min(prev + 1, FORM_STEPS.length - 1));
      updateFormProgress(activeStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  // Validate current step fields
  const validateStepFields = async (step: number): Promise<boolean> => {
    const stepFields = getStepFields(step);
    const validations = await Promise.all(
      stepFields.map(field => validateFieldWithRules(field, methods.getValues(field)))
    );

    const newErrors = validations.reduce((acc, result) => ({
      ...acc,
      ...result.errors
    }), {});

    setValidationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Update form progress
  const updateFormProgress = (step: number) => {
    setFormProgress(prev => {
      const newProgress = [...prev];
      newProgress[step] = 100;
      return newProgress;
    });
  };

  // Handle form submission
  const onFormSubmit = async (data: ApplicationFormData) => {
    setIsSubmitting(true);
    try {
      const validationResult = await validateForm(data);
      if (!validationResult.isValid) {
        setValidationErrors(validationResult.errors);
        return;
      }

      const application: Application = {
        id: crypto.randomUUID(),
        userId: '', // Set by backend
        status: ApplicationStatus.SUBMITTED,
        formData: data,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
        comments: []
      };

      await onSubmit(application);
    } catch (error) {
      console.error('Form submission failed:', error);
      setValidationErrors({
        submit: 'Failed to submit application. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render current step component
  const renderStepContent = (step: number) => {
    const StepComponent = FORM_STEPS[step].component;
    return (
      <React.Suspense fallback={<CircularProgress />}>
        <StepComponent />
      </React.Suspense>
    );
  };

  return (
    <FormProvider {...methods}>
      <Paper 
        elevation={3}
        sx={{ 
          p: theme.spacing(3),
          my: theme.spacing(2),
          maxWidth: '1200px',
          margin: '0 auto'
        }}
      >
        <Box sx={{ width: '100%' }}>
          <Stepper 
            activeStep={activeStep} 
            orientation={isMobile ? 'vertical' : 'horizontal'}
            sx={{ mb: theme.spacing(4) }}
          >
            {FORM_STEPS.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>
                  <Typography variant="body2">
                    {step.label}
                    {formProgress[index] > 0 && ` (${formProgress[index]}%)`}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {Object.keys(validationErrors).length > 0 && (
            <Alert 
              severity="error" 
              sx={{ mb: theme.spacing(2) }}
              onClose={() => setValidationErrors({})}
            >
              Please correct the following errors:
              <ul>
                {Object.entries(validationErrors).map(([field, error]) => (
                  <li key={field}>{error}</li>
                ))}
              </ul>
            </Alert>
          )}

          <Box sx={{ mt: theme.spacing(2), mb: theme.spacing(4) }}>
            {renderStepContent(activeStep)}
          </Box>

          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            mt: theme.spacing(2)
          }}>
            <Button
              onClick={handleBack}
              disabled={activeStep === 0 || isSubmitting}
              variant="outlined"
            >
              Back
            </Button>
            
            <Box sx={{ display: 'flex', gap: theme.spacing(1) }}>
              {isSaving && (
                <Typography variant="caption" sx={{ alignSelf: 'center' }}>
                  Saving draft...
                </Typography>
              )}
              
              {activeStep === FORM_STEPS.length - 1 ? (
                <Button
                  onClick={handleSubmit(onFormSubmit)}
                  variant="contained"
                  disabled={isSubmitting}
                  startIcon={isSubmitting && <CircularProgress size={20} />}
                >
                  Submit Application
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  variant="contained"
                  disabled={isSubmitting}
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>
    </FormProvider>
  );
};

export default ApplicationForm;