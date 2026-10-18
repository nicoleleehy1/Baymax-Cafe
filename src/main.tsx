import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LookDev } from './render/LookDev';
import { controller } from './state/controller';
import { useApp } from './state/store';

// Inspection hook for the browser console and end-to-end checks:
//   __afterYou.controller.engine.metrics()  → live run metrics;  __afterYou.useApp.getState().model → learned weights
(globalThis as unknown as { __afterYou: unknown }).__afterYou = { controller, useApp };
import './styles.css';
import './ui/card-theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(location.search).has('lookdev') ? <LookDev /> : <App />}
  </StrictMode>,
);
