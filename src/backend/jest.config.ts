// @jest/types version: ^29.0.0
import type { Config } from '@jest/types';

/**
 * Comprehensive Jest configuration for backend microservices
 * Configures test environment, coverage reporting, module resolution,
 * and security testing patterns with enhanced performance optimizations
 */
const config: Config.InitialOptions = {
  // Root directory for test discovery
  roots: ['<rootDir>/packages'],

  // Test pattern matching
  testMatch: [
    '**/*.test.ts',           // Unit tests
    '**/*.integration.test.ts', // Integration tests
    '**/*.security.test.ts',    // Security tests
    '**/*.e2e.test.ts'         // End-to-end tests
  ],

  // TypeScript transformation configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true,
      diagnostics: {
        warnOnly: true // Prevents test failures on TS errors
      }
    }]
  },

  // Supported file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'clover',
    'html',
    'cobertura'  // For CI/CD integration
  ],

  // Strict coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test environment configuration
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  globalSetup: '<rootDir>/jest.global.setup.ts',

  // Module path mapping for microservices
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/packages/shared/$1',
    '^@api-gateway/(.*)$': '<rootDir>/packages/api-gateway/src/$1',
    '^@auth-service/(.*)$': '<rootDir>/packages/auth-service/src/$1',
    '^@application-service/(.*)$': '<rootDir>/packages/application-service/src/$1',
    '^@document-service/(.*)$': '<rootDir>/packages/document-service/src/$1',
    '^@notification-service/(.*)$': '<rootDir>/packages/notification-service/src/$1',
    '^@workflow-service/(.*)$': '<rootDir>/packages/workflow-service/src/$1'
  },

  // Ignored paths
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Performance optimizations
  verbose: true,
  maxWorkers: '50%', // Utilize 50% of available CPU cores
  cacheDirectory: '<rootDir>/.jest-cache',
  maxConcurrency: 5, // Limit concurrent test files
  
  // Error handling and debugging
  errorOnDeprecated: true,
  testTimeout: 30000, // 30 second timeout
  detectOpenHandles: true,
  forceExit: true,
  detectLeaks: true,

  // Notification configuration
  notify: true,
  notifyMode: 'failure-change',

  // Test result reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results/jest',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
};

export default config;