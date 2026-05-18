import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Globe2, LayoutTemplate, Save, Type } from 'lucide-react';
import api from '../../services/api';
import { DEFAULT_LANDING_CONTENT } from '../../utils/defaultLandingContent';

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_LANDING_CONTENT));

export default function LandingCmsPage() {
  const [form, setForm] = useState(cloneDefaults());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/landing-content');
        setForm({ ...cloneDefaults(), ...(res.data?.data || {}) });
      } catch {
        setForm(cloneDefaults());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateArrayField = (key, index, childKey, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].map((item, itemIndex) => (itemIndex === index ? { ...item, [childKey]: value } : item)),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/landing-content', form);
      await Swal.fire({ title: 'Saved', text: 'Landing page content updated successfully.', icon: 'success', confirmButtonColor: 'var(--maroon)' });
    } catch (err) {
      await Swal.fire({ title: 'Save Failed', text: err.response?.data?.message || 'Unable to save landing page content.', icon: 'error', confirmButtonColor: 'var(--maroon)' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><span className="spinner"></span></div>;
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--maroon)' }}>Landing Page CMS</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Manage the public landing page content, including the system title and all section copy.</p>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        <section style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Type size={20} style={{ color: 'var(--maroon)' }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Brand and Hero</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Primary identity and first-view messaging.</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group"><label className="form-label">Brand Name</label><input className="form-control" value={form.brandName} onChange={(e) => updateField('brandName', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Brand Tagline</label><input className="form-control" value={form.brandTagline} onChange={(e) => updateField('brandTagline', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">System Title</label><input className="form-control" value={form.systemTitle} onChange={(e) => updateField('systemTitle', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Hero Badge</label><input className="form-control" value={form.heroBadge} onChange={(e) => updateField('heroBadge', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group"><label className="form-label">Hero Title Line 1</label><input className="form-control" value={form.heroTitleLine1} onChange={(e) => updateField('heroTitleLine1', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Hero Highlight</label><input className="form-control" value={form.heroTitleHighlight} onChange={(e) => updateField('heroTitleHighlight', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Hero Description</label><textarea className="form-control" rows={4} value={form.heroDescription} onChange={(e) => updateField('heroDescription', e.target.value)} /></div>
        </section>

        <section style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <LayoutTemplate size={20} style={{ color: 'var(--maroon)' }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Cards and Metrics</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Short content blocks used in the landing page layout.</div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {form.heroHighlights.map((item, index) => (
              <div key={`hero-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                <div className="form-group"><label className="form-label">Hero Card {index + 1} Title</label><input className="form-control" value={item.title} onChange={(e) => updateArrayField('heroHighlights', index, 'title', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Hero Card {index + 1} Description</label><input className="form-control" value={item.desc} onChange={(e) => updateArrayField('heroHighlights', index, 'desc', e.target.value)} /></div>
              </div>
            ))}
            {form.statMetrics.map((item, index) => (
              <div key={`metric-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                <div className="form-group"><label className="form-label">Metric {index + 1} Label</label><input className="form-control" value={item.label} onChange={(e) => updateArrayField('statMetrics', index, 'label', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Metric {index + 1} Value</label><input className="form-control" value={item.value} onChange={(e) => updateArrayField('statMetrics', index, 'value', e.target.value)} /></div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Globe2 size={20} style={{ color: 'var(--maroon)' }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>About and Capabilities</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Narrative sections shown on the public home page.</div>
            </div>
          </div>
          <div className="form-group"><label className="form-label">About Eyebrow</label><input className="form-control" value={form.aboutEyebrow} onChange={(e) => updateField('aboutEyebrow', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">About Title</label><input className="form-control" value={form.aboutTitle} onChange={(e) => updateField('aboutTitle', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">About Paragraph 1</label><textarea className="form-control" rows={4} value={form.aboutParagraph1} onChange={(e) => updateField('aboutParagraph1', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">About Paragraph 2</label><textarea className="form-control" rows={4} value={form.aboutParagraph2} onChange={(e) => updateField('aboutParagraph2', e.target.value)} /></div>
          {form.highlights.map((item, index) => (
            <div key={`highlight-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
              <div className="form-group"><label className="form-label">Highlight {index + 1} Title</label><input className="form-control" value={item.title} onChange={(e) => updateArrayField('highlights', index, 'title', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Highlight {index + 1} Description</label><input className="form-control" value={item.desc} onChange={(e) => updateArrayField('highlights', index, 'desc', e.target.value)} /></div>
            </div>
          ))}
          <div className="form-group"><label className="form-label">Capabilities Eyebrow</label><input className="form-control" value={form.capabilitiesEyebrow} onChange={(e) => updateField('capabilitiesEyebrow', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Capabilities Title</label><input className="form-control" value={form.capabilitiesTitle} onChange={(e) => updateField('capabilitiesTitle', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Capabilities Description</label><textarea className="form-control" rows={3} value={form.capabilitiesDescription} onChange={(e) => updateField('capabilitiesDescription', e.target.value)} /></div>
          {form.capabilities.map((item, index) => (
            <div key={`capability-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
              <div className="form-group"><label className="form-label">Capability {index + 1} Title</label><input className="form-control" value={item.title} onChange={(e) => updateArrayField('capabilities', index, 'title', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Capability {index + 1} Description</label><input className="form-control" value={item.desc} onChange={(e) => updateArrayField('capabilities', index, 'desc', e.target.value)} /></div>
            </div>
          ))}
        </section>

        <section style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <LayoutTemplate size={20} style={{ color: 'var(--maroon)' }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Process and CTA</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>How the landing page explains the platform flow and call to action.</div>
            </div>
          </div>
          {form.processSteps.map((item, index) => (
            <div key={`step-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
              <div className="form-group"><label className="form-label">Process Step {index + 1} Label</label><input className="form-control" value={item.label} onChange={(e) => updateArrayField('processSteps', index, 'label', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Process Step {index + 1} Description</label><input className="form-control" value={item.desc} onChange={(e) => updateArrayField('processSteps', index, 'desc', e.target.value)} /></div>
            </div>
          ))}
          <div className="form-group"><label className="form-label">CTA Eyebrow</label><input className="form-control" value={form.ctaEyebrow} onChange={(e) => updateField('ctaEyebrow', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">CTA Title</label><input className="form-control" value={form.ctaTitle} onChange={(e) => updateField('ctaTitle', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">CTA Text</label><textarea className="form-control" rows={3} value={form.ctaText} onChange={(e) => updateField('ctaText', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group"><label className="form-label">CTA Button Label</label><input className="form-control" value={form.ctaButtonLabel} onChange={(e) => updateField('ctaButtonLabel', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Footer Text</label><input className="form-control" value={form.footerText} onChange={(e) => updateField('footerText', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Footer Subtext</label><input className="form-control" value={form.footerSubtext} onChange={(e) => updateField('footerSubtext', e.target.value)} /></div>
        </section>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'white' }}></span> : <><Save size={16} />Save Landing Content</>}
        </button>
      </div>
    </div>
  );
}
