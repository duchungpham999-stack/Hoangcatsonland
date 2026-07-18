import { notFound } from './response.js';
import { writeResponse } from './write-response.js';

export function createRouter() {
  const routes = [];

  function add(method, path, handler, options = {}) {
    routes.push({ method, path, handler, options, matcher: createMatcher(path) });
  }

  return {
    get: (path, handler, options) => add('GET', path, handler, options),
    post: (path, handler, options) => add('POST', path, handler, options),
    patch: (path, handler, options) => add('PATCH', path, handler, options),
    addRoutes: nextRoutes => nextRoutes.forEach(route => add(route.method, route.path, route.handler, route.options)),
    async handle(req, res) {
      const url = new URL(req.url, 'http://localhost');
      const match = findRoute(routes, req.method, url.pathname);
      if (match) req.params = match.params;
      const result = match ? await match.route.handler(req, { url }) : notFound(req.requestId);

      writeResponse(req, res, result);
    }
  };
}

function findRoute(routes, method, pathname) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = route.matcher(pathname);
    if (params) return { route, params };
  }
  return null;
}

function createMatcher(path) {
  const routeParts = path.split('/').filter(Boolean);
  const paramNames = routeParts
    .filter(part => part.startsWith(':'))
    .map(part => part.slice(1));

  if (paramNames.length === 0) {
    return pathname => (pathname === path ? {} : null);
  }

  return pathname => {
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length !== routeParts.length) return null;

    const params = {};
    for (let index = 0; index < routeParts.length; index += 1) {
      const routePart = routeParts[index];
      const pathPart = pathParts[index];
      if (routePart.startsWith(':')) {
        params[routePart.slice(1)] = decodeURIComponent(pathPart);
        continue;
      }
      if (routePart !== pathPart) return null;
    }
    return params;
  };
}
