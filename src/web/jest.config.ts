// @ts-check
import type { Config } from '@jest/types';
// @types/jest version ^29.5.2
// @testing-library/jest-dom version ^5.16.5
// ts-jest version ^29.1.0
// identity-obj-proxy version ^3.0.0

/**
 * Jest configuration for the web application testing environment
 * Implements comprehensive testing setup with TypeScript support, React component testing,
 * and code coverage requirements
 */
const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Use jsdom environment for DOM testing
  testEnvironment: 'jsdom',

  // Define test file locations
  roots: ['<rootDir>/src'],

  // Module name mapping for path aliases (synchronized with tsconfig.json)
  moduleNameMapper: {
    // Path aliases for clean imports
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@assets/(.*)$': '<rootDir>/src/assets/$1',
    '^@styles/(.*)$': '<rootDir>/src/styles/$1',

    // Handle style and asset imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/__mocks__/fileMock.js'
  },

  // Setup files to run after Jest is initialized
  setupFilesAfterEnv: ['@testing-library/jest-dom'],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts'
  ],

  // Coverage thresholds enforcement
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // TypeScript transform configuration
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Additional configuration options
  verbose: true,
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true
};

export default config;