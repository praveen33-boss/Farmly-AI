/**
 * Centralized error handler returning uniform JSON responses.
 * Never leaks stack traces or credentials in production.
 */
export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const isRetryable = status >= 500 || status === 429;

  // Mask any accidental secrets in error message
  const rawMessage = err.message || 'An internal server error occurred';
  const cleanMessage = rawMessage.replace(/([a-zA-Z0-9_-]{20,})/g, '***');

  console.error(`[Error] ${req.method} ${req.originalUrl} - ${status}: ${cleanMessage}`);

  res.status(status).json({
    detail: cleanMessage,
    source: err.source || 'upstream_or_server',
    retryable: isRetryable,
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    detail: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    source: 'routing',
    retryable: false,
  });
}
