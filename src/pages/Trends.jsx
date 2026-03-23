import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

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

  const multipleReportsData = [
    {
      reportId: 1,
      reportName: 'Blood Test Report - July 2024',
      reportDate: '2024-07-15',
      medicalData: [
        { testName: 'Hemoglobin', testValue: '13.5', units: 'g/dL', referenceRange: '12.0 - 16.0', status: 'Normal' },
        { testName: 'Glucose', testValue: '95', units: 'mg/dL', referenceRange: '70 - 100', status: 'Normal' },
        { testName: 'Cholesterol', testValue: '190', units: 'mg/dL', referenceRange: '< 200', status: 'Normal' },
        { testName: 'Iron', testValue: '85', units: 'µg/dL', referenceRange: '60 - 170', status: 'Normal' },
        { testName: 'Vitamin D', testValue: '35', units: 'ng/mL', referenceRange: '30 - 100', status: 'Normal' },
      ]
    },
    {
      reportId: 2,
      reportName: 'Blood Test Report - June 2024',
      reportDate: '2024-06-15',
      medicalData: [
        { testName: 'Hemoglobin', testValue: '12.8', units: 'g/dL', referenceRange: '12.0 - 16.0', status: 'Normal' },
        { testName: 'Glucose', testValue: '102', units: 'mg/dL', referenceRange: '70 - 100', status: 'Borderline' },
        { testName: 'Cholesterol', testValue: '205', units: 'mg/dL', referenceRange: '< 200', status: 'Borderline' },
        { testName: 'Iron', testValue: '70', units: 'µg/dL', referenceRange: '60 - 170', status: 'Normal' },
        { testName: 'Vitamin D', testValue: '28', units: 'ng/mL', referenceRange: '30 - 100', status: 'Borderline' },
      ]
    },
    {
      reportId: 3,
      reportName: 'Blood Test Report - May 2024',
      reportDate: '2024-05-15',
      medicalData: [
        { testName: 'Hemoglobin', testValue: '14.0', units: 'g/dL', referenceRange: '12.0 - 16.0', status: 'Normal' },
        { testName: 'Glucose', testValue: '98', units: 'mg/dL', referenceRange: '70 - 100', status: 'Normal' },
        { testName: 'Cholesterol', testValue: '180', units: 'mg/dL', referenceRange: '< 200', status: 'Normal' },
        { testName: 'Iron', testValue: '90', units: 'µg/dL', referenceRange: '60 - 170', status: 'Normal' },
        { testName: 'Vitamin D', testValue: '42', units: 'ng/mL', referenceRange: '30 - 100', status: 'Normal' },
      ]
    },
  ];

  useEffect(() => {
    const storedReports = localStorage.getItem('userReports');
    const storedMedicalData = localStorage.getItem('extractedMedicalData');

    if (storedReports) {
      const parsedReports = JSON.parse(storedReports);
      setReports(parsedReports);
      setHasReports(parsedReports.length > 0);
      if (parsedReports.length === 1) {
        setSelectedReport(parsedReports[0]);
      }
    }

    if (storedMedicalData) {
      setExtractedMedicalData(JSON.parse(storedMedicalData));
    } else {
      setExtractedMedicalData(multipleReportsData);
      setReports(multipleReportsData.map(r => ({ id: r.reportId, name: r.reportName, date: r.reportDate })));
      setHasReports(true);
    }
  }, []);

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
    if (timeRange === 'all') return extractedMedicalData;
    if (timeRange === 'custom') {
      return extractedMedicalData.slice(-customMonths);
    }
    // For predefined ranges
    const monthsMap = { '3months': 3, '6months': 6 };
    const numMonths = monthsMap[timeRange] || extractedMedicalData.length;
    return extractedMedicalData.slice(-numMonths);
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

  // Multiple reports view
  return (
    <Layout>
      <div>
        <div className="mb-8">
          <div className="rounded-2xl p-8 " style={{ backgroundColor: '#263B6A' }}>
            <h1 className="text-4xl font-bold text-white mb-3">Trend Analysis</h1>
            <p className="text-cyan-100 text-lg">Track your health metrics over time</p>
            <div className="flex items-center gap-4 mt-6">
              <span className="text-cyan-100">{reports.length} Reports</span>
              <span className="text-cyan-100">{summaryStats.totalTests} Tests Analyzed</span>
            </div>
          </div>
        </div>

        {/* Filter Section - Enhanced and Attractive */}
        <div className="premium-card p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Time Range Filter - Button Group Style */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">Filter Type</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTimeRange('all')}
                  className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${timeRange === 'all'
                    ? 'bg-cyan-600 text-white shadow-md hover:bg-cyan-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                >
                  All Reports
                </button>

                <button
                  onClick={() => setTimeRange('compare')}
                  className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${timeRange === 'compare'
                    ? 'bg-cyan-600 text-white shadow-md hover:bg-cyan-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                >
                  Compare Two
                </button>
              </div>
            </div>

            {/* Custom Month Input - Shows when Custom is selected */}
            {timeRange === 'custom' && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-700">Select Number of Reports</label>
                <select
                  value={customMonths}
                  onChange={(e) => setCustomMonths(parseInt(e.target.value))}
                  className="px-4 py-2.5 bg-gray-100 border-2 border-transparent rounded-xl font-medium text-gray-700 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all duration-200"
                >
                  {Array.from({ length: Math.max(2, reports.length) }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num} disabled={num > reports.length}>
                      {num} {num === 1 ? 'Report' : 'Reports'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Compare Two Reports Selection */}
            {timeRange === 'compare' && (
              <div className="flex flex-col lg:flex-row gap-4 w-full lg:w-auto">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-700">First Report</label>
                  <select
                    value={compareReport1 || ''}
                    onChange={(e) => setCompareReport1(e.target.value ? parseInt(e.target.value) : null)}
                    className="px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-700 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all duration-200"
                  >
                    <option value="">Select Report</option>
                    {extractedMedicalData.map((report, idx) => (
                      <option key={idx} value={idx}>
                        {report.reportName || `Report ${idx + 1}`} - {report.reportDate || ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-700">Second Report</label>
                  <select
                    value={compareReport2 || ''}
                    onChange={(e) => setCompareReport2(e.target.value ? parseInt(e.target.value) : null)}
                    className="px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-700 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all duration-200"
                  >
                    <option value="">Select Report</option>
                    {extractedMedicalData.map((report, idx) => (
                      <option key={idx} value={idx} disabled={idx === compareReport1}>
                        {report.reportName || `Report ${idx + 1}`} - {report.reportDate || ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Reports Count Badge */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">Showing</label>
              <div className="flex items-center gap-3 px-5 py-2.5 bg-white rounded-xl border border-gray-200 shadow-sm">
                <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-bold text-[#263B6A]">
                  {timeRange === 'all' ? reports.length : timeRange === 'custom' ? customMonths : (compareReport1 !== null && compareReport2 !== null ? '2' : '0')} Reports
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <p className="text-4xl font-bold text-gray-800">{summaryStats.totalTests}</p>
            <p className="text-sm text-gray-500 mt-1">Total Tests</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <p className="text-4xl font-bold text-green-600">{summaryStats.normalTests}</p>
            <p className="text-sm text-gray-500 mt-1">Normal ({summaryStats.totalTests > 0 ? Math.round((summaryStats.normalTests / summaryStats.totalTests) * 100) : 0}%)</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <p className="text-4xl font-bold text-yellow-600">{summaryStats.borderlineTests}</p>
            <p className="text-sm text-gray-500 mt-1">Borderline</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <p className="text-4xl font-bold text-red-600">{summaryStats.abnormalTests}</p>
            <p className="text-sm text-gray-500 mt-1">Abnormal</p>
          </div>
        </div>

        {/* Compare Two Reports View */}
        {timeRange === 'compare' && compareReport1 !== null && compareReport2 !== null && (
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Report Comparison</h2>
            <p className="text-sm text-gray-500 mb-6">
              Comparing {extractedMedicalData[compareReport1]?.reportName || `Report ${compareReport1 + 1}`} vs {extractedMedicalData[compareReport2]?.reportName || `Report ${compareReport2 + 1}`}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#263B6A]/5 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Test Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-cyan-700">
                      {extractedMedicalData[compareReport1]?.reportName?.split('-')[0] || `Report ${compareReport1 + 1}`}
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-purple-700">
                      {extractedMedicalData[compareReport2]?.reportName?.split('-')[0] || `Report ${compareReport2 + 1}`}
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Change</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const report1Tests = extractedMedicalData[compareReport1]?.medicalData || [];
                    const report2Tests = extractedMedicalData[compareReport2]?.medicalData || [];
                    const allTestNames = [...new Set([...report1Tests.map(t => t.testName), ...report2Tests.map(t => t.testName)])];

                    return allTestNames.map((testName, idx) => {
                      const test1 = report1Tests.find(t => t.testName === testName);
                      const test2 = report2Tests.find(t => t.testName === testName);
                      const value1 = test1 ? parseFloat(test1.testValue) : null;
                      const value2 = test2 ? parseFloat(test2.testValue) : null;

                      let change = null, changeColor = '#6b7280', trendIcon = '';
                      if (value1 !== null && value2 !== null && value1 !== 0) {
                        const diff = value2 - value1;
                        const percentChange = ((diff / value1) * 100).toFixed(1);
                        change = `${diff >= 0 ? '+' : ''}${percentChange}%`;
                        if (Math.abs(percentChange) <= 5) { changeColor = '#2563eb'; trendIcon = '→'; }
                        else if (diff > 0) { changeColor = '#22c55e'; trendIcon = '↑'; }
                        else { changeColor = '#ef4444'; trendIcon = '↓'; }
                      }

                      return (
                        <tr key={idx} className="hover:bg-white">
                          <td className="px-6 py-4 font-medium text-gray-800">{testName}</td>
                          <td className="px-6 py-4 font-bold text-cyan-700">
                            {test1 ? `${test1.testValue} ${test1.units}` : '-'}
                          </td>
                          <td className="px-6 py-4 font-bold text-purple-700">
                            {test2 ? `${test2.testValue} ${test2.units}` : '-'}
                          </td>
                          <td className="px-6 py-4">
                            {change && (
                              <span className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 w-fit" style={{ backgroundColor: `${changeColor}20`, color: changeColor }}>
                                {trendIcon} {change}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {test2 && (
                              <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{
                                backgroundColor: getStatusBadge(test2.status).bg,
                                color: getStatusBadge(test2.status).text
                              }}>
                                {getStatusBadge(test2.status).icon} {test2.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Main Trend Charts */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Health Metrics Trend</h2>
            <p className="text-sm text-gray-500 mb-6">Test fluctuation analysis across multiple reports (BarChart view)</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '12px' }} />
                  {extractedMedicalData.slice(0, 5).map((_, idx) => (
                    <Bar
                      key={idx}
                      dataKey={`value${idx}`}
                      fill={['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'][idx]}
                      name={`Report ${idx + 1}`}
                      radius={[6, 6, 0, 0]}
                      barSize={30}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Fluctuation Analysis */}
        {chartData.length > 0 && chartData.some(test => {
          const values = extractedMedicalData.map((_, i) => test[`value${i}`]).filter(v => v !== undefined);
          return values.length >= 2;
        }) && (
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Test Fluctuation Analysis</h2>
              <p className="text-sm text-gray-500 mb-6">Individual trend charts showing how each test value changes over time</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {chartData.map((test, idx) => {
                  const values = extractedMedicalData.map((_, i) => test[`value${i}`]).filter(v => v !== undefined);
                  if (values.length < 2) return null;

                  const currentValue = values[values.length - 1];
                  const previousValue = values[values.length - 2];

                  let fluctuation = null, trendIcon = null, trendColor = '#2563eb';

                  if (previousValue !== undefined && previousValue !== 0) {
                    const diff = currentValue - previousValue;
                    const percentChange = parseFloat(((diff / previousValue) * 100).toFixed(1));
                    fluctuation = `${diff >= 0 ? '+' : ''}${percentChange}%`;
                    if (Math.abs(percentChange) <= 5) { trendIcon = '→'; trendColor = '#2563eb'; }
                    else if (diff > 0) { trendIcon = '↑'; trendColor = '#22c55e'; }
                    else { trendIcon = '↓'; trendColor = '#ef4444'; }
                  }

                  const individualChartData = extractedMedicalData.map((report, i) => ({
                    report: `Report ${i + 1}`,
                    value: test[`value${i}`]
                  })).filter(d => d.value !== undefined);

                  return (
                    <div key={idx} className="p-4 bg-white rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-800">{test.name}</h3>
                          {trendIcon && <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${trendColor}20`, color: trendColor }}>{trendIcon}</span>}
                        </div>
                        {fluctuation && <span className="text-sm font-semibold" style={{ color: trendColor }}>{fluctuation}</span>}
                      </div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={individualChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="report" stroke="#94a3b8" fontSize={10} />
                            <YAxis stroke="#94a3b8" fontSize={10} domain={['auto', 'auto']} />
                            <Line type="monotone" dataKey="value" stroke={trendColor} strokeWidth={2} dot={{ fill: trendColor, r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                        <span>Latest: <strong className="text-gray-800">{currentValue}</strong></span>
                        <span>Previous: <strong className="text-gray-800">{previousValue}</strong></span>
                        <span>Change: <strong style={{ color: trendColor }}>{fluctuation}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

      </div>
    </Layout>
  );
};

export default TrendAnalysis;
