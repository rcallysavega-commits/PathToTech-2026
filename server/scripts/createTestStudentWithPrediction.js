const mongoose = require('mongoose');
const User = require('../models/User');
const Grade = require('../models/Grade');
const SurveyResponse = require('../models/SurveyResponse');
const TechnicalSkill = require('../models/TechnicalSkill');
const SoftSkill = require('../models/SoftSkill');
const Certification = require('../models/Certification');

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pathtotech';

async function createTestStudent() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(DB_URI);

    const email = 'test2026@cvsu.edu.ph';
    const studentNumber = '2026-000100';

    // Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      console.log('Creating new user...');
      user = new User({
        fullName: 'Test Student',
        email: email,
        studentNumber: studentNumber,
        password: 'TestPass123!',
        gender: 'Male',
        major: 'Computer Science',
        emailVerified: true,
        role: 'student'
      });
      await user.save();
      console.log('User created:', user._id);
    } else {
      console.log('User already exists:', user._id);
    }

    // Create sample grades (GWA = 1.33)
    let grades = await Grade.findOne({ studentId: user._id });
    if (!grades) {
      console.log('Creating grades...');
      grades = new Grade({
        studentId: user._id,
        studentNumber: studentNumber,
        courses: [
          { code: 'CS101', name: 'Intro to CS', grade: 1.5 },
          { code: 'CS102', name: 'Programming', grade: 1.25 },
          { code: 'CS103', name: 'Data Structures', grade: 1.0 }
        ],
        gwa: 1.33
      });
      await grades.save();
      console.log('Grades created');
    }

    // Create survey response
    let survey = await SurveyResponse.findOne({ studentId: user._id });
    if (!survey) {
      console.log('Creating survey response...');
      survey = new SurveyResponse({
        studentId: user._id,
        studentNumber: studentNumber,
        surveyId: new mongoose.Types.ObjectId(),
        responses: [
          { questionId: new mongoose.Types.ObjectId(), category: 'academic_foundation', rating: 4 },
          { questionId: new mongoose.Types.ObjectId(), category: 'professional_ethics', rating: 3 },
          { questionId: new mongoose.Types.ObjectId(), category: 'scientific_spirit', rating: 3 },
          { questionId: new mongoose.Types.ObjectId(), category: 'humanistic_quality', rating: 3 },
          { questionId: new mongoose.Types.ObjectId(), category: 'computer_cognition', rating: 3 },
          { questionId: new mongoose.Types.ObjectId(), category: 'software_design', rating: 3 },
          { questionId: new mongoose.Types.ObjectId(), category: 'system_usage', rating: 3 },
          { questionId: new mongoose.Types.ObjectId(), category: 'sustainable_development', rating: 3 },
          { questionId: new mongoose.Types.ObjectId(), category: 'team_capacity', rating: 3 },
          { questionId: new mongoose.Types.ObjectId(), category: 'job_application', rating: 3 }
        ]
      });
      await survey.save();
      console.log('Survey response created');
    }

    // Create technical skills (count = 22)
    let techSkills = await TechnicalSkill.findOne({ studentId: user._id });
    if (!techSkills) {
      console.log('Creating technical skills...');
      const skills = [
        'Java', 'Python', 'C', 'JavaScript', 'TypeScript',
        'SQL', 'MongoDB', 'React', 'Node.js', 'Express',
        'REST APIs', 'Git', 'Docker', 'AWS', 'Linux',
        'HTML', 'CSS', 'Vue.js', 'Angular', 'Kubernetes',
        'CI/CD', 'GraphQL'
      ];
      techSkills = new TechnicalSkill({
        studentId: user._id,
        studentNumber: studentNumber,
        skills: skills,
        proficiencyLevels: skills.map(() => 'Intermediate')
      });
      await techSkills.save();
      console.log('Technical skills created (count:', skills.length, ')');
    }

    // Create soft skills (average = 3.0)
    let softSkills = await SoftSkill.findOne({ studentId: user._id });
    if (!softSkills) {
      console.log('Creating soft skills...');
      softSkills = new SoftSkill({
        studentId: user._id,
        studentNumber: studentNumber,
        skills: {
          'Communication': 3,
          'Leadership': 3,
          'Teamwork': 3,
          'Problem Solving': 3,
          'Adaptability': 3
        }
      });
      await softSkills.save();
      console.log('Soft skills created');
    }

    // Create certifications (count = 3)
    let existingCerts = await Certification.find({ studentId: user._id });
    if (existingCerts.length === 0) {
      console.log('Creating certifications...');
      const certs = [
        new Certification({
          studentId: user._id,
          studentNumber: studentNumber,
          certificationName: 'AWS Solutions Architect',
          provider: 'Amazon',
          dateObtained: new Date('2024-01-15'),
          expiryDate: new Date('2026-01-15')
        }),
        new Certification({
          studentId: user._id,
          studentNumber: studentNumber,
          certificationName: 'Google Cloud Professional',
          provider: 'Google',
          dateObtained: new Date('2023-06-20'),
          expiryDate: new Date('2025-06-20')
        }),
        new Certification({
          studentId: user._id,
          studentNumber: studentNumber,
          certificationName: 'Oracle Java Programmer',
          provider: 'Oracle',
          dateObtained: new Date('2023-03-10'),
          expiryDate: new Date('2026-03-10')
        })
      ];
      await Certification.insertMany(certs);
      console.log('Certifications created (count: 3)');
    }

    console.log('\n✅ Test student setup complete!');
    console.log('Email:', email);
    console.log('Student Number:', studentNumber);
    console.log('Password: TestPass123!');
    console.log('\nStudent data ready for prediction generation.');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createTestStudent();
