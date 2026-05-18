const User = require('../models/User');
const Grade = require('../models/Grade');
const SurveyResponse = require('../models/SurveyResponse');
const PredictionResult = require('../models/PredictionResult');
const TechnicalSkill = require('../models/TechnicalSkill');
const SoftSkill = require('../models/SoftSkill');
const axios = require('axios');

const _rawML = (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const ML_URL = /^https?:\/\//i.test(_rawML) ? _rawML : `https://${_rawML}`;

const STATUS_TO_LEVEL = {
  'Highly Employable': 'High Employability',
  Employable: 'Moderate Employability',
  'Needs Improvement': 'Low Employability',
  'High Employability': 'High Employability',
  'Moderate Employability': 'Moderate Employability',
  'Low Employability': 'Low Employability',
};

const LEVEL_ORDER = ['High Employability', 'Moderate Employability', 'Low Employability'];

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toPercent = (value, min, max) => {
  if (!Number.isFinite(value) || max <= min) return 0;
  const bounded = Math.min(Math.max(value, min), max);
  return ((bounded - min) / (max - min)) * 100;
};

const computeOverallSkillsScore = (summary = {}) => {
  const surveyPct = toPercent(toNumber(summary.surveyAverage, 0), 0, 5);
  const technicalPct = toPercent(toNumber(summary.technicalSkillsCount, 0), 0, 40);
  const softPct = toPercent(toNumber(summary.softSkillsAverage, 0), 0, 5);
  const certPct = toPercent(toNumber(summary.certificationCount, 0), 0, 5);

  const weighted = (surveyPct * 0.35) + (technicalPct * 0.30) + (softPct * 0.25) + (certPct * 0.10);
  return Number(weighted.toFixed(2));
};

const normalizeLevel = (status) => STATUS_TO_LEVEL[status] || 'Low Employability';

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

const toTokenText = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
};

const deriveConfidenceScore = (level, scoreRaw, modelConfidenceRaw) => {
  const modelConfidence = Number(modelConfidenceRaw);
  if (Number.isFinite(modelConfidence)) return clamp(modelConfidence, 0, 1);

  const score = Number(scoreRaw);
  if (!Number.isFinite(score)) return 0.5;

  if (level === 'High Employability') {
    return clamp(0.5 + ((score - 75) / 25) * 0.5, 0, 1);
  }
  if (level === 'Low Employability') {
    return clamp(0.5 + ((50 - score) / 50) * 0.5, 0, 1);
  }

  const distanceToBoundary = Math.min(Math.abs(score - 50), Math.abs(75 - score));
  return clamp(0.45 + (distanceToBoundary / 25) * 0.4, 0, 1);
};

const buildConfidenceHistogram = (scores = []) => {
  const bins = [
    { bucket: '0.0-0.2', min: 0, max: 0.2, count: 0 },
    { bucket: '0.2-0.4', min: 0.2, max: 0.4, count: 0 },
    { bucket: '0.4-0.6', min: 0.4, max: 0.6, count: 0 },
    { bucket: '0.6-0.8', min: 0.6, max: 0.8, count: 0 },
    { bucket: '0.8-1.0', min: 0.8, max: 1.0000001, count: 0 },
  ];

  scores.forEach((s) => {
    const score = clamp(Number(s), 0, 1);
    const bin = bins.find((b) => score >= b.min && score < b.max);
    if (bin) bin.count += 1;
  });

  return bins.map(({ bucket, count }) => ({ bucket, count }));
};

const averageFeatureComparison = (rows = [], level) => {
  if (!rows.length) {
    return {
      level,
      averageGrade: 0,
      technicalSkillsScore: 0,
      softSkillsScore: 0,
      certificationCount: 0,
      surveyScore: 0,
    };
  }

  const sum = rows.reduce((acc, r) => {
    acc.averageGrade += toNumber(r.gwa, 0);
    acc.technicalSkillsScore += toNumber(r.technicalSkillsCount, 0);
    acc.softSkillsScore += toNumber(r.softSkillsAverage, 0);
    acc.certificationCount += toNumber(r.certificationCount, 0);
    acc.surveyScore += toNumber(r.surveyAverage, 0);
    return acc;
  }, {
    averageGrade: 0,
    technicalSkillsScore: 0,
    softSkillsScore: 0,
    certificationCount: 0,
    surveyScore: 0,
  });

  return {
    level,
    averageGrade: Number((sum.averageGrade / rows.length).toFixed(2)),
    technicalSkillsScore: Number((sum.technicalSkillsScore / rows.length).toFixed(2)),
    softSkillsScore: Number((sum.softSkillsScore / rows.length).toFixed(2)),
    certificationCount: Number((sum.certificationCount / rows.length).toFixed(2)),
    surveyScore: Number((sum.surveyScore / rows.length).toFixed(2)),
  };
};

// GET /api/analytics/overview
const getOverview = async (req, res) => {
  try {
    const [totalStudents, totalGradeRecords, totalSurveyResponses, totalPredictions, genderAgg] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Grade.countDocuments(),
      SurveyResponse.countDocuments({ completed: true }),
      PredictionResult.countDocuments(),
      User.aggregate([
        { $match: { role: 'student' } },
        { $group: { _id: { $cond: [{ $in: ['$gender', ['Male', 'Female']] }, '$gender', 'Not Specified'] }, count: { $sum: 1 } } },
      ]),
    ]);

    const genderDistribution = genderAgg.map((g) => ({ gender: g._id, count: g.count }));

    return res.status(200).json({
      success: true,
      data: { totalStudents, totalGradeRecords, totalSurveyResponses, totalPredictions, genderDistribution },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/analytics/employability-status
const getEmployabilityStatus = async (req, res) => {
  try {
    const results = await PredictionResult.aggregate([
      { $group: { _id: '$employabilityStatus', count: { $sum: 1 } } },
    ]);
    const data = results.map((r) => ({ status: r._id, count: r.count }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/analytics/skills-gap
const getSkillsGap = async (req, res) => {
  try {
    const allSkills = await TechnicalSkill.find({ completed: true });
    const skillCount = {};
    allSkills.forEach((ts) => {
      ts.skills.forEach((s) => {
        skillCount[s.skillName] = (skillCount[s.skillName] || 0) + 1;
      });
    });
    const data = Object.entries(skillCount)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/analytics/career-clusters
const getCareerClusters = async (req, res) => {
  try {
    const results = await PredictionResult.aggregate([
      { $group: { _id: '$clusterLabel', count: { $sum: 1 } } },
    ]);
    const data = results.map((r) => ({ cluster: r._id, count: r.count }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/analytics/recent-activity
const getRecentActivity = async (req, res) => {
  try {
    const recentStudents = await User.find({ role: 'student' }).sort({ createdAt: -1 }).limit(5).select('fullName email studentNumber createdAt');
    const recentPredictions = await PredictionResult.find()
      .populate('userId', 'fullName studentNumber')
      .sort({ createdAt: -1 })
      .limit(5);
    return res.status(200).json({ success: true, recentStudents, recentPredictions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/analytics/clustering-insights
const getClusteringInsights = async (req, res) => {
  try {
    const predictions = await PredictionResult.find()
      .select('studentNumber employabilityStatus inputSummary')
      .lean();

    const levelBuckets = {
      'High Employability': [],
      'Moderate Employability': [],
      'Low Employability': [],
    };

    const scatterPoints = predictions.map((item) => {
      const level = STATUS_TO_LEVEL[item.employabilityStatus] || 'Low Employability';
      const averageGrade = Number(toNumber(item.inputSummary?.gwa, 0).toFixed(2));
      const overallSkillsScore = computeOverallSkillsScore(item.inputSummary);

      levelBuckets[level].push(item.inputSummary || {});

      return {
        studentNumber: item.studentNumber,
        level,
        averageGrade,
        overallSkillsScore,
      };
    });

    const distribution = LEVEL_ORDER.map((level) => ({
      level,
      count: levelBuckets[level].length,
    }));

    const totalStudents = predictions.length || 1;
    const pieDistribution = distribution.map((row) => ({
      level: row.level,
      count: row.count,
      percentage: Number(((row.count / totalStudents) * 100).toFixed(2)),
    }));

    const featureComparison = LEVEL_ORDER.map((level) => {
      const rows = levelBuckets[level];
      if (!rows.length) {
        return {
          level,
          averageGrade: 0,
          technicalSkillsScore: 0,
          softSkillsScore: 0,
          certificationCount: 0,
          surveyScore: 0,
        };
      }

      const sum = rows.reduce((acc, r) => {
        acc.averageGrade += toNumber(r.gwa, 0);
        acc.technicalSkillsScore += toNumber(r.technicalSkillsCount, 0);
        acc.softSkillsScore += toNumber(r.softSkillsAverage, 0);
        acc.certificationCount += toNumber(r.certificationCount, 0);
        acc.surveyScore += toNumber(r.surveyAverage, 0);
        return acc;
      }, {
        averageGrade: 0,
        technicalSkillsScore: 0,
        softSkillsScore: 0,
        certificationCount: 0,
        surveyScore: 0,
      });

      return {
        level,
        averageGrade: Number((sum.averageGrade / rows.length).toFixed(2)),
        technicalSkillsScore: Number((sum.technicalSkillsScore / rows.length).toFixed(2)),
        softSkillsScore: Number((sum.softSkillsScore / rows.length).toFixed(2)),
        certificationCount: Number((sum.certificationCount / rows.length).toFixed(2)),
        surveyScore: Number((sum.surveyScore / rows.length).toFixed(2)),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        scatterPoints,
        distribution,
        pieDistribution,
        featureComparison,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/analytics/model-insights
const getModelInsights = async (req, res) => {
  try {
    const [predictions, technicalSkills, studentUsers, gmmVizRes] = await Promise.all([
      PredictionResult.find()
        .select('userId studentNumber employabilityStatus employabilityScore inputSummary jobRecommendations clusterConfidence')
        .lean(),
      TechnicalSkill.find({ completed: true }).select('userId skills').lean(),
      User.find({ role: 'student' }).select('_id gender').lean(),
      axios.get(`${ML_URL}/gmm-visualization`, { timeout: 60000 }).catch(() => null),
    ]);

    const gmmVisualization = gmmVizRes?.data || { points: [], ellipses: [], explainedVariance: [0, 0] };

    const userGenderMap = new Map(studentUsers.map((u) => [String(u._id), (u.gender && ['Male', 'Female'].includes(u.gender)) ? u.gender : 'Not Specified']));

    const levelBuckets = {
      'High Employability': [],
      'Moderate Employability': [],
      'Low Employability': [],
    };

    const scatterPoints = [];
    const confidenceScores = [];
    const careerCounts = {};

    predictions.forEach((item) => {
      const level = normalizeLevel(item.employabilityStatus);
      const summary = item.inputSummary || {};

      levelBuckets[level].push(summary);

      const confidence = deriveConfidenceScore(level, item.employabilityScore, item.clusterConfidence);
      confidenceScores.push(confidence);

      scatterPoints.push({
        studentNumber: item.studentNumber,
        level,
        averageGrade: Number(toNumber(summary.gwa, 0).toFixed(2)),
        overallSkillsScore: computeOverallSkillsScore(summary),
      });

      (item.jobRecommendations || []).forEach((job) => {
        if (!job) return;
        careerCounts[job] = (careerCounts[job] || 0) + 1;
      });
    });

    const genderByLevelMap = {};
    predictions.forEach((item) => {
      const level = normalizeLevel(item.employabilityStatus);
      const gender = userGenderMap.get(String(item.userId)) || 'Not Specified';
      if (!genderByLevelMap[level]) genderByLevelMap[level] = {};
      genderByLevelMap[level][gender] = (genderByLevelMap[level][gender] || 0) + 1;
    });

    const genderByLevel = LEVEL_ORDER.map((level) => ({
      level,
      Male: genderByLevelMap[level]?.Male || 0,
      Female: genderByLevelMap[level]?.Female || 0,
      'Not Specified': genderByLevelMap[level]?.['Not Specified'] || 0,
    }));

    const clusterDistribution = LEVEL_ORDER.map((level) => ({
      level,
      count: levelBuckets[level].length,
    }));

    const total = predictions.length || 1;
    const clusterPie = clusterDistribution.map((row) => ({
      ...row,
      percentage: Number(((row.count / total) * 100).toFixed(2)),
    }));

    const featureComparison = LEVEL_ORDER.map((level) => averageFeatureComparison(levelBuckets[level], level));
    const confidenceHistogram = buildConfidenceHistogram(confidenceScores);

    const topRecommendedCareers = Object.entries(careerCounts)
      .map(([career, count]) => ({ career, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const predictionLevelByUser = new Map(
      predictions.map((p) => [String(p.userId), normalizeLevel(p.employabilityStatus)])
    );

    let totalHigh = 0;
    let totalNonHigh = 0;
    const highSkillCounts = {};
    const nonHighSkillCounts = {};

    technicalSkills.forEach((ts) => {
      const level = predictionLevelByUser.get(String(ts.userId));
      if (!level) return;

      const uniqueSkills = new Set((ts.skills || []).map((s) => s.skillName).filter(Boolean));
      if (level === 'High Employability') {
        totalHigh += 1;
        uniqueSkills.forEach((skill) => {
          highSkillCounts[skill] = (highSkillCounts[skill] || 0) + 1;
        });
      } else {
        totalNonHigh += 1;
        uniqueSkills.forEach((skill) => {
          nonHighSkillCounts[skill] = (nonHighSkillCounts[skill] || 0) + 1;
        });
      }
    });

    const allSkills = new Set([...Object.keys(highSkillCounts), ...Object.keys(nonHighSkillCounts)]);
    const skillGapAnalysis = Array.from(allSkills)
      .map((skill) => {
        const highRate = totalHigh ? (highSkillCounts[skill] || 0) / totalHigh : 0;
        const nonHighRate = totalNonHigh ? (nonHighSkillCounts[skill] || 0) / totalNonHigh : 0;
        const gap = highRate - nonHighRate;

        return {
          skill,
          highRate: Number((highRate * 100).toFixed(2)),
          nonHighRate: Number((nonHighRate * 100).toFixed(2)),
          gapPercent: Number((gap * 100).toFixed(2)),
        };
      })
      .filter((row) => row.gapPercent > 0)
      .sort((a, b) => b.gapPercent - a.gapPercent)
      .slice(0, 12);

    let associationRules = [];
    let supportConfidenceScatter = [];

    if (predictions.length > 0) {
      try {
        const patternRes = await axios.post(`${ML_URL}/patterns/discover`, {
          minSupport: 0.15,
          minConfidence: 0.6,
          maxItemsetSize: 3,
          topK: 30,
        }, { timeout: 30000 });

        const rules = Array.isArray(patternRes.data?.associationRules) ? patternRes.data.associationRules : [];
        associationRules = rules.map((r) => ({
          antecedent: toTokenText(r.antecedent),
          consequent: toTokenText(r.consequent),
          support: Number(toNumber(r.support, 0).toFixed(4)),
          confidence: Number(toNumber(r.confidence, 0).toFixed(4)),
          lift: Number(toNumber(r.lift, 0).toFixed(4)),
        }));

        supportConfidenceScatter = associationRules.map((r, idx) => ({
          id: idx + 1,
          support: r.support,
          confidence: r.confidence,
          lift: r.lift,
        }));
      } catch (patternErr) {
        console.error('[Analytics] Pattern discovery failed:', patternErr?.response?.data || patternErr?.message || patternErr);
        associationRules = [];
        supportConfidenceScatter = [];
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        clusterDistribution,
        clusterPie,
        scatterPoints,
        confidenceHistogram,
        featureComparison,
        associationRules,
        supportConfidenceScatter,
        topRecommendedCareers,
        skillGapAnalysis,
        genderByLevel,
        gmmVisualization,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get detailed model visualizations: GMM, AIC/BIC, Association Rules, Confusion Matrix, ROC Curve
const getModelVisualizations = async (req, res) => {
  try {
    // Fetch GMM visualization data from ML service
    let gmmVisualization = { points: [], ellipses: [], explainedVariance: [0, 0] };
    try {
      const gmmRes = await axios.get(`${ML_URL}/gmm-visualization`, { timeout: 60000 });
      if (gmmRes.data?.points) {
        gmmVisualization = {
          points: Array.isArray(gmmRes.data.points) ? gmmRes.data.points : [],
          ellipses: Array.isArray(gmmRes.data.ellipses) ? gmmRes.data.ellipses : [],
          explainedVariance: Array.isArray(gmmRes.data.explainedVariance) ? gmmRes.data.explainedVariance : [0, 0],
        };
      }
    } catch (_) {
      // ML service not available, continue with empty data
    }

    // Fetch AIC/BIC data from ML service
    let aicBicData = [];
    try {
      const modelRes = await axios.get(`${ML_URL}/model-summary`, { timeout: 60000 });
      const selectionCandidates = Array.isArray(modelRes.data?.gmm_selection?.candidates)
        ? modelRes.data.gmm_selection.candidates
        : [];

      if (selectionCandidates.length > 0) {
        aicBicData = selectionCandidates
          .map((item) => ({
            k: Number(item?.k ?? item?.n_components),
            aic: Number(item?.aic),
            bic: Number(item?.bic),
          }))
          .filter((item) => Number.isFinite(item.k) && Number.isFinite(item.aic) && Number.isFinite(item.bic))
          .sort((a, b) => a.k - b.k);
      }
    } catch (_) {
      // Model summary not available, continue with empty data
    }

    // Fetch association rules from model insights
    let associationRulesDiagram = { nodes: [], edges: [] };
    try {
      const rulesRes = await axios.post(`${ML_URL}/patterns/discover`, {
        minSupport: 0.2,
        minConfidence: 0.6,
        maxItemsetSize: 3,
        topK: 20,
      }, { timeout: 90000 });
      if (Array.isArray(rulesRes.data?.associationRules)) {
        const rules = rulesRes.data.associationRules;
        // Transform rules into nodes for visualization
        associationRulesDiagram.nodes = rules.slice(0, 20).map((rule, idx) => ({
          id: `rule_${idx}`,
          label: `${Array.isArray(rule.antecedent) ? rule.antecedent.join(', ') : 'Rule'} → ${rule.consequent || 'Outcome'}`,
          support: Number(rule.support) || 0,
          confidence: Number(rule.confidence) || 0,
          lift: Number(rule.lift) || 1,
        }));
      }
    } catch (_) {
      // No association rules available
    }

    let confusionMatrixData = {
      matrix: [],
      labels: ['Employed', 'Not Employed'],
      accuracy: null,
      precision: null,
      recall: null,
      f1Score: null,
      available: false,
      reason: 'Unavailable: model performance data could not be loaded.',
    };
    let rocCurve = [];
    let rocMeta = {
      available: false,
      reason: 'Unavailable: model performance data could not be loaded.',
    };
    let performanceEvaluation = {
      protocol: 'K-Fold Cross-Validation',
      folds: 0,
      rmse: null,
      stabilityIndex: null,
      averageCvNll: { mean: null, std: null },
    };

    try {
      const perfRes = await axios.get(`${ML_URL}/model-performance`, { timeout: 90000 });
      const perf = perfRes.data || {};

      if (perf?.available) {
        confusionMatrixData = {
          ...(perf.confusionMatrix || confusionMatrixData),
          available: true,
          reason: '',
        };
        rocCurve = Array.isArray(perf.rocCurve) ? perf.rocCurve : [];
        rocMeta = perf.rocMeta || { available: rocCurve.length > 0, reason: '' };
        performanceEvaluation = perf.evaluation || performanceEvaluation;
      } else {
        const reason = perf?.reason || 'Unavailable: model performance data is not ready.';
        confusionMatrixData = {
          ...confusionMatrixData,
          reason,
        };
        rocMeta = {
          available: false,
          reason,
        };
      }
    } catch (_) {
      // Keep explicit unavailable payload when ML endpoint is not reachable.
    }

    return res.json({
      success: true,
      data: {
        gmmVisualization,
        aicBicData,
        associationRulesDiagram,
        confusionMatrix: confusionMatrixData,
        rocCurve,
        rocMeta,
        performanceEvaluation,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getOverview,
  getEmployabilityStatus,
  getSkillsGap,
  getCareerClusters,
  getRecentActivity,
  getClusteringInsights,
  getModelInsights,
  getModelVisualizations,
};
