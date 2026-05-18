import { useState, useEffect, useMemo, useRef } from 'react';
import Swal from 'sweetalert2';
import { ChevronRight, ChevronLeft, CheckCircle, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { LIKERT_LABELS } from '../../utils/constants';

const getQuestionText = (q = {}) => q.questionText || q.text || '';
const getQuestionType = (q = {}) => q.questionType || q.type || 'likert';

const isQuestionAnswered = (question = {}, value) => {
  const type = getQuestionType(question);
  if (type === 'text' || type === 'multiple_choice' || type === 'dropdown') {
    return String(value || '').trim().length > 0;
  }
  return value !== undefined && value !== null;
};

const getLikertScale = (q = {}) => {
  const min = Number.isInteger(Number(q.scaleMin)) ? Number(q.scaleMin) : 1;
  const max = Number.isInteger(Number(q.scaleMax)) ? Number(q.scaleMax) : 5;
  if (min >= max) {
    return [1, 2, 3, 4, 5];
  }
  const nums = [];
  for (let n = min; n <= max; n++) nums.push(n);
  return nums;
};

const getLikertLabel = (q = {}, n) => {
  const min = Number.isInteger(Number(q.scaleMin)) ? Number(q.scaleMin) : 1;
  const idx = n - min;
  if (Array.isArray(q.options) && idx >= 0 && idx < q.options.length && String(q.options[idx] || '').trim()) {
    return q.options[idx];
  }
  return LIKERT_LABELS[n] || `Rating ${n}`;
};

export default function TakeSurveyPage() {
  const { user } = useAuth();
  const [survey, setSurvey] = useState(null);
  const [currentPart, setCurrentPart] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingResponse, setExistingResponse] = useState(null);
  const topRef = useRef(null);

  const fmtNum = (value, digits = 2, fallback = 'N/A') => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : fallback;
  };

  useEffect(() => {
    fetchSurvey();
  }, []);

  const scrollToSurveyTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    scrollToSurveyTop();
  }, [currentPart]);

  const parts = useMemo(() => {
    if (!survey?.sections?.length) return [];
    const map = new Map();
    survey.sections.forEach((section, sectionIdx) => {
      const title = String(section.title || '').trim() || 'Untitled Section';
      if (!map.has(title)) {
        map.set(title, {
          title,
          description: section.description || '',
          categories: [],
          sectionIndexes: [],
        });
      }
      const part = map.get(title);
      part.sectionIndexes.push(sectionIdx);
      const category = String(section.category || '').trim() || 'General';
      const existingCategory = part.categories.find((c) => c.key === category.toLowerCase());
      if (existingCategory) {
        existingCategory.sections.push({ section, sectionIdx });
      } else {
        part.categories.push({
          key: category.toLowerCase(),
          label: category,
          sections: [{ section, sectionIdx }],
        });
      }
      if (!part.description && section.description) {
        part.description = section.description;
      }
    });
    return Array.from(map.values());
  }, [survey]);

  const fetchSurvey = async () => {
    try {
      const [surveyRes, responseRes] = await Promise.allSettled([
        api.get('/surveys/active'),
        api.get(`/responses/user/${user._id}`),
      ]);
      if (surveyRes.status === 'fulfilled') setSurvey(surveyRes.value.data?.survey || null);
      const existingResp = responseRes.value?.data?.response;
      if (existingResp?.completed) {
        setExistingResponse(existingResp);
        setSubmitted(true);
      }
    } catch (_) {}
    setLoading(false);
  };

  const handleAnswer = (sectionIdx, questionIdx, value) => {
    setAnswers(prev => ({ ...prev, [`${sectionIdx}-${questionIdx}`]: value }));
  };

  const getSectionAnswered = (sectionIdx) => {
    if (!survey) return false;
    const section = survey.sections[sectionIdx];
    return section.questions.every((q, qi) => isQuestionAnswered(q, answers[`${sectionIdx}-${qi}`]));
  };

  const getPartAnswered = (partIdx) => {
    const part = parts[partIdx];
    if (!part) return false;
    return part.sectionIndexes.every((sectionIdx) => getSectionAnswered(sectionIdx));
  };

  const handleSubmit = async () => {
    // Check all sections answered
    for (let si = 0; si < survey.sections.length; si++) {
      if (!getSectionAnswered(si)) {
        const partIdx = parts.findIndex((p) => p.sectionIndexes.includes(si));
        await Swal.fire({
          title: 'Incomplete Survey',
          text: `Please answer all questions in section "${survey.sections[si].title}".`,
          icon: 'warning',
          confirmButtonColor: '#800000',
        });
        if (partIdx >= 0) setCurrentPart(partIdx);
        scrollToSurveyTop();
        return;
      }
    }

    const confirm = await Swal.fire({
      title: 'Submit Survey?',
      text: 'Once submitted, you cannot change your answers.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#800000',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Submit',
    });
    if (!confirm.isConfirmed) return;

    setSubmitting(true);
    try {
      const formattedAnswers = [];
      survey.sections.forEach((section, si) => {
        section.questions.forEach((q, qi) => {
          const key = `${si}-${qi}`;
          if (answers[key] !== undefined) {
            formattedAnswers.push({
              sectionIndex: si,
              questionIndex: qi,
              category: section.category || '',
              questionText: getQuestionText(q),
              questionType: getQuestionType(q),
              answer: answers[key],
            });
          }
        });
      });

      const saveRes = await api.post('/responses', { surveyId: survey._id, answers: formattedAnswers });

      // Refresh prediction immediately after survey submission so Result/Recommendations use latest answers.
      if (user?.studentNumber) {
        try {
          await api.post(`/predictions/${user.studentNumber}`);
          window.dispatchEvent(new Event('ppt-prediction-refresh'));
        } catch (_) {
          // Do not block survey submission if prediction generation is temporarily unavailable.
        }
      }

      await Swal.fire({
        title: 'Survey Submitted!',
        text: 'Your survey responses have been recorded and your latest result is being refreshed.',
        icon: 'success',
        confirmButtonColor: '#800000',
      });
      setExistingResponse(saveRes.data?.response || null);
      setSubmitted(true);
    } catch (err) {
      await Swal.fire({
        title: 'Submission Failed',
        text: err.response?.data?.message || 'Failed to submit survey.',
        icon: 'error',
        confirmButtonColor: '#800000',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}><span className="spinner"></span></div>;
  if (!survey) return <div className="alert alert-warning">No active survey available at this time.</div>;

  if (submitted) {
    const handleRetake = async () => {
      const confirm = await Swal.fire({
        title: 'Retake Survey?',
        text: 'Your previous answers will be replaced after you submit again.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#800000',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, Retake',
      });
      if (!confirm.isConfirmed) return;
      setAnswers({});
      setCurrentPart(0);
      setSubmitted(false);
    };

    return (
      <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-100)' }}>
        <div style={{ width: 72, height: 72, background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <CheckCircle size={36} style={{ color: '#059669' }} />
        </div>
        <h2 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.5rem' }}>Survey Completed!</h2>
        <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
          {existingResponse ? `Total Average Score: ${fmtNum(existingResponse.totalAverage, 2)} / 5.00` : 'Your responses have been recorded.'}
        </p>
        {existingResponse?.categoryScores?.length > 0 && (
          <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'left' }}>
            <h4 style={{ fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.75rem' }}>Category Scores</h4>
            {existingResponse.categoryScores.map(cs => (
              <div key={cs.category} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ flex: 1, fontSize: '0.875rem', color: 'var(--gray-600)', textTransform: 'capitalize' }}>{cs.category.replace(/_/g, ' ')}</div>
                <div style={{ width: 120, background: 'var(--gray-100)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${(cs.average / 5) * 100}%`, height: '100%', background: 'var(--maroon)', borderRadius: 999 }} />
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--maroon)', width: 36, textAlign: 'right' }}>{fmtNum(cs.average, 1)}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: '1.5rem' }}>
          <button onClick={handleRetake} className="btn btn-primary" style={{ gap: '0.5rem' }}>
            Retake Survey
          </button>
        </div>
      </div>
    );
  }

  const part = parts[currentPart];
  const totalParts = parts.length;
  const progress = totalParts > 0 ? ((currentPart) / totalParts) * 100 : 0;

  const goToPart = (nextPart) => {
    setCurrentPart(nextPart);
    scrollToSurveyTop();
  };

  return (
    <div ref={topRef} style={{ maxWidth: 760, margin: '0 auto', paddingBottom: '1rem' }}>
      <div style={{ marginBottom: '1rem', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, #fff7f7 0%, #ffffff 80%)', border: '1px solid #fde2e2', padding: '1.25rem 1.35rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--maroon)', marginBottom: '0.25rem', lineHeight: 1.2 }}>{survey.title}</h1>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.84rem' }}>{survey.description}</p>
          </div>
          <div style={{ padding: '0.35rem 0.7rem', borderRadius: 999, background: 'var(--maroon-pale)', color: 'var(--maroon)', fontWeight: 700, fontSize: '0.78rem' }}>
            Part {currentPart + 1} / {totalParts}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.1rem 1.25rem', marginBottom: '1rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--gray-600)' }}>Part {currentPart + 1} of {totalParts}</span>
          <span style={{ color: 'var(--maroon)', fontWeight: 600 }}>{Math.round(progress)}% Complete</span>
        </div>
        <div style={{ background: 'var(--gray-100)', borderRadius: 999, height: 8 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--maroon)', borderRadius: 999, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {parts.map((_, i) => (
            <button key={i} onClick={() => goToPart(i)}
              disabled={i > currentPart && !getPartAnswered(currentPart)}
              style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                background: i === currentPart ? 'var(--maroon)' : getPartAnswered(i) ? '#059669' : 'var(--gray-200)',
                color: i === currentPart || getPartAnswered(i) ? 'white' : 'var(--gray-500)',
                opacity: i > currentPart && !getPartAnswered(currentPart) ? 0.45 : 1,
              }}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Section Card */}
      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '1rem', boxShadow: 'var(--shadow)' }}>
        <div style={{ background: 'linear-gradient(135deg, var(--maroon) 0%, #5f0000 100%)', padding: '1.1rem 1.4rem', color: 'white' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{part.title}</h2>
          {part.description && <p style={{ opacity: 0.8, fontSize: '0.85rem', marginTop: '0.25rem' }}>{part.description}</p>}
        </div>

        <div style={{ padding: '1.2rem 1.3rem' }}>
          {part.categories.map((cat, ci) => (
            <div key={cat.key} style={{ marginBottom: ci < part.categories.length - 1 ? '1.5rem' : 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--maroon)', marginBottom: '0.75rem', textTransform: 'capitalize', letterSpacing: '0.03em' }}>
                Category: {cat.label.replace(/_/g, ' ')}
              </div>
              {cat.sections.map(({ section, sectionIdx }) => (
                <div key={sectionIdx}>
                  {getQuestionType(section.questions[0]) === 'likert' && (
                    <div style={{ padding: '0.85rem 1rem', border: '1px solid #f4e2e2', borderRadius: 'var(--radius)', background: '#fff8f8', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginRight: '0.5rem' }}>Scale:</span>
                      {getLikertScale(section.questions[0]).map((n) => (
                        <span key={n} style={{ fontSize: '0.75rem', background: 'white', border: '1px solid var(--gray-200)', borderRadius: 999, padding: '0.2rem 0.6rem', color: 'var(--gray-600)' }}>{n} = {getLikertLabel(section.questions[0], n)}</span>
                      ))}
                    </div>
                  )}
                  {section.questions.map((q, qi) => {
                    const key = `${sectionIdx}-${qi}`;
                    const val = answers[key];
                    return (
                      <div key={key} style={{ marginBottom: '1rem', padding: '0.95rem', border: '1px solid #f3f4f6', borderRadius: '10px', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <p style={{ fontWeight: 600, color: 'var(--gray-800)', marginBottom: '0.875rem', lineHeight: 1.55, fontSize: '0.94rem' }}>
                          <span style={{ color: 'var(--maroon)', fontWeight: 700, marginRight: '0.5rem' }}>{qi + 1}.</span>
                          {getQuestionText(q)}
                        </p>

                        {getQuestionType(q) === 'likert' && (
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {getLikertScale(q).map(n => (
                              <label key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                                <input type="radio" name={key} value={n} checked={val === n} onChange={() => handleAnswer(sectionIdx, qi, n)} style={{ display: 'none' }} />
                                <div style={{ width: 44, height: 44, borderRadius: 8, border: `2px solid ${val === n ? 'var(--maroon)' : 'var(--gray-200)'}`, background: val === n ? 'var(--maroon)' : 'white', color: val === n ? 'white' : 'var(--gray-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', transition: 'all 0.15s', cursor: 'pointer' }}>
                                  {n}
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)', textAlign: 'center', maxWidth: 80 }}>{getLikertLabel(q, n)}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {getQuestionType(q) === 'text' && (
                          <input type="text" className="form-control" value={val || ''} onChange={e => handleAnswer(sectionIdx, qi, e.target.value)} placeholder="Your answer..." />
                        )}

                        {getQuestionType(q) === 'multiple_choice' && q.options?.map(opt => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                            <input type="radio" name={key} value={opt} checked={val === opt} onChange={() => handleAnswer(sectionIdx, qi, opt)} />
                            <span style={{ fontSize: '0.875rem' }}>{opt}</span>
                          </label>
                        ))}

                        {getQuestionType(q) === 'dropdown' && (
                          <select
                            className="form-control"
                            value={val || ''}
                            onChange={(e) => handleAnswer(sectionIdx, qi, e.target.value)}
                          >
                            <option value="">Select an option...</option>
                            {(q.options || []).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div style={{ position: 'sticky', bottom: 0, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: '0.65rem 0.8rem', zIndex: 20, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.7rem' }}>
        <button onClick={() => goToPart(currentPart - 1)} disabled={currentPart === 0} className="btn btn-outline" style={{ gap: '0.5rem' }}>
          <ChevronLeft size={18} /> Previous
        </button>

        {currentPart < totalParts - 1 ? (
          <button onClick={() => goToPart(currentPart + 1)}
            className="btn btn-primary" style={{ gap: '0.5rem' }}
            disabled={!getPartAnswered(currentPart)}>
            Next <ChevronRight size={18} />
          </button>
        ) : (
          <button onClick={handleSubmit} className="btn btn-primary" style={{ gap: '0.5rem' }} disabled={submitting}>
            {submitting ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor: 'white' }}></span> : <><Send size={16} />Submit Survey</>}
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
