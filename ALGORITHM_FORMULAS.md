# PathToTech ML Algorithms: Formula Reference

Comprehensive documentation of all mathematical formulas used in the ECLAT and GMM algorithms.

---

## ECLAT Algorithm (Frequent Itemset Mining & Association Rules)

### 1. **Support Formula**
```
support(itemset) = count(transactions containing itemset) / total_transactions
```
- **Location**: `model.py` - `run_eclat()` function
- **Range**: [0, 1]
- **Interpretation**: Fraction of transactions that contain all items in the itemset
- **Purpose**: Identify itemsets that occur frequently enough to be relevant
- **Threshold**: `min_support` parameter filters itemsets below this frequency

### 2. **Confidence Formula**
```
confidence(A → B) = support(A ∪ B) / support(A)
                  = sup_ab / sup_a
```
- **Location**: `model.py` - `run_eclat()` function (line ~1000)
- **Range**: [0, 1]
- **Interpretation**: Probability that B occurs given A has occurred
- **Purpose**: Measure strength of directional association from antecedent to consequent
- **Threshold**: `min_confidence` parameter filters rules below this conditional probability
- **Example**: If 80% of students with Python skill also have JavaScript skill, confidence = 0.8

### 3. **Lift Formula**
```
lift(A → B) = confidence(A → B) / support(B)
            = [sup_ab / sup_a] / [sup_b / total]
            = confidence / P(B)
```
- **Location**: `model.py` - `run_eclat()` function (line ~1003)
- **Range**: [0, ∞)
- **Interpretation**: How much more likely B occurs when A occurs compared to random
- **Purpose**: Filter out correlations that could occur by chance
- **Thresholds**:
  - lift = 1.0: A and B are independent
  - lift > 1.0: Positive correlation (A increases likelihood of B)
  - lift < 1.0: Negative correlation (A decreases likelihood of B)
- **Example**: Lift = 2.0 means B is 2x more likely given A than if they were independent

### 4. **Rule Strength Formula (Custom Metric)**
```
rule_strength = confidence × lift
```
- **Location**: `model.py` - `_build_student_rule_vector()` function
- **Range**: [0, ∞)
- **Purpose**: Combined metric weighting both rule reliability and predictive power
- **Calculation**: `confidence * lift` aggregated per cluster for student skill vectors
- **Application**: Scores how strongly a skill combination predicts a job role

---

## GMM Algorithm (Gaussian Mixture Model Clustering)

### 1. **AIC (Akaike Information Criterion)**
```
AIC = -2 × log_likelihood + 2 × num_parameters
    = -2 × log_likelihood + 2k
```
- **Location**: `model.py` - `_select_best_gmm()` function
- **Purpose**: Model selection criterion balancing goodness-of-fit and complexity
- **Lower is Better**: Indicates better balance between fit and model simplicity
- **Penalty**: Lighter penalty for additional parameters than BIC
- **Use Case**: Preferred when sample size is small or moderate

### 2. **BIC (Bayesian Information Criterion)**
```
BIC = -2 × log_likelihood + num_parameters × ln(n_samples)
    = -2 × log_likelihood + k × ln(n)
```
- **Location**: `model.py` - `_select_best_gmm()` function
- **Purpose**: Bayesian approach to model selection; stricter penalty for complexity
- **Lower is Better**: Indicates better balance between fit and model simplicity
- **Penalty**: Stronger penalty for additional parameters than AIC (especially for large n)
- **Use Case**: Preferred selection criterion in this model (see code: `if bic < best_bic`)
- **Advantage**: Less likely to overfit; more conservative model selection

### 3. **Negative Log-Likelihood (Cross-Validation)**
```
NLL = -average_log_likelihood
    = -score_test(model_trained_on_train_set)
```
- **Location**: `model.py` - `_gmm_cross_validated_nll()` function
- **Range**: [0, ∞)
- **Purpose**: Measure generalization error via K-Fold cross-validation
- **Calculation**:
  1. Split data into K folds
  2. Train model on K-1 folds, test on 1 fold
  3. Compute average log-likelihood on test fold
  4. Negate to get NLL
- **Lower is Better**: Indicates better model generalization to unseen data
- **Output**: Returns `neg_log_likelihood_mean` and `neg_log_likelihood_std`

### 4. **Silhouette Score**
```
silhouette_score(X, labels)
= mean(silhouette_coefficient_per_sample)
```
- **Location**: `model.py` - `load_and_train()` function
- **Range**: [-1, 1]
- **Interpretation**:
  - **1.0**: Samples well separated and cohesive within clusters
  - **0.0**: Samples near boundary between clusters
  - **-1.0**: Samples assigned to wrong clusters
- **Purpose**: Assess quality of cluster separation without ground truth labels
- **Computation Condition**: Only computed if `len(df) > n_components` (more samples than clusters)

### 5. **Cluster Quality Score Formula**
```
quality_cluster_i = 0.30×gwa_norm + 0.25×survey_avg 
                  + 0.20×tech_norm + 0.15×soft_norm 
                  + 0.10×cert_norm
```
- **Location**: `model.py` - `_derive_cluster_levels()` function
- **Range**: [0, 1]
- **Weight Breakdown**:
  - **30%**: GPA/Academic performance (`gwa_norm`) - highest priority
  - **25%**: Survey competency average (`survey_avg`)
  - **20%**: Technical skills proficiency (`tech_norm`)
  - **15%**: Soft skills average (`soft_norm`)
  - **10%**: Certification count (`cert_norm`) - lowest priority
- **Purpose**: Rank clusters by employability potential for level assignment
- **Application**: Clusters ordered by quality score determine employability levels (Low/Moderate/High)

### 6. **Cluster Weight Formula**
```
weight_cluster_i = (quality_cluster_i - min_quality + ε) / Σ(shifted_qualities)
```
- **Location**: `model.py` - `_compute_cluster_weights()` function
- **Range**: [0, 1] (sums to 1.0)
- **Purpose**: Normalize cluster qualities into probability distribution
- **Computation**:
  1. Shift all quality scores: `shifted = quality - min_quality + ε` (ε = 1e-6 for numerical stability)
  2. Normalize: `weight = shifted / sum(shifted)`
- **Application**: Used as multiplier for GMM term in hybrid job scoring

---

## Feature Engineering & Normalization

### 1. **Academic Performance Normalization**
```
gwa_norm = (5.0 - gwa) / 4.0 ∈ [0, 1]
```
- **Purpose**: Inverse scaling (lower GPA = higher normalized score)
- **Location**: `model.py` - `_prepare_training_dataframe()`
- **Rationale**: GPA on scale 1-5 (1=best, 5=worst); normalize to 0=worst, 1=best

### 2. **Survey Competency Normalization**
```
survey_component = survey_score / 5.0 ∈ [0, 1]
```
- **Purpose**: Scale 1-5 Likert survey responses to [0, 1]
- **Components**: 9 survey categories (ethics, spirit, humanistic, cognition, design, system, development, teamwork, job-application)

### 3. **Technical Skills Normalization**
```
tech_skills_norm = (programming_langs + web_dev + database + tools) / 40.0 ∈ [0, 1]
```
- **Purpose**: Normalize count of distinct technology skills to [0, 1]
- **Max Value**: Assumes student can know max 40 distinct technologies

### 4. **Certification Normalization**
```
cert_norm = cert_count / 5.0 ∈ [0, 1]
```
- **Purpose**: Normalize certification count to [0, 1]
- **Max Value**: Assumes 5 certifications is "full coverage"

---

## Employability Scoring

### **Final Employability Score Formula**
```
score = (0.30×academic + 0.25×survey + 0.20×skills + 0.15×soft + 0.10×cert) × 100
```
- **Location**: `model.py` - `compute_score()` function
- **Range**: [0, 100]
- **Weight Distribution**:
  - **30%**: Academic performance (GPA) - primary driver
  - **25%**: Survey competency dimensions - second priority
  - **20%**: Technical skills breadth
  - **15%**: Soft skills average
  - **10%**: Certifications - complementary credential
- **Purpose**: Provide single interpretable score for student employability
- **Interpretation**: Combines multiple dimensions reflecting industry employability factors

---

## Hybrid Job Recommendation Scoring

### **Job Score Formula (GMM + ECLAT Hybrid)**
```
job_score = (JS_BETA × gmm_term) + ((1.0 - JS_BETA) × eclat_term)
where:
  gmm_term     = Σ(cluster_probability_i × cluster_weight_i)
  eclat_term   = Σ(rule_strength_i per cluster)
  JS_BETA      = 0.7 (weighting parameter)
```
- **Location**: `model.py` - `_rank_jobs_by_cosine()` function
- **Component Weights**:
  - **70%**: GMM cluster-based recommendations (data-driven from training patterns)
  - **30%**: ECLAT rule-based recommendations (skill-job association strength)
- **Purpose**: Combine unsupervised clustering (GMM) with rule mining (ECLAT)
- **Rationale**: GMM captures holistic employability; ECLAT captures skill-specific patterns

### **Cosine Similarity Formula**
```
similarity(vec_a, vec_b) = (a · b) / (||a|| × ||b||)
```
- **Location**: `model.py` - `_cosine_similarity()` function
- **Range**: [0, 1]
- **Purpose**: Measure angular similarity between student profile and job score vectors
- **Application**: Final ranking of jobs by alignment with student

---

## Summary Table

| Algorithm | Formula | Purpose | Location |
|-----------|---------|---------|----------|
| **ECLAT** | Support | Itemset frequency | `run_eclat()` |
| **ECLAT** | Confidence | Rule strength (conditional probability) | `run_eclat()` |
| **ECLAT** | Lift | Rule strength (correlation) | `run_eclat()` |
| **ECLAT** | Strength | Combined confidence × lift | `_build_student_rule_vector()` |
| **GMM** | AIC | Model complexity penalty (light) | `_select_best_gmm()` |
| **GMM** | BIC | Model complexity penalty (strict) | `_select_best_gmm()` |
| **GMM** | NLL (CV) | Generalization error | `_gmm_cross_validated_nll()` |
| **GMM** | Silhouette | Cluster separation quality | `load_and_train()` |
| **GMM** | Quality Score | Cluster employability ranking | `_derive_cluster_levels()` |
| **GMM** | Cluster Weight | Normalize quality to probability | `_compute_cluster_weights()` |
| **Scoring** | Score | Final employability (0-100) | `compute_score()` |
| **Scoring** | Job Score | Hybrid recommendation ranking | `_rank_jobs_by_cosine()` |
| **Scoring** | Similarity | Vector alignment (final ranking) | `_cosine_similarity()` |

---

## Key Parameters

- **`min_support`**: Minimum fraction of transactions for itemsets (default: 0.2)
- **`min_confidence`**: Minimum conditional probability for rules (default: 0.6)
- **`ES_ALPHA`**: Employment satisfaction weighting (default: 0.7)
- **`JS_BETA`**: GMM vs ECLAT weighting in job score (default: 0.7)
- **`CV_FOLDS`**: K-Fold cross-validation splits (default: 5)
- **`N_COMPONENTS`**: Default GMM clusters (default: 5)
- **`MAX_COMPONENTS`**: Maximum GMM clusters to evaluate (default: 8)
- **`MIN_COMPONENTS`**: Minimum GMM clusters (default: 2)

---

**Generated**: 2026-05-07  
**Algorithm**: Gaussian Mixture Model (GMM) + ECLAT Association Rule Mining  
**Purpose**: Student employability prediction and job recommendation
