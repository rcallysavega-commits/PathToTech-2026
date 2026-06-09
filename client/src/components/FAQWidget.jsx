import { useState, useEffect, useRef } from 'react';
import { HelpCircle, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import api from '../services/api';

export default function FAQWidget() {
  const [open, setOpen] = useState(false);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');
  const fetched = useRef(false);

  // Fetch once when first opened
  useEffect(() => {
    if (!open || fetched.current) return;
    setLoading(true);
    api.get('/faqs')
      .then(res => { setFaqs(res.data?.data || []); })
      .catch(() => { setFaqs([]); })
      .finally(() => { setLoading(false); fetched.current = true; });
  }, [open]);

  const filtered = faqs.filter(f =>
    !search.trim() ||
    f.question.toLowerCase().includes(search.toLowerCase()) ||
    f.answer.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => setExpanded(prev => (prev === id ? null : id));

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        title="Frequently Asked Questions"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 24,
          zIndex: 1000,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--maroon)',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 18px rgba(128,0,0,0.45)',
          cursor: 'pointer',
          display: open ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(128,0,0,0.55)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(128,0,0,0.45)'; }}
      >
        <HelpCircle size={24} />
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            width: 370,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: '80vh',
            background: 'white',
            borderRadius: 16,
            boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ background: 'var(--maroon)', color: 'white', padding: '1rem 1.1rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <HelpCircle size={18} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Frequently Asked Questions</span>
            </div>
            <button
              onClick={() => { setOpen(false); setSearch(''); setExpanded(null); }}
              style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 6, padding: '0.3rem', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: '0.7rem 1rem 0.5rem', borderBottom: '1px solid var(--gray-100)', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setExpanded(null); }}
                placeholder="Search questions…"
                style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', border: '1.5px solid var(--gray-200)', borderRadius: 8, fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box', background: 'var(--gray-50)' }}
              />
            </div>
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.85rem' }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.85rem' }}>
                {search ? 'No matching questions found.' : 'No FAQs available yet.'}
              </div>
            ) : (
              filtered.map((faq, index) => (
                <div key={faq._id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                  <button
                    onClick={() => toggle(faq._id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '0.85rem 1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                    }}
                  >
                    <span style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--maroon)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                      {index + 1}
                    </span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: '0.85rem', color: 'var(--gray-800)', lineHeight: 1.45 }}>{faq.question}</span>
                    <span style={{ color: 'var(--gray-400)', flexShrink: 0, marginTop: 2 }}>
                      {expanded === faq._id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </button>
                  {expanded === faq._id && (
                    <div style={{ padding: '0 1rem 0.9rem 3rem', fontSize: '0.82rem', color: 'var(--gray-600)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
