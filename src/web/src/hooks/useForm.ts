import { useState, useCallback, useEffect, ChangeEvent, FocusEvent, FormEvent } from 'react'; // v18.0.0
import { debounce } from 'lodash'; // v4.17.21
import { 
  validateField, 
  validateForm, 
  transformFormData 
} from '../utils/form.utils';
import { 
  VALIDATION_PATTERNS, 
  VALIDATION_RULES, 
  VALIDATION_MESSAGES, 
  ValidationRule 
} from '../constants/validation.constants';

// Constants
const VALIDATION_DEBOUNCE_MS = 300;

/**
 * Interface for form state management
 */
interface FormState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
}

/**
 * Interface for useForm hook return value
 */
interface UseFormReturn<T> extends FormState<T> {
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleBlur: (event: FocusEvent<HTMLInputElement>) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  reset: () => void;
  setFieldValue: (field: string, value: any) => void;
  setFieldTouched: (field: string, touched: boolean) => void;
  validateField: (field: string) => Promise<string | null>;
  validateForm: () => Promise<boolean>;
}

/**
 * Advanced form management hook with validation and accessibility support
 * @param initialValues - Initial form values
 * @param validationRules - Form validation rules
 * @param onSubmit - Form submission handler
 */
const useForm = <T extends Record<string, any>>(
  initialValues: T,
  validationRules: Record<string, ValidationRule>,
  onSubmit: (values: T) => Promise<void>
): UseFormReturn<T> => {
  // Initialize form state
  const [formState, setFormState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
    isValid: true,
    isDirty: false
  });

  // Create a ref for the latest error message for screen readers
  const [ariaLiveMessage, setAriaLiveMessage] = useState<string>('');

  // Create debounced validation function
  const debouncedValidate = useCallback(
    debounce(async (fieldName: string, value: any) => {
      const rule = validationRules[fieldName];
      if (rule) {
        const error = await validateField(fieldName, value, rule);
        if (error) {
          setFormState(prev => ({
            ...prev,
            errors: { ...prev.errors, [fieldName]: error },
            isValid: false
          }));
          setAriaLiveMessage(error);
        } else {
          setFormState(prev => {
            const { [fieldName]: _, ...remainingErrors } = prev.errors;
            return {
              ...prev,
              errors: remainingErrors,
              isValid: Object.keys(remainingErrors).length === 0
            };
          });
        }
      }
    }, VALIDATION_DEBOUNCE_MS),
    [validationRules]
  );

  // Handle field change
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    const fieldValue = type === 'checkbox' ? checked : value;

    setFormState(prev => ({
      ...prev,
      values: { ...prev.values, [name]: fieldValue },
      isDirty: true
    }));

    debouncedValidate(name, fieldValue);
  }, [debouncedValidate]);

  // Handle field blur
  const handleBlur = useCallback((event: FocusEvent<HTMLInputElement>) => {
    const { name } = event.target;
    setFormState(prev => ({
      ...prev,
      touched: { ...prev.touched, [name]: true }
    }));
  }, []);

  // Set field value programmatically
  const setFieldValue = useCallback((field: string, value: any) => {
    setFormState(prev => ({
      ...prev,
      values: { ...prev.values, [field]: value },
      isDirty: true
    }));
    debouncedValidate(field, value);
  }, [debouncedValidate]);

  // Set field touched state programmatically
  const setFieldTouched = useCallback((field: string, touched: boolean) => {
    setFormState(prev => ({
      ...prev,
      touched: { ...prev.touched, [field]: touched }
    }));
  }, []);

  // Validate single field
  const validateSingleField = useCallback(async (field: string): Promise<string | null> => {
    const value = formState.values[field];
    const rule = validationRules[field];
    return rule ? validateField(field, value, rule) : null;
  }, [formState.values, validationRules]);

  // Validate entire form
  const validateEntireForm = useCallback(async (): Promise<boolean> => {
    const errors = await validateForm(formState.values);
    const hasErrors = Object.keys(errors).length > 0;
    
    setFormState(prev => ({
      ...prev,
      errors,
      isValid: !hasErrors
    }));

    if (hasErrors) {
      const firstError = Object.values(errors)[0];
      setAriaLiveMessage(firstError);
    }

    return !hasErrors;
  }, [formState.values]);

  // Handle form submission
  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setFormState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const isValid = await validateEntireForm();
      if (isValid) {
        const transformedData = transformFormData(formState.values);
        await onSubmit(transformedData as T);
        
        // Reset form state after successful submission
        setFormState(prev => ({
          ...prev,
          isDirty: false,
          touched: {},
          isSubmitting: false
        }));
      } else {
        setFormState(prev => ({ ...prev, isSubmitting: false }));
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setFormState(prev => ({ 
        ...prev, 
        isSubmitting: false,
        errors: { 
          ...prev.errors, 
          submit: 'An error occurred while submitting the form' 
        }
      }));
      setAriaLiveMessage('Form submission failed. Please try again.');
    }
  }, [formState.values, validateEntireForm, onSubmit]);

  // Reset form to initial state
  const reset = useCallback(() => {
    setFormState({
      values: initialValues,
      errors: {},
      touched: {},
      isSubmitting: false,
      isValid: true,
      isDirty: false
    });
    setAriaLiveMessage('Form has been reset');
  }, [initialValues]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedValidate.cancel();
    };
  }, [debouncedValidate]);

  return {
    ...formState,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldValue,
    setFieldTouched,
    validateField: validateSingleField,
    validateForm: validateEntireForm
  };
};

export default useForm;