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
            <div className="bg-white rounded-3xl p-4 shadow-lg border border-gray-100 h-full">
              <div className="flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Upload Tips</h2>
              </div>

              <div className="space-y-6">
                {[
                  { id: 1, title: 'Clear Images', desc: 'Ensure reports are clearly readable', color: 'cyan' },
                  { id: 2, title: 'Complete Reports', desc: 'Upload full diagnostic reports', color: 'purple' },
                  { id: 3, title: 'Multiple Pages', desc: 'Scan all pages of your reports', color: 'green' },
                ].map((tip) => (
                  <div key={tip.id} className="flex gap-3">
                    <div className={`w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold text-xs border border-cyan-100 shrink-0`}>
                      {tip.id}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-[13px] leading-tight mb-0">{tip.title}</h4>
                      <p className="text-[11px] text-gray-500 line-clamp-1">{tip.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Recently Uploaded Reports */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-800">Recently Uploaded Reports</h2>
              <span className="px-2.5 py-1 bg-cyan-50 text-cyan-600 text-xs font-black rounded-full border border-cyan-100">
                {filteredReports.length}
              </span>
            </div>

            <div className="flex flex-1 items-center gap-2 sm:gap-3 w-full sm:w-auto min-w-0">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs sm:text-sm transition-all truncate"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div className="shrink-0 w-32 sm:w-40">
                <CustomSelect
                  options={[{ label: 'All Dates', value: 'all' }, { label: 'Last Week', value: 'week' }, { label: 'Last Month', value: 'month' }]}
                  value={filterDate}
                  onChange={setFilterDate}
                  placeholder="All Dates"
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {isLoading ? (
              <div className="p-10 text-center">
                <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm font-medium text-gray-500">Loading your history...</p>
              </div>
            ) : filteredReports.length > 0 ? (
              filteredReports.map((report) => (
                <div key={report.id} className="p-3 sm:p-5 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 group-hover:scale-105 transition-transform shrink-0">
                      {getFileIcon(report.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-gray-800 text-sm truncate">{report.name}</h3>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase truncate">{report.date} • {report.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setViewReport(report)} className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-white rounded-lg border border-transparent shadow-sm hover:border-gray-100" title="View"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                    <button onClick={() => handleDownload(report)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-white rounded-lg border border-transparent shadow-sm hover:border-gray-100" title="Download"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                    <button onClick={() => deleteReport(report.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg border border-transparent shadow-sm hover:border-gray-100" title="Delete"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-base font-bold text-gray-800">No history found</h3>
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
