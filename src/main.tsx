import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { FloatingWidget } from './components/widget/FloatingWidget';
import './index.css';

const isWidget = window.location.hash === '#/widget';

if (isWidget) {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isWidget ? <FloatingWidget /> : <App />}</React.StrictMode>,
);
