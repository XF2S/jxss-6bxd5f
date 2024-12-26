// External imports with versions
import { describe, it, beforeEach, afterEach, jest } from '@jest/globals'; // ^29.0.0
import { Container } from 'inversify'; // ^6.0.1
import { mock, MockProxy } from 'jest-mock-extended'; // ^3.0.0
import { performance } from 'perf_hooks'; // native

// Internal imports
import { NotificationController } from '../src/controllers/notification.controller';
import { EmailService } from '../src/services/email.service';
import { SMSService } from '../src/services/sms.service';

// Constants
const TEST_TIMEOUT = 5000;
const PERFORMANCE_THRESHOLD = 3000; // 3 seconds SLA

// Mock services
let mockEmailService: MockProxy<EmailService>;
let mockSMSService: MockProxy<SMSService>;
let container: Container;

/**
 * Sets up test container with mocked services
 */
const setupTestContainer = (): Container => {
  const container = new Container();
  
  // Configure mocks
  mockEmailService = mock<EmailService>();
  mockSMSService = mock<SMSService>();
  
  // Bind services
  container.bind('EmailService').toConstantValue(mockEmailService);
  container.bind('SMSService').toConstantValue(mockSMSService);
  container.bind(NotificationController).toSelf();
  
  return container;
};

/**
 * Measures and validates function execution time against SLA
 */
const measurePerformance = async (testFn: () => Promise<void>): Promise<void> => {
  const start = performance.now();
  await testFn();
  const duration = performance.now() - start;
  
  expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
};

describe('NotificationController Unit Tests', () => {
  let controller: NotificationController;

  beforeEach(() => {
    container = setupTestContainer();
    controller = container.get(NotificationController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Email Operations', () => {
    it('should send single email within SLA', async () => {
      // Arrange
      const emailRequest = {
        to: 'test@example.com',
        templateId: 'test_template',
        data: { name: 'Test User' }
      };
      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'test-123'
      });

      // Act & Assert
      await measurePerformance(async () => {
        const response = await new Promise((resolve, reject) => {
          controller.sendEmail(
            { request: emailRequest } as any,
            (error: any, result: any) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
        });

        expect(response).toEqual(
          expect.objectContaining({
            success: true,
            messageId: expect.any(String),
            correlationId: expect.any(String)
          })
        );
      });
    });

    it('should handle bulk email operations', async () => {
      // Arrange
      const bulkRequest = {
        recipients: ['test1@example.com', 'test2@example.com'],
        templateId: 'test_template',
        data: { content: 'Bulk test' }
      };
      mockEmailService.sendBulkEmails.mockResolvedValue({
        success: true,
        totalSent: 2,
        failed: []
      });

      // Act & Assert
      await measurePerformance(async () => {
        const response = await new Promise((resolve, reject) => {
          controller.sendBulkEmails(
            { request: bulkRequest } as any,
            (error: any, result: any) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
        });

        expect(response).toEqual(
          expect.objectContaining({
            success: true,
            totalSent: 2,
            failed: []
          })
        );
      });
    });

    it('should validate email templates', async () => {
      // Arrange
      const invalidTemplate = {
        to: 'test@example.com',
        templateId: 'invalid_template'
      };

      mockEmailService.sendEmail.mockRejectedValue(
        new Error('Invalid template')
      );

      // Act & Assert
      await new Promise((resolve) => {
        controller.sendEmail(
          { request: invalidTemplate } as any,
          (error: any) => {
            expect(error).toEqual(
              expect.objectContaining({
                code: 500,
                message: 'Failed to send email',
                details: 'Invalid template'
              })
            );
            resolve(null);
          }
        );
      });
    });

    it('should handle rate limiting', async () => {
      // Arrange
      const request = {
        to: 'test@example.com',
        templateId: 'test_template'
      };

      mockEmailService.sendEmail.mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      // Act & Assert
      await new Promise((resolve) => {
        controller.sendEmail(
          { request } as any,
          (error: any) => {
            expect(error).toEqual(
              expect.objectContaining({
                code: 500,
                message: 'Failed to send email',
                details: 'Rate limit exceeded'
              })
            );
            resolve(null);
          }
        );
      });
    });
  });

  describe('SMS Operations', () => {
    it('should send SMS within SLA', async () => {
      // Arrange
      const smsRequest = {
        to: '+1234567890',
        message: 'Test message'
      };
      mockSMSService.sendSMS.mockResolvedValue({
        success: true,
        messageSid: 'SM123'
      });

      // Act & Assert
      await measurePerformance(async () => {
        const response = await new Promise((resolve, reject) => {
          controller.sendSMS(
            { request: smsRequest } as any,
            (error: any, result: any) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
        });

        expect(response).toEqual(
          expect.objectContaining({
            success: true,
            messageSid: expect.any(String),
            correlationId: expect.any(String)
          })
        );
      });
    });

    it('should validate phone numbers', async () => {
      // Arrange
      const invalidRequest = {
        to: 'invalid-phone',
        message: 'Test message'
      };

      mockSMSService.sendSMS.mockRejectedValue(
        new Error('Invalid phone number')
      );

      // Act & Assert
      await new Promise((resolve) => {
        controller.sendSMS(
          { request: invalidRequest } as any,
          (error: any) => {
            expect(error).toEqual(
              expect.objectContaining({
                code: 500,
                message: 'Failed to send SMS',
                details: 'Invalid phone number'
              })
            );
            resolve(null);
          }
        );
      });
    });

    it('should check delivery status', async () => {
      // Arrange
      const messageSid = 'SM123';
      mockSMSService.checkDeliveryStatus.mockResolvedValue({
        status: 'delivered',
        timestamp: new Date().toISOString()
      });

      // Act & Assert
      await measurePerformance(async () => {
        const response = await new Promise((resolve, reject) => {
          controller.checkDeliveryStatus(
            { request: { messageId: messageSid } } as any,
            (error: any, result: any) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
        });

        expect(response).toEqual(
          expect.objectContaining({
            success: true,
            status: 'delivered'
          })
        );
      });
    });
  });
});

describe('Integration Tests', () => {
  let controller: NotificationController;

  beforeEach(() => {
    container = setupTestContainer();
    controller = container.get(NotificationController);
  });

  describe('Email Service', () => {
    it('should integrate with template engine', async () => {
      // Arrange
      const request = {
        to: 'test@example.com',
        templateId: 'welcome',
        data: { name: 'Test User' }
      };

      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'test-123'
      });

      // Act & Assert
      const response = await new Promise((resolve, reject) => {
        controller.sendEmail(
          { request } as any,
          (error: any, result: any) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        request.to,
        request.templateId,
        request.data,
        expect.any(Object)
      );
      expect(response).toHaveProperty('success', true);
    });

    it('should handle service outages', async () => {
      // Arrange
      const request = {
        to: 'test@example.com',
        templateId: 'test_template'
      };

      mockEmailService.sendEmail.mockRejectedValue(
        new Error('Service unavailable')
      );

      // Act & Assert
      await new Promise((resolve) => {
        controller.sendEmail(
          { request } as any,
          (error: any) => {
            expect(error.code).toBe(500);
            expect(error.message).toBe('Failed to send email');
            resolve(null);
          }
        );
      });
    });
  });
});

describe('Performance Tests', () => {
  let controller: NotificationController;

  beforeEach(() => {
    container = setupTestContainer();
    controller = container.get(NotificationController);
  });

  it('should meet 3-second SLA for single operations', async () => {
    // Arrange
    const request = {
      to: 'test@example.com',
      templateId: 'test_template',
      data: { name: 'Test User' }
    };

    mockEmailService.sendEmail.mockResolvedValue({
      success: true,
      messageId: 'test-123'
    });

    // Act & Assert
    await measurePerformance(async () => {
      await new Promise((resolve, reject) => {
        controller.sendEmail(
          { request } as any,
          (error: any, result: any) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });
    });
  });

  it('should handle concurrent requests', async () => {
    // Arrange
    const requests = Array(10).fill({
      to: 'test@example.com',
      templateId: 'test_template',
      data: { name: 'Test User' }
    });

    mockEmailService.sendEmail.mockResolvedValue({
      success: true,
      messageId: 'test-123'
    });

    // Act & Assert
    await measurePerformance(async () => {
      await Promise.all(
        requests.map(request => 
          new Promise((resolve, reject) => {
            controller.sendEmail(
              { request } as any,
              (error: any, result: any) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
          })
        )
      );
    });
  });
});