import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LookDev } from './render/LookDev';
import './styles.css';
import './ui/card-theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(location.search).has('lookdev') ? <LookDev /> : <App />}
  </StrictMode>,
);
