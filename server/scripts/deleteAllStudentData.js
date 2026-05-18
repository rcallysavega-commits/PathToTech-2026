const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const SurveyResponse = require('../models/SurveyResponse');
const TechnicalSkill = require('../models/TechnicalSkill');
const SoftSkill = require('../models/SoftSkill');
const Certification = require('../models/Certification');
const PredictionResult = require('../models/PredictionResult');
const Grade = require('../models/Grade');

async function main() {
  const connection = await connectDB();
  if (!connection) {
    throw new Error('MongoDB connection failed. Check server/.env MONGO_URI.');
  }

  const students = await User.find({ role: 'student' }).select('_id studentNumber email fullName');
  const userIds = students.map((student) => student._id);
  const studentNumbers = students
    .map((student) => String(student.studentNumber || '').trim())
    .filter(Boolean);

  if (!students.length) {
    console.log('No student accounts found. Nothing deleted.');
    await mongoose.disconnect();
    return;
  }

  const [
    surveyResponses,
    technicalSkills,
    softSkills,
    certifications,
    predictionResults,
    grades,
    users,
  ] = await Promise.all([
    SurveyResponse.deleteMany({ userId: { $in: userIds } }),
    TechnicalSkill.deleteMany({ userId: { $in: userIds } }),
    SoftSkill.deleteMany({ userId: { $in: userIds } }),
    Certification.deleteMany({ userId: { $in: userIds } }),
    PredictionResult.deleteMany({
      $or: [
        { userId: { $in: userIds } },
        { studentNumber: { $in: studentNumbers } },
      ],
    }),
    studentNumbers.length ? Grade.deleteMany({ studentNumber: { $in: studentNumbers } }) : Promise.resolve({ deletedCount: 0 }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);

  console.log('Deleted student data summary:');
  console.log(`- Student accounts: ${users.deletedCount || 0}`);
  console.log(`- Survey responses: ${surveyResponses.deletedCount || 0}`);
  console.log(`- Technical skill records: ${technicalSkills.deletedCount || 0}`);
  console.log(`- Soft skill records: ${softSkills.deletedCount || 0}`);
  console.log(`- Certification records: ${certifications.deletedCount || 0}`);
  console.log(`- Prediction results: ${predictionResults.deletedCount || 0}`);
  console.log(`- Grade records: ${grades.deletedCount || 0}`);

  await mongoose.disconnect();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Failed to delete student data:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });