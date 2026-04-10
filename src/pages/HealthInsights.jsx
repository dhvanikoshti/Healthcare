import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

const HealthInsights = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const reportId = searchParams.get('reportId');
  const [currentUser, setCurrentUser] = useState(undefined); // undefined = loading, null = no user
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
  const [isDatasetOpen, setIsDatasetOpen] = useState(false);
  const datasetRef = useRef(null);
  const hasReports = userReports.length > 0;
  const hasSelectedData = !!reportData;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setCurrentUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datasetRef.current && !datasetRef.current.contains(event.target)) {
        setIsDatasetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchReportsAndData = async () => {
      // Don't settle the loading state until we know if a user is logged in
      if (currentUser === undefined) return;
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      try {
        // 1. Fetch all reports to determine if data exists
        const qAll = query(collection(db, 'users', currentUser.uid, 'reports'));
        const snapAll = await getDocs(qAll);
        if (snapAll.empty) {
          setUserReports([]);
          setIsLoading(false);
          return;
        }

        const rawReports = snapAll.docs.map(doc => {
          const data = doc.data();
          // Extract the clinical date with same logic as Trends.jsx
          const reportDate = data.analysis?.report_date || data.analysis?.reportDate || data.report_date || data.reportDate || data.analysis?.date || data.date || 'Unknown';
          return { id: doc.id, ...data, reportDate };
        });

        // 2. Sort by Clinical Date (Latest First)
        let finalReports = rawReports.sort((a, b) => {
          const d1 = new Date(a.reportDate);
          const d2 = new Date(b.reportDate);
          return d2 - d1;
        });

        // 3. Add Display Names matching Trends page style
        finalReports = finalReports.map((report, idx) => {
          const reportName = report.name || report.analysis?.report_name || 'Lab Report';
          const matches = finalReports.filter(r => r.name === report.name && r.reportDate === report.reportDate);
          if (matches.length > 1) {
            const subIdx = finalReports.slice(0, idx + 1).filter(r => r.name === report.name && r.reportDate === report.reportDate).length;
            return { ...report, displayName: `${reportName} (${report.reportDate}) #${subIdx}`, reportName };
          }
          return { ...report, displayName: `${reportName} (${report.reportDate})`, reportName };
        });
        setUserReports(finalReports);

        // 4. Resolve Active Report
        const currentId = selectedReportId || reportId;
        if (currentId && !selectedReportId) setSelectedReportId(currentId);

        // 5. Process entire dataset to generate insights
        const adviceColors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];
        const processed = finalReports.map(report => {
          const analysis = report.analysis || {};
          // Support multiple n8n risk assessment schemas
          const risksSource = analysis.risk_assessment || analysis.risks || [];
          const risks = Array.isArray(risksSource) ? risksSource.map((risk, i) => ({
            id: i + 1,
            name: risk.risk_name || risk.name || (typeof risk === 'object' ? 'Unspecified Risk' : risk),
            score: risk.score || (risk.severity === 'High' ? 85 : risk.severity === 'Moderate' ? 50 : 20),
            status: risk.status || (risk.severity === 'High' || risk.score > 70 ? 'High Risk' : (risk.severity === 'Moderate' || risk.score > 30) ? 'Medium Risk' : 'Low Risk'),
            description: risk.reason || risk.description || (typeof risk === 'string' ? risk : 'Clinical risk identified.'),
            recommendations: risk.recommendations || [],
            icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
          })) : [];

          // Diagnosis mapping (robust fallbacks)
          const rawDiag = report.diagnosis || analysis.diagnoses || analysis.diagnosis || [];
          const mappedDiag = Array.isArray(rawDiag)
            ? rawDiag.map((diag, i) => ({
              id: i + 1,
              title: diag.title || diag.name || 'Clinical Finding',
              status: diag.status || 'Caution',
              description: diag.description || (typeof diag === 'string' ? diag : ''),
              icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
            }))
            : [{ id: 1, title: 'Clinical Assessment', status: 'Caution', description: rawDiag, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }];

          // Advice mapping
          const rawAdvice = report.advice || analysis.personalized_advice || analysis.advice || [];
          const mappedAdvice = Array.isArray(rawAdvice)
            ? rawAdvice.map((adv, i) => ({
              id: i + 1,
              title: adv.title || `Action Point ${i + 1}`,
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

        // Final UI State Update
        const active = processed.find(p => p.id === currentId) || processed[0];
        if (active) {
          setReportData(active.report);
          setRiskData(active.riskData);
          setDiagnoses(active.diagnoses);
          setAdvice(active.advice);
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
      <Layout title="Health Insights">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 border-4 border-cyan-100 border-t-cyan-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">Loading health insights...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Health Insights"
      headerActions={
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-col items-end mr-2">
            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest leading-none mb-1">Selected Dataset</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Switch for detailed analysis</p>
          </div>
          <div className="relative" ref={datasetRef}>
            <button
              onClick={() => setIsDatasetOpen(!isDatasetOpen)}
              className={`bg-white border-2 text-slate-800 py-2.5 px-5 rounded-2xl font-black text-xs shadow-sm outline-none transition-all cursor-pointer flex items-center gap-4 min-w-[240px] justify-between ${isDatasetOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200'}`}
            >
              <span className="truncate max-w-[180px]">
                {userReports.find(r => r.id === selectedReportId)?.displayName || 'Select Report for Analysis'}
              </span>
              <svg
                className={`w-4 h-4 text-indigo-500 transition-transform duration-300 ${isDatasetOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDatasetOpen && (
              <div className="absolute top-full right-0 mt-3 w-full min-w-[280px] bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                  {userReports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => {
                        setSelectedReportId(report.id);
                        setIsDatasetOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3.5 text-xs font-bold transition-all flex items-center justify-between group hover:bg-slate-50 ${selectedReportId === report.id ? 'bg-indigo-50/50 text-indigo-600' : 'text-slate-600'}`}
                    >
                      <span className="truncate pr-4">{report.displayName}</span>
                      {selectedReportId === report.id && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      }
    >
      <div>
        {hasReports && (
          <>

            {selectedReportId ? (
              <>
                <div className="bg-slate-100/50 p-1.5 rounded-[1.5rem] border border-slate-200 mb-8 w-full shadow-inner animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setActiveTab('risk')}
                      className={`flex-1 py-3 px-6 rounded-[1.2rem] font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'risk' ? 'bg-white text-[#263B6A] shadow-md border border-slate-100' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      Risk Assessment
                    </button>
                    <button
                      onClick={() => setActiveTab('diagnosis')}
                      className={`flex-1 py-3 px-3 rounded-[1.2rem] font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'diagnosis' ? 'bg-white text-[#263B6A] shadow-md border border-slate-100' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      Suggestions
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
                      <div className="grid grid-cols-1 gap-6 mb-10">
                        {riskData.map((risk) => {
                          const statusStyle = getStatusColor(risk.status);
                          const score = animatedScores[risk.id] || 0;
                          return (
                            <div key={risk.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:border-[#263B6A]/30 transition-all duration-300 group">
                              <div className="p-6">
                                <div className="flex flex-col lg:flex-row gap-6">
                                  {/* Content */}
                                  <div className="flex-1">
                                    <div className="flex items-start gap-4 mb-4">
                                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-100 transition-colors duration-300 shrink-0" style={{ color: statusStyle.text }}>
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={risk.icon} />
                                        </svg>
                                      </div>
                                      <div className="pt-1 w-full">
                                        <div className="flex flex-wrap items-center gap-3 mb-1">
                                          <h3 className="text-lg font-bold text-slate-800 tracking-tight">{risk.name}</h3>
                                          <span className="px-3 py-1 rounded-md text-xs font-semibold shadow-sm border" style={{ backgroundColor: '#FFFFFF', color: statusStyle.text, borderColor: statusStyle.text + '40' }}>
                                            {risk.status}
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium">Diagnostic Module</p>
                                      </div>
                                    </div>
                                    <p className="text-slate-600 font-normal leading-relaxed text-sm mb-4 lg:ml-16">{risk.description}</p>
                                    {risk.recommendations?.length > 0 && (
                                      <div className="flex flex-wrap gap-2 lg:ml-16">
                                        {risk.recommendations.map((rec, i) => (
                                          <span key={i} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-100 transition-all">
                                            {rec}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700">
                        <div className="bg-white rounded-[3rem] p-10 sm:p-16 shadow-[0_20px_70px_-15px_rgba(0,0,0,0.1)] border border-slate-200/60 flex flex-col items-center text-center w-full relative overflow-hidden group">
                          {/* Background Decorative Element */}
                          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700"></div>

                          <div className="relative mb-8">
                            <div className="w-20 h-20 bg-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-2xl relative z-10 group-hover:rotate-12 transition-transform duration-500">
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="absolute inset-0 bg-slate-900/20 blur-3xl -z-0 scale-75"></div>
                          </div>

                          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2 tracking-tight uppercase flex flex-col gap-1 sm:gap-2">
                             <span>{reportData?.analysis ? 'No Risks' : 'Please select report for'}</span>
                             <span className="text-blue-600">{reportData?.analysis ? 'Detected' : 'Risk Assessment'}</span>
                          </h2>

                          <p className="text-slate-400 font-medium text-xs sm:text-sm leading-relaxed max-w-md mb-8">
                            {reportData?.analysis
                              ? 'Your report analysis did not identify any health risks. All parameters appear to be within normal clinical ranges.'
                              : 'Your report is currently being processed by our AI diagnostic engine. Please check back in a few moments for detailed insights.'}
                          </p>

                          {/* Micro-interaction indicator */}
                          <div className="flex items-center gap-2 text-slate-300">
                            <div className={`w-2 h-2 rounded-full ${reportData?.analysis ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`}></div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                              {reportData?.analysis ? 'Assessment Complete' : 'Awaiting Processing'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'diagnosis' && (
                  <div className="animate-in fade-in slide-in-from-bottom duration-700">
                    {diagnoses.length > 0 || advice.length > 0 ? (
                      /* Unified Diagnosis & Action Card */
                      <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                        {/* Unified Header */}
                        <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-[#263B6A] rounded-xl flex items-center justify-center text-white shadow-sm">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div>
                              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Clinical Insight & Guidance</h2>
                              <p className="text-xs font-medium text-slate-500">Diagnostic Intelligence Review</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col">
                          {/* Top Section: Clinical Assessment */}
                          <div className="p-6 sm:p-8">
                            <div className="flex items-center gap-2 mb-6">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medical Parameters</span>
                              <div className="h-[1px] flex-1 bg-slate-50"></div>
                            </div>

                            {diagnoses.length > 0 ? (
                              <div className="grid grid-cols-1 gap-4">
                                {diagnoses.map((diagnosis) => {
                                  const style = getStatusStyle(diagnosis.status);
                                  return (
                                    <div key={diagnosis.id} className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                                      <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-50 border border-slate-100 group-hover:scale-110 transition-transform">
                                          <svg className="w-5 h-5" style={{ color: style.iconBg }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={diagnosis.icon} /></svg>
                                        </div>
                                        <div className="flex-1">
                                          <div className="flex items-center justify-between mb-1.5">
                                            <h4 className="text-sm font-bold text-slate-800 tracking-tight">{diagnosis.title}</h4>
                                            <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold border" style={{ color: style.text, borderColor: style.text + '30', backgroundColor: style.text + '05' }}>
                                              {diagnosis.status}
                                            </span>
                                          </div>
                                          <p className="text-slate-500 font-medium leading-relaxed text-xs">{diagnosis.description}</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                  <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h3 className="text-xs font-black text-slate-800 tracking-widest uppercase">No Clinical Issues</h3>
                              </div>
                            )}
                          </div>

                          {/* Bottom Section: Recommended Actions */}
                          <div className="bg-slate-50/30 p-6 sm:p-8 border-t border-slate-100">
                            <div className="flex items-center gap-2 mb-6">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recommended Actions</span>
                              <div className="h-[1px] flex-1 bg-slate-100"></div>
                            </div>

                            {advice.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                {advice.map((item) => (
                                  <div key={item.id} className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex items-start gap-4">
                                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-50 border border-slate-100 text-lg font-black group-hover:scale-110 transition-transform" style={{ color: item.color }}>
                                        {item.id}
                                      </div>
                                      <div className="flex-1">
                                        <h4 className="text-sm font-bold text-slate-800 tracking-tight mb-1.5">{item.title}</h4>
                                        <p className="text-slate-500 font-medium leading-relaxed text-xs">{item.description}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-12 text-slate-400 font-black uppercase tracking-[0.2em] text-[8px]">
                                Generating Plan...
                              </div>
                            )}

                            <div className="mt-8 p-4 bg-slate-900 rounded-2xl text-white shadow-xl shadow-slate-900/10 max-w-2xl">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/5">
                                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Clinical Protocol</p>
                              </div>
                              <p className="text-[11px] font-medium leading-relaxed text-slate-400">Please follow these suggestions in coordination with your primary healthcare provider for optimal results.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700">
                        <div className="bg-white rounded-[3rem] p-10 sm:p-16 shadow-[0_20px_70px_-15px_rgba(0,0,0,0.1)] border border-slate-200/60 flex flex-col items-center text-center w-full relative overflow-hidden group">
                          {/* Background Decorative Element */}
                          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700"></div>

                          <div className="relative mb-8">
                            <div className="w-20 h-20 bg-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-2xl relative z-10 group-hover:rotate-12 transition-transform duration-500">
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <div className="absolute inset-0 bg-slate-900/20 blur-3xl -z-0 scale-75"></div>
                          </div>

                          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2 tracking-tight uppercase flex flex-col gap-1 sm:gap-2">
                            <span>{reportData?.analysis ? 'No Issues' : 'Please select report for'}</span>
                            <span className="text-blue-600">{reportData?.analysis ? 'Identified' : 'Suggestion'}</span>
                          </h2>

                          <p className="text-slate-400 font-medium text-xs sm:text-sm leading-relaxed max-w-md mb-8">
                            {reportData?.analysis
                              ? 'Our diagnostic review did not find any specific conditions or action items for this report. Your clinical parameters look stable.'
                              : 'We are currently synthesizing your medical data to provide personalized clinical suggestions and a health improvement plan.'}
                          </p>

                          {/* Micro-interaction indicator */}
                          <div className="flex items-center gap-2 text-slate-300">
                            <div className={`w-2 h-2 rounded-full ${reportData?.analysis ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`}></div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                              {reportData?.analysis ? 'Insight Complete' : 'Synthesizing Data'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700">
                <div className="bg-white rounded-[3rem] p-10 sm:p-16 shadow-[0_20px_70px_-15px_rgba(0,0,0,0.1)] border border-slate-200/60 flex flex-col items-center text-center w-full relative overflow-hidden group">
                  {/* Background Decorative Element */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700"></div>

                  <div className="relative mb-8">
                    <div className="w-20 h-20 bg-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-2xl relative z-10 group-hover:rotate-12 transition-transform duration-500">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="absolute inset-0 bg-slate-900/20 blur-3xl -z-0 scale-75"></div>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2 tracking-tight uppercase flex flex-col gap-1 sm:gap-2">
                    <span>Please Select Report</span>
                    <span className="text-blue-600">For Analysis</span>
                  </h2>

                  <p className="text-slate-400 font-medium text-xs sm:text-sm leading-relaxed max-w-md mb-8">
                    Select a report from the selector above to unlock deep medical insights.
                    If you've just uploaded a report, we're currently extracting the data using AI.
                  </p>

                  {/* Micro-interaction indicator */}
                  <div className="flex items-center gap-2 text-slate-300">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Awaiting Selection</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!hasReports && !isLoading && (
          <div className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-700 py-12 sm:py-20">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-xl border border-blue-100/50 group-hover:scale-105 transition-transform">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-800 uppercase tracking-tight mb-4">Start Your Journey</h2>
            <p className="text-slate-500 max-w-md mx-auto font-medium leading-relaxed mb-12">Upload your first medical report to unlock clinical insights, diagnostic risk assessment, and longitudinal health tracking.</p>
            <a href="/upload" className="px-10 py-5 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl hover:bg-black hover:scale-105 active:scale-95 transition-all">
              Upload Report
            </a>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default HealthInsights;
