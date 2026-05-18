const seedDefaultSurvey = async () => {
  try {
    const Survey = require('../models/Survey');
    const existing = await Survey.findOne({ isActive: true });
    if (existing) {
      console.log('Active survey already exists. Skipping seed.');
      return;
    }

    const defaultSurvey = new Survey({
      title: 'Computer Studies Employability Survey',
      description:
        'This survey evaluates your professional literacy, knowledge, practical abilities, and general capacities relevant to the IT industry.',
      isActive: true,
      sections: [
        {
          title: 'Part I: Profile of Participants',
          description: 'Basic demographic information.',
          category: 'profile',
          order: 1,
          questions: [
            {
              questionText: 'A. Gender',
              questionType: 'multiple_choice',
              options: ['Male', 'Female'],
              required: true,
              order: 1,
            },
            {
              questionText: 'B. Major / Specialization',
              questionType: 'text',
              required: true,
              order: 2,
            },
          ],
        },
        {
          title: 'Part II: Self-evaluation of Professional Literacy',
          description:
            'Rate each statement using the Likert Scale: 5 = Strongly Agree, 4 = Agree, 3 = Neither Agree nor Disagree, 2 = Disagree, 1 = Strongly Disagree.',
          category: 'professional_ethics',
          order: 2,
          questions: [
            { questionText: 'I give importance to the positions in IT industry very much.', questionType: 'likert', required: true, order: 1 },
            { questionText: 'I can be very responsible to complete the IT work.', questionType: 'likert', required: true, order: 2 },
            { questionText: 'I have the necessary values like honesty required in the IT industry.', questionType: 'likert', required: true, order: 3 },
            { questionText: 'I can handle IT work in a professional manner.', questionType: 'likert', required: true, order: 4 },
            { questionText: 'I abide by the laws and disciplines of the IT industry.', questionType: 'likert', required: true, order: 5 },
          ],
        },
        {
          title: 'Scientific Spirit',
          description: 'Rate each statement using the Likert Scale.',
          category: 'scientific_spirit',
          order: 3,
          questions: [
            { questionText: 'In the IT industry, I always make sure to undergo training to update my skills.', questionType: 'likert', required: true, order: 1 },
            { questionText: 'In the work of computer related positions, it is important to develop my critical thinking skills.', questionType: 'likert', required: true, order: 2 },
            { questionText: 'In the work of computer related position, I always hone my creativity.', questionType: 'likert', required: true, order: 3 },
            { questionText: 'I always practice my problem-solving skills as it is essential in working in IT Industry.', questionType: 'likert', required: true, order: 4 },
            { questionText: 'I have an innate sense of curiosity about how things work which I find helpful in working in an IT Industry.', questionType: 'likert', required: true, order: 5 },
          ],
        },
        {
          title: 'Humanistic Quality',
          description: 'Rate each statement using the Likert Scale.',
          category: 'humanistic_quality',
          order: 4,
          questions: [
            { questionText: 'I have adequate knowledge about the historical components required by the IT industry.', questionType: 'likert', required: true, order: 1 },
            { questionText: 'I have the literary knowledge required by the IT industry.', questionType: 'likert', required: true, order: 2 },
            { questionText: 'I possess political qualities needed in the IT industry.', questionType: 'likert', required: true, order: 3 },
            { questionText: 'I have knowledge about the legal aspects in the IT industry.', questionType: 'likert', required: true, order: 4 },
            { questionText: 'I have the artistic knowledge required by the IT industry.', questionType: 'likert', required: true, order: 5 },
          ],
        },
        {
          title: 'Part III: Professional Knowledge and Practical Abilities',
          description: 'Rate each statement using the Likert Scale.',
          category: 'computer_cognition',
          order: 5,
          questions: [
            { questionText: 'I have a background about the history of computers.', questionType: 'likert', required: true, order: 1 },
            { questionText: 'I understand the system structure of a computer.', questionType: 'likert', required: true, order: 2 },
            { questionText: 'I am knowledgeable about the parts of the hardware of a computer.', questionType: 'likert', required: true, order: 3 },
            { questionText: 'I understand the software structure of a computer.', questionType: 'likert', required: true, order: 4 },
            { questionText: 'I can assemble a computer unit properly.', questionType: 'likert', required: true, order: 5 },
          ],
        },
        {
          title: 'Software Design and Development Ability',
          description: 'Rate each statement using the Likert Scale.',
          category: 'software_design',
          order: 6,
          questions: [
            { questionText: 'I have knowledge about operating system.', questionType: 'likert', required: true, order: 1 },
            { questionText: 'I understand the framework and techniques used in Web development.', questionType: 'likert', required: true, order: 2 },
            { questionText: 'I am skilled in using SSM framework for software development.', questionType: 'likert', required: true, order: 3 },
            { questionText: 'I can use Python and Java well.', questionType: 'likert', required: true, order: 4 },
            { questionText: 'I can design web pages.', questionType: 'likert', required: true, order: 5 },
          ],
        },
        {
          title: 'System Usage and Innovation Ability',
          description: 'Rate each statement using the Likert Scale.',
          category: 'system_usage',
          order: 7,
          questions: [
            { questionText: 'I can read and understand software instructions.', questionType: 'likert', required: true, order: 1 },
            { questionText: 'I understand the constraints and interfaces used by the software.', questionType: 'likert', required: true, order: 2 },
            { questionText: 'I can complete software installation.', questionType: 'likert', required: true, order: 3 },
            { questionText: 'I can use different types of software skillfully.', questionType: 'likert', required: true, order: 4 },
            { questionText: 'I can do routine maintenance on the software.', questionType: 'likert', required: true, order: 5 },
          ],
        },
        {
          title: 'Part IV: General Abilities',
          description: 'Rate each statement using the Likert Scale.',
          category: 'sustainable_development',
          order: 8,
          questions: [
            { questionText: 'I apply work ethics of IT industry.', questionType: 'likert', required: true, order: 1 },
            { questionText: 'I have the ability to learn new knowledge about IT industry.', questionType: 'likert', required: true, order: 2 },
            { questionText: 'I have the ability to apply specialized knowledge of computer.', questionType: 'likert', required: true, order: 3 },
            { questionText: 'I have good interpersonal skills which can be used in this industry.', questionType: 'likert', required: true, order: 4 },
            { questionText: 'I have the ability to do computer related work.', questionType: 'likert', required: true, order: 5 },
          ],
        },
        {
          title: 'Team Capacity',
          description: 'Rate each statement using the Likert Scale.',
          category: 'team_capacity',
          order: 9,
          questions: [
            { questionText: 'I have good interpersonal skills.', questionType: 'likert', required: true, order: 1 },
            { questionText: 'I can be involved in completing the business of the IT technical team.', questionType: 'likert', required: true, order: 2 },
            { questionText: 'In IT related tasks, I have the ability to plan and set the necessary steps for my team.', questionType: 'likert', required: true, order: 3 },
            { questionText: 'I have strong communication skills that I can use in communicating with my technical team.', questionType: 'likert', required: true, order: 4 },
            { questionText: 'I can work with the team to identify IT questions.', questionType: 'likert', required: true, order: 5 },
          ],
        },
        {
          title: 'Job Application Ability',
          description: 'Rate each statement using the Likert Scale.',
          category: 'job_application',
          order: 10,
          questions: [
            { questionText: 'I am confident that I have the abilities needed in the IT Industry.', questionType: 'likert', required: true, order: 1 },
            { questionText: 'I know where to search for job opportunities in the IT Industry.', questionType: 'likert', required: true, order: 2 },
            { questionText: 'I have the ability to write resumes for IT industry positions.', questionType: 'likert', required: true, order: 3 },
            { questionText: 'I have a certain ability to express myself that is essential in job application.', questionType: 'likert', required: true, order: 4 },
            { questionText: 'I have a certain ability of self-promotion.', questionType: 'likert', required: true, order: 5 },
          ],
        },
      ],
    });

    await defaultSurvey.save();
    console.log('Default survey seeded successfully.');
  } catch (error) {
    console.error('Error seeding survey:', error.message);
  }
};

module.exports = { seedDefaultSurvey };
