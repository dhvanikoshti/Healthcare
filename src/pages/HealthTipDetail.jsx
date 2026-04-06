import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import Layout from '../components/Layout';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const HealthTipDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tip, setTip] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [relatedTips, setRelatedTips] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToastMessage = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

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

  useEffect(() => {
    const fetchTipDetail = async () => {
      setIsLoading(true);
      try {
        let docRef = doc(db, 'healthTips', id);
        let docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setTip({ id: docSnap.id, ...docSnap.data() });
        } else {
          setTip(null);
        }

        const q = query(collection(db, 'healthTips'), orderBy('createdAt', 'desc'), limit(4));
        const relatedSnap = await getDocs(q);
        const related = [];
        relatedSnap.forEach(d => {
          if (d.id !== id) related.push({ id: d.id, ...d.data() });
        });
        setRelatedTips(related.slice(0, 3));

      } catch (err) {
        console.error('Error fetching tip:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTipDetail();
  }, [id]);

  const shareOnWhatsApp = () => {
    const text = `Check out this health tip: ${tip.title} - ${tip.shortDesc}`;
    const url = window.location.href;
    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
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

      const titleLines = doc.splitTextToSize(tip.title || 'Health Tip', contentWidth);
      doc.text(titleLines, margin, cursorY);
      cursorY += (titleLines.length * 10) + 5;

      // 2. Category Badge
      if (tip.category) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(6, 182, 212); // #06b6d4
        doc.text(tip.category.toUpperCase(), margin, cursorY);
        cursorY += 8;
      }

      // 3. Description
      if (tip.shortDesc) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139); // #64748b
        const descLines = doc.splitTextToSize(tip.shortDesc, contentWidth);
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

      if (tip.sections && tip.sections.length > 0) {
        tip.sections.forEach((section) => {
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
        const lines = processText(tip.content);
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

      doc.save(`${tip.title ? tip.title.replace(/\s+/g, '_') : 'health_tip'}.pdf`);
      showToastMessage('PDF downloaded successfully!', 'success');

    } catch (error) {
      console.error('Error generating PDF:', error);
      showToastMessage('Failed to trigger download. Generating print view...', 'error');
      // Final fallback to browser print if programmatic fails
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-32">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-600"></div>
        </div>
      </Layout>
    );
  }

  if (!tip) {
    return (
      <Layout title="Article Not Found">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 mt-8">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-md mb-6 border border-slate-100">
            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Article Not Found</h2>
          <p className="text-slate-500 mb-8 max-w-sm">We couldn't find the health tip you were looking for. It may have been moved or removed.</p>
          <button
            onClick={() => navigate('/health-tips')}
            className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Explore Health Tips
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Article Details"
      headerActions={
        <button
          onClick={() => navigate('/health-tips')}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white hover:border-slate-300 transition-all flex items-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to List
        </button>
      }
    >
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-gray-100 min-h-screen mb-8">


        <div className="space-y-8" id="print-content">
          {/* Hero Image with Gradient Overlay */}
          <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden shadow-lg">
            <img src={tip.image} alt={tip.title} crossOrigin="anonymous" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
            <div className="absolute top-6 right-6">
              <span className="px-5 py-2 bg-cyan-600/90 backdrop-blur-sm text-white text-sm font-bold rounded-full shadow-lg border border-cyan-400/30">
                {tip.category}
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white shadow-sm mb-4">{tip.title}</h1>
              {tip.shortDesc && <p className="text-white/90 text-lg max-w-3xl">{tip.shortDesc}</p>}
            </div>
          </div>

          {/* Share & Download Section */}
          <div className="flex justify-end py-6 px-8 bg-white rounded-2xl border border-gray-100 gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Share</span>
              <button
                onClick={shareOnWhatsApp}
                className="p-2.5 bg-white text-green-600 border border-green-200 rounded-xl hover:bg-green-500 hover:text-white transition-all shadow-sm"
                title="Share on WhatsApp"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </button>
              <button
                onClick={downloadPDF}
                disabled={isDownloading}
                className={`p-2.5 rounded-xl transition-all shadow-sm border ${isDownloading ? 'bg-white text-gray-400 cursor-wait border-gray-100' : 'bg-white text-gray-600 hover:bg-gray-700 hover:text-white border-gray-200'}`}
                title="Download PDF"
              >
                {isDownloading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* Article Content */}
          <div className="p-8 md:p-12 bg-white">
            {tip.sections ? (
              <div className="prose prose-lg md:prose-xl max-w-none">
                {tip.sections.map((section, idx) => (
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
                dangerouslySetInnerHTML={{ __html: tip.content }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Related Tips */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">More Health Tips</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {relatedTips.map((relatedTip) => (
            <div
              key={relatedTip.id}
              onClick={() => navigate(`/health-tips/${relatedTip.id}`)}
              className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            >
              <img
                src={relatedTip.image}
                alt={relatedTip.title}
                crossOrigin="anonymous"
                className="w-full h-32 object-cover"
              />
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 text-sm line-clamp-2">{relatedTip.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>

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
    </Layout>
  );
};

export default HealthTipDetail;
