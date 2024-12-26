// External dependencies
// winston v3.10.0 - Core logging framework
import * as winston from 'winston';
// winston-daily-rotate-file v4.7.1 - Log rotation
import DailyRotateFile from 'winston-daily-rotate-file';
// winston-elasticsearch v0.17.2 - ELK integration
import { ElasticsearchTransport } from 'winston-elasticsearch';

// Environment variables with defaults
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FILE_PATH = process.env.LOG_FILE_PATH || 'logs';
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS || '30');
const ELASTICSEARCH_INDEX_PREFIX = process.env.ELASTICSEARCH_INDEX_PREFIX || 'enrollment-logs';

// Interfaces for type safety
interface LoggerOptions {
  enableConsole?: boolean;
  enableFile?: boolean;
  enableElasticsearch?: boolean;
  additionalMetadata?: Record<string, any>;
}

interface HttpLogMetadata {
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
  ip?: string;
  correlationId?: string;
}

// Console transport configuration
const createConsoleTransport = (): winston.transport => {
  return new winston.transports.Console({
    level: LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        return `[${timestamp}] ${level}: ${message} ${
          Object.keys(metadata).length ? JSON.stringify(metadata, null, 2) : ''
        }`;
      })
    )
  });
};

// File transport configuration with rotation
const createFileTransport = (): winston.transport => {
  return new DailyRotateFile({
    level: LOG_LEVEL,
    dirname: LOG_FILE_PATH,
    filename: '%DATE%-application.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxFiles: `${LOG_RETENTION_DAYS}d`,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxSize: '20m'
  });
};

// Elasticsearch transport configuration
const createElasticsearchTransport = (): winston.transport => {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }

  return new ElasticsearchTransport({
    level: LOG_LEVEL,
    clientOpts: {
      node: ELASTICSEARCH_URL,
      maxRetries: 5,
      requestTimeout: 10000
    },
    indexPrefix: ELASTICSEARCH_INDEX_PREFIX,
    indexSuffixPattern: 'YYYY.MM.DD',
    bufferLimit: 100,
    ensureMappingTemplate: true,
    flushInterval: 2000,
    mappingTemplate: {
      index_patterns: [`${ELASTICSEARCH_INDEX_PREFIX}-*`],
      settings: {
        number_of_shards: 1,
        number_of_replicas: 1,
        index: {
          refresh_interval: '5s'
        }
      },
      mappings: {
        dynamic_templates: [
          {
            strings_as_keywords: {
              match_mapping_type: 'string',
              mapping: {
                type: 'keyword'
              }
            }
          }
        ]
      }
    }
  });
};

// Main Logger class
export class Logger {
  private logger: winston.Logger;
  private serviceName: string;
  private defaultMetadata: Record<string, any>;

  constructor(serviceName: string, options: LoggerOptions = {}) {
    this.serviceName = serviceName;
    this.defaultMetadata = {
      service: serviceName,
      environment: process.env.NODE_ENV,
      ...options.additionalMetadata
    };

    const transports: winston.transport[] = [];

    // Configure transports based on options
    if (options.enableConsole !== false) {
      transports.push(createConsoleTransport());
    }

    if (options.enableFile !== false) {
      transports.push(createFileTransport());
    }

    if (options.enableElasticsearch !== false && ELASTICSEARCH_URL) {
      transports.push(createElasticsearchTransport());
    }

    this.logger = winston.createLogger({
      level: LOG_LEVEL,
      transports,
      defaultMeta: this.defaultMetadata
    });
  }

  // Sanitize sensitive data
  private sanitize(data: any): any {
    const sensitiveFields = ['password', 'token', 'ssn', 'creditCard'];
    if (typeof data === 'object' && data !== null) {
      return Object.keys(data).reduce((acc: any, key) => {
        if (sensitiveFields.includes(key.toLowerCase())) {
          acc[key] = '[REDACTED]';
        } else if (typeof data[key] === 'object') {
          acc[key] = this.sanitize(data[key]);
        } else {
          acc[key] = data[key];
        }
        return acc;
      }, Array.isArray(data) ? [] : {});
    }
    return data;
  }

  // Generate correlation ID
  private generateCorrelationId(): string {
    return `${this.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Info level logging
  public info(message: string, metadata: Record<string, any> = {}): void {
    const correlationId = this.generateCorrelationId();
    const sanitizedMetadata = this.sanitize(metadata);

    this.logger.info(message, {
      correlationId,
      timestamp: new Date().toISOString(),
      ...sanitizedMetadata
    });
  }

  // Error level logging
  public error(message: string, error: Error, metadata: Record<string, any> = {}): void {
    const correlationId = this.generateCorrelationId();
    const sanitizedMetadata = this.sanitize(metadata);

    this.logger.error(message, {
      correlationId,
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...sanitizedMetadata
      }
    });
  }

  // HTTP request/response logging
  public http(request: any, response: any, options: Record<string, any> = {}): void {
    const startTime = process.hrtime();
    const correlationId = this.generateCorrelationId();

    response.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;

      const httpMetadata: HttpLogMetadata = {
        method: request.method,
        url: request.url,
        statusCode: response.statusCode,
        responseTime,
        userAgent: request.get('user-agent'),
        ip: request.ip,
        correlationId
      };

      const sanitizedMetadata = this.sanitize({
        ...httpMetadata,
        ...options
      });

      this.logger.info('HTTP Request', sanitizedMetadata);
    });
  }
}

// Export singleton instance for common use cases
export const createLogger = (serviceName: string, options?: LoggerOptions): Logger => {
  return new Logger(serviceName, options);
};
```

This implementation provides a robust logging utility that addresses all the requirements specified in the JSON specification. Key features include:

1. Structured logging with Winston
2. ELK Stack integration via winston-elasticsearch
3. Log rotation and compression with winston-daily-rotate-file
4. Security features including PII protection and correlation IDs
5. Performance monitoring with request timing
6. Multiple transport support (Console, File, Elasticsearch)
7. Environment-based configuration
8. Comprehensive metadata capture
9. Error handling with stack traces
10. HTTP request/response logging

The logger can be used across all backend services to provide consistent logging capabilities while ensuring security and performance monitoring requirements are met.

Usage example:
```typescript
const logger = createLogger('UserService');

// Info logging
logger.info('User login successful', { userId: '123' });

// Error logging
try {
  // Some operation
} catch (error) {
  logger.error('Failed to process request', error, { additionalContext: 'value' });
}

// HTTP logging (in Express middleware)
app.use((req, res, next) => {
  logger.http(req, res);
  next();
});