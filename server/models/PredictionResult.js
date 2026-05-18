const mongoose = require('mongoose');

const predictionResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentNumber: { type: String, required: true },
    employabilityScore: { type: Number, required: true },
    employabilityStatus: {
      type: String,
      enum: ['Low Employability', 'Moderate Employability', 'High Employability'],
      required: true,
    },
    scoreBasedStatus: {
      type: String,
      enum: ['Low Employability', 'Moderate Employability', 'High Employability'],
    },
    gmmBasedStatus: {
      type: String,
      enum: ['Low Employability', 'Moderate Employability', 'High Employability'],
    },
    statusExplanation: { type: String },
    gmmConfidence: { type: Number },
    clusterLabel: { type: String, required: true },
    lowEmployabilityReason: { type: String },
    jobRecommendations: [String],
    targetRolesAfterImprovement: [String],
    jobRecommendationContext: {
      title: { type: String },
      message: { type: String },
    },
    jobCosineScores: [
      {
        job: { type: String },
        cosine: { type: Number },
        jobScore: { type: Number },
      },
    ],
    scoreFusion: {
      alpha: { type: Number },
      beta: { type: Number },
      gmmContribution: { type: Number },
      eclatContribution: { type: Number },
    },
    scoreBreakdown: {
      academic: { type: Number },
      survey: { type: Number },
      technicalSkills: { type: Number },
      softSkills: { type: Number },
      certifications: { type: Number },
    },
    matchedRules: [
      {
        rule: { type: String },
        support: { type: Number },
        confidence: { type: Number },
        lift: { type: Number },
      },
    ],
    recommendations: [String],
    inputSummary: {
      gwa: Number,
      totalUnits: Number,
      surveyAverage: Number,
      technicalSkillsCount: Number,
      softSkillsAverage: Number,
      certificationCount: Number,
    },
    history: [
      {
        employabilityScore: Number,
        employabilityStatus: String,
        scoreBasedStatus: String,
        gmmBasedStatus: String,
        clusterLabel: String,
        statusExplanation: String,
        inputSummary: {
          gwa: Number,
          totalUnits: Number,
          surveyAverage: Number,
          technicalSkillsCount: Number,
          softSkillsAverage: Number,
          certificationCount: Number,
        },
        generatedAt: { type: Date, default: Date.now },
      },
    ],
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PredictionResult', predictionResultSchema);
