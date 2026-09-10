// Register background location task before anything else
import './utils/backgroundTask';

// Initialize Newly console log capture before anything else
import './utils/errorLogger';

// Polyfills
import './utils/polyfills/alert';

import 'expo-router/entry';
