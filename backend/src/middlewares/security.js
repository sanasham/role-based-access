import helmet from 'helmet';
import hpp from 'hpp';
import xss from 'xss';

/**
 * Custom NoSQL Injection sanitizer
 * - Replaces dangerous MongoDB operators ($, .) with "_"
 * - Works with req.body, req.params, and req.query (Express 5 safe)
 */
function sanitizeObject(obj) {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj).replace(/\$|\./g, '_'));
}

export const securityMiddleware = (app) => {
  // ✅ Secure HTTP headers with custom CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // ✅ Prevent HTTP Parameter Pollution
  app.use(hpp());

  // ✅ Sanitize input against XSS
  app.use(xss());

  // ✅ Custom NoSQL Injection protection
  app.use((req, res, next) => {
    if (req.body) req.body = sanitizeObject(req.body);
    if (req.params) req.params = sanitizeObject(req.params);
    if (req.query) req.sanitizedQuery = sanitizeObject(req.query); // Use req.sanitizedQuery instead of req.query
    next();
  });
};
