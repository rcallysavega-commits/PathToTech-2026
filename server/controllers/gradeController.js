const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const Grade = require('../models/Grade');
const GradeUpload = require('../models/GradeUpload');
const User = require('../models/User');
const { autoRefreshPredictionForUserId } = require('./predictionController');

const GRADE_UPLOAD_MAX_MB = Number(process.env.GRADE_UPLOAD_MAX_MB || 100);
const UPSERT_BATCH_SIZE = Number(process.env.GRADE_UPLOAD_BATCH_SIZE || 1000);
const MAX_VALIDATION_ERRORS = Number(process.env.GRADE_UPLOAD_MAX_ERRORS || 200);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `grades-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.csv', '.xlsx', '.xls'];
  if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV and Excel files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: Math.max(1, GRADE_UPLOAD_MAX_MB) * 1024 * 1024 },
});

const parseGradeValue = (val) => {
  const str = String(val ?? '').trim();
  if (!str) return null;

  const num = parseFloat(str);
  // Enforce Philippine numeric grading range.
  if (!isNaN(num) && num >= 1 && num <= 5) return num;

  // Support mixed formats like "INC (Re-Exam: 3.00)"
  const reExamMatch = str.match(/re\s*-?\s*exam\s*[:=-]?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (reExamMatch) {
    const extracted = parseFloat(reExamMatch[1]);
    if (!isNaN(extracted) && extracted >= 1 && extracted <= 5) return extracted;
  }

  return null;
};

const ALLOWED_TEXT_GRADES = new Set([
  'INC',
  'INCOMPLETE',
  'SATISFACTORY',
  'VERY SATISFACTORY',
  'OUTSTANDING',
  'UNSATISFACTORY',
  'PASSED',
  'PASS',
  'FAILED',
  'FAIL',
  'DRP',
  'DROP',
]);

const normalizeGradeText = (val = '') =>
  String(val)
    .trim()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();

const isAllowedTextGrade = (val) => {
  const normalized = normalizeGradeText(val);
  if (!normalized) return false;

  if (normalized.startsWith('INC') || normalized.includes('INCOMPLETE')) {
    return true;
  }

  return ALLOWED_TEXT_GRADES.has(normalized);
};

const normalizeKey = (key = '') =>
  String(key)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const HEADER_MAP = {
  lastname: 'lastName',
  firstName: 'firstName',
  firstname: 'firstName',
  middlename: 'middleName',
  name: 'fullName',
  fullname: 'fullName',
  studentname: 'fullName',
  learnername: 'fullName',
  studentnumber: 'studentNumber',
  studentno: 'studentNumber',
  studentid: 'studentNumber',
  idnumber: 'studentNumber',
  schoolid: 'studentNumber',
  subjectcode: 'subjectCode',
  subject: 'subjectCode',
  code: 'subjectCode',
  subjecttitle: 'subjectTitle',
  subjectname: 'subjectTitle',
  course: 'subjectTitle',
  units: 'units',
  unit: 'units',
  subjectunits: 'units',
  grade: 'grade',
  grades: 'grade',
  finalgrade: 'grade',
  rating: 'grade',
};

const normalizeRow = (row) => {
  const normalized = {};
  Object.keys(row || {}).forEach((key) => {
    const mapKey = HEADER_MAP[normalizeKey(key)] || key;
    normalized[mapKey] = String(row[key] ?? '').trim();
  });
  return normalized;
};

const parseUnitsValue = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return null;
  if (num <= 0) return null;
  return num;
};

const splitFullName = (fullName = '') => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
};

const toCanonicalRow = (row = {}) => {
  const nameInfo = splitFullName(row.fullName || row.name || '');
  const firstName = (row.firstName || nameInfo.firstName || '').trim();
  const lastName = (row.lastName || nameInfo.lastName || '').trim();
  const subjectCode = (row.subjectCode || '').trim().toUpperCase();
  const studentNumber = (row.studentNumber || '').trim();
  const subjectTitle = (row.subjectTitle || subjectCode || '').trim();

  return {
    firstName,
    lastName,
    middleName: (row.middleName || '').trim(),
    studentNumber,
    subjectCode,
    subjectTitle,
    units: (row.units || '').trim(),
    grade: (row.grade || '').trim(),
  };
};

const validateRow = (row, index) => {
  const errors = [];
  if (!row.lastName?.trim() || !row.firstName?.trim()) errors.push(`Row ${index}: Missing name.`);
  if (!row.studentNumber?.trim()) errors.push(`Row ${index}: Missing student number.`);
  if (!row.subjectCode?.trim()) errors.push(`Row ${index}: Missing subject code.`);
  if (!row.units) errors.push(`Row ${index}: Missing units.`);
  if (row.units && parseUnitsValue(row.units) === null) {
    errors.push(`Row ${index}: Invalid units "${row.units}" (must be a positive number).`);
  }
  if (!row.grade) errors.push(`Row ${index}: Missing grade.`);
  if (row.grade && parseGradeValue(row.grade) === null && !isAllowedTextGrade(row.grade)) {
    errors.push(`Row ${index}: Invalid grade "${row.grade}" (use 1.00-5.00, or INC/Satisfactory/Very Satisfactory/Outstanding/etc.).`);
  }
  return errors;
};

const parseCSV = (filePath) =>
  new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
      .on('data', (row) => rows.push(normalizeRow(row)))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

const parseExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.map((r) => normalizeRow(r));
};

const toBulkUpsertOp = (row, uploadedBy, sourceUploadId) => {
  const gradeVal = parseGradeValue(row.grade);
  const unitsVal = parseUnitsValue(row.units);
  const studentNumber = row.studentNumber.trim();
  const subjectCode = row.subjectCode.trim().toUpperCase();

  return {
    updateOne: {
      filter: { studentNumber, subjectCode },
      update: {
        $set: {
          lastName: row.lastName.trim(),
          firstName: row.firstName.trim(),
          middleName: row.middleName?.trim() || '',
          studentNumber,
          subjectCode,
          subjectTitle: row.subjectTitle.trim(),
          units: unitsVal,
          grade: String(row.grade || '').trim(),
          gradeNumeric: gradeVal,
          uploadedBy,
          sourceUpload: sourceUploadId || null,
        },
      },
      upsert: true,
    },
  };
};

const runBulkUpserts = async (rows, uploadedBy, sourceUploadId) => {
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const ops = chunk.map((row) => toBulkUpsertOp(row, uploadedBy, sourceUploadId));
    const result = await Grade.bulkWrite(ops, { ordered: false });

    inserted += Number(result.upsertedCount || 0);
    updated += Number(result.matchedCount || 0);
  }

  return { inserted, updated };
};

// POST /api/grades/upload
const uploadGrades = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let rows;
    try {
      rows = ext === '.csv' ? await parseCSV(req.file.path) : parseExcel(req.file.path);
    } catch (parseErr) {
      return res.status(400).json({ success: false, message: 'Failed to parse file: ' + parseErr.message });
    } finally {
      fs.unlink(req.file.path, () => {});
    }

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'File is empty.' });
    }

    const canonicalRows = rows.map((row) => toCanonicalRow(row));

    const requiredColumns = ['studentNumber', 'subjectCode', 'units', 'grade'];
    const firstRow = canonicalRows[0] || {};
    const missingColumns = requiredColumns.filter((col) => !(col in firstRow));
    if (missingColumns.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required column(s): ${missingColumns.join(', ')}`,
      });
    }

    // Validate all rows
    const allErrors = [];
    canonicalRows.forEach((row, i) => {
      const errs = validateRow(row, i + 2); // +2 for header row
      if (allErrors.length < MAX_VALIDATION_ERRORS) {
        allErrors.push(...errs);
      }
    });

    // Check duplicate subjectCode per studentNumber within the file
    const seen = new Set();
    canonicalRows.forEach((row, i) => {
      const key = `${row.studentNumber?.trim()}_${row.subjectCode?.trim()?.toUpperCase()}`;
      if (seen.has(key)) {
        if (allErrors.length < MAX_VALIDATION_ERRORS) {
          allErrors.push(`Row ${i + 2}: Duplicate subject code "${row.subjectCode}" for student ${row.studentNumber}.`);
        }
      }
      seen.add(key);
    });

    if (allErrors.length) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors found.',
        errors: allErrors,
        truncated: allErrors.length >= MAX_VALIDATION_ERRORS,
      });
    }

    const uploadRecord = await GradeUpload.create({
      originalName: req.file.originalname,
      storedName: req.file.filename,
      extension: ext,
      totalRecords: rows.length,
      insertedRecords: 0,
      updatedRecords: 0,
      active: true,
      uploadedBy: req.user._id,
    });

    // Upsert grades in chunks for large uploads.
    const { inserted, updated } = await runBulkUpserts(canonicalRows, req.user._id, uploadRecord._id);

    uploadRecord.insertedRecords = inserted;
    uploadRecord.updatedRecords = updated;
    await uploadRecord.save();

    // Auto-refresh predictions for affected students
    const uniqueStudentNumbers = [...new Set(canonicalRows.map(row => row.studentNumber.trim()).filter(Boolean))];
    const users = await User.find({ studentNumber: { $in: uniqueStudentNumbers } }).select('_id studentNumber').lean();
    const userMap = new Map(users.map(u => [u.studentNumber, u._id]));
    for (const studentNumber of uniqueStudentNumbers) {
      const userId = userMap.get(studentNumber);
      if (userId) {
        await autoRefreshPredictionForUserId(userId);
      }
    }

    // Keep one active upload source at a time.
    await GradeUpload.updateMany({ _id: { $ne: uploadRecord._id } }, { active: false });

    return res.status(200).json({
      success: true,
      message: `Grades uploaded successfully. ${rows.length} records processed in batches of ${UPSERT_BATCH_SIZE}.`,
      total: rows.length,
      inserted,
      updated,
      errors: [],
      upload: uploadRecord,
    });
  } catch (error) {
    console.error('Grade upload error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/grades/:studentNumber
const getGradesByStudent = async (req, res) => {
  try {
    const studentNumber = String(req.params.studentNumber).trim();
    const activeUpload = await GradeUpload.findOne({ active: true }).select('_id').lean();
    if (!activeUpload?._id) {
      return res.status(200).json({ success: true, grades: [], gwa: null, totalUnits: 0, activeUpload: false });
    }

    const grades = await Grade.find({ studentNumber, sourceUpload: activeUpload._id }).sort({ subjectCode: 1 });
    if (!grades.length) {
      return res.status(200).json({ success: true, grades: [], gwa: null, totalUnits: 0, activeUpload: true });
    }

    const numericGrades = grades.filter(
      (g) => typeof g.gradeNumeric === 'number' && !Number.isNaN(g.gradeNumeric)
    );
    const totalUnits = numericGrades.reduce((sum, g) => sum + g.units, 0);
    const weightedSum = numericGrades.reduce((sum, g) => sum + g.gradeNumeric * g.units, 0);
    const gwa = totalUnits > 0 ? parseFloat((weightedSum / totalUnits).toFixed(4)) : null;

    return res.status(200).json({ success: true, grades, gwa, totalUnits, activeUpload: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/grades
const getAllGrades = async (req, res) => {
  try {
    const { studentNumber } = req.query;
    const filter = studentNumber ? { studentNumber } : {};
    const grades = await Grade.find(filter).sort({ studentNumber: 1, subjectCode: 1 });
    return res.status(200).json({ success: true, count: grades.length, grades });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/grades/check-complete/:studentNumber
const checkGradesComplete = async (req, res) => {
  try {
    const activeUpload = await GradeUpload.findOne({ active: true }).select('_id').lean();
    if (!activeUpload?._id) {
      return res.status(200).json({
        success: true,
        complete: false,
        isComplete: false,
        count: 0,
        activeUpload: false,
      });
    }

    const count = await Grade.countDocuments({
      studentNumber: req.params.studentNumber,
      sourceUpload: activeUpload._id,
    });
    return res.status(200).json({
      success: true,
      complete: count > 0,
      isComplete: count > 0,
      count,
      activeUpload: true,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/grades/uploads
const getGradeUploads = async (req, res) => {
  try {
    const uploads = await GradeUpload.find()
      .populate('uploadedBy', 'fullName email')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, uploads });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/grades/uploads/:uploadId/status
const setGradeUploadStatus = async (req, res) => {
  try {
    const { uploadId } = req.params;
    const active = Boolean(req.body?.active);

    const record = await GradeUpload.findById(uploadId);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Upload record not found.' });
    }

    if (active) {
      await GradeUpload.updateMany({}, { active: false });
      record.active = true;
    } else {
      record.active = false;
    }
    await record.save();

    return res.status(200).json({ success: true, message: 'Upload status updated.', upload: record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/grades/uploads/:uploadId
const deleteGradeUpload = async (req, res) => {
  try {
    const { uploadId } = req.params;
    const deleteGrades = Boolean(req.body?.deleteGrades);

    const record = await GradeUpload.findById(uploadId);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Upload record not found.' });
    }

    let deletedGrades = 0;
    let affectedStudentNumbers = [];
    if (deleteGrades) {
      const affected = await Grade.find({ sourceUpload: record._id }).select('studentNumber').lean();
      affectedStudentNumbers = [...new Set(affected.map(g => String(g.studentNumber || '').trim()).filter(Boolean))];

      const delResult = await Grade.deleteMany({ sourceUpload: record._id });
      deletedGrades = Number(delResult.deletedCount || 0);

      if (affectedStudentNumbers.length) {
        const users = await User.find({ studentNumber: { $in: affectedStudentNumbers } }).select('_id studentNumber').lean();
        const userMap = new Map(users.map(u => [u.studentNumber, u._id]));
        for (const studentNumber of affectedStudentNumbers) {
          const userId = userMap.get(studentNumber);
          if (userId) {
            await autoRefreshPredictionForUserId(userId);
          }
        }
      }
    }

    const wasActive = record.active;
    await GradeUpload.deleteOne({ _id: record._id });

    if (wasActive) {
      const latest = await GradeUpload.findOne().sort({ createdAt: -1 });
      if (latest) {
        latest.active = true;
        await latest.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: deleteGrades
        ? `Upload deleted. ${deletedGrades} related grade record(s) removed.`
        : 'Upload file record deleted.',
      deletedGrades,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  upload,
  uploadGrades,
  getGradesByStudent,
  getAllGrades,
  checkGradesComplete,
  getGradeUploads,
  setGradeUploadStatus,
  deleteGradeUpload,
};
