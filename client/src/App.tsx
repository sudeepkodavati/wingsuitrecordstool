import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { EventDetailPage } from './pages/EventDetailPage';
import { EventFormPage } from './pages/EventFormPage';
import { EventsPage } from './pages/EventsPage';
import { RecordFormPage } from './pages/RecordFormPage';
import { SharePage } from './pages/SharePage';

/** Routes only; auth and data providers are supplied by main.tsx (or by tests). */
export function App() {
  return (
    <Routes>
      {/* Public participant view: no login. */}
      <Route path="share/:token" element={<SharePage />} />
      <Route element={<Layout />}>
        <Route index element={<EventsPage />} />
        <Route path="events/new" element={<EventFormPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="events/:id/edit" element={<EventFormPage />} />
        <Route path="events/:id/records/new" element={<RecordFormPage />} />
        <Route path="events/:id/records/:recordId/edit" element={<RecordFormPage />} />
        <Route
          path="*"
          element={<p className="text-slate-700">Page not found. <Link to="/" className="text-sky-700 underline">Go to events</Link></p>}
        />
      </Route>
    </Routes>
  );
}
