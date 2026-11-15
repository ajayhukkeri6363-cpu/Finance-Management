import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { getSessionSecret } from './server/auth.ts';
import { createDataStore, type IDataStore } from './server/dataStore.ts';
import { createApiRouter } from './server/routes.ts';

async function startServer() {
  let store: IDataStore | null = null;
  let productionConfigError: string | null = null;

  try {
    // Validate session secret early (throws in production if missing)
    getSessionSecret();
    // Initialize MySQL 8 store or local-dev fictional demo store (disallowed in production)
    store = await createDataStore();
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      throw err;
    }
    // Never silently switch production to in-memory/demo storage.
    // Keep the HTTP server listening so deployment health checks pass and admins see setup instructions.
    productionConfigError =
      err instanceof Error
        ? err.message
        : 'Production MySQL 8 database and SESSION_SECRET must be configured.';
    console.error('[GovTrack AI Production Startup Error]', productionConfigError);
  }

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  if (store) {
    app.use('/api', createApiRouter(store));
  } else {
    app.get('/api/health', (_req, res) => {
      res.status(503).json({
        ok: false,
        mode: 'mysql-unconfigured',
        error: productionConfigError,
      });
    });
    app.use('/api', (_req, res) => {
      res.status(503).json({
        error:
          'Production database is not configured or unreachable. Set valid MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, and SESSION_SECRET environment variables and run npm run db:migrate.',
        code: 'PRODUCTION_CONFIG_REQUIRED',
      });
    });
  }

  const port = Number(process.env.PORT || 3000);

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(
      `GovTrack AI server listening on http://0.0.0.0:${port} (storage mode: ${
        store ? store.mode : 'mysql-unconfigured'
      })`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start GovTrack AI server:', err);
  process.exit(1);
});
