const axios = require('axios');
const User = require('../models/User');
const Grade = require('../models/Grade');
const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');
const TechnicalSkill = require('../models/TechnicalSkill');
const SoftSkill = require('../models/SoftSkill');
const Certification = require('../models/Certification');
const PredictionResult = require('../models/PredictionResult');
const GradeUpload = require('../models/GradeUpload');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const normalizeCategoryKey = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const canonicalSurveyCategory = (raw = '') => {
  const key = normalizeCategoryKey(raw);
  if (!key) return '';

  const contains = (token) => key.includes(token);

  if (contains('professional_ethics')) return 'professional_ethics';
  if (contains('scientific_spirit')) return 'scientific_spirit';
  if (contains('humanistic_quality')) return 'humanistic_quality';
  if (contains('computer_cognition')) return 'computer_cognition';
  if (contains('software_design')) return 'software_design';
  if (contains('system_usage')) return 'system_usage';
  if (contains('sustainable_development')) return 'sustainable_development';
  if (contains('team_capacity')) return 'team_capacity';
  if (contains('job_application')) return 'job_application';

  return key;
};

const normalizeSurveyScores = async (surveyResponse) => {
  const byCategory = {};

  // Prefer precomputed category scores if present and valid.
  (surveyResponse.categoryScores || []).forEach((cs) => {
    const category = canonicalSurveyCategory(cs.category || '');
    const avg = Number(cs.average);
    if (!category || !Number.isFinite(avg) || avg <= 0) return;
    byCategory[category] = avg;
  });

  // Fallback: recompute from raw answers + survey section categories.
  if (Object.keys(byCategory).length === 0 && Array.isArray(surveyResponse.answers) && surveyResponse.answers.length) {
    const survey = await Survey.findById(surveyResponse.surveyId).select('sections.category').lean();
    const tmp = {};
    surveyResponse.answers.forEach((a) => {
      if (a.questionType !== 'likert') return;
      const categoryFromSection = survey?.sections?.[a.sectionIndex]?.category;
      const category = canonicalSurveyCategory(a.category || categoryFromSection || '');
      const value = Number(a.answer);
      if (!category || !Number.isFinite(value)) return;
      if (!tmp[category]) tmp[category] = { sum: 0, count: 0 };
      tmp[category].sum += value;
      tmp[category].count += 1;
    });
    Object.entries(tmp).forEach(([category, data]) => {
      byCategory[category] = parseFloat((data.sum / data.count).toFixed(2));
    });
  }

  const values = Object.values(byCategory);
  const totalAverage = values.length
    ? parseFloat((values.reduce((acc, n) => acc + n, 0) / values.length).toFixed(2))
    : Number.isFinite(Number(surveyResponse.totalAverage))
      ? Number(surveyResponse.totalAverage)
      : 0;

  return { byCategory, totalAverage };
};

const computeEffectiveTechnicalSkillCount = (skills = []) => {
  if (!Array.isArray(skills) || skills.length === 0) return 0;

  // Each technical skill contributes 0.1 to 1.0 point based on 1-10 rating.
  // Fallback to legacy level mapping when rating is missing.
  const weighted = skills.reduce((sum, s) => {
    const rating = Number(s.rating);
    if (Number.isFinite(rating)) {
      const bounded = Math.max(1, Math.min(10, rating));
      return sum + (bounded / 10);
    }
    if (s.level === 'Beginner') return sum + 0.3;
    if (s.level === 'Advanced') return sum + 0.8;
    return sum + 0.5;
  }, 0);

  return Math.round(weighted);
};

const buildPredictionForStudentNumber = async (studentNumber) => {
  // Find the user with this student number
  const user = await User.findOne({ studentNumber });
  if (!user) {
    const err = new Error('Student not found.');
    err.statusCode = 404;
    throw err;
  }

  const activeUpload = await GradeUpload.findOne({ active: true }).select('_id').lean();

  // Check completeness of all data
  const grades = activeUpload?._id
    ? await Grade.find({ studentNumber, sourceUpload: activeUpload._id })
    : [];
  const gradesComplete = grades.length > 0;

  const surveyResponse = await SurveyResponse.findOne({ userId: user._id, completed: true }).sort({ completedAt: -1, updatedAt: -1 });
  const surveyComplete = !!surveyResponse;

  const techSkills = await TechnicalSkill.findOne({ userId: user._id, completed: true });
  const techComplete = !!techSkills;

  const softSkills = await SoftSkill.findOne({ userId: user._id, completed: true });
  const softComplete = !!softSkills;

  const certs = await Certification.findOne({ userId: user._id, completed: true });
  const certComplete = !!certs;

  console.log(`Completeness for ${studentNumber}: grades=${gradesComplete}, survey=${surveyComplete}, tech=${techComplete}, soft=${softComplete}, cert=${certComplete}`);

  if (!gradesComplete || !surveyComplete || !techComplete || !softComplete || !certComplete) {
    const err = new Error('Incomplete data. Please complete your grades, survey, technical skills, soft skills, and certification information before generating employability prediction.');
    err.statusCode = 400;
    err.incomplete = {
      grades: !gradesComplete,
      survey: !surveyComplete,
      technicalSkills: !techComplete,
      softSkills: !softComplete,
      certifications: !certComplete,
    };
    throw err;
  }

  // Compute GWA from numeric grades only
  const numericGrades = grades.filter(
    (g) =>
      typeof g.gradeNumeric === 'number' &&
      !Number.isNaN(g.gradeNumeric) &&
      g.gradeNumeric >= 1 &&
      g.gradeNumeric <= 5
  );
  if (!numericGrades.length) {
    const err = new Error('Prediction requires at least one valid numeric grade in the 1.00-5.00 range.');
    err.statusCode = 400;
    throw err;
  }

  const totalUnits = numericGrades.reduce((sum, g) => sum + g.units, 0);
  const weightedSum = numericGrades.reduce((sum, g) => sum + g.gradeNumeric * g.units, 0);
  const gwa = parseFloat((weightedSum / totalUnits).toFixed(4));

  // Category averages from survey (with fallback recomputation for legacy responses)
  const { byCategory: categoryScores, totalAverage: surveyAverage } = await normalizeSurveyScores(surveyResponse);

  const effectiveTechCount = computeEffectiveTechnicalSkillCount(techSkills.skills || []);

  // Only count approved certifications toward the prediction.
  // Legacy certs without a status field are treated as approved for backwards compat.
  const allCerts = certs.certifications || [];
  const approvedCerts = allCerts.filter((c) => !c.status || c.status === 'approved');
  const approvedCertCount = approvedCerts.length;

  // Compute relevance-weighted cert weight (0.0–1.0).
  // high tier = 1.0, medium = 0.6, low = 0.3
  const certWeight = approvedCertCount > 0
    ? parseFloat((approvedCerts.reduce((sum, c) => sum + (c.relevanceScore ?? 0.3), 0) / approvedCertCount).toFixed(4))
    : 0.0;

  // Build prediction payload based on ML service contract
  const payload = {
    gwa,
    surveyScores: {
      professional_ethics: categoryScores['professional_ethics'] || 3.0,
      scientific_spirit: categoryScores['scientific_spirit'] || 3.0,
      humanistic_quality: categoryScores['humanistic_quality'] || 3.0,
      computer_cognition: categoryScores['computer_cognition'] || 3.0,
      software_design: categoryScores['software_design'] || 3.0,
      system_usage: categoryScores['system_usage'] || 3.0,
      sustainable_development: categoryScores['sustainable_development'] || 3.0,
      team_capacity: categoryScores['team_capacity'] || 3.0,
      job_application: categoryScores['job_application'] || 3.0,
    },
    technicalSkillsCount: effectiveTechCount,
    softSkillsAverage: softSkills.average,
    certificationCount: approvedCertCount,
    certWeight,
    skills: (techSkills.skills || []).map((s) => s.skillName).filter(Boolean),
    certifications: approvedCerts.map((c) => c.name).filter(Boolean),
  };

  // Call ML service
  let mlResult;
  try {
    const response = await axios.post(`${ML_URL}/predict`, payload, { timeout: 30000 });
    mlResult = response.data;
  } catch (mlErr) {
    const err = new Error('ML prediction service is unavailable. Please try again later.');
    err.statusCode = 503;
    err.cause = mlErr;
    throw err;
  }

  const predictionData = {
    userId: user._id,
    studentNumber,
    employabilityScore: mlResult.employabilityScore ?? mlResult.employability_score,
    employabilityStatus: mlResult.employabilityStatus ?? mlResult.employability_status,
    scoreBasedStatus: mlResult.scoreBasedStatus ?? mlResult.score_based_status,
    gmmBasedStatus: mlResult.gmmBasedStatus ?? mlResult.gmm_based_status,
    statusExplanation: mlResult.statusExplanation ?? mlResult.status_explanation,
    gmmConfidence: mlResult.gmmConfidence ?? null,
    clusterLabel: mlResult.clusterLabel ?? mlResult.cluster_label,
    lowEmployabilityReason: mlResult.lowEmployabilityReason ?? mlResult.low_employability_reason ?? null,
    jobRecommendations: mlResult.jobRecommendations || mlResult.job_recommendations || [],
    targetRolesAfterImprovement: mlResult.targetRolesAfterImprovement || mlResult.target_roles_after_improvement || [],
    jobRecommendationContext: mlResult.jobRecommendationContext ?? mlResult.job_recommendation_context ?? null,
    jobCosineScores: mlResult.jobCosineScores || mlResult.job_cosine_scores || [],
    scoreFusion: mlResult.scoreFusion ?? mlResult.score_fusion ?? null,
    scoreBreakdown: mlResult.scoreBreakdown ?? mlResult.score_breakdown ?? null,
    matchedRules: mlResult.matchedRules || mlResult.matched_rules || [],
    recommendations: mlResult.recommendations || [],
    inputSummary: {
      gwa,
      totalUnits,
      surveyAverage,
      technicalSkillsCount: effectiveTechCount,
      softSkillsAverage: softSkills.average,
      certificationCount: approvedCertCount,
      certWeight,
    },
  };

  const prediction = await PredictionResult.findOneAndUpdate(
    { userId: user._id },
    {
      $set: predictionData,
      $push: {
        history: {
          $each: [{
            employabilityScore: predictionData.employabilityScore,
            employabilityStatus: predictionData.employabilityStatus,
            scoreBasedStatus: predictionData.scoreBasedStatus,
            gmmBasedStatus: predictionData.gmmBasedStatus,
            clusterLabel: predictionData.clusterLabel,
            statusExplanation: predictionData.statusExplanation,
            inputSummary: predictionData.inputSummary,
            generatedAt: new Date(),
          }],
          $slice: -20,
        },
      },
    },
    { new: true, upsert: true }
  );

  return { prediction, incomplete: null };
};

const autoRefreshPredictionForUserId = async (userId) => {
  try {
    const user = await User.findById(userId).select('studentNumber').lean();
    if (!user?.studentNumber) return null;
    console.log(`Auto-refreshing prediction for user ${userId}, student ${user.studentNumber}`);
    const result = await buildPredictionForStudentNumber(user.studentNumber);
    console.log(`Auto-refresh result:`, result ? 'success' : 'failed');
    return result;
  } catch (error) {
    // If the ML service is still training (503), silently skip to avoid
    // overwriting an existing good prediction with an empty/bad one.
    const statusCode = error?.statusCode || error?.cause?.response?.status;
    if (statusCode === 503) {
      console.warn(`Auto-refresh skipped for user ${userId}: ML model not ready yet.`);
      return null;
    }
    console.error(`Auto-refresh prediction failed for user ${userId}:`, error.message);
    return null;
  }
};

// POST /api/predict/:studentNumber
const generatePrediction = async (req, res) => {
  try {
    const { studentNumber } = req.params;
    const { prediction } = await buildPredictionForStudentNumber(studentNumber);

    return res.status(200).json({
      success: true,
      message: 'Prediction generated successfully.',
      prediction,
    });
  } catch (error) {
    const code = Number(error.statusCode || 500);
    if (code === 400 && error.incomplete) {
      return res.status(400).json({
        success: false,
        message: error.message,
        incomplete: error.incomplete,
      });
    }
    if (code === 404 || code === 503) {
      return res.status(code).json({ success: false, message: error.message });
    }
    console.error('Prediction error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/results/:studentNumber
const getResultByStudent = async (req, res) => {
  try {
    const user = await User.findOne({ studentNumber: req.params.studentNumber });
    if (!user) return res.status(404).json({ success: false, message: 'Student not found.' });

    const activeUpload = await GradeUpload.findOne({ active: true }).select('_id').lean();
    if (!activeUpload?._id) {
      return res.status(200).json({ success: true, result: null });
    }

    const activeGradesCount = await Grade.countDocuments({
      studentNumber: req.params.studentNumber,
      sourceUpload: activeUpload._id,
    });
    if (!activeGradesCount) {
      return res.status(200).json({ success: true, result: null });
    }

    const result = await PredictionResult.findOne({ userId: user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/results (admin — all results)
const getAllResults = async (req, res) => {
  try {
    const results = await PredictionResult.find()
      .populate('userId', 'fullName email studentNumber major')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: results.length, results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/results/my (student — own result)
const getMyResult = async (req, res) => {
  try {
    const activeUpload = await GradeUpload.findOne({ active: true }).select('_id').lean();
    if (!activeUpload?._id) {
      return res.status(200).json({ success: true, result: null });
    }

    const user = await User.findById(req.user._id).select('studentNumber').lean();
    if (!user?.studentNumber) {
      return res.status(200).json({ success: true, result: null });
    }

    const activeGradesCount = await Grade.countDocuments({
      studentNumber: user.studentNumber,
      sourceUpload: activeUpload._id,
    });
    if (!activeGradesCount) {
      return res.status(200).json({ success: true, result: null });
    }

    const result = await PredictionResult.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/results/:id/archive
const archiveResult = async (req, res) => {
  try {
    const result = await PredictionResult.findById(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Result not found.' });
    result.archived = !result.archived;
    await result.save();
    return res.status(200).json({ success: true, archived: result.archived });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  generatePrediction,
  getResultByStudent,
  getAllResults,
  getMyResult,
  autoRefreshPredictionForUserId,
  archiveResult,
};
