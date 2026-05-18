import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ScatterChart,
  Scatter,
  CartesianGrid,
} from 'recharts';
import api from '../../services/api';

const LEVEL_COLORS = {
  'High Employability': '#15803d',
  'Moderate Employability': '#d97706',
  'Low Employability': '#b91c1c',
};

const LEVEL_ORDER = ['High Employability', 'Moderate Employability', 'Low Employability'];

function GMMClusterVisualization({ gmmVisualization }) {
  const { points = [], ellipses = [], explainedVariance = [0, 0] } = gmmVisualization || {};

  if (!points.length && !ellipses.length) {
    return <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '4rem 0', fontSize: '0.875rem' }}>No GMM visualization data yet</div>;
  }

  const W = 580, H = 380;
  const M = { top: 16, right: 20, bottom: 52, left: 52 };
  const pw = W - M.left - M.right;
  const ph = H - M.top - M.bottom;

  const allX = points.map(p => p.x);
  const allY = points.map(p => p.y);
  ellipses.forEach(e => (e.boundary || []).forEach(([bx, by]) => { allX.push(bx); allY.push(by); }));

  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX);
  const yMin = Math.min(...allY);
  const yMax = Math.max(...allY);
  const xPad = (xMax - xMin) * 0.06;
  const yPad = (yMax - yMin) * 0.06;
  const x0 = xMin - xPad, x1 = xMax + xPad;
  const y0 = yMin - yPad, y1 = yMax + yPad;

  const sx = (v) => M.left + ((v - x0) / (x1 - x0)) * pw;
  const sy = (v) => M.top + ph - ((v - y0) / (y1 - y0)) * ph;

  const xTicks = 5, yTicks = 5;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <clipPath id="gmm-viz-clip">
            <rect x={M.left} y={M.top} width={pw} height={ph} />
          </clipPath>
        </defs>

        {/* Grid */}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const x = M.left + (i / xTicks) * pw;
          return <line key={`vg${i}`} x1={x} y1={M.top} x2={x} y2={M.top + ph} stroke="#e5e7eb" strokeWidth={0.5} />;
        })}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = M.top + (i / yTicks) * ph;
          return <line key={`hg${i}`} x1={M.left} y1={y} x2={M.left + pw} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />;
        })}
        <rect x={M.left} y={M.top} width={pw} height={ph} fill="none" stroke="#d1d5db" strokeWidth={1} />

        {/* X axis ticks + labels */}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const x = M.left + (i / xTicks) * pw;
          const val = x0 + (i / xTicks) * (x1 - x0);
          return (
            <g key={`xt${i}`}>
              <line x1={x} y1={M.top + ph} x2={x} y2={M.top + ph + 4} stroke="#9ca3af" strokeWidth={1} />
              <text x={x} y={M.top + ph + 14} textAnchor="middle" fontSize={9} fill="#6b7280">{val.toFixed(1)}</text>
            </g>
          );
        })}

        {/* Y axis ticks + labels */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = M.top + (i / yTicks) * ph;
          const val = y1 - (i / yTicks) * (y1 - y0);
          return (
            <g key={`yt${i}`}>
              <line x1={M.left - 4} y1={y} x2={M.left} y2={y} stroke="#9ca3af" strokeWidth={1} />
              <text x={M.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#6b7280">{val.toFixed(1)}</text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={M.left + pw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#374151">
          {`PC1 (${((explainedVariance[0] || 0) * 100).toFixed(1)}% variance)`}
        </text>
        <text
          x={13}
          y={M.top + ph / 2}
          textAnchor="middle"
          fontSize={11}
          fill="#374151"
          transform={`rotate(-90, 13, ${M.top + ph / 2})`}
        >
          {`PC2 (${((explainedVariance[1] || 0) * 100).toFixed(1)}% variance)`}
        </text>

        {/* Ellipses (Gaussian distributions) */}
        <g clipPath="url(#gmm-viz-clip)">
          {ellipses.map((e, i) => {
            const pts = (e.boundary || []).map(([bx, by]) => `${sx(bx).toFixed(1)},${sy(by).toFixed(1)}`).join(' ');
            const color = LEVEL_COLORS[e.level] || '#64748b';
            return (
              <polygon
                key={i}
                points={pts}
                fill={color}
                fillOpacity={0.15}
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.55}
              />
            );
          })}

          {/* Scatter points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={2.5}
              fill={LEVEL_COLORS[p.level] || '#64748b'}
              fillOpacity={0.72}
            />
          ))}
        </g>

        {/* Legend */}
        {LEVEL_ORDER.map((level, i) => (
          <g key={level} transform={`translate(${M.left + 10}, ${M.top + 12 + i * 18})`}>
            <circle r={5} fill={LEVEL_COLORS[level]} fillOpacity={0.8} />
            <text x={10} y={4} fontSize={9} fill="#374151">{level}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState({
    overview: null,
    clusterDistribution: [],
    clusterPie: [],
    scatterPoints: [],
    confidenceHistogram: [],
    featureComparison: [],
    associationRules: [],
    supportConfidenceScatter: [],
    topRecommendedCareers: [],
    skillGapAnalysis: [],
    genderByLevel: [],
    gmmVisualization: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [ov, insights] = await Promise.allSettled([
        api.get('/analytics/overview'),
        api.get('/analytics/model-insights'),
      ]);

      const payload = insights.value?.data?.data || {};

      setData({
        overview: ov.value?.data?.data || null,
        clusterDistribution: Array.isArray(payload.clusterDistribution) ? payload.clusterDistribution : [],
        clusterPie: Array.isArray(payload.clusterPie) ? payload.clusterPie : [],
        scatterPoints: Array.isArray(payload.scatterPoints) ? payload.scatterPoints : [],
        confidenceHistogram: Array.isArray(payload.confidenceHistogram) ? payload.confidenceHistogram : [],
        featureComparison: Array.isArray(payload.featureComparison) ? payload.featureComparison : [],
        associationRules: Array.isArray(payload.associationRules) ? payload.associationRules : [],
        supportConfidenceScatter: Array.isArray(payload.supportConfidenceScatter) ? payload.supportConfidenceScatter : [],
        topRecommendedCareers: Array.isArray(payload.topRecommendedCareers) ? payload.topRecommendedCareers : [],
        skillGapAnalysis: Array.isArray(payload.skillGapAnalysis) ? payload.skillGapAnalysis : [],
        genderByLevel: Array.isArray(payload.genderByLevel) ? payload.genderByLevel : [],
        gmmVisualization: payload.gmmVisualization || null,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}><span className="spinner"></span></div>;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Analytics</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>System-wide employability insights</p>
      </div>

      {/* Overview Stats */}
      {data.overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            ['Students', data.overview.totalStudents],
            ['Predictions', data.overview.totalPredictions],
            ['Responses', data.overview.totalSurveyResponses],
            ['Grade Records', data.overview.totalGradeRecords],
          ].map(([label, value]) => (
            <div key={label} className="stat-card">
              <div className="stat-value">{value?.toLocaleString() || 0}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Gender Distribution */}
      {data.overview && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          {/* Overall Gender Pie */}
          <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.25rem' }}>Gender Distribution</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginBottom: '1rem' }}>Overall breakdown of enrolled students</p>
            {(data.overview.genderDistribution || []).length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={data.overview.genderDistribution}
                    dataKey="count"
                    nameKey="gender"
                    cx="38%"
                    cy="50%"
                    outerRadius={90}
                    label={({ gender, percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {(data.overview.genderDistribution).map((entry, i) => (
                      <Cell key={entry.gender} fill={['#2563eb', '#db2777', '#64748b'][i % 3]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [v, name]} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12, lineHeight: '1.5', right: 6 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '4rem 0', fontSize: '0.875rem' }}>No student data yet</div>}
          </div>

          {/* Gender by Employability Level */}
          <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.25rem' }}>Gender by Employability Level</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginBottom: '1rem' }}>How genders are distributed across each GMM cluster</p>
            {data.genderByLevel.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.genderByLevel} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Male" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Female" fill="#db2777" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Not Specified" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '4rem 0', fontSize: '0.875rem' }}>No prediction data yet</div>}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>GMM Cluster Distribution (Bar)</h3>
          {data.clusterDistribution.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.clusterDistribution} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Students']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.clusterDistribution.map((entry) => (
                    <Cell key={entry.level} fill={LEVEL_COLORS[entry.level]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '4rem 0', fontSize: '0.875rem' }}>No prediction data yet</div>}
        </div>

        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>GMM Cluster Distribution (Pie)</h3>
          {data.clusterPie.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.clusterPie}
                  dataKey="count"
                  nameKey="level"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label={({ level, percentage }) => `${level}: ${percentage.toFixed(0)}%`}
                >
                  {data.clusterPie.map((entry) => <Cell key={entry.level} fill={LEVEL_COLORS[entry.level]} />)}
                </Pie>
                <Tooltip formatter={(v) => [v, 'Students']} />
                <Legend formatter={(v) => v} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '4rem 0', fontSize: '0.875rem' }}>No prediction data yet</div>}
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.25rem' }}>GMM Cluster Visualization — Overlapping Gaussian Distributions</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginBottom: '1rem' }}>PCA-projected 2D view of training data with 2σ Gaussian ellipses per cluster</p>
        <GMMClusterVisualization gmmVisualization={data.gmmVisualization} />
      </div>

      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>GMM Cluster Scatter Plot (2D)</h3>
        {data.scatterPoints.length ? (
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart margin={{ top: 16, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="averageGrade"
                name="Average Grade"
                domain={[1, 5]}
                label={{ value: 'Average Grade', position: 'insideBottom', offset: -6 }}
              />
              <YAxis
                type="number"
                dataKey="overallSkillsScore"
                name="Overall Skills Score"
                domain={[0, 100]}
                label={{ value: 'Overall Skills Score', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name) => [value, name]} />
              <Legend />
              {LEVEL_ORDER.map((level) => (
                <Scatter
                  key={level}
                  name={level}
                  data={data.scatterPoints.filter((point) => point.level === level)}
                  fill={LEVEL_COLORS[level]}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '4rem 0', fontSize: '0.875rem' }}>No clustering data yet</div>}
      </div>

      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>GMM Confidence Score Histogram</h3>
        {data.confidenceHistogram.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.confidenceHistogram} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'Predictions']} />
              <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '4rem 0', fontSize: '0.875rem' }}>No confidence data yet</div>}
      </div>

      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>GMM Feature Comparison per Cluster</h3>
        {data.featureComparison.length ? (
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={data.featureComparison} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="level" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="averageGrade" name="Average Grade" fill="#334155" />
              <Bar dataKey="technicalSkillsScore" name="Technical Skills Score" fill="#2563eb" />
              <Bar dataKey="softSkillsScore" name="Soft Skills Score" fill="#059669" />
              <Bar dataKey="certificationCount" name="Certification Count" fill="#d97706" />
              <Bar dataKey="surveyScore" name="Survey Score" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '4rem 0', fontSize: '0.875rem' }}>No comparison data yet</div>}
      </div>

      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>ECLAT Association Rules Table</h3>
        {data.associationRules.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Antecedent</th>
                  <th>Consequent</th>
                  <th>Support</th>
                  <th>Confidence</th>
                  <th>Lift</th>
                </tr>
              </thead>
              <tbody>
                {data.associationRules.map((rule, idx) => (
                  <tr key={`${rule.antecedent}-${rule.consequent}-${idx}`}>
                    <td>{idx + 1}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{rule.antecedent}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{rule.consequent}</td>
                    <td>{rule.support.toFixed(4)}</td>
                    <td>{rule.confidence.toFixed(4)}</td>
                    <td>{rule.lift.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '4rem 0', fontSize: '0.875rem' }}>No association rules generated yet</div>}
      </div>

      <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>ECLAT Support vs Confidence Scatter</h3>
        {data.supportConfidenceScatter.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 16, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="support" name="Support" domain={[0, 1]} />
              <YAxis type="number" dataKey="confidence" name="Confidence" domain={[0, 1]} />
              <Tooltip formatter={(v) => [Number(v).toFixed(4)]} />
              <Scatter name="Rules" data={data.supportConfidenceScatter} fill="#2563eb" />
            </ScatterChart>
          </ResponsiveContainer>
        ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '4rem 0', fontSize: '0.875rem' }}>No rule scatter data yet</div>}
      </div>

      {data.topRecommendedCareers.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>Top Recommended Careers</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.topRecommendedCareers} margin={{ top: 5, right: 20, bottom: 80, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="career" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'Recommendations']} />
              <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.skillGapAnalysis.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>Skill Gap Analysis (Missing in Lower Employability Groups)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.skillGapAnalysis} margin={{ top: 5, right: 20, bottom: 70, left: 0 }}>
              <XAxis dataKey="skill" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" />
              <YAxis />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Gap vs non-high']} />
              <Bar dataKey="gapPercent" fill="#800000" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
