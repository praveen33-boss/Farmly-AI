import { app } from './app.js';
import { config, printConfigStatus } from './config.js';

const PORT = config.PORT || 8000;
const HOST = '0.0.0.0';

printConfigStatus();

const server = app.listen(PORT, HOST, () => {
  console.log(`[Server] Farmly Backend listening on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[Server] Process terminated');
  });
});
