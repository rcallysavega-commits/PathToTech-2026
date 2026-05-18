const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
require("dotenv").config();

async function upsertStudents() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const students = ["student1@cvsu.edu.ph", "student2@cvsu.edu.ph", "student3@cvsu.edu.ph"];
    const hashedPassword = await bcrypt.hash("Student@123", 10);

    for (const email of students) {
      await User.findOneAndUpdate(
        { email },
        {
          email,
          password: hashedPassword,
          role: "student",
          emailVerified: true,
          firstLoginCompleted: true,
          name: email.split("@")[0]
        },
        { upsert: true, new: true }
      );
      console.log(`Upserted ${email}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
upsertStudents();
