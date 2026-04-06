import { useState, useEffect, useRef } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ReferenceLine, ComposedChart, ReferenceArea, LabelList, Bar, BarChart, Cell } from 'recharts';
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
  const [viewMode, setViewMode] = useState('single'); // 'single' or 'trends'
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedTrajectoryParam, setSelectedTrajectoryParam] = useState(null);

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
            reportName: data.name || data.analysis?.report_name || 'Lab Report',
            reportDate: data.analysis?.report_date || data.analysis?.reportDate || data.report_date || data.reportDate || data.analysis?.date || data.date,
            category: (data.category || data.analysis?.report_category || data.analysis?.report_type || data.analysis?.category || data.analysis?.type || 'Blood Test').toString().trim(),
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
          reportName: data.name || 'Lab Report',
          reportDate: data.report_date || data.date,
          category: (data.category || 'Uncategorized').toString().trim(),
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
    // In single/analysis mode → replace selection; in fluctuations mode → multi-select
    if (viewMode === 'single') {
      setSelectedReports([report]);
      setIsDropdownOpen(false);
      return;
    }

    setSelectedReports(prev => {
      const isSelected = prev.some(r => r.id === report.id);
      if (isSelected) {
        if (prev.length === 1) return prev; // always keep at least one
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



  const renderSingleReportView = () => {
    const activeReport = selectedReports[0];
    if (!activeReport) return null;
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] py-4 px-6 shadow-xl shadow-slate-900/5 border border-slate-100 flex flex-col justify-between hover:scale-[1.02] hover:shadow-cyan-500/5 transition-all duration-500 border-b-4 border-b-cyan-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-cyan-100/50 rounded-xl flex items-center justify-center border border-cyan-200/50 shadow-inner group-hover:rotate-12 transition-transform">
                  <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <p className="text-[10px] font-black text-cyan-700/60 uppercase tracking-[0.2em]">Total Tests</p>
              </div>
            </div>
            <p className="text-3xl font-black text-slate-800 relative z-10 tracking-tighter group-hover:translate-x-1 transition-transform">{activeReport.medicalData?.length || 0}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] py-4 px-6 shadow-xl shadow-slate-900/5 border border-slate-100 flex flex-col justify-between hover:scale-[1.02] hover:shadow-emerald-500/5 transition-all duration-500 border-b-4 border-b-emerald-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-emerald-100/50 rounded-xl flex items-center justify-center border border-emerald-200/50 shadow-inner group-hover:rotate-12 transition-transform">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-[10px] font-black text-emerald-700/60 uppercase tracking-[0.2em]">Low Risk</p>
              </div>
            </div>
            <p className="text-3xl font-black text-emerald-600 relative z-10 tracking-tighter group-hover:translate-x-1 transition-transform">{activeReport.medicalData?.filter(t => (t.status || '').toLowerCase() === 'normal' || (t.status || '').toLowerCase() === 'optimal').length || 0}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] py-4 px-6 shadow-xl shadow-slate-900/5 border border-slate-100 flex flex-col justify-between hover:scale-[1.02] hover:shadow-amber-500/5 transition-all duration-500 border-b-4 border-b-amber-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-amber-100/50 rounded-xl flex items-center justify-center border border-amber-200/50 shadow-inner group-hover:rotate-12 transition-transform">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <p className="text-[10px] font-black text-amber-700/60 uppercase tracking-[0.2em]">Medium Risk</p>
              </div>
            </div>
            <p className="text-3xl font-black text-amber-600 relative z-10 tracking-tighter group-hover:translate-x-1 transition-transform">{activeReport.medicalData?.filter(t => ['borderline', 'low', 'high', 'warning'].includes((t.status || '').toLowerCase())).length || 0}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] py-4 px-6 shadow-xl shadow-slate-900/5 border border-slate-100 flex flex-col justify-between hover:scale-[1.02] hover:shadow-red-500/5 transition-all duration-500 border-b-4 border-b-red-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-red-100/50 rounded-xl flex items-center justify-center border border-red-200/50 shadow-inner group-hover:rotate-12 transition-transform">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-[10px] font-black text-red-700/60 uppercase tracking-[0.2em]">High Risk</p>
              </div>
            </div>
            <p className="text-3xl font-black text-red-600 relative z-10 tracking-tighter group-hover:translate-x-1 transition-transform">{activeReport.medicalData?.filter(t => ['abnormal', 'critical', 'dangerous'].includes((t.status || '').toLowerCase())).length || 0}</p>
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
    // ── 0. Require at least 1 selected report ────────────────────────────────
    if (selectedReports.length < 1) {
      return (
        <div className="bg-slate-50 rounded-[3rem] p-4 lg:p-6 border border-slate-100/50 shadow-inner">
          <div className="bg-white rounded-[2.5rem] p-12 text-center shadow-xl border border-slate-100 transition-all">
            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-blue-100/50">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-3">Select a Report</h2>
            <p className="text-slate-500 max-w-sm mx-auto font-medium text-sm leading-relaxed">
              Please select at least <strong>one report</strong> from the dataset selector above to view health fluctuations.
            </p>
          </div>
        </div>
      );
    }

    // ── Single-report parameter profile (bar chart) ──────────────────────────
    if (selectedReports.length === 1) {
      const report = selectedReports[0];
      const tests = (report.medicalData || []).filter(m => {
        const val = parseFloat(m.testValue);
        return !isNaN(val) && (m.testName || '').trim() !== '';
      });

      if (tests.length === 0) {
        return (
          <div className="bg-slate-50 rounded-[3rem] p-4 lg:p-6 border border-slate-100/50 shadow-inner">
            <div className="bg-white rounded-[2.5rem] p-12 text-center shadow-xl border border-slate-100 transition-all">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <p className="text-slate-500 font-bold text-sm">No numeric test data found in this report</p>
            </div>
          </div>
        );
      }

      const barData = tests.map(m => {
        const val = parseFloat(m.testValue);
        const refStr = m.referenceRange || '';
        const hasDash = typeof refStr === 'string' && refStr.includes('-');
        const refParts = hasDash ? refStr.split('-') : [];
        const refMin = refParts.length >= 2 ? parseFloat(refParts[0]) : null;
        const refMax = refParts.length >= 2 ? parseFloat(refParts[1]) : null;
        const isHigh = refMax !== null && val > refMax;
        const isLow = refMin !== null && val < refMin;
        return {
          name: m.testName,
          value: val,
          unit: m.units || '',
          refMin,
          refMax,
          refRaw: refStr || 'N/A',
          status: isHigh ? 'High' : isLow ? 'Low' : 'Normal',
          color: isHigh ? '#dc2626' : isLow ? '#d97706' : '#2563eb',
        };
      });

      const normalCount = barData.filter(d => d.status === 'Normal').length;
      const highCount = barData.filter(d => d.status === 'High').length;
      const lowCount = barData.filter(d => d.status === 'Low').length;

      return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
          {/* Summary chips */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Report</p>
              <p className="text-sm font-black text-slate-800 truncate" title={report.reportName}>{report.reportName}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</p>
              <p className="text-sm font-black text-slate-700">{report.reportDate || '—'}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Parameters</p>
              <p className="text-3xl font-black text-blue-600">{tests.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</p>
              <div className="flex items-center gap-2 mt-1">
                {normalCount > 0 && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{normalCount} Normal</span>}
                {highCount > 0 && <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{highCount} High</span>}
                {lowCount > 0 && <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{lowCount} Low</span>}
              </div>
            </div>
          </div>

          {/* Bar chart card */}
          <div className="bg-slate-50 rounded-[3rem] p-4 lg:p-6 border border-slate-100/50 shadow-inner">
            <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 shadow-2xl border border-slate-100">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg text-white shrink-0">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">Parameter Profile</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                      {report.reportName} · {report.reportDate || '—'} · <span className="text-blue-600">{tests.length} Parameters</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-blue-600"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Normal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-red-600"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">High</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-amber-500"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Low</span>
                </div>
              </div>

              {/* Bar Chart */}
              <div style={{ height: Math.max(320, barData.length * 40) }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ top: 10, right: 50, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="5 5" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: '700' }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#334155', fontSize: 10, fontWeight: '700' }}
                      width={120}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-5 shadow-2xl ring-1 ring-black/5 min-w-[160px]">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{d.name}</p>
                              <div className="flex items-baseline gap-2 mb-3">
                                <span className="text-3xl font-black text-slate-900">{d.value}</span>
                                <span className="text-xs font-bold text-slate-500">{d.unit}</span>
                              </div>
                              <div className="pt-3 border-t border-slate-100 space-y-2">
                                <div className="flex items-center justify-between gap-6">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status:</span>
                                  <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${d.status === 'High' ? 'bg-red-500/10 text-red-600' : d.status === 'Low' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                                    {d.status === 'High' ? '▲ High' : d.status === 'Low' ? '▼ Low' : '✓ Normal'}
                                  </span>
                                </div>
                                {d.refRaw && d.refRaw !== 'N/A' && (
                                  <div className="flex items-center justify-between gap-6">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reference:</span>
                                    <span className="text-[10px] font-black text-slate-700">{d.refRaw}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                      {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="right"
                        offset={8}
                        style={{ fill: '#1e293b', fontSize: 11, fontWeight: '900' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Parameter details table */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Parameter Details</p>
                <div className="flex flex-wrap gap-2">
                  {barData.map((d, idx) => {
                    const chipColor = d.status === 'High'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : d.status === 'Low'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    return (
                      <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wide ${chipColor}`}>
                        <span>{d.name}</span>
                        <span className="opacity-60">·</span>
                        <span>{d.value} {d.unit}</span>
                        {d.refRaw !== 'N/A' && <span className="opacity-50">({d.refRaw})</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ── 2. Build unique parameter list (case-insensitive dedup) ────────────────
    // Map lowercase → canonical display name, gathered across all selected reports
    const nameMap = {};
    selectedReports.forEach(r => {
      (r.medicalData || []).forEach(m => {
        const key = (m.testName || '').toLowerCase().trim();
        if (key && !nameMap[key]) nameMap[key] = m.testName;
      });
    });

    // A param is "available" if it exists in at least 2 of the selected reports
    const allParams = Object.entries(nameMap)
      .filter(([key]) =>
        selectedReports.filter(r =>
          r.medicalData.some(m => (m.testName || '').toLowerCase().trim() === key)
        ).length >= 2
      )
      .map(([, displayName]) => displayName);

    // Auto-select first available param if current param is missing/invalid
    const activeParam =
      allParams.find(p => p.toLowerCase().trim() === (selectedTrajectoryParam || '').toLowerCase().trim())
      || allParams[0]
      || null;

    // Sync state without causing infinite loop
    if (activeParam && activeParam !== selectedTrajectoryParam) {
      setSelectedTrajectoryParam(activeParam);
    }

    // ── 3. Build chart data — one entry PER selected report ───────────────────
    // Each report becomes one point on the X-axis, ordered by date (already sorted)
    const chartData = selectedReports.map((report, idx) => {
      const match = (report.medicalData || []).find(
        m => (m.testName || '').toLowerCase().trim() === (activeParam || '').toLowerCase().trim()
      );
      const raw = match ? parseFloat(match.testValue) : null;
      const refStr = match?.referenceRange || '';
      const hasDash = typeof refStr === 'string' && refStr.includes('-');
      const refParts = hasDash ? refStr.split('-') : [];
      const refMin = refParts.length >= 2 ? parseFloat(refParts[0]) : null;
      const refMax = refParts.length >= 2 ? parseFloat(refParts[1]) : null;

      // X-axis label: use reportDate, fall back to report name/index
      const xLabel = report.reportDate || report.reportName || `Report ${idx + 1}`;

      return {
        name: xLabel,
        label: report.reportName ? `${report.reportName}\n${xLabel}` : xLabel,
        date: xLabel,
        reportName: report.reportName || `Report ${idx + 1}`,
        value: !isNaN(raw) && raw !== null ? raw : null,
        unit: match?.units || '',
        status: match?.status || '—',
        refRaw: refStr || 'N/A',
        refMin,
        refMax,
      };
    });

    const validPoints = chartData.filter(d => d.value !== null).length;

    // Reference band: use the first data point that has ref values
    const refPoint = chartData.find(d => d.refMin !== null && d.refMax !== null);

    // Colors for UI accents
    const latestReport = selectedReports[selectedReports.length - 1];

    return (
      <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
        {/* ── Summary chips ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reports Selected</p>
            <p className="text-3xl font-black text-slate-800">{selectedReports.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Parameters</p>
            <p className="text-3xl font-black text-blue-600">{allParams.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date Range</p>
            <p className="text-sm font-black text-slate-700 leading-tight mt-1">
              {selectedReports[0]?.reportDate || '—'}<br />
              <span className="text-slate-400">to</span> {latestReport?.reportDate || '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Data Points</p>
            <p className="text-3xl font-black text-emerald-600">{validPoints}</p>
          </div>
        </div>

        {/* ── Main chart card ───────────────────────────────────────────── */}
        <div className="bg-slate-50 rounded-[3rem] p-4 lg:p-6 border border-slate-100/50 shadow-inner">
          <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 shadow-2xl border border-slate-100">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg text-white shrink-0">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">Health Fluctuation Profile</h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                    Tracking <span className="text-blue-600">{selectedReports.length}</span> reports · {selectedReports[0]?.reportDate} → {latestReport?.reportDate}
                  </p>
                </div>
              </div>

              {/* Active param badge */}
              {activeParam && (
                <div className="px-5 py-2.5 bg-blue-50 border-2 border-blue-200 rounded-2xl shadow-sm flex items-center gap-3 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="text-[11px] font-black text-blue-800 uppercase tracking-widest leading-none">{activeParam}</span>
                </div>
              )}
            </div>

            {/* Param selector pills */}
            {allParams.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-6 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">Parameter:</span>
                {allParams.map((param, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedTrajectoryParam(param)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${activeParam?.toLowerCase().trim() === param.toLowerCase().trim()
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600'
                      }`}
                  >
                    {param}
                  </button>
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-6 mb-6">
              {refPoint && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-md bg-emerald-500/20 border border-emerald-500/50"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Normal Range</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{activeParam || 'Selected Trajectory'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{validPoints} / {selectedReports.length} data points</span>
              </div>
            </div>

            {/* Chart */}
            {validPoints > 0 ? (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={chartData} margin={{ top: 40, right: 40, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: '700' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: '700' }}
                      domain={['auto', dataMax => Math.ceil(dataMax * 1.2)]}
                    />
                    <Tooltip
                      cursor={{ stroke: '#2563eb', strokeWidth: 1, strokeDasharray: '4 4' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          const isHigh = d.refMax !== null && d.value > d.refMax;
                          const isLow = d.refMin !== null && d.value < d.refMin;
                          const isNormal = !isHigh && !isLow && d.value !== null;
                          return (
                            <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-5 shadow-2xl ring-1 ring-black/5 min-w-[160px]">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{d.reportName}</p>
                              <p className="text-[9px] font-bold text-slate-300 mb-2">{d.date}</p>
                              {d.value !== null ? (
                                <>
                                  <div className="flex items-baseline gap-2 mb-3">
                                    <span className="text-3xl font-black text-slate-900">{d.value}</span>
                                    <span className="text-xs font-bold text-slate-500">{d.unit}</span>
                                  </div>
                                  <div className="pt-3 border-t border-slate-100 space-y-2">
                                    <div className="flex items-center justify-between gap-6">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status:</span>
                                      <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${isHigh ? 'bg-red-500/10 text-red-600' : isLow ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                                        {isHigh ? '▲ High' : isLow ? '▼ Low' : '✓ Normal'}
                                      </span>
                                    </div>
                                    {d.refRaw && d.refRaw !== 'N/A' && (
                                      <div className="flex items-center justify-between gap-6">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reference:</span>
                                        <span className="text-[10px] font-black text-slate-700">{d.refRaw}</span>
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <p className="text-[11px] font-bold text-slate-400 italic">No data in this report</p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {/* Normal range shading */}
                    {refPoint && refPoint.refMin !== null && refPoint.refMax !== null && (
                      <ReferenceArea
                        y1={refPoint.refMin}
                        y2={refPoint.refMax}
                        fill="rgba(16, 185, 129, 0.06)"
                        stroke="rgba(16, 185, 129, 0.15)"
                        strokeDasharray="4 4"
                      />
                    )}

                    {/* Single area line connecting all report dots */}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#2563eb"
                      strokeWidth={3}
                      fillOpacity={0.08}
                      fill="#2563eb"
                      connectNulls={true}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (payload.value === null || isNaN(payload.value)) return null;
                        const isHigh = payload.refMax !== null && payload.value > payload.refMax;
                        const isLow = payload.refMin !== null && payload.value < payload.refMin;
                        const color = isHigh ? '#dc2626' : isLow ? '#d97706' : '#2563eb';
                        return (
                          <g key={`dot-${cx}-${cy}`}>
                            <circle cx={cx} cy={cy} r={7} fill={color} stroke="#fff" strokeWidth={3} />
                          </g>
                        );
                      }}
                      activeDot={{ r: 9, fill: '#1e3a8a', strokeWidth: 0 }}
                    >
                      <LabelList
                        dataKey="value"
                        position="top"
                        offset={16}
                        style={{ fill: '#1e293b', fontSize: 11, fontWeight: '900' }}
                        formatter={(v) => v !== null && !isNaN(v) ? v : ''}
                      />
                    </Area>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <p className="text-slate-500 font-bold text-sm">No numeric data found for <span className="text-slate-800">{activeParam}</span></p>
                <p className="text-slate-400 text-xs mt-1">Try selecting a different parameter above</p>
              </div>
            )}

            {/* Report timeline — shows each report as a labeled chip */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Selected Reports Timeline</p>
              <div className="flex flex-wrap gap-2">
                {selectedReports.map((r, idx) => {
                  const match = (r.medicalData || []).find(
                    m => (m.testName || '').toLowerCase().trim() === (activeParam || '').toLowerCase().trim()
                  );
                  const val = match ? parseFloat(match.testValue) : null;
                  const refStr = match?.referenceRange || '';
                  const hasDash = refStr.includes('-');
                  const refParts = hasDash ? refStr.split('-') : [];
                  const refMin = refParts.length >= 2 ? parseFloat(refParts[0]) : null;
                  const refMax = refParts.length >= 2 ? parseFloat(refParts[1]) : null;
                  const isHigh = refMax !== null && val > refMax;
                  const isLow = refMin !== null && val < refMin;
                  const chipColor = val === null || isNaN(val)
                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                    : isHigh
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : isLow
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  return (
                    <div key={r.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wide ${chipColor}`}>
                      <span className="text-[9px] font-bold opacity-60">#{idx + 1}</span>
                      <span>{r.reportName}</span>
                      <span className="opacity-60">·</span>
                      <span>{r.reportDate}</span>
                      {val !== null && !isNaN(val) && <span className="ml-1 font-black">{val} {match?.units || ''}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Layout title="Trend Analysis">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 border-4 border-cyan-100 border-t-cyan-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">Loading your reports...</p>
        </div>
      </Layout>
    );
  }

  if (!hasReports) {
    return (
      <Layout title="Trend Analysis">
        <div className="max-w-7xl mx-auto pb-24 space-y-8 mt-8">
          <div className="bg-slate-50 rounded-[3rem] p-24 text-center border border-slate-100 shadow-inner">
            <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
              <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            </div>
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-4">Start Your Health Journey</h2>
            <p className="text-slate-400 max-w-lg mx-auto mb-10 font-medium">Upload your first medical report to unlock AI-powered insights, fluctuation profiles, and longitudinal trend analysis.</p>
            <Link to="/upload" className="inline-flex items-center gap-4 px-12 py-5 bg-cyan-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-cyan-700 transition-all shadow-xl shadow-cyan-900/20">
              Upload First Report
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Trend Analysis"
      headerActions={
        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200 shadow-inner mr-2">
            <button
              onClick={() => setViewMode('single')}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'single' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Analysis
            </button>
            <button
              onClick={() => setViewMode('trends')}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'trends' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Fluctuations
            </button>
          </div>

          {/* Multi-report Selector */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="bg-slate-50 border border-slate-200 text-slate-700 py-2.5 px-4 rounded-xl font-bold text-xs shadow-sm flex items-center justify-between gap-3 min-w-[180px] hover:border-slate-300 transition-all"
            >
              <span className="truncate">
                {selectedReports.length === 1
                  ? selectedReports[0].displayName
                  : `${selectedReports.length} Selected`}
              </span>
              <svg className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDropdownOpen && (() => {
              return (
                <div className="absolute right-0 z-[40] w-80 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                  {/* Report list */}
                  <div className="max-h-56 overflow-y-auto py-1">
                    {extractedMedicalData.map(report => {
                      const isSelected = selectedReports.some(sr => sr.id === report.id);
                      return (
                        <div
                          key={report.id}
                          onClick={() => toggleReportSelection(report)}
                          className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer group transition-colors ${
                            isSelected ? 'bg-cyan-50/60 hover:bg-cyan-50' : 'hover:bg-slate-50'
                          } ${viewMode === 'single' && isSelected ? 'border-r-4 border-cyan-600' : ''}`}
                        >
                          {viewMode === 'trends' && (
                            <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all shrink-0 ${isSelected ? 'bg-cyan-600 border-cyan-600' : 'border-gray-300 group-hover:border-cyan-400'}`}>
                              {isSelected && (
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`text-[11px] font-bold truncate ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>{report.reportName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{report.reportDate}</p>
                              <span className="text-[8px] font-bold text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded-md border border-cyan-100 uppercase tracking-wider">{report.category}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-2 border-t border-slate-50 bg-slate-50 flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
                      {selectedReports.length} selected
                    </span>
                    <button
                      onClick={() => setIsDropdownOpen(false)}
                      className="px-4 py-1.5 bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-700 transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      }
    >
      <div className="max-w-7xl mx-auto pb-24 space-y-12">


        {/* Dynamic Content Area */}
        <div className="relative min-h-[400px]">
          {viewMode === 'single' ? renderSingleReportView() : renderTrendsView()}
        </div>


      </div>
    </Layout>
  );
};

export default TrendAnalysis;
