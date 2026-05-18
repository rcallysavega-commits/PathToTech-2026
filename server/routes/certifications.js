const express = require('express');
const router = express.Router();
const {
  extractCertFields,
  saveCertifications,
  getCertifications,
  updateCertifications,
  deleteCertification,
  uploadProof,
  getPendingCertifications,
  adminApproveCertification,
  adminRejectCertification,
  getAllCertificationsAdmin,
} = require('../controllers/certificationController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

// Student routes
router.post('/extract-fields', protect, extractCertFields);
router.post('/', protect, saveCertifications);
router.post('/upload-proof/:certId', protect, uploadProof);
router.get('/:userId', protect, getCertifications);
router.put('/:userId', protect, updateCertifications);
router.delete('/:id', protect, deleteCertification);

// Admin routes
router.get('/admin/pending', protect, adminOnly, getPendingCertifications);
router.get('/admin/all', protect, adminOnly, getAllCertificationsAdmin);
router.patch('/admin/:certId/approve', protect, adminOnly, adminApproveCertification);
router.patch('/admin/:certId/reject', protect, adminOnly, adminRejectCertification);

module.exports = router;
