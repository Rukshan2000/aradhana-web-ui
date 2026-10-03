import 'dotenv/config';

/** @type {import('knex').Knex.Config} */
const config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // The portal's datetime-local input sends wall-clock times with no
    // offset; read them as Sri Lankan time, not the server's UTC.
    options: '-c TimeZone=Asia/Colombo',
  },
  pool: { min: 0, max: 10 },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
};

export default config;
