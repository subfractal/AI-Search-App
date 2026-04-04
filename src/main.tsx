import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initAudioContext } from '@/services/audio-engine';

// Mobile browsers require audio context to start from a user gesture.
// Listen for the first tap/click anywhere and initialize Tone.js.
function initOnFirstGesture() {
  const handler = () => {
    initAudioContext().catch(console.error);
    document.removeEventListener('touchstart', handler);
    document.removeEventListener('mousedown', handler);
    document.removeEventListener('click', handler);
  };
  document.addEventListener('touchstart', handler, { once: true });
  document.addEventListener('mousedown', handler, { once: true });
  document.addEventListener('click', handler, { once: true });
}

initOnFirstGesture();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
