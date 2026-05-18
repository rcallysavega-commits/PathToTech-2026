const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema(
  {
    lastName: { type: String, required: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true, default: '' },
    studentNumber: { type: String, required: true, trim: true },
    subjectCode: { type: String, required: true, trim: true, uppercase: true },
    subjectTitle: { type: String, required: true, trim: true },
    units: { type: Number, required: true },
    grade: { type: String, required: true, trim: true },
    gradeNumeric: { type: Number, default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sourceUpload: { type: mongoose.Schema.Types.ObjectId, ref: 'GradeUpload', default: null },
  },
  { timestamps: true }
);

// Compound index: one grade per subject per student
gradeSchema.index({ studentNumber: 1, subjectCode: 1 }, { unique: true });

module.exports = mongoose.model('Grade', gradeSchema);
