import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import CustomSelect from '../components/CustomSelect';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, getDocs, query, orderBy, deleteDoc, doc
} from 'firebase/firestore';

const Reports = () => {
  const [reports, setReports] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [viewMode, setViewMode] = useState('grid');
  const [viewModal, setViewModal] = useState(false);
  const [analysisModal, setAnalysisModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Custom modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);

  const getFileIcon = (type) => {
    if (type === 'pdf') {
      return (
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  };

  const deleteReport = (reportId) => {
    const report = reports.find(r => r.id === reportId);
    if (report) {
      setReportToDelete(report);
      setIsDeleteModalOpen(true);
    }
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setReportToDelete(null);
  };

  const confirmDelete = async () => {
    if (!reportToDelete || !currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'reports', reportToDelete.id));
      setReports(prev => prev.filter(r => r.id !== reportToDelete.id));
      closeDeleteModal();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete report.');
    }
  };

  // ─── Auth listener ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const loadReports = useCallback(async (user) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'users', user.uid, 'reports'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const fetchedReports = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setReports(fetchedReports);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
    console.log("kkkkk")
  }, []);

  useEffect(() => {
    if (currentUser) loadReports(currentUser);
    else if (auth.currentUser === null) {
      // If we are sure there is no user, stop loading
      setIsLoading(false);
    }
  }, [currentUser, loadReports]);



  const processedReports = reports.map(report => {
    const medicalData = report.medicalData || [];
    const hemoglobinTests = medicalData.filter(t => t.testName?.toLowerCase().includes('hemoglobin'))
      .map(t => {
        const value = parseFloat(t.testValue);
        return isNaN(value) || !isFinite(value) ? null : value;
      })
      .filter(v => v !== null);
    const avgHemoglobin = hemoglobinTests.length > 0
      ? (hemoglobinTests.reduce((a, b) => a + b, 0) / hemoglobinTests.length).toFixed(1)
      : null;

    const risks = medicalData.filter(t => t.status === 'Abnormal' || t.status === 'Borderline').length;

    return {
      ...report,
      category: report.category || 'Blood Test',
      status: report.status || 'Analyzed',
      hemoglobin: avgHemoglobin,
      risks,
      riskAssessment: report.riskAssessment || (risks > 0 ? `Detected ${risks} abnormal/borderline tests.` : 'All tests normal.'),
      diagnosis: report.diagnosis || (risks > 0 ? 'Follow up recommended' : 'Normal results'),
      advice: report.advice || (risks > 0 ? 'Consult doctor for abnormal tests.' : 'Continue regular checkups.'),
      originalDocument: null
    };
  });

  const categories = ['Blood Test', 'Lipid Panel', 'CBC', 'Thyroid', 'Diabetes', 'Liver'];

  const getStatusColor = (status) => {
    if (status === 'Analyzed') return { bg: 'white', border: '#dcfce7', text: '#16a34a', label: 'Analyzed' };
    if (status === 'Pending') return { bg: 'white', border: '#fef3c7', text: '#d97706', label: 'Pending' };
    return { bg: 'white', border: '#f3f4f6', text: '#6b7280', label: status };
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Blood Test': '#06b6d4',
      'Lipid Panel': '#8b5cf6',
      'CBC': '#10b981',
      'Thyroid': '#f59e0b',
      'Diabetes': '#ef4444',
      'Liver': '#6366f1',
    };
    return colors[category] || '#64748b';
  };
  const filteredReports = processedReports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || report.category === categoryFilter;

    let matchesDate = true;
    if (dateFilter === 'custom' && dateRange.start && dateRange.end) {
      const reportDate = new Date(report.date);
      matchesDate = reportDate >= new Date(dateRange.start) && reportDate <= new Date(dateRange.end);
    } else if (dateFilter === 'week') {
      matchesDate = new Date(report.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'month') {
      matchesDate = new Date(report.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === '3months') {
      matchesDate = new Date(report.date) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    }

    return matchesSearch && matchesCategory && matchesDate;
  });

  const categoryOptions = [
    { label: 'All Categories', value: 'all' },
    ...categories.map(cat => ({ label: cat, value: cat }))
  ];

  const dateFilterOptions = [
    { label: 'All Dates', value: 'all' },
    { label: 'Last 7 days', value: 'week' },
    { label: 'Last 30 days', value: 'month' },
    { label: 'Last 3 months', value: '3months' },
    { label: 'Custom Range', value: 'custom' }
  ];

  const summaryStats = {
    total: filteredReports.length,
    analyzed: filteredReports.filter(r => r.status === 'Analyzed').length,
    pending: filteredReports.filter(r => r.status === 'Pending').length,
    critical: filteredReports.filter(r => r.risks >= 3).length,
  };

  const handleShareViaWhatsApp = (report) => {
    const message = `*Health Report Details*\n\n*Report Name:* ${report.name}\n*Category:* ${report.category}\n*Date:* ${report.date}\n*Status:* ${report.status}\n${report.riskAssessment ? `\n*Risk Assessment:* ${report.riskAssessment}` : ''}\n${report.diagnosis ? `\n*Diagnosis:* ${report.diagnosis}` : ''}\n${report.advice ? `\n*Advice:* ${report.advice}` : ''}\n\nShared from Healthcare App`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <Layout>
      <div>
        {/* Header Card - Attractive Design */}
        <div className="rounded-3xl p-8 text-white  mb-8" style={{ backgroundColor: '#263B6A' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">My Reports</h1>
                <p className="text-cyan-100 text-lg">View and manage your medical reports</p>
              </div>
            </div>
          </div>
        </div>



        {/* Search & Filters */}
        <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search reports by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-12 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="flex flex-col lg:flex-row items-center gap-3 w-full lg:w-auto">
              <CustomSelect
                options={categoryOptions}
                value={categoryFilter}
                onChange={(val) => setCategoryFilter(val)}
                placeholder="All Categories"
                className="w-full lg:w-56"
              />
              <div className="flex items-center gap-2 w-full lg:w-auto">
                <CustomSelect
                  options={dateFilterOptions}
                  value={dateFilter}
                  onChange={(val) => setDateFilter(val)}
                  placeholder="All Dates"
                  className="flex-1 lg:w-56"
                />
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-3 rounded-xl transition-all duration-200 ${viewMode === 'grid' ? 'bg-gray-800 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    title="Grid View"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-3 rounded-xl transition-all duration-200 ${viewMode === 'list' ? 'bg-gray-800 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    title="List View"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {dateFilter === 'custom' && (
                <div className="flex gap-2 w-full sm:w-auto animate-fade-in">
                  <input
                    type="date"
                    className="flex-1 sm:w-32 px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs shadow-sm"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  />
                  <input
                    type="date"
                    className="flex-1 sm:w-32 px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs shadow-sm"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${categoryFilter === 'all'
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 border ${categoryFilter === cat
                  ? 'text-white'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                style={{
                  backgroundColor: categoryFilter === cat ? getCategoryColor(cat) : '',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getCategoryColor(cat) }}
                ></span>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">Showing <span className="font-semibold text-gray-800">{filteredReports.length}</span> reports</p>
        </div>

        {/* Reports Grid/List */}
        {isLoading ? (
          <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
            <div className="w-12 h-12 mx-auto border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 text-lg">Loading your reports…</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No reports found </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredReports.map((report) => {
              const statusStyle = getStatusColor(report.status);
              const categoryColor = getCategoryColor(report.category);
              return (
                <div key={report.id} className="premium-card overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: categoryColor + '15' }}
                      >
                        <svg className="w-5 h-5" style={{ color: categoryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-semibold border"
                        style={{ backgroundColor: 'white', color: statusStyle.text, borderColor: statusStyle.border }}
                      >
                        {statusStyle.label}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800 mb-0.5 line-clamp-1 text-sm">{report.name}</h3>
                    <p className="text-xs text-gray-500 mb-3">{report.category} • {report.date}</p>



                    {report.risks > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-xs font-medium text-orange-600">{report.risks} Active Risks</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => { setSelectedReport(report); setViewModal(true); }}
                        className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors text-xs"
                      >
                        View
                      </button>
                      <button
                        onClick={() => { setSelectedReport(report); setAnalysisModal(true); }}
                        className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors text-xs w-18"
                      >
                        Analysis
                      </button>
                      <button
                        onClick={() => deleteReport(report.id)}
                        className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Delete Report"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="premium-card overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[800px]">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Report Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Category</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Risks</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReports.map((report) => {
                    const statusStyle = getStatusColor(report.status);
                    const categoryColor = getCategoryColor(report.category);
                    return (
                      <tr key={report.id} className="hover:bg-white transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: categoryColor + '15' }}
                            >
                              <svg className="w-5 h-5" style={{ color: categoryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <span className="font-medium text-gray-800">{report.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: categoryColor + '15', color: categoryColor }}>
                            {report.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{report.date}</td>
                        <td className="px-5 py-3.5">
                          <span className="px-3 py-1 rounded-full text-xs font-medium border" style={{ backgroundColor: 'white', color: statusStyle.text, borderColor: statusStyle.border }}>
                            {statusStyle.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {report.risks > 0 ? (
                            <span className="text-orange-600 font-medium">{report.risks} risks</span>
                          ) : (
                            <span className="text-green-600">None</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setSelectedReport(report); setViewModal(true); }}
                              className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                              title="View"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button
                              onClick={() => { setSelectedReport(report); setAnalysisModal(true); }}
                              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Analysis"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteReport(report.id)}
                              className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}



        {/* View Document Modal */}
        {viewModal && selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedReport.name}</h2>
                  <p className="text-sm text-gray-500">{selectedReport.category} • {selectedReport.date}</p>
                </div>
                <button
                  onClick={() => { setViewModal(false); setSelectedReport(null); }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 h-[60vh] overflow-auto">
                <div className="w-full h-full bg-white rounded-xl flex items-center justify-center">
                  {selectedReport.fileData ? (
                    selectedReport.type === 'image' ? (
                      <img
                        src={selectedReport.fileData}
                        alt={selectedReport.name}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                      />
                    ) : (
                      <embed
                        src={selectedReport.fileData}
                        type="application/pdf"
                        className="w-full h-full rounded-lg"
                      />
                    )
                  ) : (
                    <div className="text-center p-8">
                      <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500">No content available</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 flex justify-between">
                <button
                  onClick={() => handleShareViaWhatsApp(selectedReport)}
                  className="px-4 py-2.5 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Share via WhatsApp
                </button>
                <button
                  onClick={() => { setViewModal(false); setSelectedReport(null); }}
                  className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Modal */}
        {analysisModal && selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Analysis Report</h2>
                  <p className="text-sm text-gray-500">{selectedReport.name}</p>
                </div>
                <button
                  onClick={() => { setAnalysisModal(false); setSelectedReport(null); }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 overflow-auto max-h-[calc(90vh-180px)]">
                {/* Risk Assessment Section */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-red-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800">Risk Assessment</h3>
                  </div>
                  <div className="bg-white rounded-xl p-4">
                    <p className="text-gray-700">{selectedReport.riskAssessment}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-sm text-gray-500">Risk Level:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold bg-white border ${selectedReport.risks >= 3 ? 'border-red-200 text-red-700' :
                        selectedReport.risks >= 1 ? 'border-yellow-200 text-yellow-700' :
                          'border-green-200 text-green-700'
                        }`}>
                        {selectedReport.risks >= 3 ? 'High Risk' :
                          selectedReport.risks >= 1 ? 'Moderate Risk' :
                            'Low Risk'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Diagnosis Section */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-blue-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800">Diagnosis</h3>
                  </div>
                  <div className="bg-white rounded-xl p-4">
                    <p className="text-gray-700">{selectedReport.diagnosis}</p>
                  </div>
                </div>

                {/* Advice Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-green-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800">Advice</h3>
                  </div>
                  <div className="bg-white rounded-xl p-4">
                    <p className="text-gray-700">{selectedReport.advice}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 flex justify-between">
                <button
                  onClick={() => handleShareViaWhatsApp(selectedReport)}
                  className="px-4 py-2.5 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Share via WhatsApp
                </button>
                <button
                  onClick={() => { setAnalysisModal(false); setSelectedReport(null); }}
                  className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {isDeleteModalOpen && reportToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeDeleteModal}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Delete Report</h2>
                    <p className="text-sm text-gray-600">This cannot be undone</p>
                  </div>
                </div>

                <div className="p-3 bg-red-50 rounded-xl mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      {getFileIcon(reportToDelete.type)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{reportToDelete.name}</p>
                      <p className="text-xs text-gray-500">{reportToDelete.date} • {reportToDelete.size}</p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-700 mb-6">
                  This will permanently remove "<strong>{reportToDelete.name}</strong>" from your records.
                </p>

                <div className="flex gap-3">
                  <button onClick={closeDeleteModal}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
                    Cancel
                  </button>
                  <button onClick={confirmDelete}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-sm transition-all">
                    Delete Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Reports;

