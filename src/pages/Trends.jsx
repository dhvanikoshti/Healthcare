import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceArea } from 'recharts';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import CustomSelect from '../components/CustomSelect';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const TrendAnalysis = () => {
  const [compareOption, setCompareOption] = useState(null);
  const [timeRange, setTimeRange] = useState('all');
  const [customMonths, setCustomMonths] = useState(2);
  const [hasReports, setHasReports] = useState(false);
  const [reports, setReports] = useState([]);
  const [extractedMedicalData, setExtractedMedicalData] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedReports, setSelectedReports] = useState([]);
  const [compareReport1, setCompareReport1] = useState(null);
  const [compareReport2, setCompareReport2] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

  // Static data for Professional Diabetes Trends (4 Reports)
  const staticDiabetesReports = [
    {
      id: 'd1',
      reportId: 'd1',
      reportName: 'Screening - Oct 2023',
      reportDate: 'Oct 2023',
      medicalData: [
        { testName: 'Glucose (Fasting)', testValue: '105', units: 'mg/dL', referenceRange: '70-99', status: 'Borderline' }
      ]
    },
    {
      id: 'd2',
      reportId: 'd2',
      reportName: 'Screening - Jan 2024',
      reportDate: 'Jan 2024',
      medicalData: [
        { testName: 'Glucose (Fasting)', testValue: '112', units: 'mg/dL', referenceRange: '70-99', status: 'Borderline' }
      ]
    },
    {
      id: 'd3',
      reportId: 'd3',
      reportName: 'Screening - Mar 2024',
      reportDate: 'Mar 2024',
      medicalData: [
        { testName: 'Glucose (Fasting)', testValue: '98', units: 'mg/dL', referenceRange: '70-99', status: 'Normal' }
      ]
    },
    {
      id: 'd4',
      reportId: 'd4',
      reportName: 'Screening - June 2024',
      reportDate: 'June 2024',
      medicalData: [
        { testName: 'Glucose (Fasting)', testValue: '94', units: 'mg/dL', referenceRange: '70-99', status: 'Normal' }
      ]
    }
  ];

  const fetchUserReports = async (userId) => {
    setIsLoading(true);
    try {
      // Locking to the professional 4-report diabetes dataset
      setReports(staticDiabetesReports);
      setExtractedMedicalData(staticDiabetesReports);
      setHasReports(true);
      setSelectedReport(staticDiabetesReports[3]); // Latest is index 3 now
    } catch (err) {
      console.error('Error fetching user reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getSummaryStats = () => {
    if (extractedMedicalData.length === 0) return { totalTests: 0, normalTests: 0, borderlineTests: 0, abnormalTests: 0 };

    let totalTests = 0, normalTests = 0, borderlineTests = 0, abnormalTests = 0;

    extractedMedicalData.forEach(report => {
      if (report.medicalData && Array.isArray(report.medicalData)) {
        report.medicalData.forEach(test => {
          totalTests++;
          if (test.status === 'Normal') normalTests++;
          else if (test.status === 'Borderline') borderlineTests++;
          else if (test.status === 'Abnormal') abnormalTests++;
        });
      }
    });

    return { totalTests, normalTests, borderlineTests, abnormalTests };
  };

  const summaryStats = getSummaryStats();

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Normal': return { bg: '#dcfce7', text: '#16a34a', label: 'Normal', icon: '✓' };
      case 'Borderline': return { bg: '#fef3c7', text: '#d97706', label: 'Borderline', icon: '⚠' };
      case 'Abnormal': return { bg: '#fee2e2', text: '#dc2626', label: 'Abnormal', icon: '✗' };
      default: return { bg: '#f3f4f6', text: '#6b7280', label: 'Unknown', icon: '?' };
    }
  };

  const generateTrendData = () => {
    if (extractedMedicalData.length === 0) return [];
    const testNames = new Set();
    extractedMedicalData.forEach(report => {
      if (report.medicalData && Array.isArray(report.medicalData)) {
        report.medicalData.forEach(test => testNames.add(test.testName));
      }
    });

    const trendData = [];
    testNames.forEach(testName => {
      const testTrend = { name: testName };
      extractedMedicalData.forEach((report, index) => {
        const test = report.medicalData?.find(t => t.testName === testName);
        if (test) testTrend[`value${index}`] = parseFloat(test.testValue);
      });
      trendData.push(testTrend);
    });
    return trendData;
  };

  const comparisonOptions = [
    { id: 1, label: 'Compare All Reports', date1: 'First', date2: 'Latest', months: 'all' },
    { id: 2, label: 'Last 2 Reports', date1: 'Previous', date2: 'Latest', months: 2 },
    { id: 3, label: 'Last 3 Reports', date1: 'First', date2: 'Latest', months: 3 },
    { id: 4, label: 'Last 4 Reports', date1: 'First', date2: 'Latest', months: 4 },
    { id: 5, label: 'Last 5 Reports', date1: 'First', date2: 'Latest', months: 5 },
    { id: 6, label: 'Last 6 Reports', date1: 'First', date2: 'Latest', months: 6 },
  ];

  // Filter data based on selected time range
  const getFilteredData = () => {
    return extractedMedicalData; // Always show the 3 reports for this focus
  };

  const filteredData = getFilteredData();

  useEffect(() => {
    if (hasReports && !compareOption) setCompareOption(comparisonOptions[0]);
  }, [hasReports, compareOption]);

  const getCurrentReportData = () => {
    if (selectedReport && selectedReport.medicalData) return selectedReport.medicalData;
    if (extractedMedicalData.length > 0) return extractedMedicalData[0].medicalData || [];
    return [];
  };

  const currentReportData = getCurrentReportData();
  const chartData = generateTrendData();

  // Risk analysis functions
  const analyzeRisk = (testName, testValue) => {
    const value = parseFloat(testValue);
    const name = testName.toLowerCase();
    let status = 'Normal', score = 15, description = '';

    if (name.includes('glucose')) {
      if (value < 100) { status = 'Normal'; score = 15; description = 'Blood sugar levels are within normal range.'; }
      else if (value < 126) { status = 'Borderline'; score = 45; description = 'Blood sugar is slightly elevated - prediabetes range.'; }
      else { status = 'Critical'; score = 75; description = 'Blood sugar is high - diabetes range. Consult doctor.'; }
    }
    else if (name.includes('cholesterol') && !name.includes('ldl') && !name.includes('hdl')) {
      if (value < 200) { status = 'Normal'; score = 15; description = 'Cholesterol levels are healthy.'; }
      else if (value < 240) { status = 'Borderline'; score = 45; description = 'Cholesterol is slightly elevated.'; }
      else { status = 'Critical'; score = 70; description = 'Cholesterol is high. Needs attention.'; }
    }
    else if (name.includes('ldl')) {
      if (value < 100) { status = 'Normal'; score = 15; description = 'LDL (bad) cholesterol is optimal.'; }
      else if (value < 160) { status = 'Borderline'; score = 45; description = 'LDL is borderline high.'; }
      else { status = 'Critical'; score = 70; description = 'LDL is high. Risk of heart disease.'; }
    }
    else if (name.includes('hdl')) {
      if (value >= 60) { status = 'Normal'; score = 15; description = 'HDL (good) cholesterol is excellent.'; }
      else if (value >= 40) { status = 'Borderline'; score = 40; description = 'HDL is low. Needs improvement.'; }
      else { status = 'Critical'; score = 65; description = 'HDL is very low. Heart risk increased.'; }
    }
    else if (name.includes('hemoglobin')) {
      if (value >= 12 && value <= 16) { status = 'Normal'; score = 15; description = 'Hemoglobin levels are healthy.'; }
      else if (value >= 10 && value < 12) { status = 'Borderline'; score = 40; description = 'Mildly low hemoglobin - possible anemia.'; }
      else { status = 'Critical'; score = 65; description = 'Low hemoglobin - anemia risk.'; }
    }
    else if (name.includes('iron')) {
      if (value >= 60 && value <= 170) { status = 'Normal'; score = 15; description = 'Iron levels are within normal range.'; }
      else if (value >= 30 && value < 60) { status = 'Borderline'; score = 45; description = 'Iron is low - possible iron deficiency.'; }
      else { status = 'Critical'; score = 70; description = 'Iron deficiency anemia risk.'; }
    }
    else if (name.includes('vitamin d')) {
      if (value >= 30) { status = 'Normal'; score = 15; description = 'Vitamin D levels are adequate.'; }
      else if (value >= 20) { status = 'Borderline'; score = 40; description = 'Vitamin D is slightly low.'; }
      else { status = 'Critical'; score = 60; description = 'Vitamin D deficiency.'; }
    }
    else if (name.includes('triglycerides')) {
      if (value < 150) { status = 'Normal'; score = 15; description = 'Triglycerides are normal.'; }
      else if (value < 200) { status = 'Borderline'; score = 45; description = 'Triglycerides are borderline high.'; }
      else { status = 'Critical'; score = 70; description = 'Triglycerides are high.'; }
    }
    else { status = 'Normal'; score = 15; description = 'Test results within normal range.'; }

    return { status, score, description };
  };

  const getTrendAdjustedRisk = (testName, currentValue) => {
    const previousReport = extractedMedicalData.length >= 2 ? extractedMedicalData[extractedMedicalData.length - 2] : null;
    if (!previousReport || !previousReport.medicalData) return null;

    const prevTest = previousReport.medicalData.find(t => t.testName.toLowerCase() === testName.toLowerCase());
    if (!prevTest) return null;

    const prevValue = parseFloat(prevTest.testValue);
    const changePercent = ((parseFloat(currentValue) - prevValue) / prevValue) * 100;

    let trendStatus = 'Stable', trendIcon = '→', trendColor = '#2563eb';

    if (Math.abs(changePercent) <= 5) { trendStatus = 'Stable'; trendIcon = '→'; trendColor = '#2563eb'; }
    else if (changePercent > 5) { trendStatus = 'Increasing'; trendIcon = '↑'; trendColor = '#22c55e'; }
    else { trendStatus = 'Decreasing'; trendIcon = '↓'; trendColor = '#ef4444'; }

    return { trendStatus, trendIcon, trendColor, changePercent };
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

  // Single report view
  if (hasReports && reports.length === 1) {


    return (
      <Layout>
        <div>
          <div className="mb-8">
            <div className="rounded-2xl p-8 " style={{ backgroundColor: '#263B6A' }}>
              <h1 className="text-4xl font-bold text-white mb-3">Trend Analysis</h1>
              <p className="text-cyan-100 text-lg">Extracted Medical Data</p>
              {reports.length === 1 && (
                <div className="flex items-center gap-4 mt-6">
                  <span className="text-cyan-100">{reports[0].name} • {reports[0].date}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <p className="text-4xl font-bold text-gray-800">{currentReportData.length}</p>
              <p className="text-sm text-gray-500 mt-1">Tests detected</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <p className="text-4xl font-bold text-green-600">{currentReportData.filter(t => t.status === 'Normal').length}</p>
              <p className="text-sm text-gray-500 mt-1">Normal</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <p className="text-4xl font-bold text-yellow-600">{currentReportData.filter(t => t.status === 'Borderline').length}</p>
              <p className="text-sm text-gray-500 mt-1">Borderline</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <p className="text-4xl font-bold text-red-600">{currentReportData.filter(t => t.status === 'Abnormal').length}</p>
              <p className="text-sm text-gray-500 mt-1">Abnormal</p>
            </div>
          </div>

          <div className="premium-card overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">Extracted Medical Data</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Test Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Test Value</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Units</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Reference Range</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Risk Assessment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentReportData.map((test, index) => {
                    const statusBadge = getStatusBadge(test.status);
                    return (
                      <tr key={index} className="hover:bg-white">
                        <td className="px-6 py-4 font-medium text-gray-800">{test.testName}</td>
                        <td className="px-6 py-4 font-bold text-gray-800">{test.testValue}</td>
                        <td className="px-6 py-4 text-gray-600">{test.units}</td>
                        <td className="px-6 py-4 text-gray-600">{test.referenceRange}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: statusBadge.bg, color: statusBadge.text }}>
                            {statusBadge.icon} {statusBadge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-6 border border-cyan-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Want to see trend analysis?</h3>
                <p className="text-sm text-gray-600">Upload more reports to compare your health metrics over time.</p>
              </div>
              <Link to="/upload-report" className="flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700">
                Upload More Reports
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // No reports view
  if (!hasReports) {
    return (
      <Layout>
        <div>
          <div className="mb-8">
            <div className="rounded-2xl p-8 " style={{ backgroundColor: '#263B6A' }}>
              <h1 className="text-4xl font-bold text-white mb-3">Trend Analysis</h1>
              <p className="text-cyan-100 text-lg">Track your health metrics over time</p>
            </div>
          </div>
          <div className="premium-card p-16 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Please Upload Your Reports</h2>
            <p className="text-gray-500 mb-8">Upload your medical reports to analyze health fluctuations and trends.</p>
            <Link to="/upload-report" className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700">
              Upload Reports
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // Professional Diagnostic Dashboard View
  return (
    <Layout>
      <div className="max-w-7xl mx-auto pb-24">
        {/* Professional Header */}
        <div className="rounded-3xl p-8 text-white  mb-8" style={{ backgroundColor: '#263B6A' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">Trend Analysis</h1>
                <p className="text-cyan-100 text-lg">Track your health metrics over time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Global Trajectory Card */}
        {/* <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100 flex items-center gap-8 relative overflow-hidden">
            <div className="w-24 h-24 rounded-3xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-800 tracking-tight mb-2 uppercase">Improving Stability</h3>
              <p className="text-slate-500 leading-relaxed max-w-md">
                Your glycemic levels show a <span className="text-emerald-600 font-bold">16% improvement</span> over the last 9 months. Metabolic homeostasis is trending towards optimal ranges.
              </p>
            </div>
            <div className="absolute top-0 right-0 p-8">
              <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold uppercase tracking-widest">Positive Drift</span>
            </div>
          </div>

          <div className="bg-[#263B6A] rounded-[2rem] p-8 shadow-xl text-white flex flex-col justify-center text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/60 mb-2">Target Goal</p>
            <p className="text-5xl font-bold mb-2 tracking-tighter">94 <span className="text-lg font-medium text-slate-400">mg/dL</span></p>
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest leading-loose">Optimal Fasting Range Achieved</p>
          </div>
        </div> */}

        {/* Diagnostic Chart */}
        <div className="bg-white rounded-[2.5rem] p-8 lg:p-12 shadow-lg border border-slate-100 mb-12 relative">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-12">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight uppercase mb-1">Glucose Fluctuation Matrix</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.1em]">Parameter: Fasting Blood Sugar (FBS)</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Borderline</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Critical</span>
              </div>
            </div>
          </div>

          <div className="h-[450px] -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData[0] ? extractedMedicalData.map((report, i) => ({
                name: report.reportDate,
                value: parseFloat(report.medicalData[0].testValue)
              })) : []} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="glucoseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="10 10" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: '800' }}
                  dy={15}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: '800' }}
                  domain={[0, 150]}
                />
                <Tooltip
                  cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }}
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '20px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                  }}
                  itemStyle={{ color: '#38bdf8', fontWeight: '900', fontSize: '20px' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}
                />

                {/* Visual Risk Zones */}
                <ReferenceArea y1={0} y2={100} fill="#10b981" fillOpacity={0.03} />
                <ReferenceArea y1={100} y2={126} fill="#f59e0b" fillOpacity={0.05} />
                <ReferenceArea y1={126} y2={150} fill="#ef4444" fillOpacity={0.05} />

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0ea5e9"
                  strokeWidth={8}
                  dot={{ fill: '#0ea5e9', r: 10, strokeWidth: 5, stroke: '#fff' }}
                  activeDot={{ r: 14, strokeWidth: 0, fill: '#1E293B' }}
                  animationDuration={3000}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* History Ledger Table */}
        <div className="bg-white rounded-[2.5rem] shadow-lg border border-slate-100 overflow-hidden">
          <div className="px-10 py-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Diagnostic History Ledger</h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Verified Clinical Records</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              </svg>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left bg-white">
                  <th className="px-10 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Diagnostic Period</th>
                  <th className="px-10 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Test Parameter</th>
                  <th className="px-10 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Diagnostic Value</th>
                  <th className="px-10 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Homeostasis Status</th>
                  <th className="px-10 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Net Drift</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {extractedMedicalData.map((report, idx) => {
                  const currentValue = parseFloat(report.medicalData[0].testValue);
                  const priorValue = idx > 0 ? parseFloat(extractedMedicalData[idx - 1].medicalData[0].testValue) : null;
                  const drift = priorValue ? currentValue - priorValue : null;
                  const status = getStatusBadge(report.medicalData[0].status);

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">{report.reportDate}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Diagnosis ID: #{idx + 1042}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <span className="text-sm font-bold text-slate-600">Glucose (Fasting)</span>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold text-slate-800">{currentValue}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">mg/dL</span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-tighter" style={{ backgroundColor: `${status.bg}`, color: status.text }}>
                          {status.icon} {status.label}
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        {drift !== null ? (
                          <div className={`flex items-center gap-1 font-bold ${drift <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {drift <= 0 ? '↓' : '↑'} {Math.abs(drift).toFixed(1)}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Reference Point</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TrendAnalysis;
