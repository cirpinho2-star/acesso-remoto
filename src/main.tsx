import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Buffer } from 'buffer';
import process from 'process';

if (typeof window !== 'undefined') {
  (window as any).global = window;
  (window as any).Buffer = Buffer;
  (window as any).process = process;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
