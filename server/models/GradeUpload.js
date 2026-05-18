const mongoose = require('mongoose');

const gradeUploadSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, default: '' },
    extension: { type: String, default: '' },
    totalRecords: { type: Number, default: 0 },
    insertedRecords: { type: Number, default: 0 },
    updatedRecords: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GradeUpload', gradeUploadSchema);
