const express = require('express');
const userService = require('../services/userService');
const auditService = require('../services/auditService');
const { auth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
const { VALID_ROLES } = userService;

// super_admin is a protected tier: invisible to (and unmanageable by) plain
// admins. Everything else (admin/operator/technician/auxiliary) is fair
// game for both admin and super_admin to manage.
function canSeeRole(viewerRole, targetRole) {
  return targetRole !== 'super_admin' || viewerRole === 'super_admin';
}

router.get(
  '/',
  auth,
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    res.json(await userService.list(req.user.role));
  })
);

router.post(
  '/',
  auth,
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { email, password, fullName, role } = req.body || {};
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'email_password_fullname_required' });
    }
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'invalid_role' });
    }
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    try {
      const user = await userService.createUser({ email, password, fullName, role });
      await auditService.log({
        actorUserId: req.user.sub,
        actorEmail: req.user.email,
        action: 'user.create',
        entityType: 'user',
        entityId: user.id,
        detail: { email: user.email, role: user.role },
      });
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
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    if (req.body?.role && !VALID_ROLES.includes(req.body.role)) {
      return res.status(400).json({ error: 'invalid_role' });
    }
    if (req.body?.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const existing = await userService.findById(req.params.id);
    if (!existing || !canSeeRole(req.user.role, existing.role)) {
      return res.status(404).json({ error: 'not_found' });
    }

    try {
      const user = await userService.update(req.params.id, req.body || {});
      if (!user) return res.status(404).json({ error: 'not_found' });
      await auditService.log({
        actorUserId: req.user.sub,
        actorEmail: req.user.email,
        action: req.body?.role && req.body.role !== existing.role ? 'user.role_change' : 'user.update',
        entityType: 'user',
        entityId: user.id,
        detail: {
          email: user.email,
          ...(req.body?.role ? { fromRole: existing.role, toRole: req.body.role } : {}),
          ...(req.body?.isActive !== undefined ? { isActive: req.body.isActive } : {}),
        },
      });
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
  requireRole('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ error: 'cannot_deactivate_self' });
    }

    const existing = await userService.findById(req.params.id);
    if (!existing || !canSeeRole(req.user.role, existing.role)) {
      return res.status(404).json({ error: 'not_found' });
    }

    await userService.remove(req.params.id);
    await auditService.log({
      actorUserId: req.user.sub,
      actorEmail: req.user.email,
      action: 'user.deactivate',
      entityType: 'user',
      entityId: existing.id,
      detail: { email: existing.email },
    });
    res.status(204).end();
  })
);

module.exports = router;
