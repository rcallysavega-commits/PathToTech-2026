const mongoose = require('mongoose');

const textPairSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    desc: { type: String, default: '' },
  },
  { _id: false }
);

const metricSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  { _id: false }
);

const stepSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    desc: { type: String, default: '' },
  },
  { _id: false }
);

const landingContentSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    brandName: { type: String, default: 'PathToTech' },
    brandTagline: { type: String, default: 'Career Intelligence' },
    systemTitle: { type: String, default: 'Employability Prediction System' },
    heroBadge: { type: String, default: '' },
    heroTitleLine1: { type: String, default: '' },
    heroTitleHighlight: { type: String, default: '' },
    heroDescription: { type: String, default: '' },
    heroHighlights: { type: [textPairSchema], default: [] },
    statMetrics: { type: [metricSchema], default: [] },
    aboutEyebrow: { type: String, default: '' },
    aboutTitle: { type: String, default: '' },
    aboutParagraph1: { type: String, default: '' },
    aboutParagraph2: { type: String, default: '' },
    highlights: { type: [textPairSchema], default: [] },
    capabilitiesEyebrow: { type: String, default: '' },
    capabilitiesTitle: { type: String, default: '' },
    capabilitiesDescription: { type: String, default: '' },
    capabilities: { type: [textPairSchema], default: [] },
    processSteps: { type: [stepSchema], default: [] },
    ctaEyebrow: { type: String, default: '' },
    ctaTitle: { type: String, default: '' },
    ctaText: { type: String, default: '' },
    ctaButtonLabel: { type: String, default: 'Go to Login' },
    footerText: { type: String, default: '' },
    footerSubtext: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LandingContent', landingContentSchema);