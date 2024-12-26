// External imports with versions
import handlebars from 'handlebars'; // v4.7.0
import i18next from 'i18next'; // v21.8.0
import sanitizeHtml from 'sanitize-html'; // v2.7.0

// Internal imports
import { validateEmail } from '../../../shared/utils/src/validation.util';
import { Logger } from '../../../shared/utils/src/logger.util';

// Initialize logger
const logger = new Logger('EmailTemplates');

// Template IDs constants
export const TEMPLATE_IDS = {
  APPLICATION_SUBMITTED: 'application_submitted',
  APPLICATION_APPROVED: 'application_approved',
  APPLICATION_REJECTED: 'application_rejected',
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_VERIFIED: 'document_verified',
  DOCUMENT_REJECTED: 'document_rejected',
  STATUS_UPDATE: 'status_update',
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password_reset',
  ACCOUNT_VERIFICATION: 'account_verification'
} as const;

// Template cache for performance optimization
const TEMPLATE_CACHE = new Map<string, handlebars.TemplateDelegate>();

// Sanitization options for security
const SANITIZE_OPTIONS = {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'li', 'a'],
  allowedAttributes: {
    'a': ['href', 'target']
  },
  allowedSchemes: ['http', 'https', 'mailto']
};

// Decorator for template caching
function CacheTemplate(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const cacheKey = `${args[0]}_${args[2]}`; // templateId_locale
    if (TEMPLATE_CACHE.has(cacheKey)) {
      return TEMPLATE_CACHE.get(cacheKey);
    }
    const result = originalMethod.apply(this, args);
    TEMPLATE_CACHE.set(cacheKey, result);
    return result;
  };
  return descriptor;
}

// Decorator for input validation
function ValidateInput(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const [templateId, data] = args;
    const validationResult = validateTemplateData(templateId, data);
    if (!validationResult.isValid) {
      throw new Error(`Template validation failed: ${validationResult.errors.join(', ')}`);
    }
    return originalMethod.apply(this, args);
  };
  return descriptor;
}

/**
 * Enhanced email template class with internationalization and security features
 */
@Injectable()
export class EmailTemplate {
  private readonly id: string;
  private readonly subject: string;
  private readonly content: string;
  private readonly schema: Record<string, any>;
  private readonly translations: Map<string, Record<string, string>>;
  private readonly rtlSupport: boolean;
  private compiledTemplate?: handlebars.TemplateDelegate;

  constructor(config: {
    id: string;
    subject: string;
    content: string;
    schema: Record<string, any>;
    translations?: Record<string, Record<string, string>>;
    rtlSupport?: boolean;
  }) {
    this.id = config.id;
    this.subject = config.subject;
    this.content = config.content;
    this.schema = config.schema;
    this.translations = new Map(Object.entries(config.translations || {}));
    this.rtlSupport = config.rtlSupport || false;
    this.precompileTemplate();
  }

  private precompileTemplate(): void {
    try {
      this.compiledTemplate = handlebars.compile(this.content);
    } catch (error) {
      logger.error('Template compilation failed', error as Error, { templateId: this.id });
      throw error;
    }
  }

  @CacheTemplate
  @ValidateInput
  public async compile(data: Record<string, any>, locale: string = 'en'): Promise<string> {
    try {
      // Load locale-specific content
      const localizedContent = this.translations.get(locale) || {};
      const mergedData = { ...data, ...localizedContent };

      // Apply RTL if needed
      const rtlLocales = ['ar', 'he', 'fa'];
      const isRTL = this.rtlSupport && rtlLocales.includes(locale);

      // Sanitize input data
      const sanitizedData = Object.entries(mergedData).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'string' ? sanitizeHtml(value, SANITIZE_OPTIONS) : value;
        return acc;
      }, {} as Record<string, any>);

      // Compile template
      const compiledHtml = this.compiledTemplate!(sanitizedData);

      // Apply RTL wrapper if needed
      return isRTL ? `<div dir="rtl">${compiledHtml}</div>` : compiledHtml;
    } catch (error) {
      logger.error('Template compilation failed', error as Error, {
        templateId: this.id,
        locale,
        data
      });
      throw error;
    }
  }
}

/**
 * Validates template data against schema and performs security checks
 */
function validateTemplateData(templateId: string, data: Record<string, any>): ValidationResult {
  const errors: string[] = [];

  try {
    // Validate required fields
    if (!templateId || !data) {
      errors.push('Template ID and data are required');
      return { isValid: false, errors };
    }

    // Validate email addresses if present
    const emailFields = ['recipientEmail', 'senderEmail'];
    for (const field of emailFields) {
      if (data[field] && !validateEmail(data[field])) {
        errors.push(`Invalid email address in field: ${field}`);
      }
    }

    // Check for potential XSS content
    const stringFields = Object.entries(data)
      .filter(([_, value]) => typeof value === 'string');

    for (const [key, value] of stringFields) {
      if (/<script|javascript:|data:/i.test(value)) {
        errors.push(`Potential malicious content detected in field: ${key}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  } catch (error) {
    logger.error('Template validation error', error as Error, { templateId, data });
    throw error;
  }
}

// Export pre-defined templates
export const templates = new Map<string, EmailTemplate>([
  [TEMPLATE_IDS.APPLICATION_SUBMITTED, new EmailTemplate({
    id: TEMPLATE_IDS.APPLICATION_SUBMITTED,
    subject: 'Application Submitted Successfully',
    content: `
      <p>Dear {{firstName}},</p>
      <p>Your application (ID: {{applicationId}}) has been successfully submitted.</p>
      <p>You can track your application status at: <a href="{{trackingUrl}}">{{trackingUrl}}</a></p>
    `,
    schema: {
      firstName: { type: 'string', required: true },
      applicationId: { type: 'string', required: true },
      trackingUrl: { type: 'string', required: true }
    },
    rtlSupport: true
  })],
  // Add other templates...
]);

// Export compile utility function
export const compileTemplate = async (
  templateId: string,
  data: Record<string, any>,
  locale: string = 'en'
): Promise<string> => {
  const template = templates.get(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  return template.compile(data, locale);
};