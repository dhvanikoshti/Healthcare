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

  const hasReports = !!reportData;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setCurrentUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchReport = async () => {
      if (!currentUser) { setIsLoading(false); return; }
      try {
        let data = null;
        if (reportId) {
          const snap = await getDoc(doc(db, 'users', currentUser.uid, 'reports', reportId));
          if (snap.exists()) data = snap.data();
        } else {
          const q = query(collection(db, 'users', currentUser.uid, 'reports'), orderBy('createdAt', 'desc'), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) data = snap.docs[0].data();
        }
        if (data) {
          setReportData(data);
          const adviceColors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];
          const analysis = data.analysis || {};

          console.log('🔍 Health Insights - Analysis keys:', Object.keys(analysis));

          // Flexible key search for risks
          const risksRaw = analysis.risks || analysis.risk_assessment || analysis.risk || analysis.health_risks || [];
          const mappedRisks = (Array.isArray(risksRaw) ? risksRaw : []).map((risk, i) => {
            let status = 'Normal', score = 25;
            const sev = (risk.severity || risk.level || risk.risk_level || '').toUpperCase();
            if (sev === 'HIGH' || sev === 'CRITICAL') { status = 'Critical'; score = 85; }
            else if (sev === 'MEDIUM' || sev === 'MODERATE') { status = 'Borderline'; score = 60; }
            return {
              id: i + 1, name: risk.risk_name || risk.name || risk.title || risk.condition || `Risk ${i + 1}`,
              score, status, description: risk.reason || risk.description || risk.detail || risk.explanation || '',
              icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
            };
          });
          setRiskData(mappedRisks);

          // Flexible key search for diagnosis/abnormal parameters
          const diagRaw = analysis.abnormal_parameters || analysis.diagnosis || analysis.diagnoses || analysis.findings || analysis.abnormalities || [];
          const mappedDiag = (Array.isArray(diagRaw) ? diagRaw : []).map((p, i) => ({
            id: i + 1,
            title: p.test_name ? `${p.test_name} Flagged as ${p.flag || 'Abnormal'}` : (p.title || p.name || p.finding || `Finding ${i + 1}`),
            status: (p.flag || p.status || p.severity || '').toLowerCase().includes('high') ? 'critical' : 'warning',
            description: p.result ? `Result: ${p.result} ${p.unit || ''}. Reference range is ${p.reference_interval || 'N/A'}.` : (p.description || p.detail || p.explanation || ''),
            icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
          }));
          setDiagnoses(mappedDiag);

          // Flexible key search for advice
          const rawAdvice = analysis.advice || analysis.recommendations || analysis.suggestions || analysis.health_advice || analysis.tips || [];
          let mappedAdvice = [];
          
          if (Array.isArray(rawAdvice) && rawAdvice.length > 0) {
            mappedAdvice = rawAdvice.map((item, i) => {
              if (typeof item === 'string') return { id: i + 1, title: item.length > 60 ? item.slice(0, 60) + '...' : item, description: item, color: adviceColors[i % adviceColors.length] };
              return { id: i + 1, title: item.title || item.name || item.recommendation || `Advice ${i + 1}`, description: item.description || item.detail || item.text || item.explanation || '', color: adviceColors[i % adviceColors.length] };
            });
          }

          // If no explicit advice, generate it from abnormal parameters (personalized)
          if (mappedAdvice.length === 0 && (mappedDiag.length > 0 || mappedRisks.length > 0)) {
            console.log('📝 Generating advice from findings...');
            
            // Priority 1: High Risks from Risk Assessment
            const highRisks = mappedRisks.filter(r => r.status === 'Critical');
            highRisks.forEach((risk, i) => {
              mappedAdvice.push({
                id: mappedAdvice.length + 1,
                title: `Action Required: ${risk.name}`,
                description: `High risk detected. ${risk.description} Immediate consultation with a healthcare professional is strongly advised to discuss specific management for ${risk.name}.`,
                color: '#ef4444' // Red for high risk
              });
            });

            // Priority 2: Abnormal Parameters grouped by category
            const adviceMap = {
              'H': { prefix: 'Elevated', action: 'Lowering' },
              'L': { prefix: 'Reduced', action: 'Improving' },
              'High': { prefix: 'Elevated', action: 'Lowering' },
              'Low': { prefix: 'Reduced', action: 'Improving' }
            };

            const byCategory = {};
            diagRaw.forEach(p => {
              const cat = p.category || 'General Health';
              if (!byCategory[cat]) byCategory[cat] = [];
              byCategory[cat].push(p);
            });

            Object.entries(byCategory).forEach(([category, params], i) => {
              // Only generate advice for categories that haven't been covered by high risks already
              if (mappedAdvice.some(a => a.title.toLowerCase().includes(category.toLowerCase()))) return;

              const highFlags = params.filter(p => (p.flag || '').toUpperCase() === 'H' || (p.flag || '').toLowerCase().includes('high'));
              const flaggedItems = params.map(p => p.test_name || p.name).join(', ');
              const isHigh = highFlags.length > 0;
              
              mappedAdvice.push({
                id: mappedAdvice.length + 1,
                title: `${category} Management`,
                description: `${isHigh ? 'Elevated' : 'Abnormal'} levels found in: ${flaggedItems}. ${isHigh ? 'Your risk assessment for this diagnosis is elevated. ' : ''}Regular monitoring and lifestyle adjustments are recommended for ${isHigh ? 'lowering' : 'managing'} these metrics.`,
                color: isHigh ? '#ef4444' : adviceColors[(i + highRisks.length) % adviceColors.length]
              });
            });
          }

          // If text_analysis exists and no structured data found, parse text into sections
          if (mappedRisks.length === 0 && mappedDiag.length === 0 && mappedAdvice.length === 0 && analysis.text_analysis) {
            console.log('📝 Parsing text_analysis into sections...');
            const text = analysis.text_analysis;

            // Parse bullet points or numbered items as advice
            const lines = text.split('\n').filter(l => l.trim());
            const bulletItems = lines.filter(l => /^[\s]*[-•*\d+.)]/.test(l)).map(l => l.replace(/^[\s]*[-•*\d+.)]\s*/, '').trim());

            if (bulletItems.length > 0) {
              mappedAdvice = bulletItems.map((item, i) => ({
                id: i + 1,
                title: item.length > 80 ? item.slice(0, 80) + '...' : item,
                description: item,
                color: adviceColors[i % adviceColors.length]
              }));
            } else {
              // Split text into paragraphs as advice items
              const paragraphs = text.split('\n\n').filter(p => p.trim().length > 20);
              mappedAdvice = paragraphs.slice(0, 6).map((p, i) => ({
                id: i + 1,
                title: p.trim().split('\n')[0].substring(0, 80),
                description: p.trim(),
                color: adviceColors[i % adviceColors.length]
              }));
            }
          }

          setAdvice(mappedAdvice);
        }
      } catch (err) { console.error("Error fetching report:", err); }
      finally { setIsLoading(false); }
    };
    fetchReport();
  }, [currentUser, reportId]);

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
            {/* Header */}
            <div className="rounded-3xl p-6 lg:p-8 mb-8 text-white relative overflow-hidden" style={{ backgroundColor: '#263B6A' }}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl"></div>
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold mb-2">Health Insights</h1>
                  <p className="text-cyan-100 text-lg">Risk Assessment + Diagnosis & Advice</p>
                  {reportData?.name && (
                    <div className="flex items-center gap-4 mt-3 p-3 bg-white/10 rounded-xl">
                      <span className="text-cyan-200 font-medium">{reportData.name} • {reportData.date}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-1 mb-8">
              <div className="flex bg-white rounded-xl overflow-hidden">
                <button onClick={() => setActiveTab('risk')} className={`flex-1 py-4 px-6 font-bold transition-all duration-300 rounded-xl ${activeTab === 'risk' ? 'bg-gray-100 text-[#263B6A] shadow-inner' : 'text-gray-500 hover:text-[#263B6A] hover:bg-gray-50'}`}>
                  🛡️ Risk Assessment
                </button>
                <button onClick={() => setActiveTab('diagnosis')} className={`flex-1 py-4 px-6 font-bold transition-all duration-300 rounded-xl ${activeTab === 'diagnosis' ? 'bg-gray-100 text-[#263B6A] shadow-inner' : 'text-gray-500 hover:text-[#263B6A] hover:bg-gray-50'}`}>
                  🩺 Diagnosis & Advice
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
                        <div key={risk.id} className="bg-white rounded-2xl shadow-lg border-2 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1" style={{ borderColor: statusStyle.border }}>
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
              <div>
                {/* Diagnosis Section */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
                  <div className="px-6 py-4 bg-white border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      Diagnosis
                    </h2>
                  </div>
                  <div className="p-6">
                    {diagnoses.length > 0 ? (
                      <div className="space-y-4">
                        {diagnoses.map((diagnosis) => {
                          const style = getStatusStyle(diagnosis.status);
                          return (
                            <div key={diagnosis.id} className="flex items-start gap-4 p-4 rounded-xl transition-all duration-200 border" style={{ backgroundColor: '#FFFFFF', borderColor: style.border }}>
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100 shadow-sm" style={{ backgroundColor: 'white' }}>
                                <svg className="w-5 h-5" style={{ color: style.iconBg }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={diagnosis.icon} /></svg>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-800 mb-1" style={{ color: style.text }}>{diagnosis.title}</h4>
                                <p className="text-sm mt-1" style={{ color: '#4b5563' }}>{diagnosis.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <p className="font-medium">{reportData?.analysis ? 'No abnormal parameters found in this report.' : 'Analysis pending — diagnosis will appear once processing completes.'}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Advice Section */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
                  <div className="px-6 py-4 bg-white border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      Personalized Advice
                    </h2>
                  </div>
                  <div className="p-6">
                    {advice.length > 0 ? (
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
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <p className="font-medium">{reportData?.analysis ? 'No personalized advice available for this report.' : 'Advice will appear once report analysis completes.'}</p>
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
