const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Certification = require('../models/Certification');
const User = require('../models/User');
const { autoRefreshPredictionForUserId } = require('./predictionController');

// ---------------------------------------------------------------------------
// Dataset-recognized certification providers (from Cert_Types column in dataset)
// HIGH tier  -> full algorithm weight (1.0)  — AWS, Cisco, CompTIA, Google, Microsoft, Oracle
// MEDIUM tier -> partial weight (0.6)        — IBM, FreeCodeCamp, TESDA
// LOW tier   -> minimal weight (0.3)         — Other / unrecognized
// ---------------------------------------------------------------------------
const HIGH_TIER_PROVIDERS = ['aws', 'amazon web services', 'cisco', 'comptia', 'google', 'microsoft', 'oracle'];
const MEDIUM_TIER_PROVIDERS = ['ibm', 'freecodecamp', 'tesda'];

// Check name+issuer combined — harder to game than a freeform category field
function computeRelevance(name = '', issuer = '') {
  const combined = `${name} ${issuer}`.toLowerCase();
  if (HIGH_TIER_PROVIDERS.some((p) => combined.includes(p))) return { tier: 'high', score: 1.0 };
  if (MEDIUM_TIER_PROVIDERS.some((p) => combined.includes(p))) return { tier: 'medium', score: 0.6 };
  return { tier: 'low', score: 0.3 };
}

// Ordered issuer list for PDF text extraction (longest match first)
const KNOWN_ISSUER_MAP = [
  { match: 'amazon web services', display: 'Amazon Web Services' },
  { match: 'aws', display: 'Amazon Web Services' },
  { match: 'cisco', display: 'Cisco' },
  { match: 'comptia', display: 'CompTIA' },
  { match: 'google', display: 'Google' },
  { match: 'microsoft', display: 'Microsoft' },
  { match: 'oracle', display: 'Oracle' },
  { match: 'ibm', display: 'IBM' },
  { match: 'freecodecamp', display: 'freeCodeCamp' },
  { match: 'tesda', display: 'TESDA' },
];

function extractFieldsFromPdfText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const lower = text.toLowerCase();

  // ── Year: most recent 4-digit year in 2000–2026 ──────────────────────────
  const yearMatches = [...text.matchAll(/\b(20[0-2][0-9])\b/g)].map((m) => parseInt(m[1], 10));
  const yearObtained = yearMatches.length ? String(Math.max(...yearMatches)) : '';

  // ── Issuer: check known providers first, then "organized/presented/issued by" ──
  let issuer = '';
  for (const { match, display } of KNOWN_ISSUER_MAP) {
    if (lower.includes(match)) { issuer = display; break; }
  }
  if (!issuer) {
    const issuerMatch = text.match(/(?:organized|presented|issued|hosted|offered|conducted|prepared)\s+by[:\s]+([^\n]{3,80})/i);
    if (issuerMatch) issuer = issuerMatch[1].trim().split('\n')[0].trim();
  }

  // ── Title: find the actual seminar/webinar/training title ────────────────
  // Certificates typically print the event title in bold/large text.
  // In extracted plain text, bold/prominent lines show up as:
  //   (a) ALL CAPS lines, or
  //   (b) lines immediately after trigger phrases like "entitled:", "topic:", etc.
  // We try multiple strategies in priority order.

  // Lines to always skip — generic certificate headers, not the actual event title
  // Use startsWith-style regex so "CERTIFICATE \u00ae" and "Certificate of Completion" are both skipped
  const SKIP_TITLE_RE = /^(?:certificate(?:\b|\s|\u00ae|\u00a9)|this\s+is\s+to\s+certif(?:y|icate)|certif(?:y|ies)\s+that|awarded\s+to|presented\s+to|given\s+to|in\s+recognition|republic\s+of|department\s+of|office\s+of|province\s+of|city\s+of|municipality\s+of)/i;

  let name = '';

  // Strategy 1: text immediately after explicit trigger phrases (most reliable)
  // Join all lines first so multi-line titles are captured
  const flatText = lines.join(' ');
  const titlePatterns = [
    /entitled[:\s"\u201c\u2018]+([^"\u201d\u2019]{5,200})/i,
    /topic[:\s"\u201c\u2018]+([^"\u201d\u2019]{5,200})/i,
    /titled[:\s"\u201c\u2018]+([^"\u201d\u2019]{5,200})/i,
    /the\s+(?:seminar|webinar|training|workshop|course|program|lecture)\s*(?:on|about|entitled|titled)[:\s"\u201c\u2018]+([^"\u201d\u2019]{5,200})/i,
    /(?:seminar|webinar|training|workshop|course|program)\s+on[:\s"\u201c\u2018]+([^"\u201d\u2019]{5,200})/i,
    /session\s+on\s*["\u201c\u2018]([^"\u201d\u2019]{5,200})/i,
    /(?:completed|attended|participating\s+in|participated\s+in|finished|undergone)\s+(?:the\s+)?["\u201c\u2018]([^"\u201d\u2019]{8,200})/i,
    /(?:completed|attended|participating\s+in|participated\s+in|finished|undergone)\s+the\s+([A-Z][\w\s,:()\/\-&]{8,200})/,
  ];
  for (const re of titlePatterns) {
    const m = flatText.match(re);
    if (m) {
      const candidate = m[1].trim().replace(/["\u201c\u201d\u2018\u2019]/g, '').replace(/\s+/g, ' ').trim();
      // Trim at obvious sentence endings ("during", "held on", "at ", etc.)
      const trimmed = candidate.split(/\s+(?:during|held|conducted|at\s+[A-Z]|on\s+[A-Z]|from\s+[A-Z])/)[0].trim();
      if (trimmed.length >= 5 && trimmed.length <= 200 && !SKIP_TITLE_RE.test(trimmed)) {
        name = trimmed;
        break;
      }
    }
  }

  // Strategy 2: ALL CAPS lines — bold/heading text commonly appears this way in extracted PDFs/OCR
  // Pick the longest ALL CAPS line that looks like a title (has real words, not just "CERTIFICATE")
  if (!name) {
    const allCapsLines = lines.filter((l) =>
      l === l.toUpperCase() &&          // all caps
      /[A-Z]/.test(l) &&               // has at least one letter
      l.length >= 10 && l.length <= 150 &&
      !SKIP_TITLE_RE.test(l)
    );
    // Prefer lines that mention seminar/training keywords; otherwise take the longest caps line
    const CERT_KW = /seminar|webinar|training|workshop|program|course|certif|lecture|congress|summit|forum|symposium/i;
    const withKw = allCapsLines.filter((l) => CERT_KW.test(l));
    const candidates = withKw.length ? withKw : allCapsLines;
    if (candidates.length) {
      // Pick the longest — usually the most descriptive
      name = candidates.reduce((a, b) => (b.length > a.length ? b : a), candidates[0]);
    }
  }

  // Strategy 3: first line containing cert/training keywords that isn't a generic header
  if (!name) {
    const CERT_LINE_RE = /certif(?:ied|icate|ication)|training|seminar|webinar|workshop|program|course|associate|professional|practitioner|specialist|completion|congress|summit|symposium|forum/i;
    for (const line of lines) {
      if (CERT_LINE_RE.test(line) && !SKIP_TITLE_RE.test(line) && line.length >= 8 && line.length <= 150) {
        name = line;
        break;
      }
    }
  }

  return { name, issuer, yearObtained };
}

// ---------------------------------------------------------------------------
// Multer — store proofs in uploads/certifications/
// ---------------------------------------------------------------------------
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'certifications');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, unique);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only PDF or image files (JPEG, PNG, WEBP) are accepted.'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// ---------------------------------------------------------------------------
// PDF text extraction + certificate validation (for PDF uploads)
// ---------------------------------------------------------------------------
async function extractImageText(filePathOrBuffer) {
  try {
    const Tesseract = require('tesseract.js');
    const { data: { text } } = await Tesseract.recognize(filePathOrBuffer, 'eng', { logger: () => {} });
    return text || '';
  } catch {
    return '';
  }
}

// Render first page of an image-based PDF to a PNG buffer, then OCR it
async function extractImagePdfText(filePath) {
  try {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    const { createCanvas } = require('canvas');

    const data = new Uint8Array(fs.readFileSync(filePath));
    const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const imgBuffer = canvas.toBuffer('image/png');
    console.log('[PDF OCR] Rendered page to PNG buffer, size:', imgBuffer.length, 'bytes');
    const ocrText = await extractImageText(imgBuffer);
    console.log('[PDF OCR] OCR result length:', ocrText.length);
    return ocrText;
  } catch (err) {
    console.error('[PDF OCR] extractImagePdfText failed:', err.message);
    return '';
  }
}

async function extractPdfText(filePath) {
  // Try native text layer first (fast, works for text-based PDFs)
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    if (data.text && data.text.trim()) return data.text;
  } catch {}

  // No text layer — PDF is image-based (e.g. photo converted to PDF)
  // Render the first page and OCR it
  return extractImagePdfText(filePath);
}

const CERTIFICATE_KEYWORDS = [
  'certificate', 'certification', 'certify', 'certifies', 'certified',
  'seminar', 'webinar', 'workshop', 'training', 'course', 'program',
  'completion', 'participated', 'participation', 'attendance', 'attended',
  'congress', 'summit', 'symposium', 'forum', 'colloquium', 'conference',
  'lecture', 'bootcamp', 'boot camp', 'orientation', 'in-service',
  'awarded', 'award', 'recognition', 'achievement', 'successfully completed',
];
const SIGNATURE_KEYWORDS = [
  'signature', 'signed', 'authorized', 'authorised',
  'director', 'president', 'coordinator', 'dean', 'principal',
  'officer', 'head', 'registrar', 'superintendent', 'secretary',
  'chairman', 'chairperson', 'chair', 'governor', 'mayor', 'congressman',
  'facilitator', 'trainer', 'speaker', 'professor', 'instructor',
  'manager', 'supervisor', 'administrator', 'executive', 'ceo', 'coo',
  'chancellor', 'vice president', 'vice-president', 'vp ',
  'dr.', 'dr ', 'atty.', 'engr.', 'prof.', 'rev.',
];

function validateCertificateText(text, studentName = '') {
  const lower = text.toLowerCase();

  console.log('[CERT VALIDATE] Extracted text (first 600 chars):', text.slice(0, 600).replace(/\n/g, ' | '));

  const hasCertKeyword = CERTIFICATE_KEYWORDS.some((kw) => lower.includes(kw));
  if (!hasCertKeyword) {
    console.log('[CERT VALIDATE] FAILED: no certificate keyword found');
    return { valid: false, reason: 'The document does not appear to be a certificate. It must mention a seminar, webinar, workshop, training, or any recognized event.' };
  }

  const hasSignature = SIGNATURE_KEYWORDS.some((kw) => lower.includes(kw));
  if (!hasSignature) {
    console.log('[CERT VALIDATE] FAILED: no signature keyword found');
    return { valid: false, reason: 'No authorizing official found in the certificate. The document must include a name or title of the person who issued it (e.g. facilitator, director, trainer, Dr., etc.).' };
  }

  if (studentName) {
    // Split name into parts; try each part individually (OCR may split or mangle names)
    const nameParts = studentName.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
    const hasName = nameParts.some((part) => lower.includes(part));
    if (!hasName) {
      console.log('[CERT VALIDATE] FAILED: student name not found. Name parts:', nameParts, '| text snippet:', lower.slice(0, 400));
      return { valid: false, reason: `Your name ("${studentName}") was not found in the certificate. Please upload the certificate issued specifically to you.` };
    }
  }

  console.log('[CERT VALIDATE] PASSED');
  return { valid: true, reason: '' };
}

// ---------------------------------------------------------------------------
// POST /api/certifications/extract-fields
// Accepts a proof file, validates it (PDF: must look like a certificate),
// extracts cert name / issuer / year from PDF text, stores the file.
// Returns stored filename + extracted fields for frontend pre-fill.
// ---------------------------------------------------------------------------
const extractFieldsMiddleware = upload.single('proof');

const extractCertFields = (req, res) => {
  extractFieldsMiddleware(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ success: false, message: uploadErr.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const file = req.file;
    const userId = req.user._id;

    try {
      let extracted = { name: '', issuer: '', yearObtained: '' };

      const isPdf = file.mimetype === 'application/pdf';
      const isImage = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype);

      let text = '';
      if (isPdf) {
        text = await extractPdfText(file.path); // handles both text-based and image-based PDFs
      } else if (isImage) {
        text = await extractImageText(file.path);
      }

      console.log('[CERT UPLOAD] File:', file.originalname, '| Type:', file.mimetype, '| Text length:', text.length);

      if (!text.trim()) {
        fs.unlinkSync(file.path);
        return res.status(422).json({
          success: false,
          message: 'Could not read text from your file. For PDFs, make sure the certificate is clear and legible. For images, ensure it is well-lit and not blurry.',
        });
      }

      const user = await User.findById(userId).select('fullName').lean();
      const { valid, reason } = validateCertificateText(text, user?.fullName || '');
      if (!valid) {
        fs.unlinkSync(file.path);
        return res.status(422).json({ success: false, message: reason });
      }
      extracted = extractFieldsFromPdfText(text);

      console.log('[CERT EXTRACT] name:', extracted.name, '| issuer:', extracted.issuer, '| year:', extracted.yearObtained);

      // Require title and year — reject if either could not be read
      const missing = [];
      if (!extracted.name) missing.push('certification title (seminar / webinar / training name)');
      if (!extracted.yearObtained) missing.push('year obtained');
      if (missing.length) {
        fs.unlinkSync(file.path);
        return res.status(422).json({
          success: false,
          message: `Could not extract the following from your certificate: ${missing.join(' and ')}. ` +
            'Make sure the certificate clearly shows the full seminar/webinar/training title and the year it was issued.',
        });
      }

      return res.status(200).json({
        success: true,
        proofFile: file.filename,
        proofFileName: file.originalname,
        proofFileType: file.mimetype,
        extracted,
      });
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(500).json({ success: false, message: error.message });
    }
  });
};

// ---------------------------------------------------------------------------
// POST /api/certifications
// ---------------------------------------------------------------------------
const saveCertifications = async (req, res) => {
  try {
    const { certifications, hasNoCertification } = req.body;
    const userId = req.user._id;
    const rawList = hasNoCertification ? [] : (certifications || []);

    const certList = rawList.map((c) => {
      const { tier, score } = computeRelevance(c.name, c.issuer);
      const hasProof = Boolean(c.proofFile);
      const item = {
        name: c.name,
        issuer: c.issuer,
        yearObtained: c.yearObtained,
        proofFile: c.proofFile || '',
        proofFileName: c.proofFileName || '',
        proofFileType: c.proofFileType || '',
        // Preserve existing status; for brand-new certs derive from proofFile presence
        status: c.status || (hasProof ? 'pending_review' : 'pending_proof'),
        adminNote: c.adminNote || '',
        relevanceTier: tier,
        relevanceScore: score,
      };
      if (c._id) item._id = c._id;
      return item;
    });
    const certCount = certList.length;
    const completed = hasNoCertification || certCount > 0;

    const existing = await Certification.findOne({ userId });
    let result;
    if (existing) {
      existing.certifications = certList;
      existing.hasNoCertification = hasNoCertification || false;
      existing.certificationCount = certCount;
      existing.completed = completed;
      result = await existing.save();
    } else {
      result = await Certification.create({
        userId,
        certifications: certList,
        hasNoCertification: hasNoCertification || false,
        certificationCount: certCount,
        completed,
      });
    }

    await autoRefreshPredictionForUserId(userId);

    return res.status(200).json({ success: true, message: 'Certifications saved.', data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/certifications/:userId
const getCertifications = async (req, res) => {
  try {
    const data = await Certification.findOne({ userId: req.params.userId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/certifications/:userId
const updateCertifications = async (req, res) => {
  try {
    const { certifications, hasNoCertification } = req.body;
    const certList = hasNoCertification ? [] : certifications || [];
    const data = await Certification.findOneAndUpdate(
      { userId: req.params.userId },
      {
        certifications: certList,
        hasNoCertification: hasNoCertification || false,
        certificationCount: certList.length,
        completed: hasNoCertification || certList.length > 0,
      },
      { new: true, upsert: true }
    );
    await autoRefreshPredictionForUserId(req.params.userId);
    return res.status(200).json({ success: true, message: 'Certifications updated.', data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/certifications/:id  (deletes a single cert item)
// ---------------------------------------------------------------------------
const deleteCertification = async (req, res) => {
  try {
    // Also delete the proof file on disk when removing a cert
    const certDoc = await Certification.findOne({ 'certifications._id': req.params.id });
    if (certDoc) {
      const certItem = certDoc.certifications.id(req.params.id);
      if (certItem?.proofFile) {
        const oldPath = path.join(UPLOAD_DIR, certItem.proofFile);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    const cert = await Certification.findOneAndUpdate(
      { 'certifications._id': req.params.id },
      { $pull: { certifications: { _id: req.params.id } } },
      { new: true }
    );
    if (cert) cert.certificationCount = cert.certifications.length;
    await cert?.save();
    if (cert?.userId) await autoRefreshPredictionForUserId(cert.userId);
    return res.status(200).json({ success: true, message: 'Certification deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/certifications/upload-proof/:certId
// Upload PDF or image proof for a specific certification item.
// ---------------------------------------------------------------------------
const uploadProofMiddleware = upload.single('proof');

const uploadProof = (req, res) => {
  uploadProofMiddleware(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ success: false, message: uploadErr.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { certId } = req.params;
    const userId = req.user._id;
    const file = req.file;

    try {
      const certDoc = await Certification.findOne({ userId, 'certifications._id': certId });
      if (!certDoc) {
        fs.unlinkSync(file.path);
        return res.status(404).json({ success: false, message: 'Certification not found.' });
      }

      const certItem = certDoc.certifications.id(certId);
      if (!certItem) {
        fs.unlinkSync(file.path);
        return res.status(404).json({ success: false, message: 'Certification item not found.' });
      }

      // PDF content validation
      if (file.mimetype === 'application/pdf') {
        const text = await extractPdfText(file.path);
        if (!text.trim()) {
          fs.unlinkSync(file.path);
          return res.status(422).json({ success: false, message: 'Could not read the PDF. Please ensure it is a text-based PDF (not a scanned image without text layer).' });
        }
        const user = await User.findById(userId).select('fullName').lean();
        const { valid, reason } = validateCertificateText(text, user?.fullName || '');
        if (!valid) {
          fs.unlinkSync(file.path);
          return res.status(422).json({ success: false, message: reason });
        }
      }
      // Images: accepted as-is; admin will visually verify content.

      // Remove old proof file
      if (certItem.proofFile) {
        const oldPath = path.join(UPLOAD_DIR, certItem.proofFile);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      certItem.proofFile = file.filename;
      certItem.proofFileName = file.originalname;
      certItem.proofFileType = file.mimetype;
      certItem.status = 'pending_review';
      certItem.adminNote = '';

      await certDoc.save();
      await autoRefreshPredictionForUserId(userId);

      return res.status(200).json({
        success: true,
        message: 'Proof uploaded. Your certification is now pending admin review.',
        proofUrl: `/uploads/certifications/${file.filename}`,
        certId,
        status: 'pending_review',
      });
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(500).json({ success: false, message: error.message });
    }
  });
};

// ---------------------------------------------------------------------------
// GET /api/certifications/admin/pending  (admin only)
// Returns all cert items awaiting review.
// ---------------------------------------------------------------------------
const getPendingCertifications = async (req, res) => {
  try {
    const docs = await Certification.find({ 'certifications.status': 'pending_review' }).lean();
    const pending = [];
    for (const doc of docs) {
      const user = await User.findById(doc.userId).select('fullName email studentNumber').lean();
      for (const cert of doc.certifications) {
        if (cert.status === 'pending_review') {
          pending.push({ certDocId: doc._id, certId: cert._id, userId: doc.userId, student: user, cert });
        }
      }
    }
    return res.status(200).json({ success: true, data: pending });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/certifications/admin/:certId/approve  (admin only)
// ---------------------------------------------------------------------------
const adminApproveCertification = async (req, res) => {
  try {
    const certDoc = await Certification.findOne({ 'certifications._id': req.params.certId });
    if (!certDoc) return res.status(404).json({ success: false, message: 'Certification not found.' });
    const certItem = certDoc.certifications.id(req.params.certId);
    if (!certItem) return res.status(404).json({ success: false, message: 'Certification item not found.' });

    certItem.status = 'approved';
    certItem.adminNote = '';
    await certDoc.save();
    await autoRefreshPredictionForUserId(certDoc.userId);

    return res.status(200).json({ success: true, message: 'Certification approved.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/certifications/admin/:certId/reject  (admin only)
// ---------------------------------------------------------------------------
const adminRejectCertification = async (req, res) => {
  try {
    const { adminNote } = req.body;
    const certDoc = await Certification.findOne({ 'certifications._id': req.params.certId });
    if (!certDoc) return res.status(404).json({ success: false, message: 'Certification not found.' });
    const certItem = certDoc.certifications.id(req.params.certId);
    if (!certItem) return res.status(404).json({ success: false, message: 'Certification item not found.' });

    certItem.status = 'rejected';
    certItem.adminNote = adminNote || 'Rejected by administrator.';

    // Remove the proof file so student must re-upload
    if (certItem.proofFile) {
      const oldPath = path.join(UPLOAD_DIR, certItem.proofFile);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      certItem.proofFile = '';
      certItem.proofFileName = '';
      certItem.proofFileType = '';
    }

    await certDoc.save();
    await autoRefreshPredictionForUserId(certDoc.userId);

    return res.status(200).json({ success: true, message: 'Certification rejected.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/certifications/admin/all  (admin only)
// All certification documents with student info.
// ---------------------------------------------------------------------------
const getAllCertificationsAdmin = async (req, res) => {
  try {
    const docs = await Certification.find({}).lean();
    const result = [];
    for (const doc of docs) {
      const user = await User.findById(doc.userId).select('fullName email studentNumber').lean();
      result.push({ ...doc, student: user });
    }
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  extractCertFields,
  saveCertifications,
  getCertifications,
  updateCertifications,
  deleteCertification,
  uploadProof,
  getPendingCertifications,
  adminApproveCertification,
  adminRejectCertification,
  getAllCertificationsAdmin,
};

