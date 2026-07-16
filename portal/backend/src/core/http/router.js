import { notFound } from './response.js';
import { writeResponse } from './write-response.js';

export function createRouter() {
  const routes = [];

  function add(method, path, handler, options = {}) {
    routes.push({ method, path, handler, options });
  }

  return {
    get: (path, handler, options) => add('GET', path, handler, options),
    post: (path, handler, options) => add('POST', path, handler, options),
    addRoutes: nextRoutes => nextRoutes.forEach(route => add(route.method, route.path, route.handler, route.options)),
    async handle(req, res) {
      const url = new URL(req.url, 'http://localhost');
      const route = routes.find(item => item.method === req.method && item.path === url.pathname);
      const result = route ? await route.handler(req, { url }) : notFound(req.requestId);

      writeResponse(req, res, result);
    }
  };
}
