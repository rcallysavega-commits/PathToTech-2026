const mongoose = require('mongoose');

const certItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  issuer: { type: String, required: true },
  yearObtained: { type: Number },
  // Proof file upload
  proofFile: { type: String, default: '' },        // stored filename (path relative to uploads/)
  proofFileName: { type: String, default: '' },    // original display name
  proofFileType: { type: String, default: '' },    // mime type
  // Admin approval workflow
  status: {
    type: String,
    enum: ['pending_proof', 'pending_review', 'approved', 'rejected'],
    default: 'pending_proof',
  },
  adminNote: { type: String, default: '' },
  // Algorithm relevance
  relevanceTier: { type: String, enum: ['high', 'medium', 'low'], default: 'low' },
  relevanceScore: { type: Number, default: 0.3 }, // 0.3=low, 0.6=medium, 1.0=high
});

const certificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    certifications: [certItemSchema],
    hasNoCertification: { type: Boolean, default: false },
    certificationCount: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Certification', certificationSchema);
