import model

model.load_and_train('dataset/employability.xlsx')

print("=== Testing Improvement Recommendations ===\n")

# LOW employability student
low_student = {
    'gwa': 3.8,
    'surveyScores': {
        'professional_ethics': 2, 'scientific_spirit': 2,
        'humanistic_quality': 2, 'computer_cognition': 2,
        'software_design': 2, 'system_usage': 2,
        'sustainable_development': 2, 'team_capacity': 2,
        'job_application': 2
    },
    'technicalSkillsCount': 1,
    'softSkillsAverage': 2.5,
    'certificationCount': 0
}

result = model.predict(low_student)
print("LOW Employability Student:")
print(f"  Status: {result['employabilityStatus']}")
print(f"  Recommendations: {len(result['recommendations'])} items")
for i, r in enumerate(result['recommendations'], 1):
    print(f"    {i}. {r}")

# HIGH employability student
high_student = {
    'gwa': 2.5,
    'surveyScores': {
        'professional_ethics': 5, 'scientific_spirit': 5,
        'humanistic_quality': 4, 'computer_cognition': 5,
        'software_design': 5, 'system_usage': 4,
        'sustainable_development': 4, 'team_capacity': 5,
        'job_application': 5
    },
    'technicalSkillsCount': 15,
    'softSkillsAverage': 4.5,
    'certificationCount': 3
}

result2 = model.predict(high_student)
print("\nHIGH Employability Student:")
print(f"  Status: {result2['employabilityStatus']}")
print(f"  Recommendations: {len(result2['recommendations'])} items")
for i, r in enumerate(result2['recommendations'], 1):
    print(f"    {i}. {r}")
