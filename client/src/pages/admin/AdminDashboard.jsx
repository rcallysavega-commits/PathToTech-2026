import { useState, useEffect } from 'react';
import { Users, BookOpen, ClipboardList, TrendingUp, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ScatterChart, Scatter, CartesianGrid, LineChart, Line,
} from 'recharts';
import api from '../../services/api';

const COLORS = ['#800000', '#b91c1c', '#059669', '#2563eb', '#d97706'];
const LEVEL_COLORS = {
  'High Employability': '#15803d',
  'Moderate Employability': '#d97706',
  'Low Employability': '#b91c1c',
};
const LEVEL_ORDER = ['High Employability', 'Moderate Employability', 'Low Employability'];
const TABS = ['Overview', 'Analytics', 'Model Visualizations'];

function ChartCard({ title, children }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
      <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem', fontSize: '0.95rem' }}>{title}</h3>
      {children}
    </div>
  );
}
function EmptyChart({ text = 'No data yet' }) {
  return <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '4rem 0', fontSize: '0.875rem' }}>{text}</div>;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [overview, setOverview] = useState(null);
  const [employStatus, setEmployStatus] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [visualizationData, setVisualizationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [vizLoading, setVizLoading] = useState(false);

  useEffect(() => { fetchOverview(); }, []);

  useEffect(() => {
    if (activeTab === 'Analytics' && !analyticsData) fetchAnalytics();
    if (activeTab === 'Model Visualizations' && !visualizationData) fetchVisualizations();
  }, [activeTab]);

  const fetchOverview = async () => {
    try {
      const [overviewRes, statusRes, activityRes] = await Promise.allSettled([
        api.get('/analytics/overview'),
        api.get('/analytics/employability-status'),
        api.get('/analytics/recent-activity'),
      ]);
      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data?.data || null);
      if (statusRes.status === 'fulfilled') setEmployStatus(Array.isArray(statusRes.value.data?.data) ? statusRes.value.data.data : []);
      if (activityRes.status === 'fulfilled') {
        const payload = activityRes.value.data || {};
        const items = [
          ...(Array.isArray(payload.recentStudents) ? payload.recentStudents : []).map(s => ({ description: `New student registered: ${s.fullName || s.email}`, timestamp: s.createdAt })),
          ...(Array.isArray(payload.recentPredictions) ? payload.recentPredictions : []).map(p => ({ description: `Prediction generated for ${p.userId?.fullName || p.studentNumber || 'student'}`, timestamp: p.createdAt })),
        ].filter(a => a.timestamp).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setRecentActivity(items);
      }
    } finally { setLoading(false); }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await api.get('/analytics/model-insights');
      const d = res.data?.data || {};
      setAnalyticsData({
        clusterDistribution: Array.isArray(d.clusterDistribution) ? d.clusterDistribution : [],
        clusterPie: Array.isArray(d.clusterPie) ? d.clusterPie : [],
        scatterPoints: Array.isArray(d.scatterPoints) ? d.scatterPoints : [],
        confidenceHistogram: Array.isArray(d.confidenceHistogram) ? d.confidenceHistogram : [],
        featureComparison: Array.isArray(d.featureComparison) ? d.featureComparison : [],
        associationRules: Array.isArray(d.associationRules) ? d.associationRules : [],
        supportConfidenceScatter: Array.isArray(d.supportConfidenceScatter) ? d.supportConfidenceScatter : [],
        topRecommendedCareers: Array.isArray(d.topRecommendedCareers) ? d.topRecommendedCareers : [],
        skillGapAnalysis: Array.isArray(d.skillGapAnalysis) ? d.skillGapAnalysis : [],
      });
    } catch (_) {
      setAnalyticsData({ clusterDistribution: [], clusterPie: [], scatterPoints: [], confidenceHistogram: [], featureComparison: [], associationRules: [], supportConfidenceScatter: [], topRecommendedCareers: [], skillGapAnalysis: [] });
    } finally { setAnalyticsLoading(false); }
  };

  const fetchVisualizations = async () => {
    setVizLoading(true);
    try {
      const res = await api.get('/analytics/model-visualizations');
      const d = res.data?.data || {};
      setVisualizationData({
        gmmVisualization: d.gmmVisualization || { points: [], ellipses: [], explainedVariance: [0, 0] },
        aicBicData: Array.isArray(d.aicBicData) ? d.aicBicData : [],
        associationRulesDiagram: d.associationRulesDiagram || { nodes: [], edges: [] },
        confusionMatrix: d.confusionMatrix || { matrix: [], labels: [], available: false, reason: 'Unavailable' },
        rocCurve: Array.isArray(d.rocCurve) ? d.rocCurve : [],
        rocMeta: d.rocMeta || { available: false, reason: 'Unavailable' },
        performanceEvaluation: d.performanceEvaluation || { protocol: 'K-Fold Cross-Validation', folds: 0, rmse: null, stabilityIndex: null, averageCvNll: { mean: null, std: null } },
      });
    } catch (_) {
      setVisualizationData({
        gmmVisualization: { points: [], ellipses: [], explainedVariance: [0, 0] },
        aicBicData: [],
        associationRulesDiagram: { nodes: [], edges: [] },
        confusionMatrix: { matrix: [], labels: [], available: false, reason: 'Unavailable' },
        rocCurve: [],
        rocMeta: { available: false, reason: 'Unavailable' },
        performanceEvaluation: { protocol: 'K-Fold Cross-Validation', folds: 0, rmse: null, stabilityIndex: null, averageCvNll: { mean: null, std: null } },
      });
    } finally { setVizLoading(false); }
  };

  const stats = [
    { icon: Users, label: 'Total Students', value: overview?.totalStudents || 0 },
    { icon: BookOpen, label: 'Grade Records', value: overview?.totalGradeRecords || 0 },
    { icon: ClipboardList, label: 'Survey Responses', value: overview?.totalSurveyResponses || 0 },
    { icon: TrendingUp, label: 'Predictions Made', value: overview?.totalPredictions || 0 },
  ];

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}><span className="spinner"></span></div>;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--maroon)' }}>Dashboard</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>PathToTech system overview and analytics</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon"><Icon size={22} /></div>
            <div className="stat-value">{value.toLocaleString()}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--gray-100)' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.55rem 1.1rem', fontSize: '0.875rem', fontWeight: activeTab === tab ? 700 : 400, color: activeTab === tab ? 'var(--maroon)' : 'var(--gray-500)', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--maroon)' : '2px solid transparent', marginBottom: -2, cursor: 'pointer' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem' }}>Employability Status</h3>
            {employStatus.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={employStatus} dataKey="count" nameKey="status" cx="38%" cy="50%" outerRadius={76} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {employStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    wrapperStyle={{ fontSize: 12, lineHeight: '1.45', right: 6 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '3rem 0', fontSize: '0.875rem' }}>No prediction data yet</div>}
          </div>

          <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} style={{ color: 'var(--maroon)' }} /> Recent Activity
            </h3>
            {recentActivity.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 260, overflowY: 'auto' }}>
                {recentActivity.slice(0, 10).map((act, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.82rem', padding: '0.4rem 0', borderBottom: '1px solid var(--gray-50)' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--maroon)', flexShrink: 0, marginTop: 5 }}></div>
                    <div>
                      <span style={{ color: 'var(--gray-700)' }}>{act.description}</span>
                      <div style={{ color: 'var(--gray-400)', fontSize: '0.75rem', marginTop: 2 }}>{new Date(act.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '3rem 0', fontSize: '0.875rem' }}>No recent activity</div>}
          </div>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {activeTab === 'Analytics' && (
        analyticsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><span className="spinner"></span></div>
        ) : analyticsData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1rem' }}>
              <ChartCard title="GMM Cluster Distribution (Bar)">
                {analyticsData.clusterDistribution.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={analyticsData.clusterDistribution} margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="level" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} />
                      <Tooltip formatter={(v) => [v, 'Students']} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {analyticsData.clusterDistribution.map(e => <Cell key={e.level} fill={LEVEL_COLORS[e.level]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>
              <ChartCard title="GMM Cluster Distribution (Pie)">
                {analyticsData.clusterPie.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={analyticsData.clusterPie} dataKey="count" nameKey="level" cx="38%" cy="50%" outerRadius={80} label={({ percentage }) => `${percentage?.toFixed(0)}%`}>
                        {analyticsData.clusterPie.map(e => <Cell key={e.level} fill={LEVEL_COLORS[e.level]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [v, 'Students']} />
                      <Legend
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        wrapperStyle={{ fontSize: 12, lineHeight: '1.45', right: 6 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>
            </div>

            <ChartCard title="GMM Cluster Scatter Plot (2D)">
              {analyticsData.scatterPoints.length ? (
                <ResponsiveContainer width="100%" height={340}>
                  <ScatterChart margin={{ top: 16, right: 20, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="averageGrade" name="Average Grade" domain={[1, 5]} label={{ value: 'Average Grade', position: 'insideBottom', offset: -6 }} />
                    <YAxis type="number" dataKey="overallSkillsScore" name="Overall Skills Score" domain={[0, 100]} label={{ value: 'Overall Skills Score', angle: -90, position: 'insideLeft' }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} /><Legend />
                    {LEVEL_ORDER.map(level => (
                      <Scatter key={level} name={level} data={analyticsData.scatterPoints.filter(p => p.level === level)} fill={LEVEL_COLORS[level]} />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1rem' }}>
              <ChartCard title="GMM Confidence Score Histogram">
                {analyticsData.confidenceHistogram.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={analyticsData.confidenceHistogram} margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} />
                      <Tooltip formatter={(v) => [v, 'Predictions']} />
                      <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>
              <ChartCard title="GMM Feature Comparison per Cluster">
                {analyticsData.featureComparison.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={analyticsData.featureComparison} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="level" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Legend />
                      <Bar dataKey="averageGrade" name="Avg Grade" fill="#334155" />
                      <Bar dataKey="technicalSkillsScore" name="Tech Skills" fill="#2563eb" />
                      <Bar dataKey="softSkillsScore" name="Soft Skills" fill="#059669" />
                      <Bar dataKey="certificationCount" name="Certs" fill="#d97706" />
                      <Bar dataKey="surveyScore" name="Survey" fill="#7c3aed" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </ChartCard>
            </div>

            <ChartCard title="ECLAT Association Rules">
              {analyticsData.associationRules.length ? (
                <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                  <table className="table">
                    <thead><tr><th>#</th><th>Antecedent</th><th>Consequent</th><th>Support</th><th>Confidence</th><th>Lift</th></tr></thead>
                    <tbody>
                      {analyticsData.associationRules.map((rule, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{rule.antecedent}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{rule.consequent}</td>
                          <td>{rule.support?.toFixed(4)}</td>
                          <td>{rule.confidence?.toFixed(4)}</td>
                          <td>{rule.lift?.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyChart text="No association rules generated yet" />}
            </ChartCard>

            <ChartCard title="ECLAT Support vs Confidence Scatter">
              {analyticsData.supportConfidenceScatter.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart margin={{ top: 16, right: 20, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="support" name="Support" domain={[0, 1]} />
                    <YAxis type="number" dataKey="confidence" name="Confidence" domain={[0, 1]} />
                    <Tooltip formatter={(v) => [Number(v).toFixed(4)]} />
                    <Scatter name="Rules" data={analyticsData.supportConfidenceScatter} fill="#2563eb" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            {analyticsData.topRecommendedCareers.length > 0 && (
              <ChartCard title="Top Recommended Careers">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.topRecommendedCareers} margin={{ top: 5, right: 20, bottom: 80, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="career" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, 'Recommendations']} />
                    <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {analyticsData.skillGapAnalysis.length > 0 && (
              <ChartCard title="Skill Gap Analysis (Missing in Lower Employability Groups)">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={analyticsData.skillGapAnalysis} margin={{ top: 5, right: 20, bottom: 70, left: 0 }}>
                    <XAxis dataKey="skill" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" />
                    <YAxis /><Tooltip formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Gap vs non-high']} />
                    <Bar dataKey="gapPercent" fill="#800000" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        ) : null
      )}

      {/* MODEL VISUALIZATIONS TAB */}
      {activeTab === 'Model Visualizations' && (
        vizLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><span className="spinner"></span></div>
        ) : visualizationData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* GMM Cluster Visualization with Ellipses */}
            <ChartCard title="GMM Cluster Visualization (2D PCA Projection with Covariance Ellipses)">
              {visualizationData.gmmVisualization?.points?.length > 0 ? (
                <div>
                  <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart margin={{ top: 16, right: 20, left: 50, bottom: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="x" name="PC1" label={{ value: `PC1 (${(visualizationData.gmmVisualization?.explainedVariance?.[0] * 100).toFixed(1)}%)`, position: 'insideBottomRight', offset: -5 }} />
                      <YAxis type="number" dataKey="y" name="PC2" label={{ value: `PC2 (${(visualizationData.gmmVisualization?.explainedVariance?.[1] * 100).toFixed(1)}%)`, angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      {LEVEL_ORDER.map(level => (
                        <Scatter key={level} name={level} data={visualizationData.gmmVisualization.points.filter(p => p.level === level)} fill={LEVEL_COLORS[level]} opacity={0.6} />
                      ))}
                    </ScatterChart>
                  </ResponsiveContainer>
                  {visualizationData.gmmVisualization?.ellipses?.length > 0 && (
                    <svg width="100%" height={50} style={{ marginTop: '0.5rem' }}>
                      <text x={10} y={20} fontSize={12} fill="#666">
                        Covariance ellipses (2σ): {visualizationData.gmmVisualization.ellipses.map(e => e.level).join(' • ')}
                      </text>
                    </svg>
                  )}
                </div>
              ) : <EmptyChart text="No GMM visualization data available" />}
            </ChartCard>

            {/* AIC/BIC Model Selection Graph */}
            <ChartCard title="Model Selection: AIC & BIC vs Number of Components (K)">
              {visualizationData.aicBicData?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={visualizationData.aicBicData} margin={{ top: 16, right: 30, left: 50, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="k" name="Number of Components" label={{ value: 'K (Components)', position: 'insideBottomRight', offset: -5 }} />
                    <YAxis label={{ value: 'AIC / BIC Score', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="aic" stroke="#2563eb" name="AIC" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="bic" stroke="#dc2626" name="BIC" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart text="No AIC/BIC data available" />}
            </ChartCard>

            {/* Association Rules Diagram */}
            <ChartCard title="ECLAT Association Rules Network (Top Rules)">
              {visualizationData.associationRulesDiagram?.nodes?.length > 0 ? (
                <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '0.5rem', minHeight: 300 }}>
                  <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                    <div style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--maroon)' }}>Association Rules Summary:</div>
                    {visualizationData.associationRulesDiagram.nodes.slice(0, 15).map((node, idx) => (
                      <div key={idx} style={{ padding: '0.5rem', background: 'white', marginBottom: '0.5rem', borderLeft: '3px solid var(--maroon)', fontSize: '0.8rem' }}>
                        <div><strong>{node.label || node.id}</strong></div>
                        <div style={{ color: '#666', marginTop: '0.2rem', fontSize: '0.75rem' }}>
                          Support: {(node.support || 0).toFixed(4)} | Confidence: {(node.confidence || 0).toFixed(4)} | Lift: {(node.lift || 0).toFixed(4)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <EmptyChart text="No association rules data available" />}
            </ChartCard>

            {/* Confusion Matrix */}
            <ChartCard title="Model Performance: Confusion Matrix">
              {visualizationData.confusionMatrix?.matrix?.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                        <th style={{ border: '1px solid #e5e7eb', padding: '0.75rem', textAlign: 'left' }}>Predicted ↓ / Actual →</th>
                        {(visualizationData.confusionMatrix?.labels || []).map((label, i) => (
                          <th key={i} style={{ border: '1px solid #e5e7eb', padding: '0.75rem', textAlign: 'center', background: LEVEL_COLORS[label] || '#f3f4f6', color: label ? 'white' : 'black' }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visualizationData.confusionMatrix.matrix.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          <td style={{ border: '1px solid #e5e7eb', padding: '0.75rem', fontWeight: 600, background: LEVEL_COLORS[visualizationData.confusionMatrix.labels?.[rowIdx]] || '#f3f4f6', color: visualizationData.confusionMatrix.labels?.[rowIdx] ? 'white' : 'black' }}>
                            {visualizationData.confusionMatrix.labels?.[rowIdx]}
                          </td>
                          {row.map((val, colIdx) => (
                            <td key={colIdx} style={{ border: '1px solid #e5e7eb', padding: '0.75rem', textAlign: 'center', background: rowIdx === colIdx ? '#dcfce7' : '#fef3c7', fontWeight: rowIdx === colIdx ? 700 : 400 }}>
                              {val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyChart text={visualizationData.confusionMatrix?.reason || 'No confusion matrix data available'} />}
            </ChartCard>

            {/* ROC Curve */}
            <ChartCard title="Model Performance: ROC Curve (False Positive vs True Positive Rate)">
              {visualizationData.rocCurve?.length > 0 ? (
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart data={visualizationData.rocCurve} margin={{ top: 16, right: 30, left: 50, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="fpr" name="False Positive Rate" domain={[0, 1]} label={{ value: 'False Positive Rate', position: 'insideBottomRight', offset: -5 }} />
                    <YAxis type="number" dataKey="tpr" name="True Positive Rate" domain={[0, 1]} label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(v) => [v.toFixed(4)]} />
                    <Line type="monotone" dataKey="tpr" stroke="#2563eb" strokeWidth={2} name="ROC Curve" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart text={visualizationData.rocMeta?.reason || 'No ROC curve data available'} />}
            </ChartCard>

          </div>
        ) : null
      )}
    </div>
  );
}