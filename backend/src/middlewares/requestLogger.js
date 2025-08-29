import { getClientIP, parseUserAgent } from '../utils/helpers.js';
import logger from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const ip = getClientIP(req);
  const userAgent = parseUserAgent(req.get('User-Agent') || '');

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip,
    userAgent: userAgent.full,
    isMobile: userAgent.isMobile,
    browser: userAgent.browser,
    timestamp: new Date().toISOString(),
    userId: req.user?.id || 'anonymous',
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function (body) {
    const duration = Date.now() - startTime;

    logger.info('Response sent', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip,
      userId: req.user?.id || 'anonymous',
      success: res.statusCode < 400,
    });

    return originalJson.call(this, body);
  };

  next();
};
