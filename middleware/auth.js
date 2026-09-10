const { verifyToken } = require('../utils/jwt');

// EventSource can't set request headers, so SSE clients pass the token as
// ?token=... instead of an Authorization header. Accept either.
function auth(req, res, next) {
  const header = req.headers.authorization;
  const bearer = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = bearer || req.query.token;

  if (!token) return res.status(401).json({ error: 'missing_token' });

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    res.status(401).json({ error: 'invalid_token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

module.exports = { auth, requireRole };
