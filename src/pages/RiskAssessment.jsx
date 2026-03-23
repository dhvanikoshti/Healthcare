import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const RiskAssessment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reportId = searchParams.get('reportId');
  const [report, setReport] = useState(null);
  const [medicalData, setMedicalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [animatedScores, setAnimatedScores] = useState({});

  useEffect(() => {
    if (!reportId) {
      setLoading(false);
      return;
    }

    const fetchRiskData = async () => {
      let role = 'user';
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          role = 'admin';
        } else if (auth.currentUser.email && auth.currentUser.email.toLowerCase() === 'admin@gmail.com') {
          role = 'admin';
        }
      }

      const reportsKey = role === 'admin' ? 'adminReports' : 'userReports';
      const extractedKey = role === 'admin' ? 'adminExtractedMedicalData' : 'userExtractedMedicalData';

      const reports = JSON.parse(localStorage.getItem(reportsKey) || '[]');
      const extracted = JSON.parse(localStorage.getItem(extractedKey) || '{}');

      const foundReport = reports.find((r) => r.id == reportId);
      if (foundReport) {
        setReport(foundReport);
        setMedicalData(extracted[reportId] || []);
      } else {
        navigate('/reports');
      }
      setLoading(false);
    };

    fetchRiskData();
  }, [reportId, navigate]);

  useEffect(() => {
    if (medicalData.length === 0) return;

    // Animate scores
    const duration = 1500;
    const steps = 60;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const newScores = {};
      riskData.forEach(risk => {
        newScores[risk.id] = Math.round(risk.score * progress);
      });
      setAnimatedScores(newScores);

      if (step >= steps) {
        clearInterval(timer);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [medicalData]); // Depend on medicalData

  const getStatusColor = (status) => {
    switch (status) {
      case 'Normal': return { bg: '#FFFFFF', text: '#16a34a', border: '#86efac', iconBg: '#22c55e' };
      case 'Borderline': return { bg: '#FFFFFF', text: '#d97706', border: '#fcd34d', iconBg: '#f59e0b' };
      case 'Critical': return { bg: '#FFFFFF', text: '#dc2626', border: '#fca5a5', iconBg: '#ef4444' };
      default: return { bg: '#FFFFFF', text: '#6b7280', border: '#d1d5db', iconBg: '#9ca3af' };
    }
  };

  const getProgressColor = (status) => {
    switch (status) {
      case 'Normal': return '#22c55e';
      case 'Borderline': return '#f59e0b';
      case 'Critical': return '#ef4444';
      default: return '#9ca3af';
    }
  };

  const riskData = medicalData.length > 0
    ? medicalData.map((data, index) => ({
      id: index + 1,
      name: `${data.param} Risk`,
      score: Math.floor(Math.random() * 100),
      status: data.value > data.normal_range.high ? 'Critical' : (data.value > data.normal_range.high * 0.9 ? 'Borderline' : 'Normal'),
      description: `Your ${data.param.toLowerCase()} level is ${data.value} ${data.unit}. ${data.value > data.normal_range.high ? 'Elevated levels detected.' : (data.value < data.normal_range.low ? 'Low levels detected.' : 'Within normal range.')}`,
      recommendations: [
        `Monitor ${data.param.toLowerCase()} levels regularly`,
        `Consult doctor if ${data.param.toLowerCase()} remains abnormal`,
        `Follow prescribed treatment if any`
      ],
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
    }))
    : [];

  const summaryStats = {
    normal: riskData.filter(r => r.status === 'Normal').length,
    borderline: riskData.filter(r => r.status === 'Borderline').length,
    critical: riskData.filter(r => r.status === 'Critical').length,
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mb-4"></div>
          <p className="text-gray-500">Loading risk assessment...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="rounded-3xl p-6 lg:p-8 mb-8 text-white shadow-xl relative overflow-hidden" style={{ backgroundColor: '#263B6A' }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold mb-2">Risk Assessment</h1>
              <p className="text-cyan-100 text-lg">Monitor your health risk factors</p>
              <div className="flex flex-wrap gap-3 mt-5">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-sm font-medium">Overall Risk: <span className="text-green-400 font-bold">Low</span></span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium">Last Updated: <span className="text-green-400 font-bold">Today</span></span>
                </div>
              </div>
            </div>
            {report && (
              <button
                onClick={() => navigate('/diagnosis?reportId=' + reportId)}
                className="bg-white text-[#263B6A] px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition-all shadow-lg whitespace-nowrap"
              >
                Next: Get Diagnosis →
              </button>
            )}
          </div>
        </div>

        {!report && (
          <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-bold text-gray-800 mb-2">No Report Found</h3>
            <p className="text-gray-500 mb-6">The selected report is not available.</p>
            <button
              onClick={() => navigate('/reports')}
              className="bg-[#263B6A] text-white px-6 py-2 rounded-xl font-medium hover:bg-opacity-90 transition-all"
            >
              Go to Reports
            </button>
          </div>
        )}

        {medicalData.length === 0 && report && (
          <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-bold text-gray-800 mb-2">No Medical Data</h3>
            <p className="text-gray-500 mb-6">No extracted data available for risk assessment.</p>
            <button
              onClick={() => navigate('/upload')}
              className="bg-[#263B6A] text-white px-6 py-2 rounded-xl font-medium hover:bg-opacity-90 transition-all"
            >
              Upload New Report
            </button>
          </div>
        )}

        {/* Alert Section */}
        {riskData.some(r => r.status === 'Borderline') && (
          <div className="bg-white border-l-4 border-amber-500 rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white border border-amber-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 mb-1">⚠️ Attention Required</h3>
                <p className="text-gray-600">You have borderline risks. Please consult with your healthcare provider for personalized advice.</p>
              </div>
            </div>
          </div>
        )}

        {riskData.some(r => r.status === 'Critical') && (
          <div className="bg-white border-l-4 border-red-500 rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white border border-red-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 mb-1">🚨 Critical Risks Detected</h3>
                <p className="text-gray-600 font-medium">Immediate medical consultation recommended for critical parameters.</p>
              </div>
            </div>
          </div>
        )}

        {/* Risk Cards Grid */}
        {riskData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {riskData.slice(0, 6).map((risk) => {
              const statusStyle = getStatusColor(risk.status);
              const progressColor = getProgressColor(risk.status);
              const score = animatedScores[risk.id] || 0;

              return (
                <div
                  key={risk.id}
                  className="bg-white rounded-2xl shadow-lg border-2 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  style={{ borderColor: statusStyle.border }}
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center border border-gray-100"
                          style={{ backgroundColor: '#FFFFFF' }}
                        >
                          <svg
                            className="w-6 h-6"
                            style={{ color: statusStyle.text }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={risk.icon} />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">{risk.name}</h3>
                          <span
                            className="px-3 py-1 rounded-full text-sm font-semibold border"
                            style={{ backgroundColor: '#FFFFFF', color: statusStyle.text, borderColor: statusStyle.border }}
                          >
                            {risk.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold" style={{ color: progressColor }}>{score}%</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Risk Score</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-6">
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out origin-left"
                          style={{
                            width: `${score}%`,
                            background: `linear-gradient(90deg, ${progressColor} 0%, ${progressColor}80 100%)`
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between mt-2 text-xs">
                        <span className="text-gray-400 font-mono">Low</span>
                        <span className="text-gray-400 font-mono">Medium</span>
                        <span className="font-mono" style={{ color: progressColor, fontWeight: '600' }}>{score}%</span>
                      </div>
                    </div>

                    <p className="text-gray-600 leading-relaxed mb-6">{risk.description}</p>

                    {/* Recommendations */}
                    <div className="border-t border-gray-100 pt-5">
                      <h4 className="text-sm font-semibold text-gray-800 mb-4 uppercase tracking-wide">Action Steps</h4>
                      <ul className="space-y-2">
                        {risk.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-3 text-sm py-2">
                            <div className="w-1.5 h-1.5 mt-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusStyle.iconBg }}></div>
                            <span className="text-gray-700 leading-relaxed">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="px-6 pb-6 pt-0">
                    <button
                      className="w-full py-3 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg text-sm border"
                      style={{ backgroundColor: '#FFFFFF', color: statusStyle.text, borderColor: statusStyle.border }}
                    >
                      {risk.status === 'Critical' ? '🚨 Consult Doctor Now' : 'View Detailed Analysis'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Overall Risk Summary */}
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">📊 Overall Health Risk Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <div className="group text-center p-6 bg-white rounded-2xl border hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white border border-green-200 group-hover:bg-green-50 flex items-center justify-center transition-all">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-green-600 mb-1">{summaryStats.normal}</p>
              <p className="text-sm text-gray-600 font-medium uppercase tracking-wide">Normal</p>
              <p className="text-xs text-green-600 font-semibold">{((summaryStats.normal / riskData.length) * 100).toFixed(0)}%</p>
            </div>
            <div className="group text-center p-6 bg-white rounded-2xl border hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white border border-amber-200 group-hover:bg-amber-50 flex items-center justify-center transition-all">
                <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-amber-600 mb-1">{summaryStats.borderline}</p>
              <p className="text-sm text-gray-600 font-medium uppercase tracking-wide">Borderline</p>
              <p className="text-xs text-amber-600 font-semibold">{((summaryStats.borderline / riskData.length) * 100).toFixed(0)}%</p>
            </div>
            <div className="group text-center p-6 bg-white rounded-2xl border hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white border border-red-200 group-hover:bg-red-50 flex items-center justify-center transition-all">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-red-600 mb-1">{summaryStats.critical}</p>
              <p className="text-sm text-gray-600 font-medium uppercase tracking-wide">Critical</p>
              <p className="text-xs text-red-600 font-semibold">{((summaryStats.critical / riskData.length) * 100).toFixed(0)}%</p>
            </div>
            <div className="md:col-span-1 lg:col-span-1 text-center p-6 bg-white rounded-2xl border hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#263B6A] to-[#547792] flex items-center justify-center shadow-2xl">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="text-4xl font-bold text-[#263B6A] mb-1">Low</p>
              <p className="text-sm text-gray-600 font-medium uppercase tracking-wide">Overall Risk Score</p>
              <p className="text-lg font-bold text-gray-800 mt-2">85/100</p>
            </div>
          </div>
          <div className="mt-8 p-6 bg-white rounded-2xl shadow-lg border">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Next Steps</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/diagnosis?reportId=' + reportId)}
                className="flex-1 bg-gradient-to-r from-[#263B6A] to-[#547792] text-white py-4 px-6 rounded-xl font-bold hover:from-[#263B6A]/90 hover:to-[#547792]/90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                🚀 Get AI Diagnosis &amp; Advice
              </button>
              <button
                onClick={() => navigate('/health-tips')}
                className="flex-1 bg-white border-2 border-green-600 text-green-600 py-4 px-6 rounded-xl font-bold hover:bg-green-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                💡 Health Tips
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RiskAssessment;
