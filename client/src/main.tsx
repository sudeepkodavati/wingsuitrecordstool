import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { createSupabaseStore } from './data/supabaseStore';
import { isSupabaseConfigured } from './lib/supabase';
import { NotConfigured } from './pages/NotConfigured';
import { SupabaseAuthProvider } from './state/AuthContext';
import { EventsProvider } from './state/EventsContext';
import './index.css';

const store = isSupabaseConfigured ? createSupabaseStore() : null;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      {store ? (
        <SupabaseAuthProvider>
          <EventsProvider store={store}>
            <App />
          </EventsProvider>
        </SupabaseAuthProvider>
      ) : (
        <NotConfigured />
      )}
    </BrowserRouter>
  </React.StrictMode>,
);
