import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

const HealthInsights = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const reportId = searchParams.get('reportId');
  const [currentUser, setCurrentUser] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [riskData, setRiskData] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [advice, setAdvice] = useState([]);
  const initialTab = location.pathname === '/diagnosis' ? 'diagnosis' : 'risk';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [animatedScores, setAnimatedScores] = useState({});
  const [userReports, setUserReports] = useState([]);
  const [reportsData, setReportsData] = useState([]); // [{id, report, riskData, diagnoses, advice}]
  const [selectedReportId, setSelectedReportId] = useState(reportId || '');
  const hasReports = !!reportData;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setCurrentUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchReportsAndData = async () => {
      if (!currentUser) { setIsLoading(false); return; }
      try {
        // 1. Fetch all reports without field-dependent ordering
        const qAll = query(collection(db, 'users', currentUser.uid, 'reports'));
        const snapAll = await getDocs(qAll);
        const allReports = snapAll.docs.map(d => ({ id: d.id, ...d.data() }));

        if (allReports.length > 0) {
          // Sort and label reports client-side
          let finalReports = allReports.sort((a, b) => {
            const dateA = a.createdAt?.toDate() || new Date(a.date || 0);
            const dateB = b.createdAt?.toDate() || new Date(b.date || 0);
            return dateB - dateA;
          });

          // Add display names for disambiguation
          finalReports = finalReports.map((report, idx) => {
            const matches = finalReports.filter(r => r.name === report.name && r.date === report.date);
            if (matches.length > 1) {
              const subIdx = finalReports.filter((r, i) => i >= idx && r.name === report.name && r.date === report.date).length;
              return { ...report, displayName: `${report.name} (${report.date}) #${subIdx}` };
            }
            return { ...report, displayName: `${report.name} (${report.date})` };
          });
          setUserReports(finalReports);

          // If no report selected yet, or selected one is not in the list, default to first (latest)
          const currentId = selectedReportId || reportId || finalReports[0].id;
          if (!selectedReportId) setSelectedReportId(currentId);

          // Process each report into its insights
          const adviceColors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];
          const processed = finalReports.map(report => {
            const analysis = report.analysis || {};

            // 1. Risks mapping (Support both 'risk_assessment' and 'risks' keys)
            const risksSource = analysis.risk_assessment || analysis.risks || [];
            const risks = risksSource.map((risk, i) => ({
              id: i + 1,
              name: risk.risk_name || risk.name || (typeof risk === 'object' ? 'Unspecified Risk' : risk),
              score: risk.score || (risk.severity === 'High' ? 85 : risk.severity === 'Moderate' ? 50 : 20),
              status: risk.status || (risk.severity === 'High' || risk.score > 70 ? 'High Risk' : (risk.severity === 'Moderate' || risk.score > 30) ? 'Medium Risk' : 'Low Risk'),
              description: risk.reason || risk.description || (typeof risk === 'string' ? risk : 'Clinical risk identified.'),
              recommendations: risk.recommendations || [],
              icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
            }));

            // 2. Diagnosis mapping (Support top-level report.diagnosis and analysis.diagnoses)
            const rawDiag = report.diagnosis || analysis.diagnoses || analysis.diagnosis || [];
            const mappedDiag = Array.isArray(rawDiag)
              ? rawDiag.map((diag, i) => ({
                id: i + 1,
                title: diag.title || diag.name || 'Diagnosis item',
                status: diag.status || 'warning',
                description: diag.description || (typeof diag === 'string' ? diag : ''),
                icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
              }))
              : [{ id: 1, title: 'Clinical Assessment', status: 'warning', description: rawDiag, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }];

            // 3. Advice mapping (Support top-level report.advice and analysis.personalized_advice)
            const rawAdvice = report.advice || analysis.personalized_advice || analysis.advice || [];
            const mappedAdvice = Array.isArray(rawAdvice)
              ? rawAdvice.map((adv, i) => ({
                id: i + 1,
                title: adv.title || `Recommendation ${i + 1}`,
                description: adv.description || (typeof adv === 'string' ? adv : ''),
                color: adviceColors[i % adviceColors.length]
              }))
              : [{ id: 1, title: 'Professional Guidance', description: rawAdvice, color: adviceColors[0] }];

            return {
              id: report.id,
              report,
              riskData: risks,
              diagnoses: mappedDiag,
              advice: mappedAdvice,
              displayName: report.displayName
            };
          });
          setReportsData(processed);

          // Update active report state based on selection
          const active = processed.find(p => p.id === currentId) || processed[0];
          if (active) {
            setReportData(active.report);
            setRiskData(active.riskData);
            setDiagnoses(active.diagnoses);
            setAdvice(active.advice);
          }
        }
      } catch (err) { console.error("Error fetching data:", err); }
      finally { setIsLoading(false); }
    };
    fetchReportsAndData();
  }, [currentUser, selectedReportId, reportId]);

  useEffect(() => {
    if (riskData.length === 0) return;
    const intervals = [];
    riskData.forEach(risk => {
      let cur = 0;
      const iv = setInterval(() => {
        cur += 1;
        setAnimatedScores(prev => ({ ...prev, [risk.id]: Math.min(cur, risk.score) }));
        if (cur >= risk.score) clearInterval(iv);
      }, 15);
      intervals.push(iv);
    });
    return () => intervals.forEach(clearInterval);
  }, [riskData]);

  const summaryStats = {
    normal: riskData.filter(r => r.status === 'Normal').length,
    borderline: riskData.filter(r => r.status === 'Borderline').length,
    critical: riskData.filter(r => r.status === 'Critical').length,
  };

  const getOverallRisk = () => {
    if (summaryStats.critical > 0) return 'High';
    if (summaryStats.borderline > 0) return 'Moderate';
    return 'Low';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Critical': return { border: '#fca5a5', text: '#dc2626' };
      case 'Borderline': return { border: '#fcd34d', text: '#d97706' };
      case 'Normal': return { border: '#86efac', text: '#16a34a' };
      default: return { border: '#d1d5db', text: '#6b7280' };
    }
  };

  const getProgressColor = (status) => {
    switch (status) {
      case 'Critical': return '#dc2626';
      case 'Borderline': return '#d97706';
      case 'Normal': return '#16a34a';
      default: return '#6b7280';
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'critical': return { border: '#fca5a5', text: '#dc2626', iconBg: '#dc2626' };
      case 'warning': return { border: '#fcd34d', text: '#d97706', iconBg: '#d97706' };
      case 'good': return { border: '#86efac', text: '#16a34a', iconBg: '#16a34a' };
      default: return { border: '#d1d5db', text: '#6b7280', iconBg: '#6b7280' };
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 border-4 border-cyan-100 border-t-cyan-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">Loading health insights...</p>
        </div>
      </Layout>
    );
  }

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
                  Upload your medical report to unlock comprehensive risk assessment, detailed diagnosis, and personalized health advice.
                </p>
                <a href="/upload" className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-2xl shadow-2xl hover:scale-[1.02] transition-all duration-300 text-lg">
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
            {/* Header with Selector */}
            {/* Standardized Header */}
            <div className="rounded-3xl p-8 text-white mb-6 shadow-xl relative overflow-hidden" style={{ backgroundColor: '#263B6A' }}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg border border-white/10">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold mb-1 tracking-tight">Health Insights</h1>
                    <p className="text-cyan-100 text-lg opacity-90 leading-tight">Diagnostic Risk & Clinical Guidance</p>
                  </div>
                </div>
              </div>
            </div>

            {/* New Selector Card Section */}
            <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100 mb-8">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-50 flex items-center justify-center border border-cyan-100 text-cyan-600 shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-cyan-600 uppercase tracking-widest leading-none mb-1">Selected Dataset</p>
                    <p className="text-xs text-gray-500 font-medium">Switch report for detailed analysis</p>
                  </div>
                </div>

                <select
                  value={selectedReportId}
                  onChange={(e) => setSelectedReportId(e.target.value)}
                  className="w-full lg:w-96 bg-gray-50 border-2 border-gray-100 text-gray-700 py-3.5 px-6 rounded-2xl font-bold text-sm shadow-sm outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all cursor-pointer appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1.5rem center',
                    backgroundSize: '1rem'
                  }}
                >
                  {userReports.map((report) => (
                    <option key={report.id} value={report.id} className="text-slate-800 bg-white">
                      {report.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-slate-100/50 p-2 rounded-[2rem] border border-slate-200 mb-10 max-w-2xl">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('risk')}
                  className={`flex-1 py-4 px-8 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${activeTab === 'risk' ? 'bg-white text-slate-800 shadow-xl border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  🛡️ Risk Assessment
                </button>
                <button
                  onClick={() => setActiveTab('diagnosis')}
                  className={`flex-1 py-4 px-8 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${activeTab === 'diagnosis' ? 'bg-white text-slate-800 shadow-xl border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  🩺 Clinical Guidance
                </button>
              </div>
            </div>

            {activeTab === 'risk' && (
              <div>
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

                {riskData.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 mb-8">
                    {riskData.map((risk) => {
                      const statusStyle = getStatusColor(risk.status);
                      const progressColor = getProgressColor(risk.status);
                      const score = animatedScores[risk.id] || 0;
                      return (
                        <div key={risk.id} className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group">
                          <div className="p-8 lg:p-10">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8">
                              <div className="flex items-center gap-5">
                                <div className="w-16 h-16 rounded-3xl flex items-center justify-center border border-slate-100 shadow-inner group-hover:scale-110 transition-transform" style={{ backgroundColor: '#f8fafc' }}>
                                  <svg className="w-8 h-8" style={{ color: statusStyle.text }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={risk.icon} />
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-1">{risk.name}</h3>
                                  <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter border shadow-sm" style={{ backgroundColor: '#FFFFFF', color: statusStyle.text, borderColor: statusStyle.text + '40' }}>
                                    {risk.status} Alert
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-center md:items-end">
                                <span className="text-5xl font-black tracking-tighter" style={{ color: progressColor }}>{score}%</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Severity Score</span>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="relative h-4 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out" style={{ width: `${score}%`, backgroundColor: progressColor }}>
                                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                </div>
                              </div>
                              <div className="flex justify-between px-1">
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Minimal</span>
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Moderate</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Critical</span>
                              </div>
                            </div>

                            <div className="mt-10 pt-8 border-t border-slate-50">
                              <p className="text-slate-500 font-medium leading-relaxed mb-6">{risk.description}</p>
                              {risk.recommendations?.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {risk.recommendations.map((rec, i) => (
                                    <span key={i} className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold border border-slate-100">
                                      {rec}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-green-50 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{reportData?.analysis ? 'No Risks Detected' : 'Analysis Pending'}</h3>
                    <p className="text-gray-500">{reportData?.analysis ? 'Your report analysis did not identify any health risks.' : 'Your report is being processed. Please check back shortly.'}</p>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                  <h2 className="text-xl font-bold text-gray-800 mb-6 text-center lg:text-left">Overall Risk Summary</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
                    <div className="text-center p-4 bg-white border border-green-100 rounded-xl">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white border border-green-200 flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-3xl font-bold text-green-600">{summaryStats.normal}</p>
                      <p className="text-sm text-gray-600">Normal</p>
                    </div>
                    <div className="text-center p-4 bg-white border border-amber-100 rounded-xl">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white border border-amber-200 flex items-center justify-center">
                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </div>
                      <p className="text-3xl font-bold text-amber-600">{summaryStats.borderline}</p>
                      <p className="text-sm text-gray-600">Borderline</p>
                    </div>
                    <div className="text-center p-4 bg-white border border-red-100 rounded-xl">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white border border-red-200 flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-3xl font-bold text-red-600">{summaryStats.critical}</p>
                      <p className="text-sm text-gray-600">Critical</p>
                    </div>
                    <div className="text-center p-4 bg-white border border-cyan-100 rounded-xl">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white border border-cyan-200 flex items-center justify-center">
                        <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      </div>
                      <p className="text-3xl font-bold text-cyan-600">{getOverallRisk()}</p>
                      <p className="text-sm text-gray-600">Overall</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'diagnosis' && (
              <div className="grid grid-cols-1 gap-10 animate-in fade-in slide-in-from-bottom duration-500">
                {/* Diagnosis Section */}
                <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
                  <div className="px-10 py-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Clinical Assessment</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">AI-Powered Diagnostic Summary</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-10">
                    {diagnoses.length > 0 ? (
                      <div className="grid grid-cols-1 gap-6">
                        {diagnoses.map((diagnosis) => {
                          const style = getStatusStyle(diagnosis.status);
                          return (
                            <div key={diagnosis.id} className="p-8 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                              <div className="flex items-start gap-6">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-slate-50 border border-slate-100 group-hover:scale-110 transition-transform">
                                  <svg className="w-6 h-6" style={{ color: style.iconBg }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={diagnosis.icon} /></svg>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-3">
                                    <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">{diagnosis.title}</h4>
                                    <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border" style={{ color: style.text, borderColor: style.text + '30', backgroundColor: style.text + '05' }}>
                                      {diagnosis.status}
                                    </span>
                                  </div>
                                  <p className="text-slate-500 font-medium leading-relaxed text-sm">{diagnosis.description}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                          <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Optimal Results Detected</h3>
                        <p className="text-slate-400 font-medium max-w-sm mx-auto">Your report shows no significant abnormal parameters requiring diagnosis.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Advice Section */}
                <div className="bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-slate-800">
                  <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shadow-lg text-white backdrop-blur-md border border-white/10">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Personalized Action Plan</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Recommended Preventative Guidance</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-10">
                    {advice.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {advice.map((item) => (
                          <div key={item.id} className="p-8 rounded-[2rem] bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-all group">
                            <div className="flex items-start gap-6">
                              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white/10 border border-white/10 text-3xl font-black" style={{ color: item.color }}>
                                {item.id}
                              </div>
                              <div className="flex-1">
                                <h4 className="text-lg font-black text-white uppercase tracking-tight mb-3">{item.title}</h4>
                                <p className="text-slate-400 font-medium leading-relaxed text-sm">{item.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16 text-slate-500">
                        <p className="text-sm font-bold uppercase tracking-widest">Awaiting assessment data</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default HealthInsights;
