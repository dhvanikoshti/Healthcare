import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

const HealthInsights = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reportId = searchParams.get('reportId');

  const [hasReports, setHasReports] = useState(false);
  const [activeTab, setActiveTab] = useState('risk');
  const [animatedScores, setAnimatedScores] = useState({});
  const [animatedStats, setAnimatedStats] = useState({ reports: 0, score: 0, risks: 0 });

  useEffect(() => {
    const storedReports = localStorage.getItem('userReports');
    setHasReports(!!storedReports && JSON.parse(storedReports).length > 0);
  }, []);

  // Risk Data from user feedback (static)
  const riskData = [
    {
      id: 1,
      name: 'Diabetes Risk',
      score: 24,
      status: 'Normal',
      description: 'Your diabetes risk is well managed. Fasting glucose levels exhibit a positive metabolic drift down to 94 mg/dL.',
      recommendations: ['Maintain complex carbohydrates', '30 minutes daily aerobic exercise', 'Quarterly HbA1c screening'],
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
    }
  ];

  // Diagnosis data from user feedback
  const diagnoses = [
    {
      id: 1,
      title: 'Optimal Glucose Homeostasis',
      status: 'good',
      description: 'Fasting glucose level is optimal at 94 mg/dL per your latest screening.',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      id: 2,
      title: 'Positive Metabolic Drift',
      status: 'good',
      description: 'Your Glucose levels have improved significantly over previous readings.',
      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
    },
    {
      id: 3,
      title: 'Diabetes Risk: Minimal',
      status: 'good',
      description: 'Current physiological markers indicate stable glycemic control with low probability of metabolic disorder.',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
  ];

  // Advice data from user feedback
  const advice = [
    {
      id: 1,
      title: 'Glycemic Maintenance',
      description: 'Continue your current dietary balance. Focus on complex carbohydrates and avoid rapid-spike sugars to maintain stability.',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      color: '#06b6d4'
    },
    {
      id: 2,
      title: 'Physical Activity Consistency',
      description: 'Moderate aerobic exercise (30 mins daily) is key to your current metabolic success. This helps in natural insulin sensitivity.',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      color: '#22c55e'
    },
    {
      id: 3,
      title: 'Quarterly Monitoring',
      description: 'Schedule your next fasting glucose check in 3 months to verify continued stability in your primary health marker.',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: '#8b5cf6'
    },
  ];

  // Lifestyle data
  const lifestyle = [
    { icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', title: 'Exercise', desc: '30 mins daily moderate activity' },
    { icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', title: 'Diet', desc: 'Balanced, low-fat meals' },
    { icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z', title: 'Sleep', desc: '7-8 hours per night' },
    { icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Stress Management', desc: 'Meditation and relaxation' },
  ];

  // Risk Animation Effect
  useEffect(() => {
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
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, []);

  // Stats Animation
  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setAnimatedStats({
        reports: Math.round(4 * progress),
        score: Math.round(94 * progress),
        risks: Math.round(0 * progress)
      });
      if (step >= steps) {
        clearInterval(timer);
        setAnimatedStats({ reports: 4, score: 94, risks: 0 });
      }
    }, interval);
    return () => clearInterval(timer);
  }, []);

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

  const getStatusStyle = (status) => {
    switch (status) {
      case 'good': return { bg: '#FFFFFF', text: '#16a34a', border: '#86efac', iconBg: '#22c55e' };
      case 'warning': return { bg: '#FFFFFF', text: '#d97706', border: '#fcd34d', iconBg: '#f59e0b' };
      case 'critical': return { bg: '#FFFFFF', text: '#dc2626', border: '#fca5a5', iconBg: '#ef4444' };
      default: return { bg: '#FFFFFF', text: '#6b7280', border: '#d1d5db', iconBg: '#9ca3af' };
    }
  };

  const summaryStats = {
    normal: riskData.filter(r => r.status === 'Normal').length,
    borderline: riskData.filter(r => r.status === 'Borderline').length,
    critical: riskData.filter(r => r.status === 'Critical').length,
  };

  return (
    <Layout>
      <div>
        {!hasReports ? (
          <>
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="text-center max-w-md mx-auto p-12">
                <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-3xl flex items-center justify-center shadow-xl">
                  <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-4">Get Your Health Insights</h1>
                <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                  Upload your medical report to unlock comprehensive risk assessment, detailed diagnosis,
                  and personalized health advice tailored specifically for you.
                </p>
                <a
                  href="/upload-report"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-2xl shadow-2xl hover:shadow-3xl hover:scale-[1.02] transition-all duration-300 text-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Medical Report
                </a>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="rounded-3xl p-6 lg:p-8 mb-8 text-white relative overflow-hidden" style={{ backgroundColor: '#263B6A' }}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl"></div>
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold mb-2">Health Insights</h1>
                  <p className="text-cyan-100 text-lg">Risk Assessment + Diagnosis & Advice</p>
                  {reportId && (
                    <div className="flex items-center gap-4 mt-3 p-3 bg-white/10 rounded-xl">
                      <span className="text-cyan-200 font-medium">Report ID: {reportId}</span>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-1 mb-8">
              <div className="flex bg-white rounded-xl overflow-hidden">
                <button
                  onClick={() => setActiveTab('risk')}
                  className={`flex-1 py-4 px-6 font-bold transition-all duration-300 rounded-xl ${activeTab === 'risk'
                    ? 'bg-gray-100 text-[#263B6A] shadow-inner'
                    : 'text-gray-500 hover:text-[#263B6A] hover:bg-gray-50'
                    }`}
                >
                  🛡️ Risk Assessment
                </button>
                <button
                  onClick={() => setActiveTab('diagnosis')}
                  className={`flex-1 py-4 px-6 font-bold transition-all duration-300 rounded-xl ${activeTab === 'diagnosis'
                    ? 'bg-gray-100 text-[#263B6A] shadow-inner'
                    : 'text-gray-500 hover:text-[#263B6A] hover:bg-gray-50'
                    }`}
                >
                  🩺 Diagnosis & Advice
                </button>
              </div>
            </div>

            {activeTab === 'risk' && (
              <div>
                {/* Alert Section */}
                {summaryStats.borderline > 0 && (
                  <div className="bg-white border-l-4 border-amber-500 rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white border border-amber-200 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800 mb-1">⚠️ Attention Required</h3>
                        <p className="text-gray-600">You have {summaryStats.borderline} borderline risk(s). Please consult with your healthcare provider.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Risk Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {riskData.map((risk) => {
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
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-gray-100" style={{ backgroundColor: '#FFFFFF' }}>
                                <svg className="w-6 h-6" style={{ color: statusStyle.text }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={risk.icon} />
                                </svg>
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-gray-800">{risk.name}</h3>
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold border" style={{ backgroundColor: '#FFFFFF', color: statusStyle.text, borderColor: statusStyle.border }}>
                                  {risk.status}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-3xl font-bold" style={{ color: progressColor }}>{score}%</p>
                              <p className="text-xs text-gray-500">Risk Score</p>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-6">
                            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, backgroundColor: progressColor }}></div>
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-gray-400">
                              <span>0</span><span>50</span><span>100</span>
                            </div>
                          </div>

                          <p className="text-gray-600 text-sm mb-4">{risk.description}</p>


                        </div>

                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                  <h2 className="text-xl font-bold text-gray-800 mb-6 text-center lg:text-left">Overall Risk Summary</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
                    <div className="text-center p-4 bg-white border border-green-100 rounded-xl">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white border border-green-200 flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-green-600">{summaryStats.normal}</p>
                      <p className="text-sm text-gray-600">Normal</p>
                    </div>
                    <div className="text-center p-4 bg-white border border-amber-100 rounded-xl">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white border border-amber-200 flex items-center justify-center">
                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-amber-600">{summaryStats.borderline}</p>
                      <p className="text-sm text-gray-600">Borderline</p>
                    </div>
                    <div className="text-center p-4 bg-white border border-red-100 rounded-xl">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white border border-red-200 flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-red-600">{summaryStats.critical}</p>
                      <p className="text-sm text-gray-600">Critical</p>
                    </div>
                    <div className="text-center p-4 bg-white border border-cyan-100 rounded-xl">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white border border-cyan-200 flex items-center justify-center">
                        <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-cyan-600">Low</p>
                      <p className="text-sm text-gray-600">Overall</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'diagnosis' && (
              <div>
                {/* Medical Summary */}
                {/* <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl border border-gray-200 mb-8">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-800">Medical Summary Report</h2>
                      <p className="text-gray-500">Generated on July 15, 2024</p>
                    </div>
                    <span className="px-4 py-2 bg-white text-green-700 rounded-xl font-semibold text-sm border border-green-200 shadow-sm">Good Health</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-white rounded-xl text-center border border-gray-100 shadow-sm">
                      <p className="text-3xl font-bold text-gray-800">{animatedStats.reports}</p>
                      <p className="text-sm text-gray-500 mt-1">Reports Analyzed</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl text-center border border-gray-100 shadow-sm">
                      <p className="text-3xl font-bold text-gray-800">{animatedStats.score}</p>
                      <p className="text-sm text-gray-500 mt-1">Overall Score</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl text-center border border-gray-100 shadow-sm">
                      <p className="text-3xl font-bold text-gray-800">{animatedStats.risks}</p>
                      <p className="text-sm text-gray-500 mt-1">Risks Found</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl text-center border border-gray-100 shadow-sm">
                      <p className="text-3xl font-bold text-green-600">Good</p>
                      <p className="text-sm text-gray-500 mt-1">Health Status</p>
                    </div>
                  </div>
                </div> */}

                {/* Diagnosis Section */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
                  <div className="px-6 py-4 bg-white border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Diagnosis
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {diagnoses.map((diagnosis) => {
                        const style = getStatusStyle(diagnosis.status);
                        return (
                          <div key={diagnosis.id} className="flex items-start gap-4 p-4 rounded-xl transition-all duration-200 border" style={{ backgroundColor: '#FFFFFF', borderColor: style.border }}>
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100 shadow-sm" style={{ backgroundColor: 'white' }}>
                              <svg className="w-5 h-5" style={{ color: style.iconBg }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={diagnosis.icon} />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-800 mb-1" style={{ color: style.text }}>{diagnosis.title}</h4>
                              <p className="text-sm mt-1" style={{ color: '#4b5563' }}>{diagnosis.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Advice Section */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
                  <div className="px-6 py-4 bg-white border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Personalized Advice
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {advice.map((item) => (
                        <div key={item.id} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-all duration-200 hover:shadow-md" style={{ backgroundColor: '#FFFFFF' }}>
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-50 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
                            <span className="text-xl font-bold" style={{ color: item.color }}>{item.id}</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 mb-1">{item.title}</h4>
                            <p className="text-sm text-gray-600">{item.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Lifestyle */}
                {/* <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
                  <div className="px-6 py-4 bg-white border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      Lifestyle Recommendations
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {lifestyle.map((item, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 rounded-xl bg-white hover:bg-gray-100 transition-colors cursor-pointer group">
                          <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center group-hover:bg-gray-50 transition-colors">
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-800">{item.title}</h4>
                            <p className="text-sm text-gray-500">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div> */}
              </div>
            )}


          </>
        )}
      </div>
    </Layout>
  );
};

export default HealthInsights;

