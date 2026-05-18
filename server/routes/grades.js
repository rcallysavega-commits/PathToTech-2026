const express = require('express');
const router = express.Router();
const {
	upload,
	uploadGrades,
	getGradesByStudent,
	getAllGrades,
	checkGradesComplete,
	getGradeUploads,
	setGradeUploadStatus,
	deleteGradeUpload,
} = require('../controllers/gradeController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

router.post('/upload', protect, adminOnly, upload.single('file'), uploadGrades);
router.get('/uploads', protect, adminOnly, getGradeUploads);
router.put('/uploads/:uploadId/status', protect, adminOnly, setGradeUploadStatus);
router.delete('/uploads/:uploadId', protect, adminOnly, deleteGradeUpload);
router.get('/check-complete/:studentNumber', protect, checkGradesComplete);
router.get('/', protect, adminOnly, getAllGrades);
router.get('/:studentNumber', protect, getGradesByStudent);

module.exports = router;
