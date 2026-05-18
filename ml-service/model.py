import os
import numpy as np
import pandas as pd
from math import ceil
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score
from sklearn.model_selection import KFold, StratifiedKFold
from sklearn.preprocessing import StandardScaler

DEFAULT_CLUSTER_LABELS = [
    "Developer Track",
    "Data Analyst Track",
    "Researcher Track",
    "Tester Track",
    "General IT Track",
]

OFFICIAL_DATASET_MIN_REQUIRED_COLUMNS = {
    "GPA",
    "Professional Literacy",
    "Technical Skills",
    "Soft Skills",
    "Cert_Count",
    "Employment",
    "Job_Type",
    "ComProg",
    "DiscreteStructures",
    "OOP",
    "ComGraphics",
    "IOT",
    "NetCom",
    "Practicum",
}

# Keep clustering features independent from target-like columns.
# GMM uses transformed numeric evidence only, while categorical/target columns
# are reserved for labeling, validation, and ECLAT transactions.
GMM_NUMERIC_SOURCE_COLUMNS = {
    "ComProg",
    "DiscreteStructures",
    "OOP",
    "ComGraphics",
    "IOT",
    "NetCom",
    "Practicum",
    "GPA",
    "YearsCode",
    "YearsCodePro",
    "ComputerSkills",
    "Professional Literacy",
    "Technical Skills",
    "Soft Skills",
    "Cert_Count",
    "Cert_Weight",
}

FEATURE_NAMES = [
    "gwa_norm",
    "survey_avg",
    "professional_ethics",
    "scientific_spirit",
    "humanistic_quality",
    "computer_cognition",
    "software_design",
    "system_usage",
    "sustainable_development",
    "team_capacity",
    "job_application",
    "tech_skills_norm",
    "soft_skills_avg",
    "cert_norm",
]

RUNTIME_BASE_FEATURE_NAMES = FEATURE_NAMES.copy()

N_COMPONENTS = 5
MIN_COMPONENTS = 5
MAX_COMPONENTS = 8
ES_ALPHA = 0.7
JS_BETA = 0.7
CV_FOLDS = 5
EMPLOYABILITY_LEVELS = ["Low Employability", "Moderate Employability", "High Employability"]
INVALID_JOB_TYPES = {"Unemployed", "Student", "General IT"}

gmm_model = None
scaler = None
training_info = {}
dataset_path = None
training_transactions = []
cluster_level_map: dict[int, str] = {}
cluster_quality_scores: dict[int, float] = {}
cluster_employment_rates: dict[int, float] = {}
cluster_strength_scores: dict[int, float] = {}
cluster_label_names: dict[int, str] = {}
cluster_job_recommendations: dict[int, list[str]] = {}
global_job_recommendations: list[str] = []
dynamic_eclat_rules: list[dict] = []
job_level_lookup: dict[str, str] = {}
cluster_eclat_rules: dict[int, list[dict]] = {}
cluster_weights: dict[int, float] = {}
job_cluster_profiles: dict[str, np.ndarray] = {}
job_rule_strengths: dict[str, np.ndarray] = {}
training_cluster_probabilities: np.ndarray | None = None
gmm_selection_scores: list[dict] = []
training_feature_matrix: np.ndarray | None = None
training_cluster_assignments: np.ndarray | None = None
training_job_types: list[str] = []
training_employment_targets: np.ndarray | None = None
training_employability_scores: np.ndarray | None = None
training_direct_employability_scores: np.ndarray | None = None
status_fusion_alpha: float = 0.5
status_low_threshold: float = 0.33
status_high_threshold: float = 0.66
runtime_feature_names: list[str] = RUNTIME_BASE_FEATURE_NAMES.copy()
runtime_feature_defaults: dict[str, float] = {name: 0.0 for name in RUNTIME_BASE_FEATURE_NAMES}
LOCAL_JOB_NEIGHBOR_COUNT = 10
job_type_model = None
job_type_encoder = None


def read_dataset(data_path: str) -> pd.DataFrame:
    ext = os.path.splitext(data_path)[1].lower()
    if ext == ".csv":
        return pd.read_csv(data_path)
    if ext in [".xlsx", ".xls"]:
        return pd.read_excel(data_path)
    raise ValueError(f"Unsupported dataset extension: {ext}. Use .csv, .xlsx, or .xls")


def _safe_num(series: pd.Series, fill: float = 0.0) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(fill)


def _impute_numeric(series: pd.Series, fallback: float = 0.0) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    valid = numeric.dropna()
    if valid.empty:
        return numeric.fillna(fallback)
    skewness = float(valid.skew()) if len(valid) > 2 else 0.0
    center = float(valid.median()) if abs(skewness) > 1.0 else float(valid.mean())
    return numeric.fillna(center)


def _cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    # Cosine Similarity Formula: similarity = (a · b) / (||a|| * ||b||)
    # Measures the angle between two vectors; range [0, 1] where 1 = identical direction
    denom = float(np.linalg.norm(vec_a) * np.linalg.norm(vec_b))
    if denom <= 1e-12:
        return 0.0
    return float(np.dot(vec_a, vec_b) / denom)


def _count_semicolon_items(series: pd.Series) -> pd.Series:
    text = series.fillna("").astype(str).str.strip()
    return text.apply(lambda value: 0 if not value else len([item for item in value.split(";") if item.strip()]))


def _normalize_job_title(value: str) -> str:
    raw = str(value or "").strip()
    if not raw or raw.lower() == "nan":
        return "General IT"
    return raw.title() if raw.islower() else raw


def _normalize_token(value: str) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    clean = "".join(ch if ch.isalnum() else "_" for ch in text)
    while "__" in clean:
        clean = clean.replace("__", "_")
    return clean.strip("_")


def _pretty_skill(token: str) -> str:
    normalized = _normalize_token(token)
    display_overrides = {
        "aws": "AWS",
        "google_cloud": "Google Cloud",
        "google_cloud_platform": "Google Cloud Platform",
        "sql": "SQL",
        "mysql": "MySQL",
        "postgresql": "PostgreSQL",
        "sqlite": "SQLite",
        "mongodb": "MongoDB",
        "react_js": "React.js",
        "node_js": "Node.js",
        "express_js": "Express.js",
        "html_css": "HTML/CSS",
        "bash_shell": "Bash/Shell",
        "asp_net": "ASP.NET",
        "asp_net_core": "ASP.NET Core",
        "c_sharp": "C#",
        "c_plusplus": "C++",
        "javascript": "JavaScript",
        "typescript": "TypeScript",
        "php": "PHP",
        "iot": "IoT",
        "powershell": "PowerShell",
    }
    if normalized in display_overrides:
        return display_overrides[normalized]
    return " ".join(part.capitalize() for part in normalized.split("_") if part)


SURVEY_CATEGORY_LABELS: dict[str, str] = {
    "professional_ethics": "professional ethics",
    "scientific_spirit": "scientific spirit",
    "humanistic_quality": "humanistic quality",
    "computer_cognition": "computer cognition",
    "software_design": "software design",
    "system_usage": "system usage",
    "sustainable_development": "sustainable development",
    "team_capacity": "team capacity",
    "job_application": "job application",
}

SURVEY_CATEGORY_RECOMMENDATIONS: dict[str, str] = {
    "professional_ethics": "Attend ethics and workplace-readiness sessions, then apply those standards in team projects.",
    "scientific_spirit": "Join a mini research or innovation project to improve your analytical and experimentation mindset.",
    "humanistic_quality": "Practice empathy and user-centered communication in collaborative activities and project work.",
    "computer_cognition": "Review core computer science concepts weekly and apply them in coding exercises.",
    "software_design": "Practice OOP and design patterns by refactoring one existing project module each week.",
    "system_usage": "Increase hands-on exposure to operating systems, networking, and deployment workflows.",
    "sustainable_development": "Incorporate secure, maintainable, and sustainable engineering practices in your projects.",
    "team_capacity": "Take active roles in group projects to improve collaboration, accountability, and leadership.",
    "job_application": "Prepare job materials and interviews through mock interviews, resume reviews, and portfolio updates.",
}


def _priority_label(weight: float) -> str:
    if weight >= 0.30:
        return "High priority"
    if weight >= 0.15:
        return "Medium priority"
    return "Priority"


# ---------------------------------------------------------------------------
# Skill-specific action plan bank.
# Keys: normalized skill token (output of _normalize_token).
# Values: list of concise, actionable advice strings. Use {role} placeholder.
# The system picks the best matching entry and rotates through its variants.
# ---------------------------------------------------------------------------
SKILL_ACTION_BANK: dict[str, list[str]] = {
    # --- Programming Languages ---
    "python": [
        "Complete a Python project end-to-end — scraping, data processing, or automation — and push it to GitHub. {role} teams expect you to show, not just tell.",
        "Work through Python's standard library (os, json, datetime, itertools) and replace manual scripts with cleaner built-in solutions. This is table stakes for {role} interviews.",
        "Build a REST API with FastAPI or Flask, deploy it to Render or Railway for free, and link it in your portfolio. {role} hiring managers value deployed projects.",
        "Study Python's data structures and practice LeetCode Easy/Medium in Python until you can solve them under 30 minutes. {role} technical screens almost always include this.",
        "Pick one Python library relevant to {role} work (pandas, requests, SQLAlchemy, celery) and ship a small working tool using it.",
    ],
    "java": [
        "Rebuild a small school project in Java using OOP principles — inheritance, interfaces, and proper encapsulation. {role} interviewers probe OOP depth heavily.",
        "Learn Spring Boot basics and build a simple CRUD REST API. It's the standard entry point for {role} backend developer positions.",
        "Practice Java collections and streams on HackerRank. Being fluent in List, Map, Set operations and lambda syntax is expected for {role} roles.",
        "Study Java concurrency (threads, ExecutorService, synchronized) using a hands-on tutorial — concurrency bugs are a common {role} interview topic.",
        "Set up a Java Maven or Gradle project from scratch, write unit tests with JUnit, and document the setup in a README. {role} employers check if you know project structure.",
    ],
    "javascript": [
        "Build a working single-page app with vanilla JavaScript (no frameworks) to prove you understand the DOM, events, and fetch API. {role} teams test JS fundamentals.",
        "Study async JavaScript deeply — callbacks, promises, async/await, and error handling. Misusing async is a top reason {role} candidates fail interviews.",
        "Learn ES6+ features (destructuring, spread, modules, optional chaining) and refactor an old project to use them. Modern {role} codebases expect this.",
        "Pick a real problem and build a browser extension or bookmarklet in JS. It's a quick, deployable project that stands out in a {role} portfolio.",
        "Practice JavaScript closures, prototypes, and the event loop on JSFiddle or CodePen and write explanations in your own words — these are classic {role} interview questions.",
    ],
    "typescript": [
        "Convert one of your JavaScript projects to TypeScript. The discipline of adding types reveals architecture problems and shows {role} interviewers you write maintainable code.",
        "Learn TypeScript generics and utility types (Partial, Pick, Omit, Record) through the official docs, then apply them to a project. {role} companies use these daily.",
        "Build a typed REST API with Express + TypeScript and share it on GitHub. {role} full-stack positions increasingly require TypeScript fluency.",
        "Study TypeScript's strict mode — turn it on in a project and fix every error. Understanding why things fail teaches you more than tutorials. {role} teams respect this rigor.",
        "Use TypeScript with React to build a component library. Typed props and custom hooks are standard in {role} frontend workflows.",
    ],
    "php": [
        "Build a custom PHP application (blog, inventory, booking system) without a framework first — understand routing, sessions, and PDO before relying on abstractions. {role} teams test PHP fundamentals.",
        "Learn Laravel and recreate a simple CRUD app you already built. Laravel proficiency is practically required for {role} PHP developer roles in the Philippines.",
        "Study PHP security: SQL injection via prepared statements, XSS escaping, CSRF tokens, and password hashing with password_hash(). {role} interviews ask about this directly.",
        "Practice PHP OOP — classes, traits, interfaces, and dependency injection. Modern {role} PHP codebases are far removed from procedural scripts.",
        "Set up a PHP project with Composer, add PHPUnit tests, and configure a basic CI pipeline on GitHub Actions. {role} employers want to see professional tooling.",
    ],
    "c": [
        "Implement classic data structures (linked list, stack, queue, BST) in C from scratch. Memory management in C is the deepest test of your understanding, valued in {role} systems roles.",
        "Study C pointers, memory allocation (malloc/free), and buffer safety. These are foundational for {role} embedded or systems programming positions.",
        "Build a command-line tool in C (e.g., a simple text processor or file parser) and distribute it. Shipping something real in C impresses {role} interviewers.",
        "Read K&R 'The C Programming Language' and implement each exercise. It's short and dense — finishing it signals real commitment to {role} low-level work.",
        "Practice debugging C programs with GDB or Valgrind. Knowing your debugging tools sets serious {role} systems candidates apart.",
    ],
    "c_sharp": [
        "Build a .NET console app or Web API with C# and deploy it. .NET Core is widely used in {role} enterprise environments in the Philippines.",
        "Study C# LINQ deeply — it's everywhere in professional C# codebases and almost every {role} .NET interview tests it.",
        "Learn async/await patterns in C# and build a small app that does concurrent I/O. {role} backend developers are expected to handle async code correctly.",
        "Build a desktop app with WinForms or WPF, or a web app with Blazor. Knowing the .NET UI ecosystem is a plus for {role} full-stack roles.",
        "Take the free Microsoft Learn C# path and complete the exercises — it's structured, official, and recognized by {role} .NET employers.",
    ],
    "c_plusplus": [
        "Implement a simple game or simulation in C++ using classes and STL containers. It's the classic {role} systems/game dev portfolio piece.",
        "Study C++ smart pointers (unique_ptr, shared_ptr, weak_ptr) — manual memory management is where most {role} C++ candidates stumble in interviews.",
        "Practice competitive programming in C++ on Codeforces or ICPC problems. Speed and accuracy in C++ is highly valued for {role} algorithmic roles.",
        "Learn CMake and build a multi-file C++ project with proper includes and linking. {role} employers expect you to manage a real build system.",
        "Read 'Effective Modern C++' by Scott Meyers (or summaries online) and apply move semantics to a project. {role} senior C++ positions test these concepts.",
    ],
    "python_django": [
        "Build a full Django project with authentication, models, views, and templates. Deploy it on Render or PythonAnywhere. {role} web dev roles expect deployed Django projects.",
        "Learn Django REST Framework and build a JSON API consumed by a React or Vue frontend. This full-stack combination is highly sought by {role} employers.",
        "Study Django ORM deeply — select_related, prefetch_related, annotate, and Q objects. Slow ORM queries are a classic {role} bug you'll be expected to fix.",
        "Add pytest-django tests to an existing Django project and get to 80% coverage. {role} senior developers write tests; showing tests in your repo is a differentiator.",
        "Configure Django settings for production: environment variables, static files, database pooling, and security headers. {role} DevOps-aware developers are in high demand.",
    ],
    "flask": [
        "Build a Flask REST API, add JWT authentication, and connect it to a database. This is the standard {role} Python backend starter project.",
        "Deploy a Flask app on Heroku or Render with a PostgreSQL add-on. Shipping to production — even a free tier — demonstrates real {role} readiness.",
        "Study Flask blueprints and application factory pattern. Structuring Flask for scale is what separates junior from mid-level {role} developers.",
        "Add Swagger/OpenAPI docs to your Flask API using flask-restx or flasgger. Documentation is expected in {role} professional environments.",
        "Write integration tests for your Flask routes using pytest and the Flask test client. {role} backend teams require testable code.",
    ],
    # --- Web Development ---
    "react": [
        "Build a multi-page React app with React Router, global state management (Context API or Zustand), and real API calls. {role} frontend roles expect this level of experience.",
        "Study React hooks deeply — useEffect dependencies, custom hooks, useCallback, useMemo. Misusing hooks causes subtle bugs that {role} interviewers look for.",
        "Convert a class-based React project to functional components with hooks. It's good practice and most {role} codebases no longer use class components.",
        "Add TypeScript to a React project and type all props, state, and API responses. {role} frontend teams increasingly require TypeScript + React fluency.",
        "Deploy a React app on Vercel, connect it to a real backend, and put the live URL in your resume. {role} hirers want to see your work live, not just on GitHub.",
    ],
    "react_js": [
        "Build a multi-page React app with React Router, global state management (Context API or Zustand), and real API calls. {role} frontend roles expect this level of experience.",
        "Study React hooks deeply — useEffect dependencies, custom hooks, useCallback, useMemo. Misusing hooks causes subtle bugs that {role} interviewers look for.",
        "Convert a class-based React project to functional components with hooks. It's good practice and most {role} codebases no longer use class components.",
        "Add TypeScript to a React app and type all props, state, and API responses. {role} frontend teams increasingly require TypeScript + React fluency.",
        "Deploy a React app on Vercel, connect it to a real backend, and put the live URL in your resume. {role} hirers want to see your work live, not just on GitHub.",
    ],
    "vue": [
        "Build a Vue 3 app using the Composition API and connect it to a REST backend. The Composition API is standard in modern {role} Vue projects.",
        "Study Vue Router and Pinia (the official Vuex replacement) and rebuild a small SPA with proper state management. {role} Vue positions expect this stack.",
        "Convert an Options API component to Composition API. It reinforces your understanding and mirrors what {role} Vue teams actually do in code reviews.",
        "Add Vite to a Vue project and configure it for production builds. {role} developers are expected to understand the build pipeline, not just write components.",
        "Write component tests with Vitest and Vue Test Utils. Testable components signal {role} team-readiness.",
    ],
    "angular": [
        "Build an Angular app with services, routing, reactive forms, and HTTP calls. This covers what most {role} Angular job listings require.",
        "Study Angular's dependency injection and module system deeply — it's different from React and Vue and is a key {role} Angular interview topic.",
        "Learn RxJS operators (map, switchMap, combineLatest, catchError) through Angular examples. RxJS fluency is the hardest part of the {role} Angular learning curve.",
        "Build a feature module in Angular with lazy loading. Lazy loading is expected in production {role} Angular apps.",
        "Take the official Angular Tour of Heroes tutorial, then extend it with a feature you design yourself. Self-directed addition shows {role} initiative.",
    ],
    "node_js": [
        "Build a Node.js REST API with Express, connect it to MongoDB or PostgreSQL, add JWT auth, and deploy it. This is the baseline {role} Node backend project.",
        "Study Node.js event loop, non-blocking I/O, and streams. Understanding why Node is fast (and when it isn't) is expected in {role} backend interviews.",
        "Use Node.js to build a CLI tool or automation script that solves a real problem. Publishing it to npm or GitHub shows {role} initiative.",
        "Learn Node.js clustering and worker threads for CPU-bound tasks. {role} senior developers are expected to handle performance and scale.",
        "Add proper error handling, logging (winston or pino), and environment config (dotenv) to a Node project. Production-readiness is what separates {role} juniors from seniors.",
    ],
    "nodejs": [
        "Build a Node.js REST API with Express, connect it to MongoDB or PostgreSQL, add JWT auth, and deploy it. This is the baseline {role} Node backend project.",
        "Study Node.js event loop, non-blocking I/O, and streams. Understanding why Node is fast (and when it isn't) is expected in {role} backend interviews.",
        "Use Node.js to build a CLI tool or automation script that solves a real problem. Publishing it to npm or GitHub shows {role} initiative.",
        "Learn Node.js clustering and worker threads for CPU-bound tasks. {role} senior developers are expected to handle performance and scale.",
        "Add proper error handling, logging (winston or pino), and environment config (dotenv) to a Node project. Production-readiness sets {role} juniors apart from seniors.",
    ],
    "express": [
        "Build a full CRUD API with Express, structure it with controllers/routes/middleware, and add input validation (express-validator or zod). {role} teams expect clean API design.",
        "Add JWT authentication middleware to an Express API — protect routes and handle token expiry. This is standard {role} backend security practice.",
        "Write integration tests for your Express routes using supertest + jest. {role} backend teams require testable APIs.",
        "Study Express error handling middleware and implement a centralized error handler with proper HTTP status codes. {role} code reviews always check error handling.",
        "Rate-limit and sanitize inputs on your Express API using helmet and express-rate-limit. {role} employers look for security awareness.",
    ],
    "express_js": [
        "Build a full CRUD API with Express, structure it with controllers/routes/middleware, and add input validation. {role} teams expect clean API design.",
        "Add JWT authentication middleware to an Express API — protect routes and handle token expiry. This is standard {role} backend security practice.",
        "Write integration tests for your Express routes using supertest + jest. {role} backend teams require testable APIs.",
        "Study Express error handling middleware and implement a centralized error handler. {role} code reviews always check this.",
        "Rate-limit and sanitize inputs on your Express API using helmet and express-rate-limit. {role} employers look for security awareness.",
    ],
    "jquery": [
        "jQuery is still used in legacy systems — practice DOM manipulation, AJAX calls, and event delegation to handle real {role} maintenance work effectively.",
        "Build a dynamic UI component (modal, autocomplete, drag-and-drop) using jQuery only. Demonstrating jQuery depth helps in {role} roles that maintain older codebases.",
        "Learn how to progressively migrate jQuery-dependent code to vanilla JS or a modern framework. {role} teams often need developers who can modernize legacy code.",
        "Study jQuery AJAX patterns and understand how to handle promises vs callbacks in older codebases. {role} jobs supporting legacy apps expect this knowledge.",
        "Explore plugins like Select2, DataTables, or FullCalendar which are heavily used in {role} admin and enterprise apps built with jQuery.",
    ],
    "html_css": [
        "Build a fully responsive multi-page website from scratch using only HTML and CSS — no frameworks. Pixel-perfect layout control is a baseline {role} frontend skill.",
        "Learn CSS Grid and Flexbox thoroughly by rebuilding a real UI layout (a dashboard, a landing page). {role} frontend roles test layout skills directly.",
        "Implement a dark/light mode toggle and animated transitions using CSS variables. {role} UI-focused roles appreciate attention to UX detail.",
        "Study CSS accessibility: semantic HTML, ARIA labels, color contrast, and keyboard navigation. {role} frontend developers are increasingly expected to know this.",
        "Learn SASS/SCSS and refactor a plain CSS project. Variables, mixins, and nesting are standard in {role} professional frontend workflows.",
    ],
    "laravel": [
        "Build a Laravel app with Eloquent ORM, authentication, and API resources. This is the standard {role} PHP developer portfolio project in the Philippines.",
        "Learn Laravel Queues and Jobs for background processing. Knowing this separates junior from mid-level {role} Laravel developers.",
        "Study Laravel middleware, policies, and gates for authorization. {role} enterprise Laravel apps rely heavily on this layer.",
        "Write feature tests with Laravel's built-in testing tools and get meaningful coverage. {role} PHP teams expect testable code.",
        "Deploy a Laravel app to a shared host (like Hostinger) or cloud (like Railway). {role} employers want to see you can ship, not just develop locally.",
    ],
    # --- Database ---
    "sql": [
        "Practice SQL on Mode Analytics or SQLZoo — JOINs, subqueries, window functions, and aggregations. {role} data-adjacent interviews are almost always SQL-heavy.",
        "Design a normalized database schema for a real-world scenario (e-commerce, school system) and write queries against it. {role} positions expect schema design knowledge.",
        "Learn query optimization: EXPLAIN plans, indexes, and avoiding full table scans. Slow queries are a top {role} backend engineering problem.",
        "Study window functions (ROW_NUMBER, RANK, LAG, LEAD) — they appear in almost every {role} data analyst and backend interview.",
        "Build a reporting query layer for a project: group by, having, pivot-style aggregations. {role} analyst and backend roles require this daily.",
    ],
    "mysql": [
        "Set up a MySQL database locally, design a schema, and write complex queries using JOINs, subqueries, and aggregations. {role} backend and analyst interviews test this directly.",
        "Learn MySQL indexing — clustered vs secondary indexes, composite indexes, and EXPLAIN output. Slow MySQL queries are a daily {role} developer problem.",
        "Practice MySQL stored procedures and triggers on a sample dataset. {role} enterprise apps often rely on database-side logic.",
        "Migrate a project's raw SQL to a query builder (Knex.js) or ORM (Eloquent, Sequelize). Understanding both layers is expected in {role} mid-level roles.",
        "Study MySQL replication concepts and backup strategies. {role} DevOps-aware developers are more valuable to employers.",
    ],
    "postgresql": [
        "Learn PostgreSQL-specific features: JSONB columns, full-text search, window functions, and CTEs. They're standard in {role} data-heavy applications.",
        "Set up a PostgreSQL project with proper indexes, foreign keys, and constraints. {role} teams expect database design discipline, not just queries.",
        "Practice PostgreSQL EXPLAIN ANALYZE to diagnose slow queries. Query tuning is a core {role} backend skill.",
        "Use PostgreSQL with Sequelize or Prisma in a Node.js project and understand how the ORM maps to raw SQL. {role} developers need to debug ORM behavior.",
        "Study PostgreSQL roles, schemas, and row-level security. {role} enterprise databases use these for access control.",
    ],
    "mongodb": [
        "Build a MongoDB-backed API with Mongoose, use populate() for references, and add indexing on frequently queried fields. {role} Node.js developers are expected to know this stack.",
        "Study MongoDB aggregation pipeline — $match, $group, $lookup, $unwind. It replaces complex SQL for {role} document-centric use cases.",
        "Learn when NOT to use MongoDB — understand the trade-offs vs relational databases. {role} architects and senior developers are expected to justify data store choices.",
        "Practice MongoDB Atlas free tier: set up a cluster, create indexes, use Atlas Search. {role} cloud-first employers expect cloud DB experience.",
        "Study MongoDB schema design patterns: embedding vs referencing, bucket pattern, outlier pattern. Good schema design is what separates {role} senior from junior MongoDB developers.",
    ],
    "sqlite": [
        "Use SQLite as the backend for a Python, Flutter, or Electron desktop app. It's the go-to embedded DB for {role} lightweight application projects.",
        "Learn SQLite's limitations (no concurrent writes, no stored procedures) and know when to migrate to PostgreSQL. {role} developers need to make informed tech choices.",
        "Build a Python CLI tool backed by SQLite to manage data persistently. It's a fast, deployable project that shows {role} practical database skills.",
        "Study SQLite FTS5 (full-text search) for building a search feature in a desktop app. {role} developers in systems and desktop tracks use this.",
        "Practice SQLite with SQLAlchemy ORM and understand how the abstraction works. {role} Python developers frequently encounter SQLite in testing environments.",
    ],
    "redis": [
        "Implement Redis caching on top of an existing API — cache frequent queries and measure the speedup. {role} developers are expected to understand caching layers.",
        "Use Redis as a session store for a web app. Replace in-memory sessions and test behavior across server restarts. This is standard {role} backend architecture.",
        "Learn Redis pub/sub and build a simple real-time notification feature. {role} backend engineers use messaging patterns regularly.",
        "Study Redis data structures: strings, hashes, lists, sorted sets, and sets. Each has distinct use cases — {role} interviewers ask when to use which.",
        "Complete the free Redis University course (redis.io/university) and earn the certificate. It's free, official, and recognized by {role} employers who use Redis.",
    ],
    "firebase": [
        "Build a real-time app with Firestore and Firebase Authentication — to-do list, chat, or booking system. {role} mobile and web developers use Firebase extensively.",
        "Study Firestore security rules and write proper read/write restrictions. Insecure Firestore rules are a critical {role} developer mistake that interviewers ask about.",
        "Integrate Firebase Cloud Messaging for push notifications in a web or mobile app. {role} frontend and mobile roles increasingly require this.",
        "Learn Firebase Cloud Functions to add serverless backend logic. {role} full-stack developers use Functions to avoid maintaining a separate server.",
        "Study the Firestore data model: collections, documents, subcollections, and query limitations. Good Firestore design is what prevents {role} performance issues at scale.",
    ],
    # --- DevOps / Cloud / Tools ---
    "aws": [
        "Create an AWS Free Tier account, deploy a static site on S3, and put a working URL in your portfolio. {role} cloud-adjacent roles expect some hands-on AWS experience.",
        "Complete the AWS Cloud Practitioner (CLF-C02) certification — it's the entry point for {role} cloud careers and widely recognized by Philippine employers.",
        "Deploy a backend API on AWS EC2 or Elastic Beanstalk with a proper security group configuration. {role} developers who can self-deploy are much more hireable.",
        "Study AWS IAM roles, policies, and least-privilege principles. Misconfigured IAM is the #1 AWS security issue — {role} cloud developers must understand this.",
        "Learn AWS Lambda and API Gateway by building a serverless function. Serverless is a growing {role} architecture pattern especially in startups.",
    ],
    "google_cloud": [
        "Set up a Google Cloud project, deploy an app on Cloud Run, and connect it to Cloud SQL. {role} backend developers benefit from hands-on GCP experience.",
        "Study GCP IAM and service accounts. Proper access control is expected from any {role} cloud developer.",
        "Complete a Google Cloud Skills Boost learning path (free credits available). Structured GCP learning is recognized in {role} cloud job applications.",
        "Build a data pipeline using BigQuery and load a public dataset into it. {role} data analyst and data engineer positions highly value BigQuery experience.",
        "Deploy a containerized app to Google Kubernetes Engine. Container orchestration experience sets {role} DevOps candidates apart.",
    ],
    "docker": [
        "Containerize an existing project with Docker — write a Dockerfile, build the image, and run it locally. {role} developers who understand containers are far more hireable.",
        "Write a docker-compose.yml to run your app with a database side-by-side. {role} teams use Docker Compose for local development environments.",
        "Learn Docker networking, volumes, and environment variables. These are the troubleshooting points {role} developers hit most in containerized projects.",
        "Push a Docker image to Docker Hub or GitHub Container Registry and reference it in your README. {role} employers check if you know the publishing workflow.",
        "Study multi-stage Dockerfile builds to reduce image size. {role} DevOps-aware developers are expected to optimize images for production.",
    ],
    "kubernetes": [
        "Run a local Kubernetes cluster with Minikube or Kind and deploy a simple app. Understanding k8s fundamentals is increasingly expected for {role} backend and DevOps roles.",
        "Learn Kubernetes Deployments, Services, and ConfigMaps. These are the three objects {role} developers interact with most in k8s.",
        "Study Kubernetes resource limits and health checks (liveness/readiness probes). {role} production deployments require these for reliability.",
        "Complete the free Kubernetes basics tutorial on kubernetes.io. It's official, structured, and recognized by {role} cloud employers.",
        "Deploy a multi-service app on Kubernetes using Helm charts. Helm is standard in {role} enterprise Kubernetes environments.",
    ],
    "git": [
        "Practice Git branching strategies (feature branches, gitflow) on a real project with meaningful commit messages. {role} teams code-review your Git history.",
        "Study Git rebase, cherry-pick, and interactive rebase. Knowing how to rewrite history cleanly is expected from {role} mid-level developers.",
        "Set up a GitHub Actions CI workflow that runs tests on every push. Automated pipelines are standard in {role} professional workflows.",
        "Practice resolving merge conflicts deliberately — merge two branches with intentional conflicts and resolve them. {role} teams do this daily.",
        "Learn Git hooks (pre-commit, pre-push) and add a linter or formatter hook to a project. {role} teams often enforce code standards this way.",
    ],
    "github": [
        "Set up a well-documented GitHub profile: pinned repos, a profile README, and meaningful commit history. {role} recruiters check GitHub first.",
        "Contribute to an open-source project on GitHub — even fixing docs counts. {role} interviewers value demonstrated collaboration experience.",
        "Configure GitHub Actions to run tests and linting on pull requests. {role} teams use CI/CD pipelines; knowing how to set one up is a real skill.",
        "Use GitHub Projects or Issues to manage a personal project's tasks. {role} employers want to see you can manage work, not just code.",
        "Learn GitHub's fork + PR workflow by contributing to a classmate's or public project. This is how {role} professional teams collaborate.",
    ],
    "linux": [
        "Set up a Linux VM (Ubuntu on VirtualBox or WSL on Windows) and practice common admin tasks: file permissions, cron jobs, systemd services. {role} backend developers work in Linux daily.",
        "Learn bash scripting for automation — loops, conditionals, file processing. {role} DevOps and sysadmin roles rely on shell scripts constantly.",
        "Study Linux networking: ifconfig, netstat, ss, iptables basics. {role} developers who can debug network issues in Linux are much more valuable.",
        "Practice Linux file system navigation, user/group management, and log reading (journalctl, tail -f). {role} server-side interviews often test these basics.",
        "Set up an Nginx or Apache web server on Linux, configure virtual hosts, and serve a simple app. {role} developers who can deploy to a bare server stand out.",
    ],
    "bash_shell": [
        "Write a bash script that automates a real task you do manually (backups, log cleanup, deployment steps). {role} DevOps and systems roles expect shell scripting fluency.",
        "Study bash functions, error handling (set -e, trap), and argument parsing. Production {role} scripts need to fail gracefully.",
        "Practice regex in bash with grep, sed, and awk on real log files or CSV data. {role} sysadmin and data pipeline roles use these tools daily.",
        "Learn cron job syntax and schedule automated tasks. {role} backend and DevOps teams use cron for maintenance and monitoring.",
        "Write a deployment bash script that pulls code, runs migrations, restarts services, and logs output. This is what {role} DevOps candidates demonstrate in interviews.",
    ],
    "powershell": [
        "Automate a Windows admin task (user management, file operations, scheduled tasks) with a PowerShell script. {role} Windows sysadmin roles expect this.",
        "Study PowerShell pipelines and object-based data flow. PowerShell's object model is different from bash — {role} Windows developers leverage it for complex automation.",
        "Learn PowerShell remoting (Invoke-Command, Enter-PSSession) for managing remote Windows servers. {role} enterprise Windows environments rely on this.",
        "Use PowerShell to interact with REST APIs (Invoke-RestMethod) for automation workflows. {role} DevOps roles increasingly use PowerShell for CI/CD scripting.",
        "Study PowerShell error handling (try/catch and $ErrorActionPreference) so your scripts fail safely and are easier to debug. Reliable failure handling is important in {role} automation workflows.",
    ],
    # --- Data / ML / Analytics ---
    "python_data": [
        "Complete a data analysis project with pandas and matplotlib/seaborn using a public dataset from Kaggle. Put the notebook on GitHub. {role} data analyst portfolios need this.",
        "Learn pandas GroupBy, merge, and pivot_table operations thoroughly — these are the core of {role} tabular data work.",
        "Build a data cleaning pipeline that handles missing values, outliers, and type coercion. {role} analysts spend 80% of their time cleaning data.",
        "Study NumPy broadcasting and vectorized operations. Writing efficient array operations is expected for {role} numerical computing roles.",
        "Visualize a dataset with both static (matplotlib) and interactive (Plotly/Altair) charts. {role} data roles require you to communicate findings visually.",
    ],
    "machine_learning": [
        "Complete a Kaggle competition (even just submitting) with scikit-learn. The structured problem + leaderboard teaches you what textbooks don't. {role} ML positions expect competition experience.",
        "Implement a classic ML algorithm (logistic regression, decision tree) from scratch without sklearn. Understanding the math behind the model is what {role} ML interviews probe.",
        "Build an end-to-end ML pipeline: data → features → train → evaluate → export model. {role} ML engineers are expected to deliver complete pipelines.",
        "Study cross-validation, confusion matrix, precision/recall/F1, and ROC-AUC. Knowing which metric to use and why is critical in {role} ML interviews.",
        "Deploy a trained ML model as a REST API with FastAPI or Flask. {role} ML engineers who can ship models to production are far more hireable.",
    ],
    "data_analysis": [
        "Pick a public dataset (government data, Kaggle), analyze it, and present your findings as a clear report or dashboard. {role} analyst interviews ask for work samples.",
        "Practice SQL window functions and aggregations on a relational dataset. Most {role} analyst interviews are SQL-heavy.",
        "Build a dashboard in Google Looker Studio (free) or Power BI connected to a real data source. {role} analysts are expected to deliver visual reporting.",
        "Study statistical concepts: mean/median/mode, variance, correlation, and hypothesis testing basics. {role} analyst interviews often include a basic stats screen.",
        "Learn Excel/Google Sheets pivot tables, VLOOKUP/XLOOKUP, and conditional formatting — {role} analysts in Philippine companies still rely on these heavily.",
    ],
    "tableau": [
        "Build a Tableau Public dashboard using a real-world dataset and publish it. {role} analyst job postings frequently list Tableau as a required skill.",
        "Study Tableau calculated fields, table calculations, and LOD expressions. These are the advanced features that {role} senior analyst positions test.",
        "Connect Tableau to a live SQL database and build a refreshing report. {role} BI roles use live connections in production dashboards.",
        "Earn the Tableau Desktop Specialist certification. It's entry-level, affordable, and recognized in {role} analyst job applications.",
        "Replicate a complex BI report you've seen as a Tableau dashboard. Reverse-engineering real reports builds {role} analyst skills faster than tutorials.",
    ],
    "power_bi": [
        "Build a Power BI report connected to a spreadsheet or database and publish it to Power BI Service. {role} analyst roles in Philippine companies rely heavily on Power BI.",
        "Learn DAX basics: CALCULATE, SUMX, FILTER, and time intelligence functions. DAX fluency is what separates {role} junior from mid-level Power BI analysts.",
        "Study Power Query for data transformation. Knowing Power Query reduces your dependence on Excel pre-processing — a key {role} analyst efficiency skill.",
        "Earn the PL-300 (Power BI Data Analyst) certification. It's the official Microsoft cert for {role} BI roles.",
        "Build a paginated report using Power BI Report Builder — {role} enterprise clients often request this format for printing and distribution.",
    ],
    # --- Mobile ---
    "flutter": [
        "Build and deploy a Flutter app to Android (APK) or publish to the Play Store. Having a live mobile app is the strongest {role} mobile developer portfolio piece.",
        "Study Flutter state management: Provider, Riverpod, or Bloc. Choosing and using state management correctly is the {role} Flutter interview differentiator.",
        "Integrate Firebase into a Flutter app — Authentication, Firestore, and push notifications. This stack is standard in {role} Philippine mobile development.",
        "Learn Flutter navigation with GoRouter and build an app with 3+ routes. Navigation complexity is a common {role} interview topic.",
        "Practice Flutter UI: custom painters, animations, and responsive layouts. {role} mobile employers look for polished UI skills, not just functionality.",
    ],
    "react_native": [
        "Build and run a React Native app on Android using Expo. A real, working app in the Play Store is the strongest {role} mobile portfolio item.",
        "Study React Native navigation with React Navigation v6 — stack, tab, and drawer navigators. Navigation is one of the first things {role} mobile interviews test.",
        "Integrate REST APIs in React Native using axios + async storage for caching. {role} apps always talk to backends — show you can connect them.",
        "Learn how to access native device features (camera, location, notifications) in React Native. {role} mobile roles require bridging web concepts to native capabilities.",
        "Optimize React Native performance: FlatList for large lists, memoization, and avoiding re-renders. {role} senior mobile interviews probe performance awareness.",
    ],
    "kotlin": [
        "Build a native Android app with Kotlin and Jetpack Compose. Compose is now the standard {role} Android UI framework — tutorials using XML views are outdated.",
        "Study Kotlin coroutines and Flow for async programming. Coroutines replace callbacks in modern {role} Android development.",
        "Learn Android ViewModel and LiveData/StateFlow for UI state management. The MVVM architecture is standard in {role} Android roles.",
        "Add Room database to an Android Kotlin app for local persistence. {role} Android developers are expected to know the Jetpack libraries.",
        "Submit an app to the Google Play Store (even free tier) and put the listing link in your resume. Published apps strongly support {role} mobile developer applications.",
    ],
    "swift": [
        "Build an iOS app with Swift and SwiftUI — the modern {role} iOS framework. UIKit-only experience is increasingly considered legacy.",
        "Study Swift Combine or async/await for reactive and async programming. {role} iOS apps are async by nature — event-driven code is unavoidable.",
        "Learn Core Data or SwiftData for local persistence in an iOS app. {role} iOS developers are expected to handle offline data scenarios.",
        "Submit an app to the App Store or TestFlight and document the experience. {role} iOS employers want to see you've navigated Apple's ecosystem.",
        "Study Swift generics, protocols, and protocol-oriented programming. Apple's frameworks are protocol-heavy — {role} iOS interviews probe this deeply.",
    ],
}

# Fallback generic templates for skills not in the bank above
_GENERIC_TEMPLATES = [
    "{priority}: Earn a recognized {skill} certification from Coursera, Udemy, or the official vendor — employers hiring for {role} positions actively look for it.",
    "{priority}: Build a portfolio project that uses {skill} to solve a real problem relevant to {role} work. A working GitHub project speaks louder than a certificate alone.",
    "{priority}: Contribute to an open-source project that uses {skill}. Even small contributions give you concrete experience to discuss in {role} interviews.",
    "{priority}: Practice {skill} weekly through hands-on labs (Katacoda, AWS Skill Builder, HackerRank, etc.) — consistent practice is how {role} candidates stand out.",
    "{priority}: Apply {skill} inside an existing school or personal project. Real-context usage builds the confidence that {role} hiring managers are looking for.",
]


def _build_improvement_action(skill_token: str, job: str, weight: float = 0.0, evidence_count: int = 0, index: int = 0) -> str:
    skill = _pretty_skill(skill_token)
    role = str(job or "target role").strip()
    priority = _priority_label(weight)
    evidence_note = f" ({evidence_count} data patterns confirm this gap)" if evidence_count > 0 else ""

    normalized = _normalize_token(skill_token)

    # Try exact match first, then partial key match
    bank_entries = SKILL_ACTION_BANK.get(normalized)
    if bank_entries is None:
        for key in SKILL_ACTION_BANK:
            if key in normalized or normalized in key:
                bank_entries = SKILL_ACTION_BANK[key]
                break

    if bank_entries:
        template = bank_entries[index % len(bank_entries)]
        return f"{priority}: {template.format(role=role)}{evidence_note}"

    # Fallback to generic templates
    template = _GENERIC_TEMPLATES[index % len(_GENERIC_TEMPLATES)]
    return template.format(priority=priority, skill=skill, role=role) + evidence_note


SKILL_ALIASES: dict[str, set[str]] = {
    "git": {"github"},
    "github": {"git"},
    "node_js": {"nodejs", "node", "javascript"},
    "nodejs": {"node_js", "node", "javascript"},
    "react": {"react_js"},
    "react_js": {"react"},
    "express": {"express_js"},
    "express_js": {"express"},
    "html": {"html_css"},
    "css": {"html_css"},
    "mysql": {"sql"},
    "postgresql": {"sql"},
    "sqlite": {"sql"},
    "mongodb": {"nosql"},
}

TECH_CATEGORY_PRIORITY = [
    "Programming Languages",
    "Web Development",
    "Database",
    "Tools",
]

RULE_CONTEXT_PREFIXES = {
    "cert_type:",
    "major:",
    "edlevel:",
    "employment:",
    "gender:",
    "age:",
}


def _normalize_display_skill(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    lowered = text.lower()
    special = {
        "react.js": "React.js",
        "node.js": "Node.js",
        "express.js": "Express.js",
        "asp.net": "ASP.NET",
        "asp.net core": "ASP.NET Core",
        "html/css": "HTML/CSS",
        "bash/shell": "Bash/Shell",
        "c#": "C#",
        "c++": "C++",
        "javascript": "JavaScript",
        "typescript": "TypeScript",
        "php": "PHP",
        "sql": "SQL",
        "mysql": "MySQL",
        "postgresql": "PostgreSQL",
        "sqlite": "SQLite",
        "mongodb": "MongoDB",
        "aws": "AWS",
        "git": "Git",
        "github": "GitHub",
        "kubernetes": "Kubernetes",
    }
    if lowered in special:
        return special[lowered]
    if text.isupper() and len(text) <= 6:
        return text
    return " ".join(part.capitalize() for part in text.split())


def _categorize_dataset_skill(skill_name: str) -> str:
    token = _normalize_token(skill_name)
    language_tokens = {
        "python", "java", "javascript", "typescript", "c", "c_sharp", "c_plusplus", "php", "go", "rust",
        "kotlin", "swift", "dart", "r", "matlab", "ruby", "scala", "perl", "sql", "bash_shell", "shell",
    }
    web_tokens = {
        "html", "css", "html_css", "react", "react_js", "node", "node_js", "nodejs", "express", "express_js",
        "angular", "vue", "jquery", "laravel", "django", "flask", "asp_net", "asp_net_core",
    }
    database_tokens = {
        "mysql", "postgresql", "sqlite", "mongodb", "microsoft_sql_server", "oracle", "firebase", "elasticsearch",
        "redis", "nosql",
    }
    if token in language_tokens:
        return "Programming Languages"
    if token in web_tokens:
        return "Web Development"
    if token in database_tokens:
        return "Database"
    return "Tools"


def _expand_student_skills(skills: set[str]) -> set[str]:
    expanded = set(skills)
    for skill in list(skills):
        expanded |= SKILL_ALIASES.get(skill, set())
    return expanded


def _extract_skill_tokens(skills_raw: str) -> set[str]:
    parts = [s.strip() for s in str(skills_raw or "").split(";") if s.strip()]
    tokens = set()
    for part in parts:
        normalized = _normalize_token(part)
        if normalized:
            tokens.add(f"skill:{normalized}")
    return tokens


def _extract_prefixed_tokens(raw_value: str, prefix: str) -> set[str]:
    text = str(raw_value or "").strip()
    if not text or text.lower() == "nan":
        return set()
    normalized_text = text.replace(",", ";")
    tokens = set()
    for part in [item.strip() for item in normalized_text.split(";") if item.strip()]:
        token = _normalize_token(part)
        if token:
            tokens.add(f"{prefix}:{token}")
    return tokens


def _employment_token(raw_value) -> str:
    text = str(raw_value or "").strip()
    if not text or text.lower() == "nan":
        return ""

    try:
        numeric = float(text)
        return "employment:employed" if numeric >= 1.0 else "employment:not_employed"
    except (TypeError, ValueError):
        token = _normalize_token(text)
        if not token:
            return ""
        employed_aliases = {
            "employed", "full_time", "part_time", "self_employed", "freelance", "contract",
        }
        unemployed_aliases = {"unemployed", "student", "looking_for_work", "not_employed"}
        if token in employed_aliases:
            return "employment:employed"
        if token in unemployed_aliases:
            return "employment:not_employed"
        return f"employment:{token}"


def _age_bucket_token(raw_value) -> str:
    text = str(raw_value or "").strip()
    if not text or text.lower() == "nan":
        return ""
    try:
        age = float(text)
    except (TypeError, ValueError):
        return ""

    if age < 22:
        return "age:under_22"
    if age < 26:
        return "age:22_to_25"
    if age < 31:
        return "age:26_to_30"
    return "age:31_plus"


def _prepare_training_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    columns = set(df.columns.astype(str))

    if OFFICIAL_DATASET_MIN_REQUIRED_COLUMNS.issubset(columns):
        prepared = pd.DataFrame(index=df.index)

        gpa = _impute_numeric(df["GPA"], 3.0).clip(1.0, 5.0)
        prepared["gwa_norm"] = ((5.0 - gpa) / 4.0).clip(0.0, 1.0)

        prof_lit = (_impute_numeric(df["Professional Literacy"], 60.0).clip(0.0, 100.0) / 100.0)
        tech_score = (_impute_numeric(df["Technical Skills"], 50.0).clip(0.0, 100.0) / 100.0)
        soft_score = (_impute_numeric(df["Soft Skills"], 50.0).clip(0.0, 100.0) / 100.0)
        cert_norm = (_impute_numeric(df["Cert_Count"], 0.0).clip(lower=0.0) / 5.0).clip(0.0, 1.0)
        employment = _impute_numeric(df["Employment"], 0.0).clip(0.0, 1.0)
        years_code = (_impute_numeric(df.get("YearsCode", pd.Series(np.nan, index=df.index)), 0.0).clip(0.0, 20.0) / 20.0)
        years_code_pro = (_impute_numeric(df.get("YearsCodePro", pd.Series(np.nan, index=df.index)), 0.0).clip(0.0, 15.0) / 15.0)
        computer_skills = (_impute_numeric(df.get("ComputerSkills", pd.Series(np.nan, index=df.index)), 0.0).clip(0.0, 25.0) / 25.0)
        worked_with = (_count_semicolon_items(df.get("HaveWorkedWith", pd.Series("", index=df.index))).clip(0, 30) / 30.0)

        comprog = (_impute_numeric(df["ComProg"], 3.0).clip(0.0, 5.0) / 5.0)
        discrete = (_impute_numeric(df["DiscreteStructures"], 3.0).clip(0.0, 5.0) / 5.0)
        oop = (_impute_numeric(df["OOP"], 3.0).clip(0.0, 5.0) / 5.0)
        comgraphics = (_impute_numeric(df["ComGraphics"], 3.0).clip(0.0, 5.0) / 5.0)
        iot = (_impute_numeric(df["IOT"], 3.0).clip(0.0, 5.0) / 5.0)
        netcom = (_impute_numeric(df["NetCom"], 3.0).clip(0.0, 5.0) / 5.0)
        practicum = (_impute_numeric(df["Practicum"], 3.0).clip(0.0, 5.0) / 5.0)

        prepared["professional_ethics"] = prof_lit
        prepared["scientific_spirit"] = practicum
        prepared["humanistic_quality"] = ((prof_lit * 0.4) + (soft_score * 0.6)).clip(0.0, 1.0)
        prepared["computer_cognition"] = ((comprog + discrete) / 2.0).clip(0.0, 1.0)
        prepared["software_design"] = oop
        prepared["system_usage"] = ((iot + netcom) / 2.0).clip(0.0, 1.0)
        prepared["sustainable_development"] = ((comgraphics + prof_lit) / 2.0).clip(0.0, 1.0)
        prepared["team_capacity"] = soft_score
        # Keep job_application behavior-driven and avoid using target-like labels.
        prepared["job_application"] = ((years_code_pro * 0.5) + (years_code * 0.3) + (practicum * 0.2)).clip(0.0, 1.0)

        survey_cols = [
            "professional_ethics",
            "scientific_spirit",
            "humanistic_quality",
            "computer_cognition",
            "software_design",
            "system_usage",
            "sustainable_development",
            "team_capacity",
            "job_application",
        ]
        prepared["survey_avg"] = prepared[survey_cols].mean(axis=1)
        prepared["tech_skills_norm"] = ((tech_score * 0.5) + (computer_skills * 0.15) + (worked_with * 0.2) + (years_code * 0.15)).clip(0.0, 1.0)
        prepared["soft_skills_avg"] = soft_score
        prepared["cert_norm"] = cert_norm
        cert_weight = _impute_numeric(df.get("Cert_Weight", pd.Series(1.0, index=df.index)), 1.0).clip(lower=0.0)
        cert_weight_cap = float(np.quantile(cert_weight, 0.95)) if len(cert_weight) > 0 else 1.0
        cert_weight_denom = cert_weight_cap if cert_weight_cap > 1e-9 else 1.0
        prepared["cert_weight_norm"] = (cert_weight / cert_weight_denom).clip(0.0, 1.0)
        prepared["job_type"] = df["Job_Type"].fillna("General IT").astype(str).map(_normalize_job_title)
        prepared["employment"] = employment
        prepared["skills_raw"] = df.get("HaveWorkedWith", pd.Series("", index=df.index)).fillna("").astype(str)
        prepared["cert_types_raw"] = df.get("Cert_Types", pd.Series("", index=df.index)).fillna("").astype(str)
        prepared["major_raw"] = df.get("Major", pd.Series("", index=df.index)).fillna("").astype(str)
        prepared["edlevel_raw"] = df.get("EdLevel", pd.Series("", index=df.index)).fillna("").astype(str)
        prepared["employment_raw"] = df.get("Employment", pd.Series("", index=df.index)).fillna("").astype(str)
        prepared["gender_raw"] = df.get("Gender", pd.Series("", index=df.index)).fillna("").astype(str)
        prepared["age_raw"] = df.get("Age", pd.Series("", index=df.index)).fillna("").astype(str)

        runtime_features = RUNTIME_BASE_FEATURE_NAMES + ["cert_weight_norm"]

        prepared.attrs["runtime_feature_names"] = runtime_features
        return prepared

    required_legacy = {"gwa", "soft_skills_avg", "certification_count", "programming_langs_count", "web_dev_count", "database_count", "tools_count"}
    if required_legacy.issubset(columns):
        prepared = df.copy()
        prepared["gwa_norm"] = ((5.0 - _safe_num(prepared["gwa"], 3.0)) / 4.0).clip(0.0, 1.0)
        prepared["tech_skills_norm"] = (
            _safe_num(prepared["programming_langs_count"], 0.0)
            + _safe_num(prepared["web_dev_count"], 0.0)
            + _safe_num(prepared["database_count"], 0.0)
            + _safe_num(prepared["tools_count"], 0.0)
        ) / 40.0
        prepared["tech_skills_norm"] = prepared["tech_skills_norm"].clip(0.0, 1.0)
        prepared["cert_norm"] = (_safe_num(prepared["certification_count"], 0.0) / 10.0).clip(0.0, 1.0)

        survey_cols = [
            "professional_ethics", "scientific_spirit", "humanistic_quality",
            "computer_cognition", "software_design", "system_usage",
            "sustainable_development", "team_capacity", "job_application",
        ]
        for col in survey_cols:
            prepared[col] = (_safe_num(prepared[col], 3.0) / 5.0).clip(0.0, 1.0)

        prepared["survey_avg"] = prepared[survey_cols].mean(axis=1)
        prepared["soft_skills_avg"] = (_safe_num(prepared["soft_skills_avg"], 3.0) / 5.0).clip(0.0, 1.0)
        prepared["cert_weight_norm"] = (_safe_num(prepared.get("cert_weight", pd.Series(1.0, index=prepared.index)), 1.0)).clip(0.0, 1.0)
        prepared["job_type"] = prepared.get("job_type", pd.Series("General IT", index=prepared.index)).astype(str).map(_normalize_job_title)
        prepared["employment"] = prepared.get("employment", pd.Series(1.0, index=prepared.index))
        prepared["skills_raw"] = prepared.get("skills_raw", pd.Series("", index=prepared.index)).fillna("").astype(str)
        prepared["cert_types_raw"] = prepared.get("cert_types_raw", pd.Series("", index=prepared.index)).fillna("").astype(str)
        prepared["major_raw"] = prepared.get("major_raw", pd.Series("", index=prepared.index)).fillna("").astype(str)
        prepared["edlevel_raw"] = prepared.get("edlevel_raw", pd.Series("", index=prepared.index)).fillna("").astype(str)
        prepared["employment_raw"] = prepared.get("employment_raw", pd.Series("", index=prepared.index)).fillna("").astype(str)
        prepared["gender_raw"] = prepared.get("gender_raw", pd.Series("", index=prepared.index)).fillna("").astype(str)
        prepared["age_raw"] = prepared.get("age_raw", pd.Series("", index=prepared.index)).fillna("").astype(str)
        prepared.attrs["runtime_feature_names"] = RUNTIME_BASE_FEATURE_NAMES + ["cert_weight_norm"]
        return prepared

    raise ValueError("Dataset schema is not supported. Expected the official employability.xlsx columns or the legacy CSV schema.")


def _band_label(value: float) -> str:
    if value >= 0.75:
        return "high"
    if value >= 0.5:
        return "mid"
    return "low"


def _score_status_fallback(score: float) -> str:
    if score >= 75:
        return "High Employability"
    if score >= 50:
        return "Moderate Employability"
    return "Low Employability"


def _status_from_score01(score: float) -> str:
    if score >= 0.66:
        return "High Employability"
    if score >= 0.33:
        return "Moderate Employability"
    return "Low Employability"


def _status_from_thresholds(score: float, low_threshold: float, high_threshold: float) -> str:
    if score >= high_threshold:
        return "High Employability"
    if score >= low_threshold:
        return "Moderate Employability"
    return "Low Employability"


def _select_status_fusion_alpha(direct_scores: np.ndarray, cluster_scores: np.ndarray, y_true_bin: np.ndarray) -> float:
    if direct_scores.size == 0 or cluster_scores.size == 0 or y_true_bin.size == 0:
        return 0.5
    if len(np.unique(y_true_bin)) < 2:
        return 0.5

    best_alpha = 0.5
    best_score = (-1.0, -1.0, -1.0)
    for alpha in np.linspace(0.0, 1.0, 21):
        fused = (alpha * cluster_scores) + ((1.0 - alpha) * direct_scores)
        metrics = _binary_metrics_from_scores(y_true_bin, fused, threshold=0.5)
        candidate = (
            float(metrics.get("balanced_accuracy", 0.0)),
            float(metrics.get("f1", 0.0)),
            -float(metrics.get("rmse", 0.0)),
        )
        if candidate > best_score:
            best_score = candidate
            best_alpha = float(alpha)

    return best_alpha


def _select_status_band_thresholds(fused_scores: np.ndarray, y_true_bin: np.ndarray) -> tuple[float, float]:
    if fused_scores.size == 0 or y_true_bin.size == 0 or len(np.unique(y_true_bin)) < 2:
        return 0.33, 0.66

    best_threshold = 0.5
    best_balanced_accuracy = -1.0
    for threshold in np.linspace(0.1, 0.9, 81):
        metrics = _binary_metrics_from_scores(y_true_bin, fused_scores, threshold=float(threshold))
        balanced_accuracy = float(metrics.get("balanced_accuracy", 0.0))
        if balanced_accuracy > best_balanced_accuracy:
            best_balanced_accuracy = balanced_accuracy
            best_threshold = float(threshold)

    positives = fused_scores[y_true_bin == 1]
    negatives = fused_scores[y_true_bin == 0]
    if positives.size > 0 and negatives.size > 0:
        separation = float(abs(np.median(positives) - np.median(negatives)))
        margin = float(np.clip(separation * 0.25, 0.05, 0.12))
    else:
        margin = 0.08

    low_threshold = float(np.clip(best_threshold - margin, 0.05, 0.95))
    high_threshold = float(np.clip(best_threshold + margin, low_threshold + 0.05, 0.98))
    return low_threshold, high_threshold


def _build_training_transactions(df: pd.DataFrame, clusters: np.ndarray, level_map: dict[int, str]) -> list[set[str]]:
    tx = []
    for idx, row in df.iterrows():
        cluster_id = int(clusters[idx]) if idx < len(clusters) else 0
        level = level_map.get(cluster_id, "Moderate Employability")
        job_type = str(row.get("job_type", "General IT"))

        items = {
            f"level:{level.replace(' ', '_').lower()}",
            f"job:{_normalize_token(job_type)}",
        }

        items |= _extract_skill_tokens(row.get("skills_raw", ""))

        if float(row.get("cert_norm", 0.0)) > 0:
            items.add("cert:has_cert")
        else:
            items.add("cert:no_cert")

        if any(item.startswith("skill:") for item in items):
            tx.append(items)

    return tx


def _eclat(prefix: tuple[str, ...], prefix_tidset: set[int], items: list[tuple[str, set[int]]],
           min_support_count: int, max_itemset_size: int, out: list[tuple[tuple[str, ...], int]]):
    for i, (item, tidset) in enumerate(items):
        next_tidset = tidset if not prefix_tidset else (prefix_tidset & tidset)
        support = len(next_tidset)
        if support < min_support_count:
            continue

        next_prefix = prefix + (item,)
        out.append((next_prefix, support))

        if len(next_prefix) >= max_itemset_size:
            continue

        suffix = []
        for j in range(i + 1, len(items)):
            other_item, other_tidset = items[j]
            inter = next_tidset & other_tidset
            if len(inter) >= min_support_count:
                suffix.append((other_item, inter))

        if suffix:
            _eclat(next_prefix, next_tidset, suffix, min_support_count, max_itemset_size, out)


def run_eclat(transactions: list[set[str]], min_support: float = 0.2,
              min_confidence: float = 0.6, max_itemset_size: int = 3,
              top_k: int = 20) -> dict:
    if not transactions:
        return {
            "transactionCount": 0,
            "minSupport": min_support,
            "minConfidence": min_confidence,
            "frequentItemsets": [],
            "associationRules": [],
        }

    total = len(transactions)
    support_count = ceil(total * min_support) if 0 < min_support < 1 else int(min_support)
    support_count = max(1, support_count)

    item_tidsets: dict[str, set[int]] = {}
    for tx_id, tx in enumerate(transactions):
        for item in tx:
            item_tidsets.setdefault(item, set()).add(tx_id)

    base_items = [
        (item, tids)
        for item, tids in item_tidsets.items()
        if len(tids) >= support_count
    ]
    base_items.sort(key=lambda x: (-len(x[1]), x[0]))

    discovered: list[tuple[tuple[str, ...], int]] = []
    _eclat((), set(), base_items, support_count, max_itemset_size, discovered)

    support_map: dict[tuple[str, ...], int] = {}
    for items, sup in discovered:
        key = tuple(sorted(items))
        if support_map.get(key, 0) < sup:
            support_map[key] = sup

    frequent_itemsets = [
        {
            "items": list(k),
            "supportCount": sup,
            # ECLAT: Support Formula
            # support = sup(itemset) / total_transactions
            # Fraction of transactions containing all items in itemset
            "support": round(sup / total, 4),
        }
        for k, sup in sorted(support_map.items(), key=lambda x: (-x[1], -len(x[0]), x[0]))[:max(1, top_k)]
    ]

    rules = []
    for itemset, sup_ab in support_map.items():
        if len(itemset) < 2:
            continue

        for i, consequent in enumerate(itemset):
            antecedent = tuple(sorted(itemset[:i] + itemset[i + 1:]))
            sup_a = support_map.get(antecedent)
            sup_b = support_map.get((consequent,))
            if not sup_a or not sup_b:
                continue

            # ECLAT: Confidence Formula
            # confidence = P(consequent | antecedent) = sup(A ∪ B) / sup(A)
            confidence = sup_ab / sup_a
            if confidence < min_confidence:
                continue

            # ECLAT: Lift Formula
            # lift = confidence / P(consequent) = [sup(A ∪ B) / sup(A)] / [sup(B) / total]
            # Measures how much more likely B occurs when A occurs
            lift = confidence / (sup_b / total)
            rules.append({
                "antecedent": list(antecedent),
                "consequent": consequent,
                "support": round(sup_ab / total, 4),
                "confidence": round(confidence, 4),
                "lift": round(lift, 4),
            })

    rules.sort(key=lambda r: (-r["confidence"], -r["lift"], -r["support"]))

    return {
        "transactionCount": total,
        "minSupport": min_support,
        "minSupportCount": support_count,
        "minConfidence": min_confidence,
        "frequentItemsets": frequent_itemsets,
        "associationRules": rules[:max(1, top_k)],
    }


def discover_training_patterns(min_support: float = 0.2, min_confidence: float = 0.6,
                              max_itemset_size: int = 3, top_k: int = 20) -> dict:
    return run_eclat(
        training_transactions,
        min_support=min_support,
        min_confidence=min_confidence,
        max_itemset_size=max_itemset_size,
        top_k=top_k,
    )


def _select_best_gmm(features_scaled: np.ndarray) -> tuple[GaussianMixture, list[dict]]:
    sample_count = int(features_scaled.shape[0])
    max_k = min(MAX_COMPONENTS, max(MIN_COMPONENTS, sample_count - 1))
    min_k = MIN_COMPONENTS if sample_count > MIN_COMPONENTS else 1
    if max_k < min_k:
        max_k = min_k

    candidates: list[dict] = []
    best_model = None
    best_bic = float("inf")
    best_aic = float("inf")

    for k in range(min_k, max_k + 1):
        model = GaussianMixture(n_components=k, random_state=42, max_iter=300, n_init=5)
        model.fit(features_scaled)
        # GMM: AIC (Akaike Information Criterion)
        # AIC = -2 * log_likelihood + 2 * num_parameters
        # Lower AIC indicates better balance between fit and model complexity
        aic = float(model.aic(features_scaled))
        # GMM: BIC (Bayesian Information Criterion)
        # BIC = -2 * log_likelihood + num_parameters * ln(n_samples)
        # Penalizes model complexity more than AIC; preferred for model selection
        bic = float(model.bic(features_scaled))
        candidates.append(
            {
                "k": int(k),
                "aic": round(aic, 4),
                "bic": round(bic, 4),
                "converged": bool(model.converged_),
                "n_iter": int(model.n_iter_),
            }
        )

        if bic < best_bic or (abs(bic - best_bic) <= 1e-9 and aic < best_aic):
            best_bic = bic
            best_aic = aic
            best_model = model

    if best_model is None:
        best_model = GaussianMixture(n_components=N_COMPONENTS, random_state=42, max_iter=300, n_init=5)
        best_model.fit(features_scaled)

    return best_model, candidates


def _gmm_cross_validated_nll(features_scaled: np.ndarray, n_components: int, folds: int = CV_FOLDS) -> dict:
    sample_count = int(features_scaled.shape[0])
    if sample_count < 2:
        return {"folds": 0, "neg_log_likelihood_mean": 0.0, "neg_log_likelihood_std": 0.0}

    usable_folds = max(2, min(folds, sample_count))
    kf = KFold(n_splits=usable_folds, shuffle=True, random_state=42)
    nll_scores: list[float] = []

    for train_idx, test_idx in kf.split(features_scaled):
        train_x = features_scaled[train_idx]
        test_x = features_scaled[test_idx]
        if train_x.shape[0] <= n_components or test_x.shape[0] == 0:
            continue
        cv_model = GaussianMixture(n_components=n_components, random_state=42, max_iter=300, n_init=3)
        cv_model.fit(train_x)
        # GMM: Average Log-Likelihood on test fold
        # Used to compute Negative Log-Likelihood (NLL = -avg_log_likelihood)
        # Lower NLL indicates better model generalization
        avg_log_likelihood = float(cv_model.score(test_x))
        nll_scores.append(-avg_log_likelihood)

    if not nll_scores:
        return {"folds": 0, "neg_log_likelihood_mean": 0.0, "neg_log_likelihood_std": 0.0}

    return {
        "folds": len(nll_scores),
        "neg_log_likelihood_mean": round(float(np.mean(nll_scores)), 6),
        "neg_log_likelihood_std": round(float(np.std(nll_scores)), 6),
    }


def _build_cluster_training_transactions(df: pd.DataFrame, clusters: np.ndarray, level_map: dict[int, str]) -> tuple[list[set[str]], dict[int, list[set[str]]]]:
    all_transactions: list[set[str]] = []
    by_cluster: dict[int, list[set[str]]] = {}

    for idx, row in df.iterrows():
        cluster_id = int(clusters[idx]) if idx < len(clusters) else 0
        level = level_map.get(cluster_id, "Moderate Employability")
        job_type = str(row.get("job_type", "General IT"))

        items = {
            f"level:{level.replace(' ', '_').lower()}",
            f"job:{_normalize_token(job_type)}",
        }
        items |= _extract_skill_tokens(row.get("skills_raw", ""))
        items |= _extract_prefixed_tokens(row.get("cert_types_raw", ""), "cert_type")
        items |= _extract_prefixed_tokens(row.get("major_raw", ""), "major")
        items |= _extract_prefixed_tokens(row.get("edlevel_raw", ""), "edlevel")

        employment_token = _employment_token(row.get("employment_raw", ""))
        if employment_token:
            items.add(employment_token)

        items |= _extract_prefixed_tokens(row.get("gender_raw", ""), "gender")
        age_token = _age_bucket_token(row.get("age_raw", ""))
        if age_token:
            items.add(age_token)

        items.add("cert:has_cert" if float(row.get("cert_norm", 0.0)) > 0 else "cert:no_cert")

        if not any(item.startswith("skill:") for item in items):
            continue

        all_transactions.append(items)
        by_cluster.setdefault(cluster_id, []).append(items)

    return all_transactions, by_cluster


def _extract_cluster_eclat_rules(cluster_transactions: dict[int, list[set[str]]]) -> tuple[list[dict], dict[int, list[dict]]]:
    merged_rules: list[dict] = []
    per_cluster_rules: dict[int, list[dict]] = {}

    for cluster_id, transactions in cluster_transactions.items():
        if not transactions:
            continue

        patterns = run_eclat(
            transactions,
            min_support=0.02,
            min_confidence=0.1,
            max_itemset_size=3,
            top_k=20000,
        )

        cluster_rules: list[dict] = []
        seen = set()
        for rule in patterns.get("associationRules", []):
            consequent_token = str(rule.get("consequent", ""))
            if not consequent_token.startswith("job:"):
                continue

            antecedent_tokens = [str(item) for item in rule.get("antecedent", [])]
            usable_tokens = [
                token for token in antecedent_tokens
                if (
                    token.startswith("skill:")
                    or token.startswith("level:")
                    or token.startswith("cert:")
                    or any(token.startswith(prefix) for prefix in RULE_CONTEXT_PREFIXES)
                )
            ]
            if not usable_tokens:
                continue

            job_name = _pretty_skill(consequent_token.removeprefix("job:"))
            key = (tuple(sorted(usable_tokens)), job_name)
            if key in seen:
                continue
            seen.add(key)

            normalized_rule = {
                "cluster_id": int(cluster_id),
                "antecedent": [
                    _pretty_skill(token.removeprefix("skill:")) if token.startswith("skill:") else token
                    for token in usable_tokens
                ],
                "consequent": job_name,
                "support": float(rule.get("support", 0.0)),
                "confidence": float(rule.get("confidence", 0.0)),
                "lift": float(rule.get("lift", 0.0)),
            }
            if normalized_rule["lift"] <= 1.0:
                continue
            cluster_rules.append(normalized_rule)

        cluster_rules.sort(key=lambda item: (-item["confidence"], -item["lift"], -item["support"], item["consequent"]))
        per_cluster_rules[int(cluster_id)] = cluster_rules
        merged_rules.extend(cluster_rules)

    merged_rules.sort(
        key=lambda item: (
            item.get("cluster_id", 0),
            -item["confidence"],
            -item["lift"],
            -item["support"],
            item["consequent"],
        )
    )
    return merged_rules, per_cluster_rules


def _compute_cluster_weights(quality_scores: dict[int, float]) -> dict[int, float]:
    if not quality_scores:
        return {}
    # Shift quality scores to be positive (for meaningful normalization)
    min_quality = min(quality_scores.values())
    shifted = {cid: (score - min_quality + 1e-6) for cid, score in quality_scores.items()}
    total = sum(shifted.values())
    if total <= 1e-12:
        # Uniform weight fallback if all quality scores are equal
        uniform = 1.0 / max(1, len(quality_scores))
        return {cid: uniform for cid in quality_scores}
    # Cluster Weight Formula (normalized quality)
    # weight(cluster) = shifted_quality(cluster) / sum(shifted_qualities)
    # Ensures weights sum to 1.0 and reflect relative cluster quality
    return {cid: float(val / total) for cid, val in shifted.items()}


def _build_job_profiles(df: pd.DataFrame, responsibilities: np.ndarray, rules: list[dict], n_components: int) -> tuple[dict[str, np.ndarray], dict[str, np.ndarray]]:
    profiles: dict[str, np.ndarray] = {}
    counts: dict[str, int] = {}

    for i, (_, row) in enumerate(df.iterrows()):
        job = str(row.get("job_type", "")).strip()
        if not job:
            continue
        key = job
        profiles.setdefault(key, np.zeros(n_components, dtype=float))
        counts[key] = counts.get(key, 0) + 1
        profiles[key] += responsibilities[i]

    for key, vec in profiles.items():
        count = max(1, counts.get(key, 1))
        profiles[key] = vec / count

    rule_strengths: dict[str, np.ndarray] = {job: np.zeros(n_components, dtype=float) for job in profiles}
    for rule in rules:
        job = str(rule.get("consequent", "")).strip()
        cluster_id = int(rule.get("cluster_id", 0))
        if job not in rule_strengths or cluster_id >= n_components:
            continue
        rule_strengths[job][cluster_id] += float(rule.get("confidence", 0.0)) * float(rule.get("lift", 0.0))

    return profiles, rule_strengths


def _feature_tokens_for_student(gwa: float, survey_vals: list[float], tech_count: int,
                                soft_avg: float, cert_count: int) -> set[str]:
    gwa_norm = (5.0 - gwa) / 4.0
    survey_avg = float(np.mean(survey_vals))
    tech_norm = min(tech_count / 40.0, 1.0)
    soft_norm = soft_avg / 5.0
    cert_norm = min(cert_count / 10.0, 1.0)
    return {
        f"gwa:{_band_label(gwa_norm)}",
        f"survey:{_band_label(survey_avg)}",
        f"tech:{_band_label(tech_norm)}",
        f"soft:{_band_label(soft_norm)}",
        f"cert:{_band_label(cert_norm)}",
    }


def get_job_level(job: str) -> str:
    """
    GMM is used only to determine employability level.
    Job level is inferred dynamically from ECLAT level-conditioned rules.
    """
    normalized = _normalize_token(job)
    return job_level_lookup.get(normalized, "Moderate")


def _is_job_level_compatible(employability_level: str, job_level: str) -> bool:
    if employability_level == "Low Employability":
        return job_level == "Low"
    if employability_level == "Moderate Employability":
        return job_level in {"Low", "Moderate"}
    return job_level in {"Moderate", "High"}


def _format_rule(rule: dict) -> str:
    antecedent = ", ".join(rule.get("antecedent", []))
    consequent = str(rule.get("consequent", ""))
    return f"{antecedent} => {consequent}"


def _extract_dynamic_eclat_rules() -> list[dict]:
    patterns = discover_training_patterns(min_support=0.02, min_confidence=0.1, max_itemset_size=3, top_k=20000)
    dynamic_rules: list[dict] = []
    seen = set()

    for rule in patterns.get("associationRules", []):
        consequent_token = str(rule.get("consequent", ""))
        if not consequent_token.startswith("job:"):
            continue

        antecedent_tokens = [str(item) for item in rule.get("antecedent", [])]
        usable_tokens = [
            token for token in antecedent_tokens
            if (
                token.startswith("skill:")
                or token.startswith("level:")
                or token.startswith("cert:")
                or any(token.startswith(prefix) for prefix in RULE_CONTEXT_PREFIXES)
            )
        ]
        if not usable_tokens:
            continue

        job_name = _pretty_skill(consequent_token.removeprefix("job:"))
        key = (tuple(sorted(usable_tokens)), job_name)
        if key in seen:
            continue
        seen.add(key)

        dynamic_rules.append({
            "antecedent": [
                _pretty_skill(token.removeprefix("skill:")) if token.startswith("skill:") else token
                for token in usable_tokens
            ],
            "consequent": job_name,
            "support": float(rule.get("support", 0.0)),
            "confidence": float(rule.get("confidence", 0.0)),
            "lift": float(rule.get("lift", 0.0)),
        })

    dynamic_rules.sort(key=lambda item: (-item["confidence"], -item["lift"], -item["support"], item["consequent"]))
    return dynamic_rules


def _derive_cluster_levels(df: pd.DataFrame, clusters: np.ndarray, gmm: GaussianMixture, std_scaler: StandardScaler) -> tuple[dict[int, str], dict[int, float], dict[int, float], dict[int, float]]:
    centers = std_scaler.inverse_transform(gmm.means_)
    quality_by_cluster = {}
    employment_rate_by_cluster: dict[int, float] = {}

    for idx, center in enumerate(centers):
        gwa_norm = float(center[0])
        survey_avg = float(center[1])
        tech_norm = float(center[11])
        soft_norm = float(center[12])
        cert_norm = float(center[13])
        # GMM: Cluster Quality Score (weighted combination of employability dimensions)
        # quality = 0.30*gwa + 0.25*survey + 0.20*tech + 0.15*soft + 0.10*cert
        # Weights reflect relative importance of each dimension for employability prediction
        quality = (
            gwa_norm * 0.30
            + survey_avg * 0.25
            + tech_norm * 0.20
            + soft_norm * 0.15
            + cert_norm * 0.10
        )
        quality_by_cluster[idx] = quality

    for cluster_id in range(int(gmm.n_components)):
        cluster_mask = (clusters == cluster_id)
        if np.any(cluster_mask):
            employment_vals = pd.to_numeric(
                df.loc[cluster_mask, "employment"],
                errors="coerce",
            ).fillna(0.0).clip(0.0, 1.0).values
            employment_rate_by_cluster[cluster_id] = float(np.mean(employment_vals))
        else:
            employment_rate_by_cluster[cluster_id] = 0.0

    quality_values = np.array(list(quality_by_cluster.values()), dtype=float)
    if quality_values.size > 0:
        q_min = float(np.min(quality_values))
        q_max = float(np.max(quality_values))
        q_denom = max(q_max - q_min, 1e-12)
        quality_norm_by_cluster = {cid: (float(score) - q_min) / q_denom for cid, score in quality_by_cluster.items()}
    else:
        quality_norm_by_cluster = {cid: 0.0 for cid in quality_by_cluster}

    employment_values = np.array(list(employment_rate_by_cluster.values()), dtype=float)
    if employment_values.size > 0:
        e_min = float(np.min(employment_values))
        e_max = float(np.max(employment_values))
        e_denom = max(e_max - e_min, 1e-12)
        employment_norm_by_cluster = {cid: (float(score) - e_min) / e_denom for cid, score in employment_rate_by_cluster.items()}
    else:
        employment_norm_by_cluster = {cid: 0.0 for cid in employment_rate_by_cluster}

    cluster_strength_by_cluster = {
        cid: float((employment_norm_by_cluster.get(cid, 0.0) * 0.70) + (quality_norm_by_cluster.get(cid, 0.0) * 0.30))
        for cid in quality_by_cluster
    }

    ordered = [cid for cid, _ in sorted(cluster_strength_by_cluster.items(), key=lambda x: x[1])]
    if not ordered:
        return {}, quality_by_cluster, employment_rate_by_cluster, cluster_strength_by_cluster

    level_map = {}
    for pos, cid in enumerate(ordered):
        frac = pos / max(1, len(ordered) - 1)
        if frac <= 0.33:
            level_map[cid] = "Low Employability"
        elif frac <= 0.66:
            level_map[cid] = "Moderate Employability"
        else:
            level_map[cid] = "High Employability"

    return level_map, quality_by_cluster, employment_rate_by_cluster, cluster_strength_by_cluster


def _derive_cluster_roles(df: pd.DataFrame, clusters: np.ndarray) -> tuple[dict[int, str], dict[int, list[str]], list[str]]:
    label_map: dict[int, str] = {}
    recommendation_map: dict[int, list[str]] = {}
    used_labels: set[str] = set()
    usable = df.copy()
    usable["cluster_id"] = clusters
    overall_counts = usable[usable["employment"] >= 1]["job_type"].value_counts()
    global_roles = overall_counts.index.tolist()[:10]
    overall_freq = overall_counts / overall_counts.sum() if overall_counts.sum() > 0 else overall_counts

    for cluster_id in sorted(usable["cluster_id"].unique().tolist()):
        subset = usable[usable["cluster_id"] == cluster_id]
        employed_subset = subset[subset["employment"] >= 1]
        role_counts = employed_subset["job_type"].value_counts()

        if role_counts.empty:
            role_counts = subset["job_type"].value_counts()

        top_roles = role_counts.index.tolist()[:5]
        if len(top_roles) < 5:
            for role in global_roles:
                if role not in top_roles:
                    top_roles.append(role)
                if len(top_roles) >= 5:
                    break

        if not top_roles:
            top_roles = global_roles[:5] if global_roles else ["Developer", "Data Analyst", "Tester", "Researcher", "Manager"]

        recommendation_map[int(cluster_id)] = top_roles

        # Label by the most *distinctive* job in this cluster (over-represented vs global)
        # distinctiveness = P(job|cluster) / P(job|overall) — rewards jobs that appear
        # disproportionately often in this cluster relative to the full dataset.
        # A minimum cluster share of 5% is required to filter out noise.
        cluster_total = max(1, role_counts.sum())
        cluster_freq = role_counts / cluster_total
        min_share = 0.05  # job must be ≥5% of this cluster to qualify as label
        qualifying = cluster_freq[cluster_freq >= min_share]
        if qualifying.empty:
            qualifying = cluster_freq

        global_freq_aligned = overall_freq.reindex(qualifying.index).fillna(1e-6)
        distinctiveness = qualifying / global_freq_aligned

        # Prefer a label not yet used by another cluster
        label_job = None
        for job in distinctiveness.sort_values(ascending=False).index:
            candidate = f"{job} Track"
            if candidate not in used_labels:
                label_job = job
                break
        if label_job is None:
            label_job = top_roles[0]

        label = f"{label_job} Track"
        used_labels.add(label)
        label_map[int(cluster_id)] = label

    return label_map, recommendation_map, (global_roles[:5] if global_roles else ["Developer", "Data Analyst", "Tester", "Researcher", "Manager"])


def _rank_jobs_for_profile(cluster_id: int, profile_features_scaled: np.ndarray | None = None, status: str = "Moderate Employability") -> list[str]:
    scores: dict[str, float] = {}

    for rank, job in enumerate(cluster_job_recommendations.get(cluster_id, [])):
        scores[job] = scores.get(job, 0.0) + (6 - rank)

    if (
        profile_features_scaled is not None
        and training_feature_matrix is not None
        and training_cluster_assignments is not None
        and training_job_types
    ):
        cluster_indices = np.where(training_cluster_assignments == cluster_id)[0]
        if cluster_indices.size > 0:
            distances = np.linalg.norm(training_feature_matrix[cluster_indices] - profile_features_scaled, axis=1)
            ordered_indices = cluster_indices[np.argsort(distances)]

            used = 0
            for idx in ordered_indices:
                job = training_job_types[idx]
                if job in INVALID_JOB_TYPES:
                    continue

                distance = float(np.linalg.norm(training_feature_matrix[idx] - profile_features_scaled))
                if distance <= 1e-9:
                    continue

                scores[job] = scores.get(job, 0.0) + (3.0 / (distance + 1e-6))
                used += 1
                if used >= LOCAL_JOB_NEIGHBOR_COUNT:
                    break

    for rank, job in enumerate(global_job_recommendations):
        scores[job] = scores.get(job, 0.0) + max(0.0, 1.5 - (rank * 0.2))

    if status == "Low Employability":
        low_status_bias = {
            "Tester": 0.45,
            "Freelancer": 0.4,
            "Designer": 0.25,
            "Developer": 0.15,
        }
        for job, bonus in low_status_bias.items():
            if job in scores:
                scores[job] += bonus

    ranked = [job for job, _ in sorted(scores.items(), key=lambda item: (-item[1], item[0])) if job not in INVALID_JOB_TYPES]
    if ranked:
        return ranked[:5]

    return []


def _rank_jobs_from_classifier(profile_features_raw: np.ndarray | None = None) -> list[str]:
    if profile_features_raw is None or job_type_model is None or job_type_encoder is None:
        return []

    probabilities = job_type_model.predict_proba(profile_features_raw.reshape(1, -1))[0]
    ranked_indices = np.argsort(probabilities)[::-1]
    roles = []
    for idx in ranked_indices:
        job = str(job_type_encoder.classes_[idx])
        if job in INVALID_JOB_TYPES or job in roles:
            continue
        roles.append(job)
        if len(roles) >= 5:
            break

    return roles


def load_and_train(data_path: str):
    global gmm_model, scaler, training_info, dataset_path, training_transactions
    global cluster_level_map, cluster_quality_scores, cluster_employment_rates, cluster_strength_scores, cluster_label_names, cluster_job_recommendations
    global global_job_recommendations, dynamic_eclat_rules, job_level_lookup, cluster_eclat_rules
    global cluster_weights, job_cluster_profiles, job_rule_strengths, training_cluster_probabilities
    global gmm_selection_scores, training_feature_matrix, training_cluster_assignments, training_job_types
    global training_employment_targets, training_employability_scores
    global training_direct_employability_scores, status_fusion_alpha, status_low_threshold, status_high_threshold
    global runtime_feature_names, runtime_feature_defaults
    dataset_path = data_path

    df = read_dataset(data_path)
    df = _prepare_training_dataframe(df)
    df = df.reset_index(drop=True)

    runtime_feature_names = list(df.attrs.get("runtime_feature_names", RUNTIME_BASE_FEATURE_NAMES))
    for feature_name in runtime_feature_names:
        if feature_name not in df.columns:
            df[feature_name] = 0.0
    runtime_feature_defaults = {name: float(pd.to_numeric(df[name], errors="coerce").mean()) for name in runtime_feature_names}
    for name, value in list(runtime_feature_defaults.items()):
        if np.isnan(value):
            runtime_feature_defaults[name] = 0.0

    features = df[runtime_feature_names].values

    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)
    training_feature_matrix = features_scaled

    gmm_model, gmm_selection_scores = _select_best_gmm(features_scaled)
    cluster_assignments = gmm_model.predict(features_scaled)
    training_cluster_assignments = cluster_assignments
    training_cluster_probabilities = gmm_model.predict_proba(features_scaled)
    training_job_types = [str(job).strip() for job in df["job_type"].tolist()]
    training_employment_targets = pd.to_numeric(
        df.get("employment", pd.Series(np.zeros(len(df)), index=df.index)),
        errors="coerce",
    ).fillna(0.0).clip(0.0, 1.0).values
    training_direct_employability_scores = (
        (df["gwa_norm"] * 0.30)
        + (df["survey_avg"] * 0.25)
        + (df["tech_skills_norm"] * 0.20)
        + (df["soft_skills_avg"] * 0.15)
        + (df["cert_norm"] * 0.10)
    ).clip(0.0, 1.0).values
    # GMM: Silhouette Score
    # Measures how similar each sample is to its own cluster vs. other clusters
    # Range: [-1, 1], higher values indicate better-separated, more cohesive clusters
    # Only computed when we have more samples than components
    silhouette = silhouette_score(features_scaled, cluster_assignments) if len(df) > gmm_model.n_components else 0.0
    cv_nll = _gmm_cross_validated_nll(features_scaled, int(gmm_model.n_components), folds=CV_FOLDS)

    cluster_level_map, cluster_quality_scores, cluster_employment_rates, cluster_strength_scores = _derive_cluster_levels(df, cluster_assignments, gmm_model, scaler)
    if cluster_strength_scores:
        min_s = float(min(cluster_strength_scores.values()))
        max_s = float(max(cluster_strength_scores.values()))
        denom = max(max_s - min_s, 1e-12)
        strength_norm = {cid: (float(score) - min_s) / denom for cid, score in cluster_strength_scores.items()}
        strength_vector = np.array([strength_norm.get(i, 0.5) for i in range(int(gmm_model.n_components))], dtype=float)
        training_employability_scores = (training_cluster_probabilities @ strength_vector).clip(0.0, 1.0)
    else:
        training_employability_scores = np.zeros(len(df), dtype=float)
    status_fusion_alpha = _select_status_fusion_alpha(
        training_direct_employability_scores,
        training_employability_scores,
        y_true_bin=training_employment_targets.astype(int),
    )
    status_low_threshold, status_high_threshold = _select_status_band_thresholds(
        training_employability_scores,
        training_employment_targets.astype(int),
    )
    cluster_weights = _compute_cluster_weights(cluster_strength_scores if cluster_strength_scores else cluster_quality_scores)
    cluster_label_names, cluster_job_recommendations, global_job_recommendations = _derive_cluster_roles(df, cluster_assignments)

    job_level_votes: dict[str, dict[str, int]] = {}
    for idx, row in df.iterrows():
        job_name = str(row.get("job_type", "")).strip()
        if not job_name or job_name in INVALID_JOB_TYPES:
            continue
        cluster_id = int(cluster_assignments[idx]) if idx < len(cluster_assignments) else 0
        employability_label = cluster_level_map.get(cluster_id, "Moderate Employability")
        mapped_level = "Moderate"
        if employability_label == "Low Employability":
            mapped_level = "Low"
        elif employability_label == "High Employability":
            mapped_level = "High"
        key = _normalize_token(job_name)
        job_level_votes.setdefault(key, {"Low": 0, "Moderate": 0, "High": 0})
        job_level_votes[key][mapped_level] += 1

    job_level_lookup = {
        job_key: max(level_counts.items(), key=lambda item: item[1])[0]
        for job_key, level_counts in job_level_votes.items()
    }

    training_transactions, transactions_by_cluster = _build_cluster_training_transactions(df, cluster_assignments, cluster_level_map)
    dynamic_eclat_rules, cluster_eclat_rules = _extract_cluster_eclat_rules(transactions_by_cluster)
    job_cluster_profiles, job_rule_strengths = _build_job_profiles(df, training_cluster_probabilities, dynamic_eclat_rules, gmm_model.n_components)

    training_info = {
        "algorithm": "Gaussian Mixture Model (GMM)",
        "n_components": int(gmm_model.n_components),
        "training_samples": len(df),
        "features_used": len(runtime_feature_names),
        "feature_names": runtime_feature_names,
        "converged": bool(gmm_model.converged_),
        "n_iter": int(gmm_model.n_iter_),
        "lower_bound": round(float(gmm_model.lower_bound_), 4),
        "silhouette_score": round(float(silhouette), 4),
        "aic": round(float(gmm_model.aic(features_scaled)), 4),
        "bic": round(float(gmm_model.bic(features_scaled)), 4),
        "cv_neg_log_likelihood": cv_nll,
        "gmm_candidates": gmm_selection_scores,
        "dataset_path": os.path.basename(data_path),
        "employability_levels": EMPLOYABILITY_LEVELS,
        "gmm_numeric_source_columns": sorted(GMM_NUMERIC_SOURCE_COLUMNS),
        "eclat_categorical_source_columns": [
            "HaveWorkedWith",
            "Cert_Types",
            "Job_Type",
            "Major",
            "EdLevel",
            "Employment",
            "Gender (optional)",
            "Age (optional)",
        ],
    }

    return training_info


def compute_score(gwa: float, survey_avg: float, tech_skills_count: int,
                  soft_skills_avg: float, cert_count: int, cert_weight: float = 1.0) -> float:
    # Normalize each dimension to [0, 1] range
    academic = min(max((5.0 - gwa) / 4.0, 0.0), 1.0)  # Inverse GPA (lower GPA = higher academic score)
    survey = survey_avg / 5.0                          # Survey average from 1-5 scale
    skills = min(tech_skills_count / 40.0, 1.0)        # Technical skills count normalized by max 40
    soft = soft_skills_avg / 5.0                        # Soft skills average from 1-5 scale
    # cert_weight (0.0–1.0) scales the certification contribution:
    # dataset-recognized certs (AWS/Cisco/CompTIA/Google/Microsoft/Oracle) -> 1.0 (full credit)
    # unrecognized/generic certs -> 0.3 (minimal credit)
    cert = min((cert_count * max(0.0, min(1.0, cert_weight))) / 5.0, 1.0)
    # Employability Score Formula (weighted average)
    # score = 0.30*academic + 0.25*survey + 0.20*skills + 0.15*soft + 0.10*cert
    # Weights prioritize academic performance and survey-based competencies
    return (academic * 0.30 + survey * 0.25 + skills * 0.20 + soft * 0.15 + cert * 0.10) * 100


def compute_improved_score(gwa: float, survey_avg: float, tech_skills_count: int,
                          soft_skills_avg: float, cert_count: int) -> tuple[float, float, dict]:
    """
    Calculate employability score after realistic improvements.
    Returns: (current_score, improved_score, improvements_dict)
    
    Realistic improvement targets (Philippine grading):
    - GWA: lower by ~0.7 points (2.8 → 2.1)
    - Survey: raise by ~1.0 point (3.0 → 4.0)
    - Tech skills: add ~5 more skills
    - Soft skills: raise by ~0.8 points (3.5 → 4.3)
    - Certifications: add 1 certification
    """
    # Current score
    current_score = compute_score(gwa, survey_avg, tech_skills_count, soft_skills_avg, cert_count)
    
    # Calculate improvements
    improved_gwa = max(1.0, gwa - 0.7)
    improved_survey = min(5.0, survey_avg + 1.0)
    improved_tech = tech_skills_count + 5
    improved_soft = min(5.0, soft_skills_avg + 0.8)
    improved_cert = cert_count + 1
    
    # Improved score
    improved_score = compute_score(improved_gwa, improved_survey, improved_tech, improved_soft, improved_cert)
    
    improvements = {
        "gwa": {"current": round(gwa, 2), "improved": round(improved_gwa, 2)},
        "survey": {"current": round(survey_avg, 2), "improved": round(improved_survey, 2)},
        "tech_skills": {"current": tech_skills_count, "improved": improved_tech},
        "soft_skills": {"current": round(soft_skills_avg, 2), "improved": round(improved_soft, 2)},
        "certifications": {"current": cert_count, "improved": improved_cert},
        "current_score": round(current_score, 2),
        "improved_score": round(improved_score, 2),
        "potential_gain": round(improved_score - current_score, 2),
    }
    
    return current_score, improved_score, improvements


def _profile_gap_recommendations(scores: dict, seen_actions: set, target_count: int) -> list[str]:
    """
    Generate profile-dimension recommendations (academic, survey, soft skills, certs)
    ordered by the student's weakest areas. Only adds actions not already in seen_actions.
    Philippine grading scale: 1=highest, 3=passing, 4=INC, 5=failed
    """
    actions: list[str] = []

    gwa = float(scores.get("gwa", 3.0))
    soft_avg = float(scores.get("softSkillsAverage", 3.0))
    cert_count = int(scores.get("certificationCount", 0))
    survey_categories: dict[str, float] = scores.get("surveyCategories", {})

    # Rank dimensions by weakness (lowest normalized score first)
    dimension_scores: list[tuple[float, str, str]] = []

    # Academic: GWA 1.0=best (excellent), 3.0=passing, 5.0=worst (failed)
    # Calculate weakness: higher GWA = more urgent improvement needed
    academic_weakness = (gwa - 1.0) / 4.0
    
    # Calculate realistic target: aim to lower GWA by 0.5-1.0 points
    # If GWA 2.8: target 2.0-2.3 (good standing)
    # If GWA 3.5: target 2.5-3.0 (move toward passing)
    target_gwa = max(1.0, gwa - 0.7)  # Aim to lower by ~0.7 points
    current_academic_score = (5.0 - gwa) / 4.0 * 100 * 0.30  # Current contribution to employability
    target_academic_score = (5.0 - target_gwa) / 4.0 * 100 * 0.30  # Potential contribution
    potential_gain = round(target_academic_score - current_academic_score, 1)
    
    if gwa >= 3.5:
        # Below passing or INC - critical
        academic_action = (
            f"PRIORITY: Lower your GWA from {gwa:.1f} to 2.5 or better. Focus intensively on challenging courses. "
            f"This single improvement can boost your employability score by {potential_gain} points (30% weight)."
        )
    elif gwa >= 2.5:
        # Moderate - improvement needed
        academic_action = (
            f"Lower your GWA from {gwa:.1f} towards {target_gwa:.1f} by focusing on core technical courses. "
            f"This can improve your employability score by {potential_gain} points."
        )
    else:
        # Already good - maintenance
        academic_action = (
            f"Maintain your current GWA of {gwa:.1f} (good standing). Continue strong performance in specialized technical courses to further strengthen your profile."
        )
    
    dimension_scores.append((academic_weakness, "academic", academic_action))

    # Soft skills: 1-5 scale, lower=worse
    soft_weakness = 1.0 - ((soft_avg - 1.0) / 4.0)
    current_soft_score = (soft_avg / 5.0) * 100 * 0.15
    target_soft = min(4.5, soft_avg + 0.8)  # Aim to raise by ~0.8 points
    target_soft_score = (target_soft / 5.0) * 100 * 0.15
    soft_potential_gain = round(target_soft_score - current_soft_score, 1)
    
    if soft_avg < 2.5:
        soft_action = (
            f"PRIORITY: Strengthen soft skills from {soft_avg:.1f}/5 to {target_soft:.1f}/5 by joining team projects and leadership activities. "
            f"This can improve your score by {soft_potential_gain} points (15% weight)."
        )
    else:
        soft_action = (
            f"Improve soft skills from your current {soft_avg:.1f}/5 towards {target_soft:.1f}/5 by engaging in collaborative projects, communication workshops, and team leadership roles."
        )
    dimension_scores.append((soft_weakness, "soft", soft_action))

    # Certifications: 0=worst
    cert_weakness = 1.0 if cert_count == 0 else max(0.0, 1.0 - (cert_count / 5.0))
    current_cert_score = (cert_count / 5.0) * 100 * 0.10 if cert_count > 0 else 0
    target_cert_count = cert_count + 1
    target_cert_score = min(10, target_cert_count) / 5.0 * 100 * 0.10
    cert_potential_gain = round(target_cert_score - current_cert_score, 1)
    
    cert_action = (
        f"Earn your first IT certification (e.g., CompTIA Security+, AWS Cloud Practitioner, or Google Cloud Associate). "
        f"This adds {cert_potential_gain} points to your employability score (10% weight) and demonstrates professional readiness."
        if cert_count == 0
        else f"Expand your certification portfolio from {cert_count} to {target_cert_count} certifications. Each additional cert adds {cert_potential_gain} points. Choose role-aligned certifications for maximum impact."
    )
    dimension_scores.append((cert_weakness, "cert", cert_action))

    # Individual survey categories (1-5 scale)
    survey_dimension_scores: list[tuple[float, str, str]] = []
    for cat_key, cat_score in survey_categories.items():
        if cat_key not in SURVEY_CATEGORY_RECOMMENDATIONS:
            continue
        cat_weakness = 1.0 - ((float(cat_score) - 1.0) / 4.0)
        label = SURVEY_CATEGORY_LABELS.get(cat_key, cat_key.replace("_", " "))
        
        # Calculate potential improvement from raising score by ~1 point
        current_cat_contrib = (float(cat_score) / 5.0) * 100 * 0.25 / 9  # Survey is 25% of total, divided by 9 categories
        target_cat = min(5.0, float(cat_score) + 1.0)
        target_cat_contrib = (target_cat / 5.0) * 100 * 0.25 / 9
        cat_potential_gain = round(target_cat_contrib - current_cat_contrib, 1)
        
        action = (
            f"Strengthen {label} (current: {float(cat_score):.1f}/5 → target: {target_cat:.1f}/5, gain: {cat_potential_gain} points). "
            f"{SURVEY_CATEGORY_RECOMMENDATIONS[cat_key]}"
        )
        survey_dimension_scores.append((cat_weakness, f"survey:{cat_key}", action))
    
    # Add survey items only if they're weak enough (weakness > 0.4)
    for weakness, dim_key, action in survey_dimension_scores:
        if weakness > 0.4:  # Only add notably weak survey dimensions
            dimension_scores.append((weakness, dim_key, action))

    # Sort by weakness descending — most problematic dimension first
    # Then by weight priority (academic 30% > soft 15% > survey 25% > cert 10%)
    dimension_scores.sort(key=lambda item: (-item[0], item[1]))

    used_per_dim: dict[str, int] = {}
    for weakness, dim_key, action in dimension_scores:
        if len(actions) >= target_count:
            break
        
        # Dimension-specific filtering based on impact
        dim_group = dim_key.split(":")[0]
        
        # Always include academic, cert, and soft (high weight dimensions)
        if dim_group in {"academic", "cert", "soft"}:
            # For high-weight dimensions, include if weakness > 0.15 (not already excellent)
            if weakness < 0.15:
                continue
        else:
            # For survey categories, only include if notably weak (weakness > 0.35)
            if weakness < 0.35:
                continue
        
        count = used_per_dim.get(dim_group, 0)
        max_per_dim = 1
        if count >= max_per_dim:
            continue
        if action in seen_actions:
            continue
        seen_actions.add(action)
        actions.append(action)
        used_per_dim[dim_group] = count + 1

    return actions


def generate_dynamic_recommendation(student: dict, eclat_rules: list[dict], employability_level: str, score: float, cluster_id: int | None = None) -> dict:
    """
    ECLAT is the source of both job recommendations and improvement actions.
    GMM is used only for filtering by employability level.
    Profile-dimension gaps (GWA, soft skills, certs, survey) fill remaining plan slots.
    """
    student_skills_raw = {_normalize_token(skill) for skill in student.get("skills", []) if _normalize_token(skill)}
    student_skills = _expand_student_skills(student_skills_raw)
    certifications = [str(item).strip() for item in student.get("certifications", []) if str(item).strip()]
    level_token = f"level:{employability_level.replace(' ', '_').lower()}"
    cert_token = "cert:has_cert" if certifications else "cert:no_cert"

    job_candidates: dict[str, dict] = {}
    all_job_candidates: dict[str, dict] = {}
    matched_rule_rows: list[dict] = []

    for rule in eclat_rules:
        antecedent_raw = [str(token) for token in rule.get("antecedent", [])]
        antecedent_skill_tokens = set()
        rule_requires_level = None
        rule_requires_cert = None

        for token in antecedent_raw:
            if token.startswith("level:"):
                rule_requires_level = token
                continue
            if token.startswith("cert:"):
                rule_requires_cert = token
                continue
            if any(token.startswith(prefix) for prefix in RULE_CONTEXT_PREFIXES):
                continue
            if token.startswith("skill:"):
                normalized_skill = _normalize_token(token.removeprefix("skill:"))
                if normalized_skill:
                    antecedent_skill_tokens.add(normalized_skill)
                continue
            normalized_skill = _normalize_token(token)
            if normalized_skill:
                antecedent_skill_tokens.add(normalized_skill)

        if not antecedent_skill_tokens:
            continue
        if rule_requires_level and rule_requires_level != level_token:
            continue

        matched_skills = antecedent_skill_tokens & student_skills
        missing_skills = antecedent_skill_tokens - student_skills
        match_ratio = len(matched_skills) / max(1, len(antecedent_skill_tokens))
        is_strict_match = not missing_skills
        is_partial_match = len(matched_skills) > 0 and match_ratio >= 0.5
        if not is_strict_match and not is_partial_match:
            continue

        job = str(rule.get("consequent", "")).strip()
        if not job:
            continue
        confidence = float(rule.get("confidence", 0.0))
        lift = float(rule.get("lift", 0.0))
        support = float(rule.get("support", 0.0))
        job_level = get_job_level(job)

        normalized_rule = {
            **rule,
            "_required_skills": sorted(antecedent_skill_tokens),
            "_matched_skills": sorted(matched_skills),
            "_missing_skills": sorted(missing_skills),
            "_match_ratio": float(match_ratio),
            "_strict": bool(is_strict_match),
        }

        existing_all = all_job_candidates.get(job)
        if not existing_all:
            all_job_candidates[job] = {
                "confidence": confidence,
                "lift": lift,
                "support": support,
                "match_ratio": match_ratio,
                "job_level": job_level,
                "rules": [normalized_rule],
            }
        else:
            existing_all["confidence"] = max(existing_all["confidence"], confidence)
            existing_all["lift"] = max(existing_all["lift"], lift)
            existing_all["support"] = max(existing_all["support"], support)
            existing_all["match_ratio"] = max(existing_all["match_ratio"], match_ratio)
            existing_all["rules"].append(normalized_rule)

        # Cert filter only applies to the strict job_candidates pool
        if rule_requires_cert and rule_requires_cert != cert_token:
            continue
        if not is_strict_match:
            continue
        if not _is_job_level_compatible(employability_level, job_level):
            continue

        existing = job_candidates.get(job)
        if not existing:
            job_candidates[job] = {
                "confidence": confidence,
                "lift": lift,
                "support": support,
                "match_ratio": match_ratio,
                "job_level": job_level,
                "rules": [normalized_rule],
            }
        else:
            existing["confidence"] = max(existing["confidence"], confidence)
            existing["lift"] = max(existing["lift"], lift)
            existing["support"] = max(existing["support"], support)
            existing["match_ratio"] = max(existing["match_ratio"], match_ratio)
            existing["rules"].append(normalized_rule)

    sorted_jobs = sorted(
        job_candidates.items(),
        key=lambda item: (-item[1]["confidence"], -item[1]["lift"], -item[1]["support"], -item[1]["match_ratio"], item[0]),
    )
    recommended_jobs = [job for job, _ in sorted_jobs[:5]]

    # If strict employability-level filtering removes all candidates, keep dynamic ECLAT ranking
    # instead of returning an empty list.
    if not recommended_jobs:
        fallback_sorted_jobs = sorted(
            all_job_candidates.items(),
            key=lambda item: (-item[1]["match_ratio"], -item[1]["confidence"], -item[1]["lift"], -item[1]["support"], item[0]),
        )
        recommended_jobs = [job for job, _ in fallback_sorted_jobs[:5]]
        job_candidates = all_job_candidates

    # Final fallback: still dataset-driven from cluster/global job distributions.
    # Also top up to 5 using cluster/global data if ECLAT didn't yield enough.
    if cluster_id is not None and len(recommended_jobs) < 5:
        for job in cluster_job_recommendations.get(cluster_id, []) + global_job_recommendations:
            if job in recommended_jobs:
                continue
            recommended_jobs.append(job)
            if len(recommended_jobs) >= 5:
                break

    improvement_plan: list[str] = []
    seen_actions: set[str] = set()
    missing_skill_scores: dict[str, float] = {}
    missing_skill_job_scores: dict[str, dict[str, float]] = {}
    missing_skill_job_evidence: dict[str, dict[str, int]] = {}
    job_action_counts: dict[str, int] = {job: 0 for job in recommended_jobs}
    max_actions_per_job = 2 if len(recommended_jobs) > 1 else 5
    for job in recommended_jobs:
        job_rules = job_candidates.get(job, {}).get("rules", [])
        for rule in job_rules:
            rule_weight = float(rule.get("confidence", 0.0)) * max(0.1, float(rule.get("_match_ratio", 0.0)))
            for missing in rule.get("_missing_skills", []):
                missing_skill_scores[missing] = missing_skill_scores.get(missing, 0.0) + rule_weight
                if missing not in missing_skill_job_scores:
                    missing_skill_job_scores[missing] = {}
                if missing not in missing_skill_job_evidence:
                    missing_skill_job_evidence[missing] = {}
                missing_skill_job_scores[missing][job] = missing_skill_job_scores[missing].get(job, 0.0) + rule_weight
                missing_skill_job_evidence[missing][job] = missing_skill_job_evidence[missing].get(job, 0) + 1

    for missing, _ in sorted(missing_skill_scores.items(), key=lambda item: (-item[1], item[0])):
        job_scores = missing_skill_job_scores.get(missing, {})
        if recommended_jobs:
            ranked_jobs = sorted(
                recommended_jobs,
                key=lambda job: (
                    -float(job_scores.get(job, 0.0)),
                    job_action_counts.get(job, 0),
                    recommended_jobs.index(job),
                ),
            )
            selected_job = None
            for job in ranked_jobs:
                if job_action_counts.get(job, 0) < max_actions_per_job:
                    selected_job = job
                    break
            if selected_job is None:
                selected_job = ranked_jobs[0]
        else:
            selected_job = "your target role"

        selected_weight = float(job_scores.get(selected_job, 0.0))
        selected_evidence = int(missing_skill_job_evidence.get(missing, {}).get(selected_job, 0))
        action = _build_improvement_action(missing, selected_job, selected_weight, selected_evidence, len(improvement_plan))
        if action in seen_actions:
            continue
        seen_actions.add(action)
        improvement_plan.append(action)
        if selected_job in job_action_counts:
            job_action_counts[selected_job] = job_action_counts.get(selected_job, 0) + 1
        if len(improvement_plan) >= 5:
            break

    # If all selected jobs are strict matches, derive next-step skill gaps from nearby partial rules.
    if not improvement_plan:
        global_skill_gaps: dict[str, float] = {}
        global_skill_best_job: dict[str, tuple[str, float]] = {}
        for job, item in all_job_candidates.items():
            for rule in item.get("rules", []):
                rule_weight = float(rule.get("confidence", 0.0)) * max(0.1, float(rule.get("_match_ratio", 0.0)))
                for missing in rule.get("_missing_skills", []):
                    global_skill_gaps[missing] = global_skill_gaps.get(missing, 0.0) + rule_weight
                    if rule_weight >= global_skill_best_job.get(missing, ("", 0.0))[1]:
                        global_skill_best_job[missing] = (job, rule_weight)

        for missing, total_weight in sorted(global_skill_gaps.items(), key=lambda item: (-item[1], item[0])):
            best_job = global_skill_best_job.get(missing, (recommended_jobs[0] if recommended_jobs else "your target role", 0.0))[0]
            action = _build_improvement_action(missing, best_job, total_weight, index=len(improvement_plan))
            if action in seen_actions:
                continue
            seen_actions.add(action)
            improvement_plan.append(action)
            if len(improvement_plan) >= 5:
                break

    if not improvement_plan:
        for job in recommended_jobs:
            for rule in job_candidates.get(job, {}).get("rules", []):
                required_skills = set(rule.get("_required_skills", []))
                missing_skills = sorted(required_skills - student_skills)
                for missing in missing_skills:
                    action = _build_improvement_action(missing, job, index=len(improvement_plan))
                    if action in seen_actions:
                        continue
                    seen_actions.add(action)
                    improvement_plan.append(action)
                    if len(improvement_plan) >= 5:
                        break
                if len(improvement_plan) >= 5:
                    break
            if len(improvement_plan) >= 5:
                break

    # Fill remaining slots (up to 5) with profile-dimension recommendations
    # based on the student's actual weakest areas (GWA, survey categories, soft skills, certs).
    if len(improvement_plan) < 5:
        profile_scores = student.get("scores", {})
        if profile_scores:
            gap_actions = _profile_gap_recommendations(profile_scores, seen_actions, 5 - len(improvement_plan))
            improvement_plan.extend(gap_actions)

    for job in recommended_jobs:
        for rule in job_candidates.get(job, {}).get("rules", []):
            matched_rule_rows.append({
                "rule": _format_rule({
                    "antecedent": [f"skill:{skill}" for skill in rule.get("_required_skills", [])],
                    "consequent": f"job:{_normalize_token(job)}",
                }),
                "support": float(rule.get("support", 0.0)),
                "confidence": float(rule.get("confidence", 0.0)),
                "lift": float(rule.get("lift", 0.0)),
            })

    matched_rule_rows.sort(key=lambda row: (-row["confidence"], -row["lift"], -row["support"], row["rule"]))

    return {
        "employabilityLevel": employability_level,
        "score": round(float(score), 2),
        "recommendedJobs": recommended_jobs,
        "improvementPlan": improvement_plan[:5],
        "matchedRules": matched_rule_rows,
    }


def _build_student_rule_vector(student_skills: list[str], has_cert: bool, employability_level: str, n_components: int, cluster_probs: np.ndarray | None = None) -> np.ndarray:
    skills = {_normalize_token(skill) for skill in student_skills if _normalize_token(skill)}
    expanded_skills = _expand_student_skills(skills)
    level_token = f"level:{employability_level.replace(' ', '_').lower()}"
    cert_token = "cert:has_cert" if has_cert else "cert:no_cert"
    vector = np.zeros(n_components, dtype=float)

    for rule in dynamic_eclat_rules:
        cluster_id = int(rule.get("cluster_id", 0))
        if cluster_id >= n_components:
            continue

        if cluster_probs is not None and cluster_probs.size > cluster_id and cluster_probs[cluster_id] < 0.05:
            continue

        antecedents = [str(token) for token in rule.get("antecedent", [])]
        required_skills = set()
        rule_level = None
        rule_cert = None
        for token in antecedents:
            if token.startswith("level:"):
                rule_level = token
                continue
            if token.startswith("cert:"):
                rule_cert = token
                continue
            normalized = _normalize_token(token)
            if normalized:
                required_skills.add(normalized)

        if rule_level and rule_level != level_token:
            continue
        if rule_cert and rule_cert != cert_token:
            continue
        if not required_skills:
            continue
        if not required_skills.issubset(expanded_skills):
            continue

        # ECLAT: Rule Strength = Confidence × Lift
        # Combines how often consequent follows antecedent (confidence)
        # with how much more likely it is than random (lift)
        vector[cluster_id] += float(rule.get("confidence", 0.0)) * float(rule.get("lift", 0.0))

    return vector


def _compute_student_rule_sum(student_skills: list[str], has_cert: bool, employability_level: str, n_components: int,
                              cluster_probs: np.ndarray | None = None) -> float:
    rule_vector = _build_student_rule_vector(
        student_skills,
        has_cert=has_cert,
        employability_level=employability_level,
        n_components=n_components,
        cluster_probs=cluster_probs,
    )
    return float(np.sum(rule_vector))

def _rank_jobs_by_cosine(student_es_score: float, n_components: int) -> list[tuple[str, float, float]]:
    ranked: list[tuple[str, float, float]] = []
    weight_vec = np.array([cluster_weights.get(i, 0.0) for i in range(n_components)], dtype=float)
    student_es_array = np.array([student_es_score], dtype=float)

    for job, profile in job_cluster_profiles.items():
        if job in INVALID_JOB_TYPES:
            continue
        profile_vec = np.array(profile, dtype=float)
        if profile_vec.size != n_components:
            continue
        rule_vec = np.array(job_rule_strengths.get(job, np.zeros(n_components, dtype=float)), dtype=float)
        # GMM term: weighted cluster probabilities (GMM-based component)
        gmm_term = float(np.sum(profile_vec * weight_vec))
        # ECLAT term: sum of rule strengths across all clusters (ECLAT-based component)
        eclat_term = float(np.sum(rule_vec))
        # Job Recommendation Score Formula (hybrid GMM + ECLAT)
        # job_score = (JS_BETA * gmm_term) + ((1.0 - JS_BETA) * eclat_term)
        # JS_BETA = 0.7: Weights GMM at 70% and ECLAT at 30% for balanced job ranking
        job_score = (JS_BETA * gmm_term) + ((1.0 - JS_BETA) * eclat_term)
        similarity = _cosine_similarity(student_es_array, np.array([job_score], dtype=float))
        ranked.append((job, similarity, job_score))

    ranked.sort(key=lambda item: (-item[1], -item[2], item[0]))
    return ranked


def _build_job_cosine_scores(cosine_ranked_jobs: list, all_recommended_jobs: list) -> list:
    """Build jobCosineScores list for top-10 cosine jobs, then pad any remaining
    recommended jobs that didn't make the cosine list (fallback jobs) with score 0.0
    so the frontend always has a score entry for every displayed job."""
    seen: set[str] = set()
    scores = []
    for job, sim, js in cosine_ranked_jobs[:10]:
        scores.append({"job": job, "cosine": round(float(sim), 6), "jobScore": round(float(js), 6)})
        seen.add(job)
    for job in all_recommended_jobs:
        if job not in seen:
            scores.append({"job": job, "cosine": 0.0, "jobScore": 0.0})
    return scores


def predict(input_data: dict) -> dict:
    gwa = float(input_data.get("gwa", 3.0))
    survey_scores = input_data.get("surveyScores", {})
    tech_count = int(input_data.get("technicalSkillsCount", 0))
    soft_avg = float(input_data.get("softSkillsAverage", 3.0))
    cert_count = int(input_data.get("certificationCount", 0))
    # certWeight: relevance multiplier for approved certifications (0.0–1.0).
    # 1.0 = all certs are dataset-recognized (AWS/Cisco/CompTIA/Google/Microsoft/Oracle)
    # 0.3 = certs are unrecognized/generic. Defaults to 1.0 for backwards compat.
    cert_weight = float(input_data.get("certWeight", 1.0))
    cert_weight = max(0.0, min(1.0, cert_weight))
    student_skills = [str(skill) for skill in input_data.get("skills", []) if str(skill).strip()]
    student_certifications = [str(cert) for cert in input_data.get("certifications", []) if str(cert).strip()]

    survey_keys = ["professional_ethics", "scientific_spirit", "humanistic_quality",
                   "computer_cognition", "software_design", "system_usage",
                   "sustainable_development", "team_capacity", "job_application"]

    survey_vals = [survey_scores.get(k, 3.0) / 5.0 for k in survey_keys]
    survey_avg_raw = float(np.mean(survey_vals)) * 5.0

    employability_score = compute_score(gwa, survey_avg_raw, tech_count, soft_avg, cert_count, cert_weight)
    score_based_status = _score_status_fallback(employability_score)
    gmm_based_status = score_based_status
    status = score_based_status
    direct_employability_score = float(np.clip(employability_score / 100.0, 0.0, 1.0))
    fused_employability_score = direct_employability_score

    cluster_label = DEFAULT_CLUSTER_LABELS[-1]
    cluster_id = 0
    feat_row = None
    cluster_probs = None
    n_components = int(gmm_model.n_components) if gmm_model is not None else N_COMPONENTS
    if gmm_model is not None and scaler is not None:
        gwa_norm = (5.0 - gwa) / 4.0
        tech_norm = min(tech_count / 40.0, 1.0)
        cert_norm = min(cert_count / 10.0, 1.0)
        soft_norm = soft_avg / 5.0

        base_row = {
            "gwa_norm": gwa_norm,
            "survey_avg": float(np.mean(survey_vals)),
            "professional_ethics": survey_vals[0],
            "scientific_spirit": survey_vals[1],
            "humanistic_quality": survey_vals[2],
            "computer_cognition": survey_vals[3],
            "software_design": survey_vals[4],
            "system_usage": survey_vals[5],
            "sustainable_development": survey_vals[6],
            "team_capacity": survey_vals[7],
            "job_application": survey_vals[8],
            "tech_skills_norm": tech_norm,
            "soft_skills_avg": soft_norm,
            "cert_norm": cert_norm,
            "cert_weight_norm": cert_weight,  # relevance weight from student's approved certs
        }

        runtime_row = []
        for feature_name in runtime_feature_names:
            if feature_name in base_row:
                runtime_row.append(float(base_row[feature_name]))
            else:
                runtime_row.append(float(runtime_feature_defaults.get(feature_name, 0.0)))
        feat_row = np.array([runtime_row], dtype=float)
        feat_scaled = scaler.transform(feat_row)
        cluster_probs = gmm_model.predict_proba(feat_scaled)[0]
        cluster_id = int(np.argmax(cluster_probs))
        cluster_label = cluster_label_names.get(cluster_id, DEFAULT_CLUSTER_LABELS[cluster_id % len(DEFAULT_CLUSTER_LABELS)])
        gmm_based_status = cluster_level_map.get(cluster_id, score_based_status)
        if cluster_strength_scores:
            min_s = float(min(cluster_strength_scores.values()))
            max_s = float(max(cluster_strength_scores.values()))
            denom = max(max_s - min_s, 1e-12)
            strength_norm = {cid: (float(score) - min_s) / denom for cid, score in cluster_strength_scores.items()}
            strength_vector = np.array([strength_norm.get(i, 0.5) for i in range(int(gmm_model.n_components))], dtype=float)
            cluster_employability_score = float(np.sum(cluster_probs * strength_vector))
        else:
            cluster_employability_score = float(np.max(cluster_probs)) if len(cluster_probs) > 0 else 0.0
        fused_employability_score = (status_fusion_alpha * cluster_employability_score) + ((1.0 - status_fusion_alpha) * direct_employability_score)
        status = _status_from_thresholds(fused_employability_score, status_low_threshold, status_high_threshold)

    survey_category_scores = {k: survey_scores.get(k, 3.0) for k in survey_keys}

    dynamic_result = generate_dynamic_recommendation(
        {
            "skills": student_skills,
            "certifications": student_certifications,
            "scores": {
                "gwa": gwa,
                "surveyAverage": survey_avg_raw,
                "surveyCategories": survey_category_scores,
                "technicalSkillsCount": tech_count,
                "softSkillsAverage": soft_avg,
                "certificationCount": cert_count,
            },
        },
        dynamic_eclat_rules,
        status,
        employability_score,
        cluster_id=cluster_id,
    )

    # Fallback to uniform weights when cluster_weights is empty (model not fully ready).
    _active_weights = cluster_weights if cluster_weights else {i: 1.0 / max(1, n_components) for i in range(n_components)}
    weight_vec = np.array([_active_weights.get(i, 0.0) for i in range(n_components)], dtype=float)
    if cluster_probs is None:
        cluster_probs = np.zeros(n_components, dtype=float)
        if n_components > 0:
            cluster_probs[cluster_id] = 1.0

    student_rule_sum = _compute_student_rule_sum(
        student_skills,
        has_cert=bool(student_certifications or cert_count > 0),
        employability_level=status,
        n_components=n_components,
        cluster_probs=cluster_probs,
    )
    gmm_contribution = float(np.sum(cluster_probs * weight_vec))
    student_es_score = (ES_ALPHA * gmm_contribution) + ((1.0 - ES_ALPHA) * student_rule_sum)
    cosine_ranked_jobs = _rank_jobs_by_cosine(student_es_score, n_components)

    job_recommendations = [job for job, _, _ in cosine_ranked_jobs[:5]]
    if not job_recommendations:
        job_recommendations = dynamic_result["recommendedJobs"]
    # Absolute fallback: if both cosine and ECLAT returned nothing (e.g. model not yet
    # trained when request arrived), use global dataset-derived jobs then hardcoded defaults.
    if not job_recommendations:
        job_recommendations = list(global_job_recommendations[:5])
    if not job_recommendations:
        job_recommendations = ["Developer", "Data Analyst", "Tester", "Researcher", "Manager"]

    thesis_employability_score = round(student_es_score * 100.0, 2)
    recommendations = dynamic_result["improvementPlan"]

    score_breakdown = {
        "academic": round(((5.0 - gwa) / 4.0) * 100, 1),
        "survey": round((np.mean(survey_vals)) * 100, 1),
        "technicalSkills": round(min(tech_count / 40.0, 1.0) * 100, 1),
        "softSkills": round((soft_avg / 5.0) * 100, 1),
        "certifications": round(min(cert_count / 5.0, 1.0) * 100, 1),
    }

    weakest_area_labels = {
        "academic": "Academic / GWA",
        "survey": "Survey Responses",
        "technicalSkills": "Technical Skills",
        "softSkills": "Soft Skills",
        "certifications": "Certifications",
    }
    weakest_areas = sorted(score_breakdown.items(), key=lambda item: item[1])[:3]
    weakest_area_text = ", ".join(
        f"{weakest_area_labels.get(key, key)} ({value:.1f}%)" for key, value in weakest_areas
    )
    gmm_confidence = float(np.max(cluster_probs)) if cluster_probs is not None and len(cluster_probs) > 0 else 0.0
    low_employability_reason = None
    if status == "Low Employability":
        reason_parts = []
        if score_based_status != gmm_based_status:
            reason_parts.append(
                f"Your score-band is {score_based_status}, but final status remains Low because GMM profile classification is the final decision rule."
            )
        reason_parts.append(f"Weakest profile areas now: {weakest_area_text}.")
        if gmm_confidence > 0:
            reason_parts.append(f"Current Low-cluster confidence: {gmm_confidence * 100:.1f}%.")
        low_employability_reason = " ".join(reason_parts)

    is_low_status = status == "Low Employability"
    recommendation_context = {
        "mode": "target_path" if is_low_status else "immediate_fit",
        "title": "Target Roles After Improvement" if is_low_status else "Top Job Recommendations",
        "message": (
            "You are not yet job-ready for these roles today. Treat this list as your target career path after completing the action plan."
            if is_low_status
            else "These roles are your current best-fit opportunities based on your profile."
        ),
    }

    # Calculate improved score and target roles after improvement
    current_score, improved_score, improvements = compute_improved_score(
        gwa, survey_avg_raw, tech_count, soft_avg, cert_count
    )
    improved_status = _score_status_fallback(improved_score)
    
    # Get target jobs at improved level
    target_jobs_at_improved_level = []
    if improved_status != status:
        # Re-run recommendation at improved level
        improved_result = generate_dynamic_recommendation(
            {
                "skills": student_skills + ["python", "react", "sql"],  # Add some common improvements
                "certifications": student_certifications + ["AWS Certified Cloud Practitioner"],
                "scores": {
                    "gwa": improvements["gwa"]["improved"],
                    "surveyAverage": min(5.0, survey_avg_raw + 1.0),
                    "surveyCategories": {k: min(5.0, v + 0.8) for k, v in survey_category_scores.items()},
                    "technicalSkillsCount": improvements["tech_skills"]["improved"],
                    "softSkillsAverage": improvements["soft_skills"]["improved"],
                    "certificationCount": improvements["certifications"]["improved"],
                },
            },
            dynamic_eclat_rules,
            improved_status,
            improved_score,
            cluster_id=cluster_id,
        )
        target_jobs_at_improved_level = improved_result["recommendedJobs"]

    return {
        "employabilityScore": round(employability_score, 2),
        "employabilityScoreImproved": round(improved_score, 2),
        "employabilityScoreCurrentTotal": round(current_score, 2),
        "employabilityImprovementPotential": improvements["potential_gain"],
        "employabilityImprovementDetails": improvements,
        "thesisEmployabilityScore": thesis_employability_score,
        "employabilityStatus": status,
        "scoreBasedStatus": score_based_status,
        "gmmBasedStatus": gmm_based_status,
        "statusExplanation": (
            f"Final status follows learned fused thresholds (low={status_low_threshold:.2f}, high={status_high_threshold:.2f}); score-band status is shown separately as {score_based_status}."
            if score_based_status != gmm_based_status
            else f"Score-based status and GMM profile status both indicate {status}."
        ),
        "employabilityLevel": dynamic_result["employabilityLevel"],
        "score": dynamic_result["score"],
        "clusterLabel": cluster_label,
        "clusterId": cluster_id,
        "gmmConfidence": round(gmm_confidence, 4),
        "jobRecommendations": job_recommendations,
        "recommendedJobs": job_recommendations,
        "targetRolesAfterImprovement": target_jobs_at_improved_level,
        "jobRecommendationContext": recommendation_context,
        "lowEmployabilityReason": low_employability_reason,
        "scoreFusion": {
            "alpha": round(float(status_fusion_alpha), 4),
            "beta": JS_BETA,
            "gmmContribution": round(gmm_contribution, 4),
            "eclatContribution": round(student_rule_sum, 4),
            "directContribution": round(direct_employability_score, 4),
            "fusedEmployabilityScore": round(fused_employability_score, 4),
            "lowThreshold": round(float(status_low_threshold), 4),
            "highThreshold": round(float(status_high_threshold), 4),
        },
        "clusterProbabilities": [round(float(value), 6) for value in cluster_probs.tolist()],
        "jobCosineScores": _build_job_cosine_scores(cosine_ranked_jobs, job_recommendations),
        "scoreBreakdown": score_breakdown,
        "recommendations": recommendations,
        "improvementPlan": dynamic_result["improvementPlan"],
        "matchedRules": dynamic_result["matchedRules"],
        "inputSummary": {
            "gwa": gwa,
            "surveyAverage": round(survey_avg_raw, 2),
            "technicalSkillsCount": tech_count,
            "softSkillsAverage": soft_avg,
            "certificationCount": cert_count,
        },
    }


def is_model_ready() -> bool:
    """Returns True only when the GMM model has been fully trained and job profiles are built."""
    return gmm_model is not None and scaler is not None and bool(job_cluster_profiles) and bool(cluster_weights)


def get_training_info() -> dict:
    return training_info


def get_features() -> dict:
    return {"feature_names": runtime_feature_names, "feature_count": len(runtime_feature_names)}


def get_model_summary() -> dict:
    if gmm_model is None:
        return {"status": "not_trained"}
    n_components = int(gmm_model.n_components)
    return {
        "algorithm": "GaussianMixture",
        "n_components": n_components,
        "gmm_selection": {
            "criterion": "lowest_bic_then_aic",
            "candidates": gmm_selection_scores,
        },
        "status_fusion_alpha": round(float(status_fusion_alpha), 4),
        "status_thresholds": {
            "low": round(float(status_low_threshold), 4),
            "high": round(float(status_high_threshold), 4),
        },
        "pattern_mining": {
            "algorithm": "ECLAT",
            "available": True,
            "training_transactions": len(training_transactions),
            "cluster_rule_counts": {str(k): len(v) for k, v in sorted(cluster_eclat_rules.items(), key=lambda item: item[0])},
        },
        "covariance_type": gmm_model.covariance_type,
        "converged": bool(gmm_model.converged_),
        "n_iter": int(gmm_model.n_iter_),
        "silhouette_score": round(float(training_info.get("silhouette_score", 0.0)), 4),
        "cv_neg_log_likelihood": training_info.get("cv_neg_log_likelihood", {}),
        "weights": [round(float(w), 4) for w in gmm_model.weights_],
        "cluster_labels": [cluster_label_names.get(i, DEFAULT_CLUSTER_LABELS[i % len(DEFAULT_CLUSTER_LABELS)]) for i in range(n_components)],
        "cluster_employability_levels": {str(k): v for k, v in cluster_level_map.items()},
        "cluster_quality_scores": {str(k): round(float(v), 4) for k, v in cluster_quality_scores.items()},
        "cluster_employment_rates": {str(k): round(float(v), 4) for k, v in cluster_employment_rates.items()},
        "cluster_strength_scores": {str(k): round(float(v), 4) for k, v in cluster_strength_scores.items()},
        "cluster_weights": {str(k): round(float(v), 6) for k, v in cluster_weights.items()},
        "cluster_job_recommendations": {
            str(k): v for k, v in sorted(cluster_job_recommendations.items(), key=lambda item: item[0])
        },
        "dynamic_eclat_rules": len(dynamic_eclat_rules),
        "employability_levels": EMPLOYABILITY_LEVELS,
        "score_weights": {
            "academic_gwa": 0.30,
            "survey": 0.25,
            "technical_skills": 0.20,
            "soft_skills": 0.15,
            "certifications": 0.10,
        },
    }


def get_gmm_visualization_data() -> dict:
    """Return PCA-projected GMM cluster scatter points and Gaussian ellipse boundaries for 2D visualization."""
    if gmm_model is None or training_feature_matrix is None or training_cluster_assignments is None:
        return {"points": [], "ellipses": [], "explainedVariance": [0.0, 0.0]}

    from sklearn.decomposition import PCA  # lazy import — PCA only needed for visualization

    pca = PCA(n_components=2, random_state=42)
    X_2d = pca.fit_transform(training_feature_matrix)

    # Sample at most 500 points to keep the response small
    rng = np.random.RandomState(42)
    n = len(X_2d)
    idx = rng.choice(n, size=min(n, 500), replace=False)

    points = [
        {
            "x": round(float(X_2d[i, 0]), 3),
            "y": round(float(X_2d[i, 1]), 3),
            "cluster": int(training_cluster_assignments[i]),
            "level": cluster_level_map.get(int(training_cluster_assignments[i]), "Moderate Employability"),
        }
        for i in idx
    ]

    W = pca.components_  # shape (2, n_features)
    theta = np.linspace(0, 2 * np.pi, 60)
    ellipses = []

    for k in range(gmm_model.n_components):
        mean_2d = W @ gmm_model.means_[k]

        cov_full = gmm_model.covariances_[k]
        if cov_full.ndim == 1:
            cov_full = np.diag(cov_full)
        cov_2d = W @ cov_full @ W.T  # project covariance into 2D PCA space

        eigenvalues, eigenvectors = np.linalg.eigh(cov_2d)
        order = np.argsort(eigenvalues)[::-1]
        eigenvalues = eigenvalues[order]
        eigenvectors = eigenvectors[:, order]

        r0 = 2.0 * np.sqrt(max(float(eigenvalues[0]), 1e-10))
        r1 = 2.0 * np.sqrt(max(float(eigenvalues[1]), 1e-10))

        # Generate 60 boundary points for the 2-sigma ellipse polygon
        boundary = []
        for t in theta:
            unit = np.array([np.cos(t), np.sin(t)])
            scaled = np.array([r0 * unit[0], r1 * unit[1]])
            pt = mean_2d + eigenvectors @ scaled
            boundary.append([round(float(pt[0]), 3), round(float(pt[1]), 3)])

        ellipses.append({
            "cluster": k,
            "level": cluster_level_map.get(k, "Moderate Employability"),
            "boundary": boundary,
        })

    return {
        "points": points,
        "ellipses": ellipses,
        "explainedVariance": [round(float(v), 4) for v in pca.explained_variance_ratio_],
    }


def _binary_metrics_from_scores(y_true_bin: np.ndarray, y_score: np.ndarray, threshold: float = 0.5) -> dict:
    y_pred_bin = (y_score >= threshold).astype(int)

    tp = int(np.sum((y_pred_bin == 1) & (y_true_bin == 1)))
    fp = int(np.sum((y_pred_bin == 1) & (y_true_bin == 0)))
    fn = int(np.sum((y_pred_bin == 0) & (y_true_bin == 1)))
    tn = int(np.sum((y_pred_bin == 0) & (y_true_bin == 0)))

    total = max(1, tp + fp + fn + tn)
    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    specificity = tn / max(1, tn + fp)
    f1 = (2.0 * precision * recall) / max(1e-12, precision + recall)
    npv = tn / max(1, tn + fn)
    f1_negative = (2.0 * specificity * npv) / max(1e-12, specificity + npv)
    balanced_accuracy = (recall + specificity) / 2.0
    macro_f1 = (f1 + f1_negative) / 2.0
    accuracy = (tp + tn) / total
    # RMSE for continuous employability score against binary employment labels.
    rmse = float(np.sqrt(np.mean((y_score - y_true_bin) ** 2)))

    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "specificity": float(specificity),
        "f1": float(f1),
        "f1_negative": float(f1_negative),
        "macro_f1": float(macro_f1),
        "balanced_accuracy": float(balanced_accuracy),
        "rmse": rmse,
    }


def _roc_points_and_auc(y_true_bin: np.ndarray, y_score: np.ndarray) -> tuple[list[dict], float]:
    thresholds = np.linspace(1.0, 0.0, 101)
    points: list[dict] = []
    for threshold in thresholds:
        pred = (y_score >= threshold).astype(int)
        tp = int(np.sum((pred == 1) & (y_true_bin == 1)))
        fp = int(np.sum((pred == 1) & (y_true_bin == 0)))
        fn = int(np.sum((pred == 0) & (y_true_bin == 1)))
        tn = int(np.sum((pred == 0) & (y_true_bin == 0)))

        tpr = tp / max(1, tp + fn)
        fpr = fp / max(1, fp + tn)
        points.append({
            "threshold": round(float(threshold), 4),
            "fpr": round(float(fpr), 6),
            "tpr": round(float(tpr), 6),
        })

    points = sorted(points, key=lambda p: (p["fpr"], p["tpr"]))

    auc = 0.0
    for i in range(1, len(points)):
        x0 = points[i - 1]["fpr"]
        y0 = points[i - 1]["tpr"]
        x1 = points[i]["fpr"]
        y1 = points[i]["tpr"]
        auc += (x1 - x0) * ((y0 + y1) / 2.0)

    return points, float(auc)


def _cross_validated_model_performance() -> dict:
    if not dataset_path:
        return {"available": False, "reason": "Dataset path is unavailable."}

    df = read_dataset(dataset_path)
    df = _prepare_training_dataframe(df).reset_index(drop=True)

    feature_names = list(df.attrs.get("runtime_feature_names", RUNTIME_BASE_FEATURE_NAMES))
    for feature in feature_names:
        if feature not in df.columns:
            df[feature] = 0.0

    x_all = df[feature_names].values
    y_all = pd.to_numeric(df.get("employment", pd.Series(np.zeros(len(df)), index=df.index)), errors="coerce").fillna(0.0).clip(0.0, 1.0).values
    y_bin_all = (y_all >= 0.5).astype(int)

    if len(x_all) < 2:
        return {"available": False, "reason": "Not enough samples for K-Fold validation."}

    if len(np.unique(y_bin_all)) < 2:
        return {"available": False, "reason": "Employment labels have only one class; ROC/confusion metrics are undefined."}

    fold_count = max(2, min(CV_FOLDS, len(x_all)))
    skf = StratifiedKFold(n_splits=fold_count, shuffle=True, random_state=42)

    pooled_scores: list[np.ndarray] = []
    pooled_truth: list[np.ndarray] = []
    pooled_preds: list[np.ndarray] = []
    fold_accuracies: list[float] = []
    fold_precisions: list[float] = []
    fold_recalls: list[float] = []
    fold_f1s: list[float] = []
    fold_rmses: list[float] = []
    fold_nlls: list[float] = []
    fold_thresholds: list[float] = []

    for train_idx, test_idx in skf.split(x_all, y_bin_all):
        x_train = x_all[train_idx]
        x_test = x_all[test_idx]
        y_train_bin = y_bin_all[train_idx]
        y_test_bin = y_bin_all[test_idx]

        if len(x_train) <= 1 or len(x_test) == 0:
            continue

        scaler_cv = StandardScaler()
        x_train_scaled = scaler_cv.fit_transform(x_train)
        x_test_scaled = scaler_cv.transform(x_test)

        gmm_cv, _ = _select_best_gmm(x_train_scaled)
        probs_train = gmm_cv.predict_proba(x_train_scaled)
        probs_test = gmm_cv.predict_proba(x_test_scaled)
        train_cluster_assignments = gmm_cv.predict(x_train_scaled)
        _, quality_scores_cv, employment_rate_cv, strength_scores_cv = _derive_cluster_levels(
            df.iloc[train_idx].reset_index(drop=True),
            train_cluster_assignments,
            gmm_cv,
            scaler_cv,
        )

        # GMM term: use thesis cluster weight formula w_k = (quality_k − min + ε) / Σ_j(quality_j − min + ε)
        # quality_k = 0.30*gwa_norm + 0.25*survey_avg + 0.20*tech_norm + 0.15*soft_norm + 0.10*cert_norm
        if quality_scores_cv:
            q_min = float(min(quality_scores_cv.values()))
            _eps = 1e-6
            q_shifted = {cid: (float(score) - q_min + _eps) for cid, score in quality_scores_cv.items()}
            q_sum = max(sum(q_shifted.values()), 1e-12)
            quality_vector = np.array([q_shifted.get(i, _eps) / q_sum for i in range(int(gmm_cv.n_components))], dtype=float)
            y_score_gmm_train = (probs_train @ quality_vector).clip(0.0, 1.0)
            y_score_gmm_test = (probs_test @ quality_vector).clip(0.0, 1.0)
        else:
            y_score_gmm_train = np.zeros(len(x_train), dtype=float)
            y_score_gmm_test = np.zeros(len(x_test), dtype=float)

        # Direct score term (thesis displayed employability score formula):
        # ES_direct = 0.30*gwa_norm + 0.25*survey_avg + 0.20*tech_norm + 0.15*soft_norm + 0.10*cert_norm
        _direct_weights = [("gwa_norm", 0.30), ("survey_avg", 0.25), ("tech_skills_norm", 0.20), ("soft_skills_avg", 0.15), ("cert_norm", 0.10)]
        y_score_direct_train = np.zeros(len(x_train), dtype=float)
        y_score_direct_test = np.zeros(len(x_test), dtype=float)
        for _feat, _w in _direct_weights:
            if _feat in feature_names:
                _idx = feature_names.index(_feat)
                y_score_direct_train += _w * np.clip(x_train[:, _idx], 0.0, 1.0)
                y_score_direct_test += _w * np.clip(x_test[:, _idx], 0.0, 1.0)

        # Thesis ES formula: ES = α*GMM_term + (1-α)*direct_term
        # Find optimal α on training fold using AUC to avoid test leakage.
        best_fusion_alpha = float(ES_ALPHA)
        if len(np.unique(y_train_bin)) >= 2:
            best_fusion_auc = -1.0
            for _a in np.linspace(0.0, 1.0, 11):
                _fused_tr = np.clip(float(_a) * y_score_gmm_train + (1.0 - float(_a)) * y_score_direct_train, 0.0, 1.0)
                _, _auc_val = _roc_points_and_auc(y_train_bin, _fused_tr)
                if float(_auc_val) > best_fusion_auc:
                    best_fusion_auc = float(_auc_val)
                    best_fusion_alpha = float(_a)
        y_score_train = np.clip(best_fusion_alpha * y_score_gmm_train + (1.0 - best_fusion_alpha) * y_score_direct_train, 0.0, 1.0)
        y_score_test = np.clip(best_fusion_alpha * y_score_gmm_test + (1.0 - best_fusion_alpha) * y_score_direct_test, 0.0, 1.0)

        # Calibrate score direction per fold so higher score always means more likely employed.
        if np.any(y_train_bin == 1) and np.any(y_train_bin == 0):
            pos_mean = float(np.mean(y_score_train[y_train_bin == 1]))
            neg_mean = float(np.mean(y_score_train[y_train_bin == 0]))
            if pos_mean < neg_mean:
                y_score_train = 1.0 - y_score_train
                y_score_test = 1.0 - y_score_test

        # Select threshold on training fold only (no test leakage).
        # Objective: macro F1 — balances both classes without degenerating to all-one prediction.
        best_threshold = 0.5
        best_obj = -1.0
        best_acc = -1.0
        best_bal_acc = -1.0
        for threshold in np.linspace(0.0, 1.0, 101):
            train_metrics = _binary_metrics_from_scores(y_train_bin, y_score_train, threshold=float(threshold))
            objective = float(train_metrics["macro_f1"])
            acc = float(train_metrics["accuracy"])
            bal_acc = float(train_metrics["balanced_accuracy"])
            if (
                (objective > best_obj)
                or (abs(objective - best_obj) <= 1e-12 and acc > best_acc)
                or (abs(objective - best_obj) <= 1e-12 and abs(acc - best_acc) <= 1e-12 and bal_acc > best_bal_acc)
            ):
                best_obj = objective
                best_acc = acc
                best_bal_acc = bal_acc
                best_threshold = float(threshold)

        metrics = _binary_metrics_from_scores(y_test_bin, y_score_test, threshold=best_threshold)
        y_pred_test = (y_score_test >= best_threshold).astype(int)

        fold_accuracies.append(metrics["accuracy"])
        fold_precisions.append(metrics["precision"])
        fold_recalls.append(metrics["recall"])
        fold_f1s.append(metrics["f1"])
        fold_rmses.append(metrics["rmse"])
        fold_thresholds.append(best_threshold)

        avg_log_likelihood = float(gmm_cv.score(x_test_scaled))
        fold_nlls.append(avg_log_likelihood)

        pooled_scores.append(y_score_test)
        pooled_truth.append(y_test_bin)
        pooled_preds.append(y_pred_test)

    if not pooled_scores or not pooled_truth:
        return {"available": False, "reason": "K-Fold validation did not produce usable folds."}

    y_score = np.concatenate(pooled_scores)
    y_true_bin = np.concatenate(pooled_truth)

    y_pred = np.concatenate(pooled_preds)

    tp = int(np.sum((y_pred == 1) & (y_true_bin == 1)))
    fp = int(np.sum((y_pred == 1) & (y_true_bin == 0)))
    fn = int(np.sum((y_pred == 0) & (y_true_bin == 1)))
    tn = int(np.sum((y_pred == 0) & (y_true_bin == 0)))
    total = max(1, tp + fp + fn + tn)

    overall_accuracy = float((tp + tn) / total)
    overall_precision = float(tp / max(1, tp + fp))
    overall_recall = float(tp / max(1, tp + fn))
    overall_f1 = float((2.0 * overall_precision * overall_recall) / max(1e-12, overall_precision + overall_recall))
    roc_points, auc = _roc_points_and_auc(y_true_bin, y_score)

    # Stability Index: higher means lower variability across folds.
    # We use 1 - std(accuracy) and clamp to [0, 1] for interpretability.
    stability_index = float(np.clip(1.0 - float(np.std(fold_accuracies)), 0.0, 1.0))

    return {
        "available": True,
        "reason": "",
        "confusionMatrix": {
            "labels": ["Employed", "Not Employed"],
            "matrix": [
                [tp, fp],
                [fn, tn],
            ],
            "accuracy": round(overall_accuracy, 6),
            "precision": round(overall_precision, 6),
            "recall": round(overall_recall, 6),
            "f1Score": round(overall_f1, 6),
        },
        "rocCurve": roc_points,
        "rocMeta": {
            "available": True,
            "reason": "",
            "auc": round(float(auc), 6),
            "positiveClass": "Employed",
            "thresholdUsedForConfusion": round(float(np.mean(fold_thresholds) if fold_thresholds else 0.5), 6),
        },
        "evaluation": {
            "protocol": "K-Fold Cross-Validation",
            "folds": int(len(fold_accuracies)),
            "rmse": round(float(np.mean(fold_rmses)), 6),
            "stabilityIndex": round(stability_index, 6),
            "averageCvNll": {
                "mean": round(float(np.mean(fold_nlls)), 6),
                "std": round(float(np.std(fold_nlls)), 6),
            },
            "foldMetrics": {
                "accuracyMean": round(float(np.mean(fold_accuracies)), 6),
                "accuracyStd": round(float(np.std(fold_accuracies)), 6),
                "precisionMean": round(float(np.mean(fold_precisions)), 6),
                "recallMean": round(float(np.mean(fold_recalls)), 6),
                "f1Mean": round(float(np.mean(fold_f1s)), 6),
            },
        },
    }


def get_model_performance_data() -> dict:
    """Return Chapter 3-aligned K-Fold validation metrics without altering core model logic."""
    if gmm_model is None or scaler is None:
        return {
            "available": False,
            "reason": "Model is not fully trained yet.",
            "confusionMatrix": {"matrix": [], "labels": ["Employed", "Not Employed"]},
            "rocCurve": [],
            "rocMeta": {"available": False, "reason": "Model is not fully trained yet."},
        }

    return _cross_validated_model_performance()


def get_dataset_options() -> dict:
    path = dataset_path or os.getenv("DATASET_PATH", "dataset/employability.xlsx")
    df = read_dataset(path)

    skill_frequency: dict[str, int] = {}
    if "HaveWorkedWith" in df.columns:
        for raw in df["HaveWorkedWith"].fillna("").astype(str):
            for item in [part.strip() for part in str(raw).split(";") if part.strip()]:
                display = _normalize_display_skill(item)
                if not display:
                    continue
                skill_frequency[display] = skill_frequency.get(display, 0) + 1

    categorized: dict[str, list[tuple[str, int]]] = {category: [] for category in TECH_CATEGORY_PRIORITY}
    for skill, freq in skill_frequency.items():
        category = _categorize_dataset_skill(skill)
        categorized.setdefault(category, []).append((skill, freq))

    technical_skills = []
    for category in TECH_CATEGORY_PRIORITY:
        ranked = sorted(categorized.get(category, []), key=lambda item: (-item[1], item[0]))
        if not ranked:
            continue
        technical_skills.append({
            "category": category,
            "skills": [name for name, _ in ranked[:20]],
        })

    soft_skills = []
    if "Professional Literacy" in df.columns:
        soft_skills.append({
            "key": "professionalism",
            "label": "Professional Literacy",
            "desc": "Dataset-aligned: Professional Literacy",
        })
    if "Soft Skills" in df.columns:
        soft_skills.append({
            "key": "adaptability",
            "label": "Soft Skills",
            "desc": "Dataset-aligned: Soft Skills",
        })

    return {
        "source": os.path.basename(path),
        "technicalSkills": technical_skills,
        "softSkills": soft_skills,
    }


# ---------------------------------------------------------------------------
# Model persistence — save/load trained state so Render can skip re-training
# ---------------------------------------------------------------------------

def save_model(path: str = "saved_model.pkl") -> bool:
    """Serialize the fully-trained model state to a pickle file."""
    import pickle
    if not is_model_ready():
        return False
    state = {
        "gmm_model": gmm_model,
        "scaler": scaler,
        "training_info": training_info,
        "cluster_level_map": cluster_level_map,
        "cluster_quality_scores": cluster_quality_scores,
        "cluster_employment_rates": cluster_employment_rates,
        "cluster_strength_scores": cluster_strength_scores,
        "cluster_weights": cluster_weights,
        "cluster_label_names": cluster_label_names,
        "cluster_job_recommendations": cluster_job_recommendations,
        "global_job_recommendations": global_job_recommendations,
        "job_cluster_profiles": job_cluster_profiles,
        "job_rule_strengths": job_rule_strengths,
        "job_level_lookup": job_level_lookup,
        "training_feature_matrix": training_feature_matrix,
        "training_cluster_assignments": training_cluster_assignments,
        "training_cluster_probabilities": training_cluster_probabilities,
        "training_employability_scores": training_employability_scores,
        "training_employment_targets": training_employment_targets,
        "training_job_types": training_job_types,
        "training_transactions": training_transactions,
        "gmm_selection_scores": gmm_selection_scores,
        "dataset_path": dataset_path,
        "runtime_feature_names": runtime_feature_names,
        "runtime_feature_defaults": runtime_feature_defaults,
    }
    with open(path, "wb") as f:
        import pickle
        pickle.dump(state, f, protocol=4)
    return True


def load_model(path: str = "saved_model.pkl") -> bool:
    """Load a previously saved model state from a pickle file."""
    import pickle
    if not os.path.exists(path):
        return False
    try:
        with open(path, "rb") as f:
            state = pickle.load(f)
        global gmm_model, scaler, training_info, cluster_level_map
        global cluster_quality_scores, cluster_employment_rates, cluster_strength_scores
        global cluster_weights, cluster_label_names, cluster_job_recommendations
        global global_job_recommendations, job_cluster_profiles, job_rule_strengths
        global job_level_lookup, training_feature_matrix, training_cluster_assignments
        global training_cluster_probabilities, training_employability_scores
        global training_employment_targets, training_job_types, training_transactions
        global gmm_selection_scores, dataset_path, runtime_feature_names, runtime_feature_defaults
        gmm_model = state["gmm_model"]
        scaler = state["scaler"]
        training_info = state["training_info"]
        cluster_level_map = state.get("cluster_level_map", {})
        cluster_quality_scores = state.get("cluster_quality_scores", {})
        cluster_employment_rates = state.get("cluster_employment_rates", {})
        cluster_strength_scores = state.get("cluster_strength_scores", {})
        cluster_weights = state.get("cluster_weights", {})
        cluster_label_names = state.get("cluster_label_names", {})
        cluster_job_recommendations = state.get("cluster_job_recommendations", {})
        global_job_recommendations = state.get("global_job_recommendations", [])
        job_cluster_profiles = state.get("job_cluster_profiles", {})
        job_rule_strengths = state.get("job_rule_strengths", {})
        job_level_lookup = state.get("job_level_lookup", {})
        training_feature_matrix = state.get("training_feature_matrix")
        training_cluster_assignments = state.get("training_cluster_assignments")
        training_cluster_probabilities = state.get("training_cluster_probabilities")
        training_employability_scores = state.get("training_employability_scores")
        training_employment_targets = state.get("training_employment_targets")
        training_job_types = state.get("training_job_types", [])
        training_transactions = state.get("training_transactions", [])
        gmm_selection_scores = state.get("gmm_selection_scores", [])
        dataset_path = state.get("dataset_path", "")
        runtime_feature_names = state.get("runtime_feature_names", RUNTIME_BASE_FEATURE_NAMES.copy())
        runtime_feature_defaults = state.get("runtime_feature_defaults", {name: 0.0 for name in runtime_feature_names})
        return True
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(f"Failed to load saved model: {exc}")
        return False
