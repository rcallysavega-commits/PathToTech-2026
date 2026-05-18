const LandingContent = require('../models/LandingContent');

const DEFAULT_CONTENT = {
  brandName: 'PathToTech',
  brandTagline: 'Career Intelligence',
  systemTitle: 'Employability Prediction System',
  heroBadge: 'Professional readiness intelligence for Computer Studies students',
  heroTitleLine1: 'Professional readiness,',
  heroTitleHighlight: 'made visible before graduation.',
  heroDescription: 'PathToTech helps students and faculty understand employability readiness using academic performance, competency surveys, technical skills, soft skills, and certifications. Instead of isolated records, the platform turns student data into clear insights and actionable next steps.',
  heroHighlights: [
    { title: 'Prediction Inputs', desc: 'Grades, surveys, skills, and certifications' },
    { title: 'Guided Output', desc: 'Career paths and focused improvement actions' },
    { title: 'Audience', desc: 'Students, faculty, and program leads' },
  ],
  statMetrics: [
    { label: 'Inputs', value: '5 core student data sources' },
    { label: 'Assessment', value: 'GMM-based readiness grouping' },
    { label: 'Insights', value: 'Career and action recommendations' },
    { label: 'Use Case', value: 'Student and faculty decision support' },
  ],
  aboutEyebrow: 'About PathToTech',
  aboutTitle: 'A more professional way to understand student career readiness.',
  aboutParagraph1: 'PathToTech is built for a practical academic setting: it connects student records that are usually scattered across forms, grade sheets, and assessments, then turns them into a clearer readiness profile.',
  aboutParagraph2: 'The goal is not just to score students, but to give both students and administrators a grounded view of where readiness is strong, where it is weak, and which areas deserve intervention next.',
  highlights: [
    { title: 'Evidence-Based Prediction', desc: 'Combines academic records, surveys, certifications, and skill inventories into a single readiness view.' },
    { title: 'Actionable Skill Signals', desc: 'Shows what areas should be improved next so students and faculty can act early.' },
    { title: 'Career Direction Support', desc: 'Transforms prediction outputs into career-aligned guidance instead of raw scores only.' },
  ],
  capabilitiesEyebrow: 'Capabilities',
  capabilitiesTitle: 'Designed to support both individual growth and program-level insight.',
  capabilitiesDescription: 'The platform is useful not only for student self-assessment, but also for monitoring trends that matter to faculty and administrators.',
  capabilities: [
    { title: 'For Students', desc: 'Track readiness, understand your strengths, and see where growth will have the biggest impact.' },
    { title: 'For Faculty', desc: 'Monitor program-level readiness patterns and support interventions before graduation.' },
    { title: 'For Decision-Making', desc: 'Provide a clearer, data-backed basis for advising, improvement planning, and reporting.' },
  ],
  processSteps: [
    { label: 'Data Intake', desc: 'The platform gathers grades, surveys, technical skills, soft skills, and certifications in one place.' },
    { label: 'Profile Analysis', desc: 'Machine learning clusters profiles and estimates employability readiness using combined academic and competency signals.' },
    { label: 'Recommendations', desc: 'Students receive targeted career recommendations and improvement suggestions tied to their profile gaps.' },
  ],
  ctaEyebrow: 'Start with a clearer view of student readiness',
  ctaTitle: 'Use PathToTech to turn student data into planning, guidance, and career direction.',
  ctaText: 'Access the platform to review readiness predictions, understand observed skill gaps, and guide improvement with more confidence.',
  ctaButtonLabel: 'Go to Login',
  footerText: '© 2026 PathToTech',
  footerSubtext: 'Cavite State University · Computer Studies Department',
};

const normalizePairs = (items = [], fallback = []) => {
  const source = Array.isArray(items) && items.length ? items : fallback;
  return source.map((item, index) => ({
    title: String(item?.title || fallback[index]?.title || '').trim(),
    desc: String(item?.desc || fallback[index]?.desc || '').trim(),
  }));
};

const normalizeMetrics = (items = [], fallback = []) => {
  const source = Array.isArray(items) && items.length ? items : fallback;
  return source.map((item, index) => ({
    label: String(item?.label || fallback[index]?.label || '').trim(),
    value: String(item?.value || fallback[index]?.value || '').trim(),
  }));
};

const normalizeSteps = (items = [], fallback = []) => {
  const source = Array.isArray(items) && items.length ? items : fallback;
  return source.map((item, index) => ({
    label: String(item?.label || fallback[index]?.label || '').trim(),
    desc: String(item?.desc || fallback[index]?.desc || '').trim(),
  }));
};

const buildContentPayload = (source = {}) => ({
  brandName: String(source.brandName || DEFAULT_CONTENT.brandName).trim(),
  brandTagline: String(source.brandTagline || DEFAULT_CONTENT.brandTagline).trim(),
  systemTitle: String(source.systemTitle || DEFAULT_CONTENT.systemTitle).trim(),
  heroBadge: String(source.heroBadge || DEFAULT_CONTENT.heroBadge).trim(),
  heroTitleLine1: String(source.heroTitleLine1 || DEFAULT_CONTENT.heroTitleLine1).trim(),
  heroTitleHighlight: String(source.heroTitleHighlight || DEFAULT_CONTENT.heroTitleHighlight).trim(),
  heroDescription: String(source.heroDescription || DEFAULT_CONTENT.heroDescription).trim(),
  heroHighlights: normalizePairs(source.heroHighlights, DEFAULT_CONTENT.heroHighlights),
  statMetrics: normalizeMetrics(source.statMetrics, DEFAULT_CONTENT.statMetrics),
  aboutEyebrow: String(source.aboutEyebrow || DEFAULT_CONTENT.aboutEyebrow).trim(),
  aboutTitle: String(source.aboutTitle || DEFAULT_CONTENT.aboutTitle).trim(),
  aboutParagraph1: String(source.aboutParagraph1 || DEFAULT_CONTENT.aboutParagraph1).trim(),
  aboutParagraph2: String(source.aboutParagraph2 || DEFAULT_CONTENT.aboutParagraph2).trim(),
  highlights: normalizePairs(source.highlights, DEFAULT_CONTENT.highlights),
  capabilitiesEyebrow: String(source.capabilitiesEyebrow || DEFAULT_CONTENT.capabilitiesEyebrow).trim(),
  capabilitiesTitle: String(source.capabilitiesTitle || DEFAULT_CONTENT.capabilitiesTitle).trim(),
  capabilitiesDescription: String(source.capabilitiesDescription || DEFAULT_CONTENT.capabilitiesDescription).trim(),
  capabilities: normalizePairs(source.capabilities, DEFAULT_CONTENT.capabilities),
  processSteps: normalizeSteps(source.processSteps, DEFAULT_CONTENT.processSteps),
  ctaEyebrow: String(source.ctaEyebrow || DEFAULT_CONTENT.ctaEyebrow).trim(),
  ctaTitle: String(source.ctaTitle || DEFAULT_CONTENT.ctaTitle).trim(),
  ctaText: String(source.ctaText || DEFAULT_CONTENT.ctaText).trim(),
  ctaButtonLabel: String(source.ctaButtonLabel || DEFAULT_CONTENT.ctaButtonLabel).trim(),
  footerText: String(source.footerText || DEFAULT_CONTENT.footerText).trim(),
  footerSubtext: String(source.footerSubtext || DEFAULT_CONTENT.footerSubtext).trim(),
});

const getLandingContent = async (req, res) => {
  try {
    const content = await LandingContent.findOne({ key: 'main' }).lean();
    return res.status(200).json({ success: true, data: buildContentPayload(content || DEFAULT_CONTENT) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateLandingContent = async (req, res) => {
  try {
    const payload = buildContentPayload(req.body || {});
    const updated = await LandingContent.findOneAndUpdate(
      { key: 'main' },
      { ...payload, key: 'main' },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({ success: true, message: 'Landing page content updated.', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { DEFAULT_CONTENT, getLandingContent, updateLandingContent };