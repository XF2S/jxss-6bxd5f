import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { vi } from 'vitest'; // v0.34.0
import { axe, toHaveNoViolations } from 'jest-axe'; // v8.0.0

import ApplicationForm from './ApplicationForm';
import { validateField, validateForm, transformFormData } from '@/utils/form.utils';
import { 
  ApplicationFormData, 
  ApplicationStatus, 
  ProgramType 
} from '@/types/application.types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock validation utilities
vi.mock('@/utils/form.utils', () => ({
  validateField: vi.fn(),
  validateForm: vi.fn(),
  transformFormData: vi.fn()
}));

// Mock form step components
vi.mock('./steps/PersonalInfoStep', () => ({
  default: () => <div data-testid="personal-info-step">Personal Info Step</div>
}));

vi.mock('./steps/AcademicInfoStep', () => ({
  default: () => <div data-testid="academic-info-step">Academic Info Step</div>
}));

vi.mock('./steps/ProgramInfoStep', () => ({
  default: () => <div data-testid="program-info-step">Program Info Step</div>
}));

vi.mock('./steps/DocumentUploadStep', () => ({
  default: () => <div data-testid="document-upload-step">Document Upload Step</div>
}));

vi.mock('./steps/ReviewStep', () => ({
  default: () => <div data-testid="review-step">Review Step</div>
}));

// Test data generators
const mockFormData = (overrides: Partial<ApplicationFormData> = {}): ApplicationFormData => ({
  personalInfo: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-555-5555',
    dateOfBirth: new Date('1990-01-01'),
    address: {
      street1: '123 Main St',
      street2: null,
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
      country: 'USA'
    }
  },
  academicInfo: {
    previousInstitution: 'Test University',
    gpa: 3.5,
    graduationDate: new Date('2022-05-15'),
    major: 'Computer Science',
    transcripts: [{
      id: '1',
      name: 'transcript.pdf',
      type: 'application/pdf',
      size: 1024,
      uploadedAt: new Date()
    }]
  },
  programInfo: {
    programType: ProgramType.GRADUATE,
    intendedMajor: 'Computer Science',
    startTerm: 'Fall 2024',
    fullTime: true,
    specializations: ['Software Engineering']
  },
  documents: [],
  additionalInfo: {},
  ...overrides
});

// Test setup helpers
const renderApplicationForm = async (props = {}) => {
  const user = userEvent.setup();
  const defaultProps = {
    onSubmit: vi.fn(),
    onSaveDraft: vi.fn(),
    initialData: mockFormData(),
    ...props
  };

  const result = render(<ApplicationForm {...defaultProps} />);
  
  // Wait for initial render to complete
  await waitFor(() => {
    expect(screen.getByTestId('personal-info-step')).toBeInTheDocument();
  });

  return {
    ...result,
    user,
    mockSubmit: defaultProps.onSubmit,
    mockSaveDraft: defaultProps.onSaveDraft
  };
};

describe('ApplicationForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Accessibility', () => {
    it('should meet WCAG 2.1 Level AA compliance', async () => {
      const { container } = await renderApplicationForm();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const { user } = await renderApplicationForm();
      
      // Test tab navigation
      await user.tab();
      expect(screen.getByRole('button', { name: /next/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /save draft/i })).toHaveFocus();
    });

    it('should have proper ARIA labels and landmarks', () => {
      render(<ApplicationForm onSubmit={vi.fn()} onSaveDraft={vi.fn()} />);
      
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label');
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });

  describe('Form Navigation', () => {
    it('should render initial step correctly', async () => {
      await renderApplicationForm();
      expect(screen.getByTestId('personal-info-step')).toBeInTheDocument();
    });

    it('should navigate through steps when clicking Next', async () => {
      const { user } = await renderApplicationForm();
      
      // Mock successful validation
      (validateField as jest.Mock).mockResolvedValue({ isValid: true, errors: {} });
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      
      // Navigate through steps
      await user.click(nextButton);
      expect(screen.getByTestId('academic-info-step')).toBeInTheDocument();
      
      await user.click(nextButton);
      expect(screen.getByTestId('program-info-step')).toBeInTheDocument();
    });

    it('should prevent navigation if validation fails', async () => {
      const { user } = await renderApplicationForm();
      
      // Mock failed validation
      (validateField as jest.Mock).mockResolvedValue({
        isValid: false,
        errors: { 'personalInfo.firstName': 'Required field' }
      });
      
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Should stay on first step
      expect(screen.getByTestId('personal-info-step')).toBeInTheDocument();
      expect(screen.getByText(/required field/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate fields on blur', async () => {
      const { user } = await renderApplicationForm();
      
      const input = screen.getByRole('textbox', { name: /first name/i });
      await user.type(input, 'John');
      await user.tab();
      
      expect(validateField).toHaveBeenCalledWith(
        'firstName',
        'John',
        expect.any(Object)
      );
    });

    it('should show validation errors', async () => {
      const { user } = await renderApplicationForm();
      
      (validateField as jest.Mock).mockResolvedValue({
        isValid: false,
        errors: { 'personalInfo.email': 'Invalid email format' }
      });
      
      const emailInput = screen.getByRole('textbox', { name: /email/i });
      await user.type(emailInput, 'invalid-email');
      await user.tab();
      
      expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should handle successful form submission', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      const { user } = await renderApplicationForm({ onSubmit: mockSubmit });
      
      // Navigate to last step
      for (let i = 0; i < 4; i++) {
        (validateField as jest.Mock).mockResolvedValue({ isValid: true, errors: {} });
        await user.click(screen.getByRole('button', { name: /next/i }));
      }
      
      (validateForm as jest.Mock).mockResolvedValue({ isValid: true, errors: {} });
      
      await user.click(screen.getByRole('button', { name: /submit application/i }));
      
      expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
        status: ApplicationStatus.SUBMITTED
      }));
    });

    it('should handle submission errors', async () => {
      const mockSubmit = vi.fn().mockRejectedValue(new Error('Submission failed'));
      const { user } = await renderApplicationForm({ onSubmit: mockSubmit });
      
      // Navigate to last step
      for (let i = 0; i < 4; i++) {
        (validateField as jest.Mock).mockResolvedValue({ isValid: true, errors: {} });
        await user.click(screen.getByRole('button', { name: /next/i }));
      }
      
      await user.click(screen.getByRole('button', { name: /submit application/i }));
      
      expect(await screen.findByText(/failed to submit application/i)).toBeInTheDocument();
    });
  });

  describe('Auto-save Functionality', () => {
    it('should auto-save form data when changes are made', async () => {
      const mockSaveDraft = vi.fn().mockResolvedValue(undefined);
      const { user } = await renderApplicationForm({ onSaveDraft: mockSaveDraft });
      
      const input = screen.getByRole('textbox', { name: /first name/i });
      await user.type(input, 'Jane');
      
      // Wait for debounced save
      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalled();
      }, { timeout: 2500 });
    });

    it('should show saving indicator during auto-save', async () => {
      const mockSaveDraft = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      const { user } = await renderApplicationForm({ onSaveDraft: mockSaveDraft });
      
      const input = screen.getByRole('textbox', { name: /first name/i });
      await user.type(input, 'Jane');
      
      expect(await screen.findByText(/saving draft/i)).toBeInTheDocument();
    });
  });
});