import express, { type ErrorRequestHandler } from 'express';
import fs from 'fs';
import path from 'path';
import { buildRecordPdf, buildRosterPdf, recordPdfTitle } from './pdf';
import { eventSchema, recordPdfSchema } from './schema';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';
}

export function createApp(options: { staticDir?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Storage lives in the browser for this release, so the client posts the full event to render.
  app.post('/api/events/pdf', async (req, res, next) => {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid event data', issues: parsed.error.issues });
      return;
    }
    try {
      const pdf = await buildRosterPdf(parsed.data);
      res
        .status(200)
        .type('application/pdf')
        .setHeader('Content-Disposition', `attachment; filename="${slugify(parsed.data.name)}-roster.pdf"`)
        .send(pdf);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/records/pdf', async (req, res, next) => {
    const parsed = recordPdfSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid record data', issues: parsed.error.issues });
      return;
    }
    try {
      const { event, record } = parsed.data;
      const pdf = await buildRecordPdf(event, record);
      res
        .status(200)
        .type('application/pdf')
        .setHeader('Content-Disposition', `attachment; filename="${slugify(recordPdfTitle(event, record))}.pdf"`)
        .send(pdf);
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // In production, serve the built React app with SPA fallback.
  const { staticDir } = options;
  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('*', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Malformed JSON' });
      return;
    }
    if (err?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Event data is too large' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(onError);

  return app;
}
