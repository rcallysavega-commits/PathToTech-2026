/**
 * Seed the 32 default FAQs into MongoDB.
 * Run: node server/utils/seedFAQs.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const connectDB = require('../config/db');
const FAQ = require('../models/FAQ');

const FAQS = [
  { question: 'What is Path to Tech – DCS?', answer: 'Path to Tech – DCS is a system that helps students access career-related information, recommendations, and other academic services.' },
  { question: 'How do I create an account?', answer: 'Click the Register button on the login page, fill in the required information, and submit the form.' },
  { question: 'What should I do if I forgot my password?', answer: 'Click Forgot Password on the login page and follow the instructions to reset your password.' },
  { question: 'How do I update my profile information?', answer: 'Go to the Settings page, edit your information, then click Save Changes.' },
  { question: "Why can't I log in to my account?", answer: "Possible reasons include:\n• Incorrect email or password\n• Poor internet connection\n• Temporary server issue\n\nTry checking your login details and try again." },
  { question: 'Can I use the system on my phone?', answer: 'Yes. The system can be accessed using mobile phones, tablets, laptops, and desktop computers.' },
  { question: 'Why is the page loading slowly?', answer: "Slow loading may be caused by:\n• Weak internet connection\n• Too many users accessing the system\n• Browser issues\n\nRefreshing the page may help." },
  { question: 'How do I log out of my account?', answer: 'Click your profile or menu button, then select Logout.' },
  { question: 'Can I change my password?', answer: 'Yes. You can change your password in the Settings or Account Settings page.' },
  { question: 'Why are some features not working properly?', answer: 'Some features may temporarily not work because of maintenance, internet issues, or browser compatibility problems.' },
  { question: 'Is my information safe in the system?', answer: 'Yes. The system is designed to keep user information secure and protected.' },
  { question: 'Who can use the system?', answer: 'Students in CVSU-CCAT and authorized users with registered accounts can access the system.' },
  { question: 'How do I edit my personal information?', answer: 'Open the Profile or Settings page and update the information you want to change.' },
  { question: 'Can I access the system anytime?', answer: 'Yes. The system is available online and can be accessed anytime with an internet connection.' },
  { question: 'What browser works best for the system?', answer: 'The system works best on updated browsers such as Google Chrome, Microsoft Edge, and Mozilla Firefox.' },
  { question: 'Why am I automatically logged out?', answer: 'For security purposes, the system may automatically log out inactive users after a certain period of time.' },
  { question: 'Can I use the same account on another device?', answer: 'Yes. You can log in to your account using another device as long as you enter the correct credentials.' },
  { question: 'What should I do if I entered the wrong information?', answer: 'You can edit or update your information in the Settings page.' },
  { question: "Why can't I access some pages?", answer: 'Some pages may only be available to authorized users or may require you to log in first.' },
  { question: 'Do I need an internet connection to use the system?', answer: 'Yes. An internet connection is required to access and use the system features.' },
  { question: 'What should I do if the website is not opening?', answer: "Try the following:\n• Check your internet connection\n• Refresh the page\n• Restart your browser\n• Try another browser or device" },
  { question: 'Can I contact support if I experience problems?', answer: 'Yes. Users may contact the administrator or support team for assistance regarding technical issues or account concerns.' },
  { question: 'How do I know if my changes were saved?', answer: 'A confirmation message or notification will appear after successfully saving changes.' },
  { question: 'Can I upload or change my profile picture?', answer: 'Yes. Users can update their profile picture through the profile or settings page if the feature is available.' },
  { question: 'Why does the system require login credentials?', answer: 'Login credentials help protect user accounts and ensure that only authorized users can access the system.' },
  {
    question: 'How does the system generate my Employability Score?',
    answer: "The system evaluates five key factors: Academic Performance (GWA), Survey Average, Technical Skills, Soft Skills, and Certifications. Each factor is assigned a specific weight.\n\nFormula:\n(A × 0.30) + (S × 0.25) + (T × 0.20) + (SS × 0.15) + (C × 0.10)\n\nWhere:\n  A  = Academic Score\n  S  = Survey Average\n  T  = Technical Skills Score\n  SS = Soft Skills Score\n  C  = Certification Score",
  },
  { question: 'How accurate are my results?', answer: 'The accuracy of your results depends on the information you provide. The system calculates scores using predefined weights and actual data from your profile, skills, and survey responses. More complete and accurate information leads to more reliable results.' },
  {
    question: 'How does the system calculate the points for each category?',
    answer: "Each category's percentage score is multiplied by its assigned weight to determine the points contributed to the final Employability Score.\n\nFormula:\n  Points = Percentage × Weight × 100\n\nFor example:\n  Academic Score: 90.1% × 0.30 × 100 = 27.04 points",
  },
  { question: 'Why did I receive this recommendation?', answer: 'The system uses profile gap analysis to identify skills, qualifications, or certifications that are commonly associated with your target career but are currently missing from your profile. These gaps are then translated into personalized recommendations and improvement plans.' },
  { question: 'How are improvement plans generated?', answer: 'Improvement plans are generated by comparing your current profile with skills and qualifications found in matched ECLAT rules. Missing competencies and low-scoring areas trigger specific recommendations.\n\nFor example, if certifications are missing, the system may recommend obtaining industry-recognized certifications to increase your score.' },
  {
    question: 'Can my Employability Score change over time?',
    answer: "Yes. Your score automatically changes whenever you update your profile, add certifications, improve your technical skills, or complete a new assessment.\n\nFormula used during recalculation:\n  Employability Score = Σ (Percentage Score × Weight)",
  },
  {
    question: "Why are my results different from another user's results?",
    answer: "Each user has a unique combination of academic performance, survey responses, technical skills, soft skills, and certifications. Since the system calculates scores based on individual data, recommendations and Employability Scores may vary.\n\nOverall Score Formula:\n(A × 0.30) + (S × 0.25) + (T × 0.20) + (SS × 0.15) + (C × 0.10)",
  },
];

async function seed() {
  await connectDB();
  const existing = await FAQ.countDocuments();
  if (existing > 0) {
    console.log(`[seed-faqs] ${existing} FAQs already exist — skipping seed. Delete them first if you want to re-seed.`);
    process.exit(0);
  }
  const docs = FAQS.map((f, i) => ({ ...f, order: i, isVisible: true }));
  await FAQ.insertMany(docs);
  console.log(`[seed-faqs] Inserted ${docs.length} FAQs.`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
