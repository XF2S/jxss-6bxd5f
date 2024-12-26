/**
 * @fileoverview Root Redux store configuration with enhanced security, performance,
 * and type-safety features for the Enrollment System.
 * @version 1.0.0
 */

import { 
  configureStore, 
  getDefaultMiddleware,
  Middleware
} from '@reduxjs/toolkit'; // v2.0.0
import { 
  persistStore, 
  persistReducer,
  createTransform,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from 'redux-persist'; // v6.0.0
import storage from 'redux-persist/lib/storage'; // v6.0.0
import { createStateSyncMiddleware } from 'redux-state-sync'; // v3.1.4
import CryptoJS from 'crypto-js'; // v4.1.1

// Import reducers
import applicationReducer from './slices/applicationSlice';
import authReducer from './slices/authSlice';
import documentReducer from './slices/documentSlice';
import notificationReducer from './slices/notificationSlice';
import workflowReducer from './slices/workflowSlice';

// Encryption key for sensitive data
const ENCRYPTION_KEY = process.env.VITE_REDUX_ENCRYPTION_KEY || 'enrollment-system-key';

/**
 * Transform for encrypting sensitive data before persistence
 */
const encryptTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState: any, key) => {
    if (key === 'auth') {
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(inboundState),
        ENCRYPTION_KEY
      ).toString();
      return { ...inboundState, encrypted };
    }
    return inboundState;
  },
  // Transform state being rehydrated
  (outboundState: any, key) => {
    if (key === 'auth' && outboundState.encrypted) {
      const decrypted = CryptoJS.AES.decrypt(
        outboundState.encrypted,
        ENCRYPTION_KEY
      ).toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted);
    }
    return outboundState;
  },
  { whitelist: ['auth'] }
);

/**
 * Redux persist configuration with security enhancements
 */
const persistConfig = {
  key: 'enrollment_system_root',
  storage,
  whitelist: ['auth'], // Only persist authentication state
  blacklist: ['notification'], // Never persist notifications
  transforms: [encryptTransform],
  timeout: 10000,
  debug: process.env.NODE_ENV === 'development'
};

/**
 * Combined root reducer with all feature reducers
 */
const rootReducer = {
  application: applicationReducer,
  auth: authReducer,
  document: documentReducer,
  notification: notificationReducer,
  workflow: workflowReducer
};

/**
 * Custom middleware configuration with performance optimizations
 */
const customMiddleware: Middleware[] = [
  createStateSyncMiddleware({
    blacklist: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
  })
];

/**
 * Configure and create the Redux store with persistence and security features
 */
const configureAppStore = () => {
  const persistedReducer = persistReducer(persistConfig, rootReducer);

  const store = configureStore({
    reducer: persistedReducer,
    middleware: getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        ignoredPaths: ['payload.timestamp']
      },
      immutableCheck: true,
      thunk: true
    }).concat(customMiddleware),
    devTools: process.env.NODE_ENV !== 'production' ? {
      maxAge: 25,
      trace: true,
      traceLimit: 25
    } : false
  });

  const persistor = persistStore(store, null, () => {
    console.debug('Redux store rehydration complete');
  });

  return { store, persistor };
};

// Create store instance
const { store, persistor } = configureAppStore();

// Export store type for TypeScript support
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export store and persistor
export { store, persistor };

// Export default for module imports
export default store;