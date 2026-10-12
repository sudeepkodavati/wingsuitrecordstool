import path from 'path';
import { createApp } from './app';

const port = Number(process.env.PORT) || 3001;
const staticDir = process.env.NODE_ENV === 'production' ? path.resolve(__dirname, '../../client/dist') : undefined;

createApp({ staticDir }).listen(port, () => {
  console.log(`Wingsuit Records server listening on http://localhost:${port}`);
});
