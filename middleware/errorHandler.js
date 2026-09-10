function errorHandler(err, req, res, next) {
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.publicMessage || 'internal_error' });
}

module.exports = { errorHandler };
