import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// keep ONLY one import; bump the version to force refresh
import './styles.css?v=cityfest4';

createRoot(document.getElementById('root')).render(<App />);

