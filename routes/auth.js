const express = require('express');
const rateLimit = require('express-rate-limit');
const userService = require('../services/userService');
const { signToken } = require('../utils/jwt');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email_and_password_required' });
    }

    const user = await userService.findByEmail(email);
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const valid = await userService.verifyPassword(user, password);
    if (!valid) return res.status(401).json({ error: 'invalid_credentials' });

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
    });
  })
);

router.get(
  '/me',
  auth,
  asyncHandler(async (req, res) => {
    const user = await userService.findById(req.user.sub);
    if (!user) return res.status(404).json({ error: 'not_found' });
    res.json({ id: user.id, email: user.email, fullName: user.full_name, role: user.role });
  })
);

module.exports = router;
