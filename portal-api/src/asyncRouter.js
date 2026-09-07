import { Router } from 'express';

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all', 'use'];

/**
 * Express 4 does not catch rejections from async handlers: one failed query
 * (a dropped SSH tunnel, say) becomes an unhandled rejection and takes the
 * whole process down. This returns a normal Router whose handlers are wrapped
 * so rejections go to next(err) and land in the error middleware instead.
 */
export function asyncRouter() {
  const router = Router();
  for (const method of METHODS) {
    const original = router[method].bind(router);
    router[method] = (...args) =>
      original(...args.map((arg) =>
        typeof arg === 'function' && arg.length < 4
          ? (req, res, next) => Promise.resolve(arg(req, res, next)).catch(next)
          : arg));
  }
  return router;
}
