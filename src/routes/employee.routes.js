import express from 'express';
import {
  getAllEmployees,
  createEmployee,
  verifyEmployee,
  updateEmployeeStatus,
  deleteEmployee,
  resendVerification
} from '../controllers/employee.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public route for employee verification
router.post('/verify', verifyEmployee);

// Admin-only routes
router.get('/', requireAdmin, getAllEmployees);
router.post('/', requireAdmin, createEmployee);
router.put('/:id/status', requireAdmin, updateEmployeeStatus);
router.delete('/:id', requireAdmin, deleteEmployee);
router.post('/:id/resend-verification', requireAdmin, resendVerification);

export default router;
