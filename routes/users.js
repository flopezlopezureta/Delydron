const express = require('express');
const userService = require('../services/userService');
const { auth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
const VALID_ROLES = ['admin', 'operator'];

router.get(
  '/',
  auth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    res.json(await userService.list());
  })
);

router.post(
  '/',
  auth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { email, password, fullName, role } = req.body || {};
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'email_password_fullname_required' });
    }
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'invalid_role' });
    }

    try {
      const user = await userService.createUser({ email, password, fullName, role });
      res.status(201).json(user);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'email_already_in_use' });
      throw err;
    }
  })
);

router.patch(
  '/:id',
  auth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (req.body?.role && !VALID_ROLES.includes(req.body.role)) {
      return res.status(400).json({ error: 'invalid_role' });
    }
    try {
      const user = await userService.update(req.params.id, req.body || {});
      if (!user) return res.status(404).json({ error: 'not_found' });
      res.json(user);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'email_already_in_use' });
      throw err;
    }
  })
);

router.delete(
  '/:id',
  auth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ error: 'cannot_deactivate_self' });
    }
    await userService.remove(req.params.id);
    res.status(204).end();
  })
);

module.exports = router;
