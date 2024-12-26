/**
 * @fileoverview Entry point for the Enrollment System web application
 * Implements React 18 features with comprehensive error tracking, performance monitoring,
 * and accessibility support.
 * @version 1.0.0
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// Internal imports
import App from './App';
import { store, persistor } from './store';
import './styles/global.css';

// Environment variables
const ENV = process.env.NODE_ENV;
const SENTRY_DSN = process.env.VITE_SENTRY_DSN;

/**
 * Initializes error tracking and performance monitoring
 */
const initializeMonitoring = (): void => {
  if (ENV === 'production' && SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      integrations: [new BrowserTracing()],
      environment: ENV,
      tracesSampleRate: 0.2,
      beforeSend(event) {
        // Sanitize sensitive data before sending
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
        }
        return event;
      },
      // Performance monitoring configuration
      tracingOptions: {
        trackComponents: true,
        trackHttpRequests: true,
        trackUserInteractions: true
      }
    });
  }
};

/**
 * Initializes accessibility monitoring and announcements
 */
const initializeAccessibility = (): void => {
  // Create accessibility announcement container
  const announcerElement = document.createElement('div');
  announcerElement.setAttribute('role', 'status');
  announcerElement.setAttribute('aria-live', 'polite');
  announcerElement.className = 'visually-hidden';
  document.body.appendChild(announcerElement);

  // Listen for custom announcement events
  document.addEventListener('announcement', ((event: CustomEvent) => {
    const { message, politeness = 'polite' } = event.detail;
    announcerElement.setAttribute('aria-live', politeness);
    announcerElement.textContent = message;
  }) as EventListener);
};

/**
 * Initializes performance monitoring
 */
const initializePerformance = (): void => {
  if (ENV === 'production') {
    // Report Core Web Vitals
    const reportWebVitals = ({ name, delta, id }: any) => {
      Sentry.addBreadcrumb({
        category: 'Web Vitals',
        message: `${name} (ID: ${id}) changed by ${Math.round(delta)}`,
        level: 'info'
      });
    };

    // Initialize performance observer
    const perfObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        Sentry.addBreadcrumb({
          category: 'Performance',
          message: `${entry.name}: ${entry.duration}ms`,
          level: 'info'
        });
      });
    });

    perfObserver.observe({ entryTypes: ['resource', 'navigation', 'longtask'] });
  }
};

/**
 * Renders the application with all necessary providers and monitoring
 */
const renderApp = (): void => {
  const rootElement = document.getElementById('root') as HTMLElement;
  
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Initialize monitoring and accessibility features
  initializeMonitoring();
  initializeAccessibility();
  initializePerformance();

  // Create React root with concurrent features
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <Sentry.ErrorBoundary
            fallback={({ error }) => (
              <div role="alert" className="error-boundary">
                <h2>An error has occurred</h2>
                <pre>{error.message}</pre>
              </div>
            )}
            showDialog={ENV === 'production'}
          >
            <App />
          </Sentry.ErrorBoundary>
        </PersistGate>
      </Provider>
    </React.StrictMode>
  );
};

// Initialize and render application
renderApp();

// Enable hot module replacement in development
if (ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    renderApp();
  });
}

// Export for testing purposes
export { initializeMonitoring, initializeAccessibility, initializePerformance };