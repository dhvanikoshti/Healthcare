import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import AdminLayout from '../components/AdminLayout';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import CustomSelect from '../components/CustomSelect';

const defaultCategories = ['All', 'Sleep', 'Diabetes', 'Heart Health', 'Weight Loss', 'Prevention', 'Nutrition', 'Endocrine', 'Lifestyle', 'Mental Health'];

const categoryColors = {
  'Sleep': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Diabetes': { bg: 'bg-red-100', text: 'text-red-700' },
  'Heart Health': { bg: 'bg-pink-100', text: 'text-pink-700' },
  'Weight Loss': { bg: 'bg-green-100', text: 'text-green-700' },
  'Prevention': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'Nutrition': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Endocrine': { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Lifestyle': { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  'Mental Health': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
};

const AdminHealthTips = () => {
  const [healthTips, setHealthTips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHealthTips();
  }, []);

  const fetchHealthTips = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'healthTips'), orderBy('createdAt', 'desc'), limit(20));
      const querySnapshot = await getDocs(q);
      const tips = [];
      querySnapshot.forEach((doc) => {
        tips.push({ id: doc.id, ...doc.data() });
      });
      // For older tips without createdAt fallback to their original order or date
      setHealthTips(tips);
    } catch (err) {
      console.error("Error fetching health tips: ", err);
      showToastMessage('Failed to load health tips', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedTip, setSelectedTip] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const formatContent = (text) => {
    if (!text) return '';
    const lines = text.split('\n');
    let html = '';
    let inList = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) {
          html += '<ul class="list-disc pl-6 mb-4 space-y-2 text-gray-700 marker:text-cyan-500">';
          inList = true;
        }
        let itemText = trimmed.substring(2);
        if (itemText.includes(':')) {
          const parts = itemText.split(':');
          itemText = `<strong>${parts[0]}:</strong>${parts.slice(1).join(':')}`;
        }
        html += `<li class="leading-relaxed">${itemText}</li>`;
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        if (trimmed) {
          html += `<p class="mb-4 text-gray-700 leading-relaxed">${trimmed}</p>`;
        }
      }
    });

    if (inList) {
      html += '</ul>';
    }
    return html;
  };
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const [formData, setFormData] = useState({
    title: '',
    shortDesc: '',
    category: 'Diabetes',
    image: '',
  });

  const [sections, setSections] = useState([
    { id: 1, title: '', content: '' }
  ]);
  const [customCategory, setCustomCategory] = useState('');

  const allCategories = ['All', ...new Set([
    ...defaultCategories.slice(1),
    ...healthTips.map(tip => tip.category).filter(Boolean)
  ])];

  const showToastMessage = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const addSection = () => {
    setSections([...sections, { id: Date.now(), title: '', content: '' }]);
  };

  const removeSection = (id) => {
    if (sections.length > 1) {
      setSections(sections.filter(s => s.id !== id));
    }
  };

  const updateSection = (id, field, value) => {
    setSections(sections.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const totalTips = healthTips.length;

  const getCurrentCategories = () => {
    return allCategories.filter(c => c !== 'All');
  };

  const filteredTips = healthTips.filter(tip => {
    const matchesSearch = tip.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tip.shortDesc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || tip.category === categoryFilter;
    return matchesCategory && matchesSearch;
  });

  const parseHtmlToSections = (html) => {
    if (!html) return [{ id: Date.now(), title: '', content: '' }];
    const sectionsArr = [];
    const div = document.createElement('div');
    div.innerHTML = html;

    let currentTitle = '';
    let currentContent = '';

    Array.from(div.children).forEach(node => {
      if (node.tagName.toLowerCase() === 'h2') {
        if (currentContent || currentTitle) {
          sectionsArr.push({ id: Date.now() + sectionsArr.length, title: currentTitle, content: currentContent.trim() });
        }
        currentTitle = node.textContent;
        currentContent = '';
      } else {
        currentContent += (currentContent ? '\n\n' : '') + node.textContent;
      }
    });

    if (currentContent || currentTitle) {
      sectionsArr.push({ id: Date.now() + sectionsArr.length, title: currentTitle, content: currentContent.trim() });
    }

    return sectionsArr.length > 0 ? sectionsArr : [{ id: Date.now(), title: '', content: div.textContent }];
  };

  const handleOpenModal = (mode, tip = null) => {
    setCustomCategory('');
    if (mode === 'add') {
      setFormData({
        title: '',
        shortDesc: '',
        category: 'Diabetes',
        image: '',
      });
      setSections([{ id: Date.now(), title: '', content: '' }]);
      setSelectedTip(null);
    } else if (mode === 'edit' && tip) {
      setFormData({ ...tip });
      setSections(tip.sections || parseHtmlToSections(tip.content));
      setSelectedTip(tip);
    } else if (mode === 'view' && tip) {
      setSelectedTip(tip);
    }
    setModalMode(mode);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTip(null);
    setImagePreview(null);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToastMessage('Image must be under 5MB', 'error');
        return;
      }

      try {
        showToastMessage('Uploading image...', 'success');

        // Show local preview immediately
        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);

        // Upload to Cloudinary
        const result = await uploadToCloudinary(file);
        const cloudUrl = result.secure_url;

        setFormData({ ...formData, image: cloudUrl });
        setImagePreview(null); // Clear preview once we have the real URL
        showToastMessage('Image uploaded successfully!', 'success');
      } catch (err) {
        console.error('Upload error:', err);
        showToastMessage(err.message || 'Failed to upload image.', 'error');
        setImagePreview(null);
      }
    }
  };

  const downloadPDF = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      showToastMessage('Generating PDF... please wait.', 'success');

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      let cursorY = 25;

      // 1. Header & Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(38, 59, 106); // #263B6A

      const titleLines = doc.splitTextToSize(selectedTip.title || 'Health Tip', contentWidth);
      doc.text(titleLines, margin, cursorY);
      cursorY += (titleLines.length * 10) + 5;

      // 2. Category Badge
      if (selectedTip.category) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(6, 182, 212); // #06b6d4
        doc.text(selectedTip.category.toUpperCase(), margin, cursorY);
        cursorY += 8;
      }

      // 3. Description
      if (selectedTip.shortDesc) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139); // #64748b
        const descLines = doc.splitTextToSize(selectedTip.shortDesc, contentWidth);
        doc.text(descLines, margin, cursorY);
        cursorY += (descLines.length * 7) + 10;
      }

      // 4. Horizontal Line
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 15;

      // 5. Main Content
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85); // #334155

      const processText = (text) => {
        if (!text) return [];
        // Basic clean up of HTML tags if present
        const cleanText = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
        return doc.splitTextToSize(cleanText, contentWidth);
      };

      if (selectedTip.sections && selectedTip.sections.length > 0) {
        selectedTip.sections.forEach((section) => {
          // Check for page overflow
          if (cursorY > pageHeight - 30) {
            doc.addPage();
            cursorY = 20;
          }

          if (section.title) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(38, 59, 106);
            doc.text(section.title, margin, cursorY);
            cursorY += 8;
          }

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          doc.setTextColor(51, 65, 85);
          const lines = processText(section.content);

          lines.forEach(line => {
            if (cursorY > pageHeight - 20) {
              doc.addPage();
              cursorY = 20;
            }
            doc.text(line, margin, cursorY);
            cursorY += 6;
          });
          cursorY += 10;
        });
      } else {
        const lines = processText(selectedTip.content);
        lines.forEach(line => {
          if (cursorY > pageHeight - 20) {
            doc.addPage();
            cursorY = 20;
          }
          doc.text(line, margin, cursorY);
          cursorY += 6;
        });
      }

      // 6. Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Healthcare App • Health Tips • Page ${i} of ${totalPages}`, margin, pageHeight - 10);
      }

      doc.save(`${selectedTip.title ? selectedTip.title.replace(/\s+/g, '_') : 'health_tip'}.pdf`);
      showToastMessage('PDF downloaded successfully!', 'success');

    } catch (error) {
      console.error('Error generating PDF:', error);
      showToastMessage('Failed to trigger download. Generating print view...', 'error');
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSave = async () => {
    const finalCategory = formData.category === 'custom_new' ? (customCategory.trim() || 'Other') : formData.category;

    try {
      if (modalMode === 'add') {
        const docRef = await addDoc(collection(db, 'healthTips'), {
          ...formData,
          category: finalCategory,
          sections: sections,
          createdAt: serverTimestamp()
        });
        showToastMessage('Health tip added successfully!', 'success');
      } else if (modalMode === 'edit') {
        const tipRef = doc(db, 'healthTips', selectedTip.id);

        // Exclude ID and other metadata from the update payload to keep Firestore clean
        const { id, ...updateData } = formData;

        const tipUpdate = {
          ...updateData,
          category: finalCategory,
          sections: sections,
        };
        if (!selectedTip.createdAt) {
          tipUpdate.createdAt = serverTimestamp();
        }
        await updateDoc(tipRef, tipUpdate);
        showToastMessage('Health tip updated successfully!', 'success');
      }
      fetchHealthTips(); // Refresh list
      handleCloseModal();
    } catch (err) {
      console.error("Error saving tip: ", err);
      showToastMessage('Failed to save health tip', 'error');
    }
  };

  const triggerDelete = (id) => {
    setDeleteConfirm({ show: true, id });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.id) {
      try {
        await deleteDoc(doc(db, 'healthTips', deleteConfirm.id));
        showToastMessage('Health tip deleted successfully!', 'success');
        fetchHealthTips();
      } catch (err) {
        console.error("Error deleting tip: ", err);
        showToastMessage('Failed to delete health tip', 'error');
      }
    }
    setDeleteConfirm({ show: false, id: null });
  };

  return (
    <AdminLayout
      title={showModal ? "Health Tips Management" : "Health Tips Management"}
      subtitle={showModal ? "Creating or editing health tips." : "View and manage all health tips articles"}
      headerActions={
        !showModal && (
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">


            <button
              onClick={() => handleOpenModal('add')}
              className="px-6 py-2.5 bg-[#263B6A] text-white font-bold rounded-xl shadow-md hover:bg-[#1f3057] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap flex-1 lg:flex-none"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add New Tip
            </button>
          </div>
        )
      }
    >
      {showModal ? (
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-gray-100 min-h-screen">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex w-14 h-14 bg-[#263B6A] rounded-2xl items-center justify-center shadow-lg shadow-blue-900/20 shrink-0">
                {modalMode === 'add' ? (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                ) : modalMode === 'edit' ? (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                ) : (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-[#263B6A] pb-1">
                  {modalMode === 'add' ? 'Create Health Tip' : modalMode === 'edit' ? 'Edit Health Tip' : 'Health Tip Details'}
                </h2>
                <p className="text-gray-500 text-sm font-medium mt-1">
                  {modalMode === 'add' ? 'Publish a new tip to help the community.' : modalMode === 'edit' ? 'Update the details of this health tip.' : 'Review tip details before managing.'}
                </p>
              </div>
            </div>
            <button onClick={handleCloseModal} className="px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-white hover:border-gray-300 transition-all flex items-center justify-center gap-2 shadow-sm w-full md:w-auto shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to List
            </button>
          </div>

          {modalMode === 'view' && selectedTip ? (
            <div className="space-y-8" id="admin-print-content">
              {/* Hero Image with Gradient Overlay */}
              <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden shadow-lg">
                <img src={selectedTip.image} alt={selectedTip.title} crossOrigin="anonymous" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                <div className="absolute top-6 right-6">
                  <span className="px-5 py-2 bg-cyan-600/90 backdrop-blur-sm text-white text-sm font-bold rounded-full shadow-lg border border-cyan-400/30">
                    {selectedTip.category}
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white shadow-sm mb-4">{selectedTip.title}</h1>
                  <p className="text-white/90 text-lg max-w-3xl">{selectedTip.shortDesc}</p>
                </div>
              </div>

              {/* Share & Download Section */}
              <div className="flex flex-col sm:flex-row items-center justify-end py-6 px-8 bg-white rounded-2xl border border-gray-100 gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const text = `Check out this health tip: ${selectedTip.title} - ${selectedTip.shortDesc}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    className="px-5 py-2.5 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Share
                  </button>
                  <button
                    onClick={downloadPDF}
                    disabled={isDownloading}
                    className={`px-5 py-2.5 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 ${isDownloading ? 'bg-cyan-400 cursor-wait' : 'bg-cyan-600 hover:bg-cyan-700'}`}
                  >
                    {isDownloading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    )}
                    {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
                  </button>
                </div>
              </div>

              {/* Content Section */}
              <div className="p-8 md:p-12 bg-white">
                {selectedTip.sections ? (
                  <div className="prose prose-lg md:prose-xl max-w-none">
                    {selectedTip.sections.map((section, idx) => (
                      <div key={idx} className="mb-8">
                        {section.title && (
                          <h2 className="text-2xl md:text-3xl font-bold text-[#263B6A] mb-5">{section.title}</h2>
                        )}
                        <div dangerouslySetInnerHTML={{ __html: formatContent(section.content) }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="prose prose-lg md:prose-xl max-w-none prose-headings:text-[#263B6A] prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-cyan-600 hover:prose-a:text-cyan-700"
                    dangerouslySetInnerHTML={{ __html: selectedTip.content }}
                  />
                )}
              </div>


              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-4" id="admin-action-buttons">
                <button onClick={() => {
                  setFormData({ ...selectedTip });
                  setSections(selectedTip.sections || parseHtmlToSections(selectedTip.content));
                  setModalMode('edit');
                }} className="px-6 py-3 bg-[#547792] text-white font-bold rounded-xl hover:bg-[#45667d] transition-all flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Edit Article
                </button>
                <button onClick={() => { triggerDelete(selectedTip.id); handleCloseModal(); }} className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 max-w-5xl mx-auto">
              {/* Form implementation */}
              <div className="space-y-6 bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-inner">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Title <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-5 py-3.5 bg-white border-2 border-gray-200 rounded-xl text-gray-800 font-medium focus:outline-none focus:border-[#263B6A] transition-all shadow-sm" placeholder="e.g., 5 Simple Daily Habits for Better Sleep" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Short Description <span className="text-red-500">*</span></label>
                  <textarea value={formData.shortDesc} onChange={(e) => setFormData({ ...formData, shortDesc: e.target.value })} className="w-full px-5 py-3.5 bg-white border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-[#263B6A] transition-all shadow-sm" rows={3} placeholder="A concise summary of the article..." />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Category <span className="text-red-500">*</span></label>
                    <CustomSelect
                      options={[
                        ...getCurrentCategories().map(cat => ({ label: cat, value: cat })),
                        { label: '-- Add New Category --', value: 'custom_new' }
                      ]}
                      value={formData.category}
                      onChange={(val) => {
                        if (val === 'custom_new') {
                          setFormData({ ...formData, category: 'custom_new' });
                        } else {
                          setFormData({ ...formData, category: val });
                          setCustomCategory('');
                        }
                      }}
                      placeholder="Select Category"
                    />
                    {formData.category === 'custom_new' && (
                      <input type="text" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} className="w-full mt-3 px-5 py-3.5 bg-white border-2 border-gray-200 rounded-xl text-gray-800 font-medium focus:outline-none focus:border-[#263B6A] transition-all shadow-sm" placeholder="Enter new category name" />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Cover Image (URL or File) <span className="text-red-500">*</span></label>
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <input
                        type="text"
                        value={formData.image}
                        onChange={(e) => { setFormData({ ...formData, image: e.target.value }); setImagePreview(null); }}
                        placeholder="Paste image URL (e.g. from Unsplash)"
                        className="flex-1 px-5 py-3.5 bg-white border-2 border-gray-200 rounded-xl text-gray-800 font-medium focus:outline-none focus:border-[#263B6A] transition-all shadow-sm"
                      />
                      <div className="flex items-center gap-4 shrink-0 justify-center">
                        <span className="font-bold text-gray-400 uppercase text-sm">OR</span>
                        <label className="px-6 py-3.5 bg-cyan-600 text-white font-bold text-center rounded-xl shadow-lg hover:bg-cyan-700 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          Upload File
                          <input type="file" accept="image/*,.pdf" onChange={handleImageUpload} className="hidden" />
                        </label>
                      </div>
                    </div>

                    {(imagePreview || formData.image) && (
                      <div className="mt-4 flex flex-col items-end gap-3">
                        <div className="w-full rounded-2xl overflow-hidden border-2 border-gray-200 h-64 md:h-80 shadow-md">
                          <img src={imagePreview || formData.image} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <button type="button" onClick={() => { setImagePreview(null); setFormData({ ...formData, image: '' }); }} className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2 text-sm shadow-sm">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Remove Image
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700">Content Sections <span className="text-red-500">*</span></label>
                      <p className="text-xs text-gray-500 mt-1">Break your article into readable sections.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addSection}
                      className="flex items-center gap-2 px-4 py-2 bg-cyan-50 text-cyan-700 text-sm font-bold rounded-xl hover:bg-cyan-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      Add Section
                    </button>
                  </div>

                  <div className="space-y-4">
                    {sections.map((section, index) => (
                      <div key={section.id} className="relative border-2 border-gray-200 rounded-xl p-5 bg-white shadow-sm group">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Section {index + 1}</span>
                          {sections.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSection(section.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                        <div className="space-y-4">
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                            className="w-full px-4 py-3 bg-white border-2 border-transparent rounded-xl text-gray-800 font-medium focus:bg-white focus:outline-none focus:border-[#263B6A] transition-all placeholder-gray-400"
                            placeholder="Optional Subheading (e.g., How It Works)"
                          />
                          <textarea
                            value={section.content}
                            onChange={(e) => updateSection(section.id, 'content', e.target.value)}
                            className="w-full px-4 py-3 bg-white border-2 border-transparent rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:border-[#263B6A] transition-all placeholder-gray-400"
                            rows={4}
                            placeholder="Write the content for this section here..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-8">
                <button onClick={handleCloseModal} className="px-8 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors shadow-sm">Cancel</button>
                <button onClick={handleSave} className="px-8 py-3.5 bg-[#263B6A] text-white font-bold rounded-xl hover:bg-[#152850] hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  {modalMode === 'add' ? 'Publish Health Tip' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">

          <div className="premium-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">Categories Overview</h3>
              <span className="text-sm text-gray-500 font-medium">{healthTips.length} total tips</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
              {allCategories.filter(c => c !== 'All').map((category) => {
                const count = healthTips.filter(t => t.category === category).length;
                const colors = {
                  'Sleep': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
                  'Diabetes': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
                  'Heart Health': { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
                  'Weight Loss': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
                  'Prevention': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
                  'Nutrition': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
                  'Endocrine': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
                  'Lifestyle': { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
                  'Mental Health': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
                };
                const color = colors[category] || { bg: 'bg-white', border: 'border-gray-200', text: 'text-gray-700' };
                return (
                  <button
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 bg-white ${color.border} ${categoryFilter === category ? 'ring-2 ring-offset-2 ring-[#263B6A] scale-105' : 'hover:scale-105 hover:shadow-md'}`}
                  >
                    <span className={`text-xl font-black ${color.text}`}>{count}</span>
                    <span className="text-xs font-semibold text-gray-600 mt-0.5 truncate w-full text-center">{category}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="premium-card p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search health tips..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-100 rounded-xl text-sm sm:text-base font-medium placeholder-gray-400 focus:outline-none focus:border-[#263B6A] transition-all"
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="w-full sm:w-[220px]">
                <CustomSelect
                  options={allCategories}
                  value={categoryFilter}
                  onChange={(cat) => setCategoryFilter(cat)}
                  placeholder="All Categories"
                  className="!shadow-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTips.map((tip) => {
              const tipColors = categoryColors[tip.category] || { bg: 'bg-gray-100', text: 'text-gray-700' };
              return (
                <div
                  key={tip.id}
                  onClick={() => handleOpenModal('view', tip)}
                  className="premium-card overflow-hidden cursor-pointer group flex flex-col h-full"
                >
                  <div className="relative h-52 overflow-hidden shrink-0">
                    <img src={tip.image} alt={tip.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-white/95 backdrop-blur-md text-cyan-800 text-xs font-bold rounded-lg shadow-sm">{tip.category}</span>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-cyan-700 transition-colors line-clamp-2 leading-tight">{tip.title}</h3>
                      <p className="text-gray-600 text-sm mb-2 line-clamp-3 leading-relaxed">{tip.shortDesc}</p>
                    </div>
                    <div className="mt-auto">
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 mt-1">
                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', tip); }} className="p-2.5 text-gray-500 hover:text-cyan-700 hover:bg-white hover:border-cyan-200 border border-transparent rounded-xl transition-all" title="Edit">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); triggerDelete(tip.id); }} className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-white hover:border-red-200 border border-transparent rounded-xl transition-all" title="Delete">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTips.length === 0 && (
            <div className="text-center py-20 premium-card">
              <svg className="w-20 h-20 mx-auto text-gray-300 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              <h3 className="text-xl font-bold text-gray-800 mb-2">No Health Tips Found</h3>
              <p className="text-gray-500">Try adjusting your search or category filter to find what you're looking for.</p>
              <button
                onClick={() => { setSearchTerm(''); setCategoryFilter('All'); }}
                className="mt-6 px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-[70] animate-fade-in-down">
          <div className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.type === 'success' ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
            <span className="font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm({ show: false, id: null })}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl scale-100 transition-all">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-center text-gray-800 mb-2">Delete Health Tip</h3>
            <p className="text-center text-gray-500 mb-8 max-w-xs mx-auto">Are you sure you want to delete this tip? This action cannot be undone.</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirm({ show: false, id: null })} className="flex-1 px-4 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all hover:-translate-y-0.5">Delete</button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
};

export default AdminHealthTips;
