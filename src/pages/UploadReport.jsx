import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp, updateDoc
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

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);

  // View modal state
  const [viewReport, setViewReport] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [isViewerLoading, setIsViewerLoading] = useState(false);

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

  const handleUpload = useCallback(async (file) => {
    if (!currentUser) {
      setUploadError('You must be logged in to upload reports.');
      return;
    }
    if (!file) return;

    const maxMB = 10;
    if (file.size > maxMB * 1024 * 1024) {
      setUploadError(`File too large. Please upload a file under ${maxMB} MB.`);
      return;
    }

    setUploadError(null);
    setUploadProgress(0);
    setUploadSuccess(false);

    try {
      setUploadProgress(15);

      // 1. Upload the file to Cloudinary
      const result = await uploadToCloudinary(file);
      const fileUrl = result.secure_url;
      setUploadProgress(40);

      // 2. Save basic report
      const reportData = {
        name: file.name,
        date: new Date().toISOString().split('T')[0],
        type: file.type.includes('pdf') ? 'pdf' : 'image',
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        fileData: fileUrl,
        createdAt: serverTimestamp(),
        status: 'Processing',
        analysis: null
      };

      const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'reports'), reportData);
      setUploadProgress(60);

      // 3. Send to n8n for AI Analysis
      try {
        const formData = new FormData();
        formData.append('data', file);
        formData.append('fileName', file.name);
        formData.append('userId', currentUser.uid);
        formData.append('reportId', docRef.id);

        const n8nResponse = await fetch('http://localhost:5678/webhook/medical-report-analyze', {
          method: 'POST',
          body: formData,
        });

        if (n8nResponse.ok) {
          const responseText = await n8nResponse.text();
          if (responseText) {
            let rawData;
            try { rawData = JSON.parse(responseText); } catch (e) { console.warn('Non-JSON response'); }
            if (rawData) {
              setUploadProgress(85);
              let aiAnalysisData = Array.isArray(rawData) ? rawData[0] : rawData;
              if (aiAnalysisData && aiAnalysisData.item) aiAnalysisData = aiAnalysisData.item;

              const analyzedCategory = (aiAnalysisData.report_category || aiAnalysisData.report_type || aiAnalysisData.category || aiAnalysisData.type || 'Blood Test').toString().trim();

              await updateDoc(doc(db, 'users', currentUser.uid, 'reports', docRef.id), {
                analysis: aiAnalysisData,
                category: analyzedCategory,
                status: 'Analyzed'
              });
            } else {
              throw new Error("Invalid response format from AI Engine");
            }
          }
        } else {
          throw new Error(`AI Engine returned error: ${n8nResponse.statusText}`);
        }
      } catch (n8nErr) {
        console.error('n8n error:', n8nErr);
        // Mark as failed in DB so it doesn't spin forever
        await updateDoc(doc(db, 'users', currentUser.uid, 'reports', docRef.id), {
          status: 'Failed'
        });
        throw new Error('Could not connect to AI Engine. Is n8n running on port 5678?');
      }

      setUploadProgress(100);
      await fetchReports(currentUser);
      setUploadSuccess(true);

    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload report.');
    } finally {
      setTimeout(() => {
        setUploadProgress(null);
        setUploadSuccess(false);
        setSelectedFile(null);
      }, 3000);
    }
  }, [currentUser, fetchReports]);

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

  const handleDownload = async (report) => {
    if (!report.fileData) return;
    try {
      const response = await fetch(report.fileData, { mode: 'cors' });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.name || "medical_report";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setToastMsg(`Successfully downloaded ${report.name.substring(0, 15)}...`);
    } catch (error) {
      window.open(report.fileData, '_blank');
      setToastMsg('Opening report in new tab for download...');
    } finally { setTimeout(() => setToastMsg(''), 4000); }
  };

  const deleteReport = (id) => {
    setReportToDelete(recentReports.find(r => r.id === id));
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!reportToDelete || !currentUser) return closeDeleteModal();
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'reports', reportToDelete.id));
      setRecentReports(prev => prev.filter(r => r.id !== reportToDelete.id));
    } catch (err) { console.error('Delete error:', err); }
    closeDeleteModal();
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setReportToDelete(null);
  };

  const getFileIcon = (type) => {
    if (type === 'pdf') {
      return (
        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 18a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5H10a1.5 1.5 0 010 3H9v.5a.5.5 0 01-.5.5zm1-2h.5a.5.5 0 000-1H9.5v1zm4 2a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5H15a1.5 1.5 0 010 3H14v.5a.5.5 0 01-.5.5z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
      </svg>
    );
  };

  const filteredReports = recentReports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesDate = true;
    if (filterDate === 'week') {
      matchesDate = new Date(report.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (filterDate === 'month') {
      matchesDate = new Date(report.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    return matchesSearch && matchesDate;
  });

  useEffect(() => {
    const fetchBlob = async () => {
      if (!viewReport) return;
      setIsViewerLoading(true);
      if (viewReport.type === 'pdf' && viewReport.fileData) {
        try {
          const response = await fetch(viewReport.fileData);
          const blob = await response.blob();
          setBlobUrl(URL.createObjectURL(blob));
        } catch (err) { setBlobUrl(viewReport.fileData); }
        finally { setIsViewerLoading(false); }
      } else if (viewReport.type === 'image') {
        setBlobUrl(viewReport.fileData);
        setIsViewerLoading(false);
      }
    };
    fetchBlob();
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    };
  }, [viewReport]);

  return (
    <Layout
      title="Upload & Analysis"
      headerActions={
        <div className="flex items-center gap-3">

        </div>
      }
    >
      <div className="w-full space-y-6">

        {/* Main Section: Dropzone and Tips */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Upload Interface */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl p-4 shadow-lg border border-gray-100 h-full">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Upload Report</h2>
              </div>

              <div
                className={`relative border-2 border-dashed rounded-3xl p-4 text-center transition-all duration-300 min-h-[120px] flex flex-col items-center justify-center
                  ${dragActive ? 'border-cyan-500 bg-cyan-50'
                    : uploadSuccess ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-cyan-400 hover:bg-gray-50'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {uploadSuccess ? (
                  <div className="animate-in zoom-in duration-300">
                    <div className="w-16 h-16 mb-2 rounded-full bg-green-100 flex items-center justify-center mx-auto shadow-inner">
                      <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-green-600">Upload Complete!</h3>
                  </div>
                ) : uploadProgress !== null ? (
                  <div className="w-full max-w-sm px-6 py-4 animate-in fade-in zoom-in duration-500">
                    <div className="flex flex-col items-center">
                      {/* Animated Upload Icon */}
                      <div className="relative mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-cyan-50 flex items-center justify-center border border-cyan-100 shadow-sm relative z-10">
                          <svg className={`w-8 h-8 text-cyan-600 ${uploadProgress < 100 ? 'animate-bounce' : 'animate-pulse'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        {/* Pulse rings */}
                        <div className="absolute inset-0 w-16 h-16 bg-cyan-400 rounded-2xl animate-ping opacity-20"></div>
                      </div>

                      <div className="w-full space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-cyan-600 uppercase tracking-widest mb-1">
                              {uploadProgress < 40 ? 'Initializing...' :
                                uploadProgress < 70 ? 'Uploading to Server...' :
                                  uploadProgress < 95 ? 'AI Analysis in Progress...' : 'Finalizing Results...'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase">
                              {selectedFile?.name || 'Medical Document'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black text-gray-800 tracking-tighter">{uploadProgress}%</span>
                          </div>
                        </div>

                        {/* Premium Glowing Progress Bar */}
                        <div className="relative h-3 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                          <div
                            style={{ width: `${uploadProgress}%` }}
                            className="h-full bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-500 transition-all duration-700 ease-out relative"
                          >
                            {/* Moving light effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-20 animate-shimmer"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 mb-2 rounded-xl bg-cyan-50 flex items-center justify-center border border-cyan-100 shadow-sm">
                      <svg className="w-8 h-8 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-0.5">Drop files here</h3>
                    <p className="text-xs text-gray-400 mb-4">or click to browse your device</p>

                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-red-50 text-red-500 border border-red-100 rounded-md text-[10px] font-bold">PDF</span>
                      <span className="px-3 py-1 bg-blue-50 text-blue-500 border border-blue-100 rounded-md text-[10px] font-bold">JPG</span>
                      <span className="px-3 py-1 bg-green-50 text-green-500 border border-green-100 rounded-md text-[10px] font-bold">PNG</span>
                    </div>

                    <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileSelect} accept="image/*,.pdf" />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Upload Tips */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-6 shadow-xl shadow-gray-200/50 border border-gray-100 h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-100 rounded-full blur-[50px] opacity-40 -mr-10 -mt-10 pointer-events-none"></div>
              
              <div className="flex items-center gap-3 mb-8 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center border border-purple-100/50">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-800 tracking-tight">Upload Tips</h2>
                  <p className="text-xs text-gray-400 font-medium">For best analysis results</p>
                </div>
              </div>

              <div className="space-y-4 relative z-10">
                {[
                  { id: 1, title: 'Clear Images', desc: 'Ensure reports are well-lit and clearly readable', colorClasses: 'bg-cyan-50 text-cyan-600 border-cyan-100', hoverClasses: 'group-hover:bg-cyan-100', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' },
                  { id: 2, title: 'Complete Pages', desc: 'Upload all pages of your diagnostic reports', colorClasses: 'bg-purple-50 text-purple-600 border-purple-100', hoverClasses: 'group-hover:bg-purple-100', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                  { id: 3, title: 'Formats Supported', desc: 'We support PDF, JPG, and PNG up to 10MB', colorClasses: 'bg-green-50 text-green-600 border-green-100', hoverClasses: 'group-hover:bg-green-100', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
                ].map((tip) => (
                  <div key={tip.id} className="flex gap-4 p-4 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 group cursor-default">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 transition-all duration-300 group-hover:scale-110 border ${tip.colorClasses} ${tip.hoverClasses}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tip.icon} /></svg>
                    </div>
                    <div className="flex flex-col justify-center">
                      <h4 className="font-bold text-gray-800 text-[13px] mb-0.5">{tip.title}</h4>
                      <p className="text-[11px] text-gray-500 leading-snug">{tip.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Recently Uploaded Reports */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-cyan-50/50 to-transparent rounded-full blur-[80px] -mt-40 -mr-40 pointer-events-none"></div>
          
          <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 bg-white/50 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-100/50 flex items-center justify-center border border-cyan-200/50 shadow-sm">
                <svg className="w-6 h-6 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800 tracking-tight flex items-center gap-3">
                  Upload History
                  <span className="px-2.5 py-1 bg-cyan-50 text-cyan-700 text-xs font-bold rounded-lg border border-cyan-100">
                    {filteredReports.length}
                  </span>
                </h2>
                <p className="text-xs text-gray-500 font-medium tracking-wide mt-1">Manage and access your previous reports</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 pr-4 py-2.5 w-full md:w-64 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 text-sm shadow-sm transition-all text-gray-700 font-medium placeholder-gray-400 group-hover:border-gray-300"
                />
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-cyan-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <CustomSelect
                options={[{ label: 'All Dates', value: 'all' }, { label: 'Last Week', value: 'week' }, { label: 'Last Month', value: 'month' }]}
                value={filterDate}
                onChange={setFilterDate}
                placeholder="All Dates"
                className="w-40 shadow-sm"
              />
            </div>
          </div>

          <div className="p-4 md:p-6 bg-gray-50/30 max-h-[600px] overflow-y-auto relative z-10">
            {isLoading ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm font-bold text-gray-500 animate-pulse">Loading report history...</p>
              </div>
            ) : filteredReports.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredReports.map((report) => (
                  <div key={report.id} className="bg-white p-5 rounded-2xl border border-gray-100 hover:border-cyan-200 shadow-sm hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-300 group flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center border border-gray-200 group-hover:scale-110 group-hover:shadow-md transition-all duration-300 shrink-0">
                          {getFileIcon(report.type)}
                        </div>
                        <div className="truncate pr-2">
                          <h3 className="font-bold text-gray-800 text-sm truncate group-hover:text-cyan-600 transition-colors">{report.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-500 font-semibold bg-gray-100 px-2 py-0.5 rounded-md">{report.date}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0"></span>
                            <span className="text-[10px] text-gray-500 font-semibold uppercase">{report.size}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1.5 flex items-center gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          report.status === 'Analyzed' ? 'bg-green-50 text-green-600 border border-green-100' :
                          report.status === 'Processing' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          report.status === 'Failed' ? 'bg-red-50 text-red-600 border border-red-100' :
                          'bg-gray-50 text-gray-600 border border-gray-100'
                        }`}>
                          {report.status === 'Analyzed' && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                          {report.status === 'Processing' && <div className="w-3 h-3 border-[2.5px] border-amber-600 border-t-transparent rounded-full animate-spin"></div>}
                          {report.status === 'Failed' && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>}
                          {report.status || 'Uploaded'}
                        </span>
                        
                        {report.category && report.status === 'Analyzed' && (
                          <span className="px-2.5 py-1.5 bg-purple-50 text-purple-600 border border-purple-100 rounded-lg text-[10px] font-black uppercase tracking-wider truncate max-w-[120px]">
                            {report.category}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewReport(report)} className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all" title="View">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        <button onClick={() => handleDownload(report)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all" title="Download">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                        <button onClick={() => deleteReport(report.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-5 border border-gray-100 shadow-sm">
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">No uploads yet</h3>
                <p className="text-sm font-medium text-gray-500">Your report history will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isDeleteModalOpen && reportToDelete && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in" onClick={closeDeleteModal}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-100">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2 uppercase">Delete?</h2>
              <p className="text-gray-500 font-medium text-sm mb-10">Permanently delete <strong>{reportToDelete.name}</strong>?</p>
              <div className="flex flex-col gap-3">
                <button onClick={confirmDelete} className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-lg active:scale-95">Yes, Delete</button>
                <button onClick={closeDeleteModal} className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-gray-200 transition-all active:scale-95">No, Keep It</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewReport && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in">
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100 bg-white shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => setViewReport(null)} className="p-2.5 hover:bg-gray-100 rounded-2xl transition-colors">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight leading-none mb-1">{viewReport.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-bold">{viewReport.date}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                  <span className="text-xs font-black text-cyan-600 uppercase tracking-widest">{viewReport.type}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => handleDownload(viewReport)} className="hidden md:flex px-6 py-3 bg-cyan-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-cyan-700 transition-all shadow-lg items-center gap-2 active:scale-95">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download
              </button>
              <button onClick={() => setViewReport(null)} className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-50 overflow-auto p-4 md:p-10 flex items-center justify-center">
            <div className="w-full max-w-5xl h-full bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 relative overflow-hidden flex items-center justify-center">
              {isViewerLoading ? (
                <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
              ) : viewReport.type === 'image' ? (
                <img src={blobUrl || viewReport.fileData} alt="View" className="max-w-full max-h-full object-contain p-4 animate-in zoom-in" />
              ) : (
                <iframe src={`${blobUrl || viewReport.fileData}#toolbar=0`} className="w-full h-full border-none" />
              )}
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-10 right-10 z-[120] bg-gray-900/95 backdrop-blur-xl border border-gray-800 text-white px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 duration-500">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${toastMsg.includes('Error') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
            {toastMsg.includes('Error') ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            )}
          </div>
          <span className="font-bold text-sm">{toastMsg}</span>
        </div>
      )}
    </Layout>
  );
};

export default UploadReport;
