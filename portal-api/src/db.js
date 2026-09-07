import knexFactory from 'knex';
import config from '../knexfile.js';

export const db = knexFactory(config);

// The database is reached through scripts/tunnel.sh. If the tunnel is not up,
// pool errors arrive as unhandled rejections and take the process down mid-
// request; log them instead so the API stays alive and /health reports it.
db.on('query-error', (err) => console.error('DB query error:', err.message));
