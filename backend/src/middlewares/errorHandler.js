import ApiError from '../utils/ApiError.js';

// Global error handling middleware
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error details
  console.error('Error Details:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    userId: req.user?.id || 'anonymous',
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid resource ID format';
    error = new ApiError(400, message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = Object.values(err.keyValue)[0];
    const message = `${
      field.charAt(0).toUpperCase() + field.slice(1)
    } '${value}' already exists`;
    error = new ApiError(409, message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    error = new ApiError(400, 'Validation failed', messages);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Token has expired');
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new ApiError(400, 'File size too large');
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error = new ApiError(400, 'Too many files uploaded');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new ApiError(400, 'Unexpected file field');
  }

  // CORS errors
  if (err.message && err.message.includes('CORS')) {
    error = new ApiError(403, 'CORS policy violation');
  }

  // Rate limiting errors
  if (err.status === 429) {
    error = new ApiError(429, 'Too many requests, please try again later');
  }

  // Database connection errors
  if (err.name === 'MongoNetworkError') {
    error = new ApiError(503, 'Database connection failed');
  }

  if (err.name === 'MongoTimeoutError') {
    error = new ApiError(503, 'Database operation timeout');
  }

  // Default to 500 server error
  if (!error.statusCode) {
    error = new ApiError(500, 'Internal server error');
  }

  // Prepare error response
  const errorResponse = {
    success: false,
    error: {
      message: error.message,
      ...(error.errors && { details: error.errors }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  };

  // Add request ID for tracking (if available)
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  // Send error response
  res.status(error.statusCode || 500).json(errorResponse);
};

// Async error wrapper (for development)
export const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 Not Found handler
export const notFound = (req, res, next) => {
  const error = new ApiError(404, `Route ${req.originalUrl} not found`);
  next(error);
};
