const express = require('express');
const router = express.Router();
const {
	getOverview,
	getEmployabilityStatus,
	getSkillsGap,
	getCareerClusters,
	getRecentActivity,
	getClusteringInsights,
	getModelInsights,
	getModelVisualizations,
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');

router.get('/overview', protect, adminOnly, getOverview);
router.get('/employability-status', protect, adminOnly, getEmployabilityStatus);
router.get('/skills-gap', protect, adminOnly, getSkillsGap);
router.get('/career-clusters', protect, adminOnly, getCareerClusters);
router.get('/recent-activity', protect, adminOnly, getRecentActivity);
router.get('/clustering-insights', protect, adminOnly, getClusteringInsights);
router.get('/model-insights', protect, adminOnly, getModelInsights);
router.get('/model-visualizations', protect, adminOnly, getModelVisualizations);

module.exports = router;
