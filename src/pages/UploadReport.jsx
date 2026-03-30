import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import CustomSelect from '../components/CustomSelect';

const UploadReport = () => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Search / filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);

  // View modal state
  const [viewReport, setViewReport] = useState(null);

  // Toast state
  const [toastMsg, setToastMsg] = useState('');

  // ─── Auth listener ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // ─── Fetch reports from Firestore ─────────────────────────────────────────
  const fetchReports = useCallback(async (user) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'users', user.uid, 'reports'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setRecentReports(reports);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) fetchReports(currentUser);
  }, [currentUser, fetchReports]);

  // ─── Simulated Medical Data Extraction ────────────────────────────────────
  const generateSimulatedMedicalData = () => {
    const tests = [
      { name: 'Hemoglobin', unit: 'g/dL', base: 14, range: 2 },
      { name: 'Glucose', unit: 'mg/dL', base: 90, range: 20 },
      { name: 'Cholesterol', unit: 'mg/dL', base: 180, range: 40 },
      { name: 'Vitamin D', unit: 'ng/mL', base: 30, range: 15 }
    ];

    return tests.map(t => {
      const val = (t.base + (Math.random() * t.range - t.range / 2)).toFixed(1);
      const value = parseFloat(val);
      let status = 'Normal';

      // Basic normal range checks for simulation
      if (t.name === 'Hemoglobin' && (value < 13.5 || value > 17.5)) status = value < 12 ? 'Abnormal' : 'Borderline';
      if (t.name === 'Glucose' && value > 100) status = value > 125 ? 'Abnormal' : 'Borderline';
      if (t.name === 'Cholesterol' && value > 200) status = value > 239 ? 'Abnormal' : 'Borderline';
      if (t.name === 'Vitamin D' && value < 30) status = value < 20 ? 'Abnormal' : 'Borderline';

      return {
        testName: t.name,
        testValue: val,
        units: t.unit,
        status: status,
        referenceRange: t.name === 'Hemoglobin' ? '13.5 - 17.5' : (t.name === 'Glucose' ? '70 - 100' : (t.name === 'Cholesterol' ? '< 200' : '30 - 100'))
      };
    });
  };

  // ─── Upload handler (Base64 → Firestore, no Storage plan needed) ──────────
  const handleUpload = useCallback(async (file) => {
    if (!currentUser) {
      setUploadError('You must be logged in to upload reports.');
      return;
    }
    if (!file) return;

    // File size check
    const maxMB = 10; // Cloudinary handled larger files better than Base64
    if (file.size > maxMB * 1024 * 1024) {
      setUploadError(`File too large. Please upload a file under ${maxMB} MB.`);
      return;
    }

    setUploadError(null);
    setUploadProgress(0);
    setUploadSuccess(false);

    try {
      setUploadProgress(20); // Initializing upload

      // Upload to Cloudinary
      const result = await uploadToCloudinary(file);
      const fileUrl = result.secure_url;

      setUploadProgress(80); // Processing on Firebase

      const reportData = {
        name: file.name,
        date: new Date().toISOString().split('T')[0],
        type: file.type.includes('pdf') ? 'pdf' : 'image',
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        fileData: fileUrl,   // Cloudinary URL instead of base64
        createdAt: serverTimestamp(),
        medicalData: generateSimulatedMedicalData(),
      };

      await addDoc(collection(db, 'users', currentUser.uid, 'reports'), reportData);

      setUploadProgress(100);
      await fetchReports(currentUser);
      setUploadSuccess(true);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload report. Please try again.');
    } finally {
      setTimeout(() => {
        setUploadProgress(null);
        setUploadSuccess(false);
        setSelectedFile(null);
      }, 3000);
    }
  }, [currentUser, fetchReports]);

  // ─── Drag & drop handlers ─────────────────────────────────────────────────
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { setSelectedFile(file); handleUpload(file); }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); handleUpload(file); }
  };

  // ─── Download handlers ────────────────────────────────────────────────────
  const handleDownload = async (report) => {
    setToastMsg(`Preparing download...`);
    try {
      const response = await fetch(report.fileData);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.name || "medical_report";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setToastMsg(`Successfully downloaded ${report.name.substring(0, 15)}${report.name.length > 15 ? '...' : ''}`);
    } catch (error) {
      console.error("Error downloading file", error);
      setToastMsg('Error: Failed to fetch the target file content.');
    } finally {
      setTimeout(() => setToastMsg(''), 4000);
    }
  };

  // ─── Delete handlers ──────────────────────────────────────────────────────
  const deleteReport = (id) => {
    setReportToDelete(recentReports.find(r => r.id === id));
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!reportToDelete || !currentUser) return closeDeleteModal();
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'reports', reportToDelete.id));
      setRecentReports(prev => prev.filter(r => r.id !== reportToDelete.id));
    } catch (err) {
      console.error('Delete error:', err);
    }
    closeDeleteModal();
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setReportToDelete(null);
  };

  // ─── File icon ────────────────────────────────────────────────────────────
  const getFileIcon = (type) => {
    if (type === 'pdf') {
      return (
        <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 18a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5H10a1.5 1.5 0 010 3H9v.5a.5.5 0 01-.5.5zm1-2h.5a.5.5 0 000-1H9.5v1zm4 2a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5H15a1.5 1.5 0 010 3H14v.5a.5.5 0 01-.5.5z" />
        </svg>
      );
    }
    return (
      <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
      </svg>
    );
  };

  // ─── Filtered list ────────────────────────────────────────────────────────
  const filteredReports = recentReports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesDate = true;
    if (filterDate === 'week') {
      matchesDate = new Date(report.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (filterDate === 'month') {
      matchesDate = new Date(report.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (filterDate === 'custom') {
      const d = new Date(report.date);
      if (fromDate && toDate) matchesDate = d >= new Date(fromDate) && d <= new Date(toDate);
      else if (fromDate) matchesDate = d >= new Date(fromDate);
      else if (toDate) matchesDate = d <= new Date(toDate);
    }
    return matchesSearch && matchesDate;
  });

  const dateFilterOptions = [
    { label: 'All Dates', value: 'all' },
    { label: 'Last 7 days', value: 'week' },
    { label: 'Last 30 days', value: 'month' },
    { label: 'Custom Date Range', value: 'custom' }
  ];

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="w-full space-y-6">

        {/* Header */}
        <div className="rounded-3xl p-8 text-white" style={{ backgroundColor: '#263B6A' }}>
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Upload Medical Report</h1>
              <p className="text-cyan-100 text-lg">Turn your medical report into smart health insights.</p>
            </div>
          </div>
        </div>

        {/* Upload + Tips */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 lg:gap-6">

          {/* Upload Card */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="premium-card overflow-hidden h-full flex flex-col">
            <div className="px-5 py-3 bg-white border-b border-gray-100">
                <h2 className="text-md font-bold text-gray-800 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Report
                </h2>
                {uploadError && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">{uploadError}</p>
                )}
              </div>

              {/* Drop Zone */}
              <div
                className={`flex-1 relative border-2 border-dashed rounded-lg m-2 p-4 text-center transition-all duration-300 min-h-[160px] flex flex-col items-center justify-center
                  ${dragActive ? 'border-cyan-500 bg-cyan-50 scale-[1.02]'
                    : uploadSuccess ? 'border-green-500 bg-green-50'
                      : uploadProgress !== null ? 'border-cyan-400 bg-white'
                        : 'border-gray-300 hover:border-cyan-400 hover:bg-gray-50'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {uploadSuccess ? (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 mb-3 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-green-600 mb-1">Uploaded Successfully!</h3>
                    <p className="text-sm text-green-700">Your report is now saved and visible below.</p>
                  </div>

                ) : uploadProgress !== null ? (
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 mb-3 relative">
                      <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="34" stroke="#e2e8f0" strokeWidth="6" fill="none" />
                        <circle
                          cx="40" cy="40" r="34"
                          stroke="#06b6d4" strokeWidth="6" fill="none"
                          strokeDasharray="213.6"
                          strokeDashoffset={213.6 - (213.6 * uploadProgress) / 100}
                          strokeLinecap="round"
                          className="transition-all duration-300"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-cyan-600">
                        {uploadProgress}%
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-2 max-w-xs truncate">{selectedFile?.name}</p>
                    <p className="text-xs text-gray-500">Uploading to Firebase…</p>
                  </div>

                ) : (
                  <>
                    <div className="w-12 h-12 mb-2 rounded-xl bg-white border border-cyan-100 flex items-center justify-center shadow-sm">
                      <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Drop files here</h3>
                    <p className="text-xs text-gray-500 mb-4">or click to browse your device</p>
                    <div className="flex flex-wrap justify-center gap-1.5 mb-2">
                      {['PDF', 'JPG', 'PNG'].map((ext, i) => (
                        <span key={ext} className={`px-2.5 py-1 text-xs font-medium rounded-full border flex items-center gap-1
                          ${i === 0 ? 'border-red-100 text-red-600 bg-white'
                            : i === 1 ? 'border-blue-100 text-blue-600 bg-white'
                              : 'border-green-100 text-green-600 bg-white'}`}>
                          {ext}
                        </span>
                      ))}
                    </div>
                    <input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleFileSelect}
                      accept="image/*,.pdf"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tips Card */}
          <div className="premium-card overflow-hidden h-full flex flex-col">
            <div className="px-5 py-3 bg-white border-b border-gray-100">
              <h2 className="text-md font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-4.5 h-4.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Upload Tips
              </h2>
            </div>
            <div className="p-5 space-y-3.5 flex-1">
              {[
                { color: 'cyan', num: '1', title: 'Clear Images', desc: 'Ensure reports are clearly readable' },
                { color: 'purple', num: '2', title: 'Complete Reports', desc: 'Upload full diagnostic reports' },
                // { color: 'pink', num: '3', title: 'Recent Dates', desc: 'Use reports from the last 6 months' },
                { color: 'green', num: '3', title: 'Multiple Pages', desc: 'Scan all pages of your reports' },
              ].map(({ color, num, title, desc }) => (
                <div key={num} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg bg-${color}-100 flex items-center justify-center flex-shrink-0`}>
                    <span className={`text-${color}-600 font-bold text-xs`}>{num}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recently Uploaded Reports */}
        <div className="premium-card">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Recently Uploaded Reports
                <span className="ml-2 px-2 py-0.5 bg-white border border-cyan-100 text-cyan-600 text-xs font-semibold rounded-full shadow-sm">
                  {filteredReports.length}
                </span>
              </h2>

              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                {/* Search */}
                <div className="relative group w-full md:w-72">
                  <input
                    type="text"
                    placeholder="Search reports..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2.5 pl-11 pr-10 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-sm placeholder:text-gray-400 shadow-sm group-hover:border-gray-300"
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-cyan-600 transition-colors">
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z" />
                    </svg>
                  </div>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all"
                      title="Clear search"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Date filter */}
                <CustomSelect
                  options={dateFilterOptions}
                  value={filterDate}
                  onChange={(val) => setFilterDate(val)}
                  placeholder="All Dates"
                  className="w-full md:w-56"
                />

                {filterDate === 'custom' && (
                  <div className="flex gap-3 items-center">
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-600 mb-1">From Date</label>
                      <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-600 mb-1">To Date</label>
                      <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Report rows */}
          <div className="divide-y divide-gray-100">
            {isLoading ? (
              <div className="px-6 py-12 text-center">
                <div className="w-8 h-8 mx-auto border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-sm text-gray-500">Loading reports…</p>
              </div>
            ) : filteredReports.length > 0 ? (
              filteredReports.map((report) => (
                <div key={report.id} className="px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {getFileIcon(report.type)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-800 truncate text-base sm:text-md mb-0.5">{report.name}</h3>
                      <p className="text-sm text-gray-500 whitespace-nowrap">{report.date} • {report.size}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    {/* View — opens modal viewer */}
                    <button
                      onClick={() => setViewReport(report)}
                      className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors inline-flex items-center"
                      title="View Report"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>

                    {/* Download */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(report); }}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors inline-flex items-center cursor-pointer"
                      title="Download"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => deleteReport(report.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No reports found</p>
                <p className="text-sm text-gray-400 mt-1">Upload a report above to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>

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

      {/* ── Report Viewer Modal - Full Screen ─────────────────────────────────────────── */}
      {viewReport && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewReport(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 truncate max-w-[200px] md:max-w-md">{viewReport.name}</h2>
                <p className="text-sm text-gray-500">{viewReport.date} • {viewReport.size}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDownload(viewReport)}
                className="hidden md:flex px-5 py-2.5 bg-cyan-600 text-white rounded-xl font-semibold hover:bg-cyan-700 transition-all shadow-md hover:shadow-lg items-center gap-2 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
              <button
                onClick={() => setViewReport(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-gray-50 overflow-auto p-4 md:p-8">
            <div className="max-w-5xl mx-auto h-full bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center p-2 md:p-4">
              {viewReport.type === 'image' ? (
                <img
                  src={viewReport.fileData}
                  alt={viewReport.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <iframe
                  src={viewReport.fileData}
                  title={viewReport.name}
                  className="w-full h-full border-none rounded-xl"
                />
              )}
            </div>
          </div>

          {/* Mobile Actions */}
          <div className="md:hidden p-4 border-t border-gray-100 bg-white">
            <button
              onClick={() => handleDownload(viewReport)}
              className="w-full py-3 bg-cyan-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Report
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-8 right-8 z-[120] bg-gray-900 border border-gray-700 text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 transition-opacity duration-300">
          {toastMsg.includes('Error') ? (
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span className="font-semibold text-sm tracking-wide">{toastMsg}</span>
        </div>
      )}

    </Layout>
  );
};

export default UploadReport;
