const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Grade = require('../models/Grade');
const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');
const TechnicalSkill = require('../models/TechnicalSkill');
const SoftSkill = require('../models/SoftSkill');
const Certification = require('../models/Certification');

const normalizeCategoryKey = (value = '') =>
  String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  const user = await User.findOne({ fullName: /alyssa vega/i }).lean();
  if (!user) {
    console.log('USER_NOT_FOUND');
    process.exit(0);
  }

  const grades = await Grade.find({ studentNumber: user.studentNumber }).lean();
  const surveyResponse = await SurveyResponse.findOne({ userId: user._id, completed: true })
    .sort({ completedAt: -1, updatedAt: -1 })
    .lean();
  const techSkills = await TechnicalSkill.findOne({ userId: user._id, completed: true }).lean();
  const softSkills = await SoftSkill.findOne({ userId: user._id, completed: true }).lean();
  const certs = await Certification.findOne({ userId: user._id, completed: true }).lean();

  const numericGrades = grades.filter((g) => typeof g.gradeNumeric === 'number' && !Number.isNaN(g.gradeNumeric));
  const totalUnits = numericGrades.reduce((sum, g) => sum + (g.units || 0), 0);
  const weightedSum = numericGrades.reduce((sum, g) => sum + g.gradeNumeric * (g.units || 0), 0);
  const gwa = totalUnits > 0 ? Number((weightedSum / totalUnits).toFixed(4)) : null;

  const byCategory = {};
  if (surveyResponse && Array.isArray(surveyResponse.categoryScores)) {
    for (const cs of surveyResponse.categoryScores) {
      const category = normalizeCategoryKey(cs.category || '');
      const avg = Number(cs.average);
      if (!category || !Number.isFinite(avg) || avg <= 0) continue;
      byCategory[category] = avg;
    }
  }

  if (Object.keys(byCategory).length === 0 && surveyResponse && Array.isArray(surveyResponse.answers) && surveyResponse.answers.length) {
    const survey = await Survey.findById(surveyResponse.surveyId).select('sections.category').lean();
    const tmp = {};
    surveyResponse.answers.forEach((a) => {
      if (a.questionType !== 'likert') return;
      const categoryFromSection = survey?.sections?.[a.sectionIndex]?.category;
      const category = normalizeCategoryKey(a.category || categoryFromSection || '');
      const value = Number(a.answer);
      if (!category || !Number.isFinite(value)) return;
      if (!tmp[category]) tmp[category] = { sum: 0, count: 0 };
      tmp[category].sum += value;
      tmp[category].count += 1;
    });
    Object.entries(tmp).forEach(([category, data]) => {
      byCategory[category] = Number((data.sum / data.count).toFixed(2));
    });
  }

  const effectiveTechCount = Array.isArray(techSkills?.skills)
    ? Math.round(
        techSkills.skills.reduce((sum, s) => {
          const rating = Number(s.rating);
          if (Number.isFinite(rating)) {
            const bounded = Math.max(1, Math.min(10, rating));
            return sum + bounded / 10;
          }
          if (s.level === 'Beginner') return sum + 0.3;
          if (s.level === 'Advanced') return sum + 0.8;
          return sum + 0.5;
        }, 0)
      )
    : 0;

  const payload = {
    gwa,
    surveyScores: {
      professional_ethics: byCategory.professional_ethics || 3.0,
      scientific_spirit: byCategory.scientific_spirit || 3.0,
      humanistic_quality: byCategory.humanistic_quality || 3.0,
      computer_cognition: byCategory.computer_cognition || 3.0,
      software_design: byCategory.software_design || 3.0,
      system_usage: byCategory.system_usage || 3.0,
      sustainable_development: byCategory.sustainable_development || 3.0,
      team_capacity: byCategory.team_capacity || 3.0,
      job_application: byCategory.job_application || 3.0,
    },
    technicalSkillsCount: effectiveTechCount,
    softSkillsAverage: softSkills?.average ?? null,
    certificationCount: certs?.certificationCount ?? 0,
    skills: (techSkills?.skills || []).map((s) => s.skillName).filter(Boolean),
    certifications: (certs?.certifications || []).map((c) => c.name).filter(Boolean),
  };

  const surveyValues = Object.values(payload.surveyScores);
  const surveyAverage = surveyValues.length
    ? Number((surveyValues.reduce((a, b) => a + b, 0) / surveyValues.length).toFixed(3))
    : null;

  console.log(
    JSON.stringify(
      {
        user: { fullName: user.fullName, studentNumber: user.studentNumber },
        completeness: {
          grades: grades.length,
          numericGrades: numericGrades.length,
          surveyCompleted: !!surveyResponse,
          techCompleted: !!techSkills,
          softCompleted: !!softSkills,
          certCompleted: !!certs,
        },
        computed: {
          gwa,
          totalUnits,
          weightedSum: Number(weightedSum.toFixed(4)),
          surveyCategoriesFound: Object.keys(byCategory),
          surveyAverage,
          technicalSkillsCount: effectiveTechCount,
          softSkillsAverage: softSkills?.average ?? null,
          certificationCount: certs?.certificationCount ?? 0,
          skillsCount: payload.skills.length,
          certNamesCount: payload.certifications.length,
        },
        payload,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
})();
