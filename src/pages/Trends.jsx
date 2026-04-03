import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const TrendAnalysis = () => {
  const [hasReports, setHasReports] = useState(false);
  const [extractedMedicalData, setExtractedMedicalData] = useState([]);
  const [selectedReports, setSelectedReports] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTestName, setSelectedTestName] = useState('');
  const [viewMode, setViewMode] = useState('single'); // 'single' or 'trends'
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUserReports(currentUser.uid);
    } else if (auth.currentUser === null) {
      setIsLoading(false);
    }
  }, [currentUser]);

  const fetchUserReports = async (userId) => {
    setIsLoading(true);
    try {
      // Fetch all reports without complex ordering that might silently filter out docs missing fields
      const q = query(collection(db, 'users', userId, 'reports'));
      const snapshot = await getDocs(q);

      const fetchedReports = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        let labReport = [];
        let status = data.status || 'Pending';

        if (data.analysis && typeof data.analysis === 'object') {
          const rawLabReport = data.analysis.lab_report || [];

          // MAP n8n standard keys (test_name, result, flag) to frontend keys (testName, testValue, status)
          labReport = rawLabReport.map(item => ({
            testName: item.test_name || item.parameter || item.testName || 'Unknown',
            testValue: item.result || item.value || item.testValue || '0',
            units: item.unit || item.units || '',
            referenceRange: item.reference_range || item.referenceRange || 'N/A',
            status: item.flag || item.status || 'Normal'
          }));

          return {
            id: docSnap.id,
            reportName: data.name,
            reportDate: data.date,
            medicalData: labReport,
            hasAnalysis: true,
            status: status === 'Pending' ? 'Analyzed' : status,
            overallHealth: data.analysis.overall_health || null,
            totalTests: data.analysis.total_tests || labReport.length,
            totalAbnormals: data.analysis.total_abnormals || labReport.filter(t => {
              const s = (t.status || '').toLowerCase();
              return s !== 'normal' && s !== '';
            }).length
          };
        }

        return {
          id: docSnap.id,
          reportName: data.name,
          reportDate: data.date,
          medicalData: [],
          hasAnalysis: false,
          status: status,
          overallHealth: null,
          totalAbnormals: 0,
          totalTests: 0
        };
      });

      // Sort fetched reports client-side to ensure nothing is filtered out by Firestore index issues
      let finalReports = fetchedReports.sort((a, b) => {
        const dateA = a.reportDate ? new Date(a.reportDate) : new Date(0);
        const dateB = b.reportDate ? new Date(b.reportDate) : new Date(0);
        return dateA - dateB;
      });

      // Add disambiguation suffixes for reports with identical names and dates
      finalReports = finalReports.map((report, idx) => {
        const matches = finalReports.filter(r => r.reportName === report.reportName && r.reportDate === report.reportDate);
        if (matches.length > 1) {
          const subIdx = finalReports.slice(0, idx + 1).filter(r => r.reportName === report.reportName && r.reportDate === report.reportDate).length;
          return { ...report, displayName: `${report.reportName} (${report.reportDate}) #${subIdx}` };
        }
        return { ...report, displayName: `${report.reportName} (${report.reportDate})` };
      });

      setExtractedMedicalData(finalReports);
      setHasReports(finalReports.length > 0);
      if (finalReports.length > 0) {
        setSelectedReports([finalReports[finalReports.length - 1]]);
      }
    } catch (err) {
      console.error('Error fetching user reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'normal' || s === 'optimal') {
      return { bg: '#dcfce7', text: '#16a34a', label: 'Normal', icon: '✓' };
    }
    if (s === 'borderline' || s === 'low' || s === 'high' || s === 'warning') {
      return { bg: '#fef3c7', text: '#d97706', label: s.toUpperCase(), icon: '⚠' };
    }
    if (s === 'abnormal' || s === 'critical' || s === 'dangerous') {
      return { bg: '#fee2e2', text: '#dc2626', label: s.toUpperCase(), icon: '✗' };
    }
    return { bg: '#f3f4f6', text: '#6b7280', label: status || 'Unknown', icon: '?' };
  };

  const allTestNames = [...new Set(
    extractedMedicalData.flatMap(r => (r.medicalData || []).map(t => t.testName))
  )];

  useEffect(() => {
    if (allTestNames.length > 0 && !selectedTestName) {
      setSelectedTestName(allTestNames[0]);
    }
  }, [extractedMedicalData.length, allTestNames]);

  const latestReport = selectedReports[selectedReports.length - 1];

  // Automatic View Switching based on selection count (Only when count definitively changes)
  const prevCount = useRef(0);
  useEffect(() => {
    if (selectedReports.length === 0) return;

    if (selectedReports.length !== prevCount.current) {
      if (selectedReports.length > 1) {
        setViewMode('trends');
      } else if (selectedReports.length === 1 && prevCount.current === 0) {
        // Only force 'single' if we are coming from zero selection 
        // to avoid overriding manual toggle when count is already 1
        setViewMode('single');
      }
      prevCount.current = selectedReports.length;
    }
  }, [selectedReports.length]);

  const toggleReportSelection = (report) => {
    setSelectedReports(prev => {
      const isSelected = prev.some(r => r.id === report.id);
      if (isSelected) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter(r => r.id !== report.id);
      } else {
        return [...prev, report].sort((a, b) => {
          const dateA = a.reportDate ? new Date(a.reportDate) : new Date(0);
          const dateB = b.reportDate ? new Date(b.reportDate) : new Date(0);
          return dateA - dateB;
        });
      }
    });
  };

  const chartLineData = selectedTestName ? extractedMedicalData
    .filter(report => selectedReports.some(sr => sr.id === report.id)) // Filter by selection
    .filter(report => report.medicalData?.some(t => t.testName === selectedTestName))
    .map(report => {
      const test = report.medicalData.find(t => t.testName === selectedTestName);
      return { name: report.reportDate, value: parseFloat(test.testValue) };
    }) : [];

  const renderSingleReportView = () => {
    const activeReport = selectedReports[0];
    if (!activeReport) return null;
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 border border-slate-100">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Tests</p>
            </div>
            <p className="text-4xl font-black text-slate-800 mt-2">{activeReport.medicalData?.length || 0}</p>
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow border-b-4 border-b-emerald-400">
            <div>
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 border border-emerald-100">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Low Risk</p>
            </div>
            <p className="text-4xl font-black text-emerald-600 mt-2">{activeReport.medicalData?.filter(t => (t.status || '').toLowerCase() === 'normal').length || 0}</p>
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow border-b-4 border-b-amber-400">
            <div>
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-4 border border-amber-100">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medium Risk</p>
            </div>
            <p className="text-4xl font-black text-amber-600 mt-2">{activeReport.medicalData?.filter(t => (t.status || '').toLowerCase() === 'borderline' || (t.status || '').toLowerCase() === 'warning').length || 0}</p>
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow border-b-4 border-b-red-400">
            <div>
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mb-4 border border-red-100">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">High Risk</p>
            </div>
            <p className="text-4xl font-black text-red-600 mt-2">{activeReport.medicalData?.filter(t => (t.status || '').toLowerCase() === 'abnormal' || (t.status || '').toLowerCase() === 'critical' || (t.status || '').toLowerCase() === 'dangerous').length || 0}</p>
          </div>
        </div>

        {!activeReport.hasAnalysis ? (
          <div className="bg-white rounded-[2rem] p-16 text-center border border-slate-100 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-cyan-500/20">
              <div className="h-full bg-cyan-500 animate-progress w-2/3"></div>
            </div>
            <div className="w-20 h-20 bg-cyan-50 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm">
              <svg className="w-10 h-10 text-cyan-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-4">Deep Extraction in Progress</h2>
            <p className="text-slate-500 max-w-md mx-auto font-medium leading-relaxed mb-8">
              We're using AI to extract medical data from your report. This usually takes 30-60 seconds.
            </p>

            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => fetchUserReports(currentUser.uid)}
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Refresh Data
              </button>
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.3s]"></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Full Report Analysis</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">{activeReport.reportName} — {activeReport.reportDate}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              {activeReport.medicalData.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="text-left bg-white">
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Parameter</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Result</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference Range</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {activeReport.medicalData.map((test, idx) => {
                      const statusDetails = getStatusBadge(test.status);
                      const history = extractedMedicalData
                        .filter(r => r.medicalData?.some(t => t.testName === test.testName))
                        .map(r => ({ value: parseFloat(r.medicalData.find(t => t.testName === test.testName).testValue) }))
                        .slice(-5);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-6">
                            <span className="text-sm font-bold text-slate-700 block transition-colors">{test.testName}</span>
                          </td>
                          <td className="px-6 py-6 font-black text-slate-800 text-lg">{test.testValue}</td>
                          <td className="px-6 py-6 text-xs font-bold text-slate-500 uppercase">{test.units || '—'}</td>
                          <td className="px-6 py-6 text-xs font-bold text-slate-400">{test.referenceRange || 'N/A'}</td>
                          <td className="px-6 py-6 text-left">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border" style={{ backgroundColor: statusDetails.bg, color: statusDetails.text, borderColor: statusDetails.text + '20' }}>
                              {statusDetails.icon} {statusDetails.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-16 text-center">
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No structured parameters found in this analysis</p>
                  {activeReport.textAnalysis && (
                    <div className="mt-8 p-6 bg-slate-50 rounded-2xl text-left border border-slate-100 italic text-slate-600 text-sm leading-relaxed">
                      {activeReport.textAnalysis}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTrendsView = () => {
    const parseRange = (refStr) => {
      if (!refStr) return null;
      const clean = refStr.replace(/[^0-9.\-<>]/g, ' ').trim();
      if (clean.includes('-')) {
        const [min, max] = clean.split('-').map(v => parseFloat(v));
        return { min, max };
      }
      if (clean.startsWith('<')) return { min: 0, max: parseFloat(clean.slice(1)) };
      if (clean.startsWith('>')) {
        const min = parseFloat(clean.slice(1));
        return { min, max: min * 2 };
      }
      return null;
    };

    const getFluctuation = (p) => {
      const val = parseFloat(p.testValue);
      const ref = parseRange(p.referenceRange);
      if (!isNaN(val) && ref) {
        if (val > ref.max) return Math.min(((val - ref.max) / ref.max) * 100, 100);
        else if (val < ref.min) return Math.max(((val - ref.min) / (ref.min || 1)) * 100, -100);
      }
      return p.status === 'Abnormal' ? 50 : p.status === 'Normal' ? 0 : 25;
    };

    let fluctuationData = [];
    const isComparison = selectedReports.length > 1;

    if (!isComparison) {
      // Logic for 1 report: Show ALL parameters
      fluctuationData = (latestReport?.medicalData || []).map(p => ({
        name: (p.testName || 'Test').substring(0, 12),
        fullName: p.testName || 'Test',
        value: getFluctuation(p),
        originalValue: p.testValue,
        unit: p.units || '',
        status: p.status,
        refRange: p.referenceRange || 'N/A'
      }));
    } else {
      // Logic for 2+ reports: Show COMPARISON
      const r1 = selectedReports[selectedReports.length - 2]; // Previous
      const r2 = selectedReports[selectedReports.length - 1]; // Latest

      // Get all unique parameters from both reports
      const allParams = [...new Set([
        ...(r1.medicalData || []).map(t => t.testName),
        ...(r2.medicalData || []).map(t => t.testName)
      ])];

      fluctuationData = allParams.map(name => {
        const p1 = r1.medicalData.find(t => t.testName === name);
        const p2 = r2.medicalData.find(t => t.testName === name);

        return {
          name: name.substring(0, 12),
          fullName: name,
          val1: p1 ? getFluctuation(p1) : null,
          val2: p2 ? getFluctuation(p2) : null,
          report1: p1 ? { val: p1.testValue, unit: p1.units } : null,
          report2: p2 ? { val: p2.testValue, unit: p2.units } : null,
          ref1: p1?.referenceRange || 'N/A',
          ref2: p2?.referenceRange || 'N/A'
        };
      }).filter(d => d.val1 !== null || d.val2 !== null).slice(0, 20);
    }

    const isImproving = selectedReports.length > 1 && (
      (selectedReports[selectedReports.length - 1].totalAbnormals <= selectedReports[0].totalAbnormals)
    );

    return (
      <div className="space-y-12 animate-in slide-in-from-bottom duration-700">
        {selectedReports.length > 1 && (
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg text-white ${isImproving ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                {isImproving ? (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                ) : (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                )}
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Comparative Analysis</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Latest vs. Baseline Progress</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Warnings</p>
                <p className="text-2xl font-black text-slate-800">{latestReport.totalAbnormals}</p>
              </div>
              <div className="px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Difference</p>
                <p className={`text-2xl font-black ${isImproving ? 'text-emerald-500' : 'text-red-500'}`}>
                  {latestReport.totalAbnormals - selectedReports[0].totalAbnormals > 0 ? '+' : ''}{latestReport.totalAbnormals - selectedReports[0].totalAbnormals}
                </p>
              </div>
            </div>
          </div>
        )}

        {fluctuationData.length > 0 ? (
          <div className="bg-slate-50 rounded-[3rem] p-6 lg:p-10 border border-slate-100/50 shadow-inner">
            <div className="bg-white rounded-[2.5rem] p-8 lg:p-12 shadow-2xl border border-slate-100 transition-all">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg text-white">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">Health Fluctuation Profile</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                      {isComparison ? `Comparison: ${selectedReports[selectedReports.length - 2].reportDate} vs ${selectedReports[selectedReports.length - 1].reportDate}` : `All Parameters (Latest: ${latestReport?.reportDate})`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  {isComparison ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Baseline</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Latest</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 rounded-full bg-red-400"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">High Risk</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 rounded-full bg-slate-200"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Low Risk</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 rounded-full bg-blue-400"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Medium Risk</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={fluctuationData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                        <stop offset="50%" stopColor="#ef4444" stopOpacity={0} />
                        <stop offset="50%" stopColor="#3b82f6" stopOpacity={0} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.4} />
                      </linearGradient>
                      <linearGradient id="colorComparison" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9, fontBold: '900' }} dy={10} />
                    <YAxis domain={[-100, 100]} hide />
                    <Tooltip
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          if (isComparison) {
                            return (
                              <div className="bg-slate-900 border-none rounded-2xl p-6 shadow-2xl ring-1 ring-white/10 max-w-xs">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{data.fullName}</p>
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between gap-8">
                                    <div>
                                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Baseline</p>
                                      <p className="text-xl font-black text-white">{data.report1?.val || '—'} <span className="text-[10px] text-slate-400">{data.report1?.unit}</span></p>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400">{data.val1 !== null ? `${Math.round(data.val1)}%` : '—'}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-8">
                                    <div>
                                      <p className="text-[8px] font-black text-cyan-500 uppercase tracking-widest mb-1">Latest</p>
                                      <p className="text-xl font-black text-white">{data.report2?.val || '—'} <span className="text-[10px] text-slate-400">{data.report2?.unit}</span></p>
                                    </div>
                                    <span className="text-[10px] font-black text-cyan-500">{data.val2 !== null ? `${Math.round(data.val2)}%` : '—'}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          const isHigh = data.value > 0;
                          return (
                            <div className="bg-slate-900 border-none rounded-2xl p-6 shadow-2xl ring-1 ring-white/10">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{data.fullName}</p>
                              <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-3xl font-black text-white">{data.originalValue}</span>
                                <span className="text-xs font-bold text-slate-400 leading-none">{data.unit}</span>
                              </div>
                              <div className="pt-4 border-t border-white/5 space-y-3">
                                <div className="flex items-center justify-between gap-6">
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Fluctuation:</span>
                                  <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${isHigh ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                                    {isHigh ? '↑' : '↓'} {Math.abs(Math.round(data.value))}%
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-6">
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ref Range:</span>
                                  <span className="text-[10px] font-black text-white">{data.refRange}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" label={{ position: 'top', value: 'NORMAL', fill: '#94a3b8', fontSize: 8, fontBold: '900' }} />
                    {isComparison ? (
                      <>
                        <Area type="monotone" dataKey="val1" stroke="#cbd5e1" strokeWidth={2} fillOpacity={0.1} fill="#cbd5e1" dot={{ r: 4, fill: '#cbd5e1', strokeWidth: 0 }} />
                        <Area type="monotone" dataKey="val2" stroke="#06b6d4" strokeWidth={4} fillOpacity={1} fill="url(#colorComparison)" dot={{ r: 6, fill: '#06b6d4', strokeWidth: 3, stroke: '#fff' }} activeDot={{ r: 8, fill: '#06b6d4', strokeWidth: 0 }} />
                      </>
                    ) : (
                      <Area type="monotone" dataKey="value" stroke="#1e293b" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" dot={{ r: 6, fill: '#1e293b', strokeWidth: 3, stroke: '#fff' }} activeDot={{ r: 10, fill: '#1e293b', strokeWidth: 0 }} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-[3rem] p-16 text-center border border-slate-100 shadow-inner">
            <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Stability Detected</h2>
            <p className="text-slate-400 max-w-md mx-auto">All medical parameters are within optimal ranges for the selected report.</p>
          </div>
        )}

        {allTestNames.length > 0 && (
          <div className="bg-white rounded-[2.5rem] p-8 lg:p-12 shadow-xl border border-slate-100 group transition-all">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-12">
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-tight">{selectedTestName} History</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Longitudinal parameter tracking</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Metric:</span>
                <select
                  value={selectedTestName}
                  onChange={(e) => setSelectedTestName(e.target.value)}
                  className="px-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-700 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 shadow-sm transition-all"
                >
                  {allTestNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="h-[400px] w-full">
              {chartLineData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartLineData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="10 10" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontBold: '900' }} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontBold: '900' }} domain={['auto', 'auto']} />
                    <Tooltip
                      cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }}
                      contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '24px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }}
                      itemStyle={{ color: '#38bdf8', fontWeight: '900', fontSize: '24px' }}
                      labelStyle={{ color: '#94a3b8', fontWeight: '900', fontSize: '12px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '2px' }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={6} dot={{ fill: '#0ea5e9', r: 8, strokeWidth: 4, stroke: '#fff' }} activeDot={{ r: 12, strokeWidth: 0, fill: '#1E293B' }} animationDuration={2000} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  </div>
                  <p className="font-black text-slate-600 uppercase tracking-widest text-xs">Additional data required for trend visualization</p>
                  <p className="text-slate-400 text-[10px] mt-1 font-bold">Please upload more reports containing this parameter</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 border-4 border-cyan-100 border-t-cyan-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">Loading your reports...</p>
        </div>
      </Layout>
    );
  }

  if (!hasReports) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto pb-24 space-y-8">
          <div className="rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden" style={{ backgroundColor: '#263B6A' }}>
            <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">Trend Analysis</h1>
            <p className="text-cyan-200 text-lg font-bold opacity-80 uppercase tracking-widest">No reports detected in your profile</p>
          </div>
          <div className="bg-slate-50 rounded-[3rem] p-24 text-center border border-slate-100 shadow-inner">
            <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
              <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            </div>
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-4">Start Your Health Journey</h2>
            <p className="text-slate-400 max-w-lg mx-auto mb-10 font-medium">Upload your first medical report to unlock AI-powered insights, fluctuation profiles, and longitudinal trend analysis.</p>
            <Link to="/upload-report" className="inline-flex items-center gap-4 px-12 py-5 bg-cyan-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-cyan-700 transition-all shadow-xl shadow-cyan-900/20">
              Upload First Report
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto pb-24 space-y-12">
        {/* Dynamic Header */}
        {/* Standardized Header */}
        <div className="rounded-3xl p-8 text-white mb-6 shadow-xl relative overflow-hidden" style={{ backgroundColor: '#263B6A' }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg border border-white/10">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1 tracking-tight">Trend Analysis</h1>
                <p className="text-cyan-100 text-lg opacity-90 leading-tight">Longitudinal Health Intelligence</p>
              </div>
            </div>

            {/* View Mode Switcher */}
            <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
              <button
                onClick={() => setViewMode('single')}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'single' ? 'bg-white text-[#263B6A] shadow-xl' : 'text-white/60 hover:text-white'}`}
              >
                Analysis
              </button>
              <button
                onClick={() => setViewMode('trends')}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'trends' ? 'bg-white text-[#263B6A] shadow-xl' : 'text-white/60 hover:text-white'}`}
              >
                Fluctuations
              </button>
            </div>
          </div>
        </div>

        {/* New Selector Card Section */}
        <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100 mb-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 flex items-center justify-center border border-cyan-100 text-cyan-600 shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3zM12 7v10M8 12h8" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-black text-cyan-600 uppercase tracking-widest leading-none mb-1">Source Dataset</p>
                <p className="text-xs text-gray-500 font-medium">Select an uploaded report for analysis</p>
              </div>
            </div>

            <div className="relative w-full lg:w-96">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full bg-gray-50 border-2 border-gray-100 text-gray-700 py-3.5 px-6 rounded-2xl font-bold text-sm shadow-sm flex items-center justify-between outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all cursor-pointer"
              >
                <span className="truncate">
                  {selectedReports.length === 1
                    ? selectedReports[0].displayName
                    : `${selectedReports.length} Reports Selected`}
                </span>
                <svg className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="max-h-64 overflow-y-auto py-2">
                    {extractedMedicalData.map(report => {
                      const isSelected = selectedReports.some(sr => sr.id === report.id);
                      return (
                        <div
                          key={report.id}
                          onClick={() => toggleReportSelection(report)}
                          className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 cursor-pointer group transition-colors"
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-cyan-600 border-cyan-600' : 'border-gray-300 group-hover:border-cyan-400'}`}>
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>{report.reportName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{report.reportDate}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-2 border-t border-slate-50 bg-slate-50 flex justify-end">
                    <button
                      onClick={() => setIsDropdownOpen(false)}
                      className="px-4 py-1.5 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-700 transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="relative min-h-[400px]">
          {viewMode === 'single' ? renderSingleReportView() : renderTrendsView()}
        </div>

        {extractedMedicalData.length === 1 && viewMode === 'trends' && (
          <div className="bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden text-center max-w-3xl mx-auto mt-8 relative z-20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10">
              <h3 className="text-xl font-black uppercase mb-4 tracking-tighter">Comparative Trends Logic</h3>
              <p className="text-slate-400 font-bold text-sm mb-8 leading-relaxed px-10">
                You're viewing the fluctuation profile for your single report. To see progress over time, upload your next medical document!
              </p>
              <Link to="/upload-report" className="inline-flex items-center gap-3 px-10 py-5 bg-cyan-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-cyan-700 transition-all shadow-xl shadow-cyan-900/40">
                Upload Next Report
              </Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TrendAnalysis;
