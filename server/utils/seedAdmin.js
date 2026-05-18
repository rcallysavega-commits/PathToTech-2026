require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

const seedAdmin = async () => {
  try {
    const User = require('../models/User');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pathtotech.edu.ph';
    const existing = await User.findOne({ email: adminEmail });

    if (!existing) {
      const password = process.env.ADMIN_PASSWORD || 'Admin@PathToTech2024';
      const hashed = await bcrypt.hash(password, 12);
      await User.create({
        fullName: process.env.ADMIN_NAME || 'PathToTech Administrator',
        email: adminEmail,
        password: hashed,
        role: 'admin',
        emailVerified: true,
        firstLoginCompleted: true,
      });
      console.log('Admin account seeded successfully.');
    } else {
      console.log('Admin account already exists.');
    }
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

// Allow running directly: node utils/seedAdmin.js
if (require.main === module) {
  connectDB().then(async () => {
    await seedAdmin();
    process.exit(0);
  });
}

module.exports = { seedAdmin };
