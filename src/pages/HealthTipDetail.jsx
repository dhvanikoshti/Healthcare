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
    const element = document.getElementById('print-content');
    if (!element) {
      setIsDownloading(false);
      return;
    }
    try {
      showToastMessage('Preparing PDF... please wait.', 'success');
      const originalStyle = element.style.cssText;
      element.style.padding = '20px';
      element.style.backgroundColor = 'white';

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, allowTaint: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${tip.title ? tip.title.replace(/\s+/g, '_') : 'health_tip'}.pdf`);

      element.style.cssText = originalStyle;
      showToastMessage('PDF downloaded successfully!', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToastMessage('Could not download PDF cleanly due to restricted external images. Please use window Print.', 'error');
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
      <Layout>
        {/* Attractive Header for Not Found */}
        <div className="mb-8">
          <div className="rounded-2xl p-8 shadow-lg" style={{ backgroundColor: '#263B6A' }}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-white mb-3">Health Tip Detail</h1>
                <p className="text-cyan-100 text-lg">Article not found</p>
              </div>
            </div>
          </div>
        </div>

        {/* Not Found Card */}
        <div className="premium-card p-12 text-center">
          <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-3">Article Not Found</h3>
          <p className="text-gray-500 mb-8 text-lg">The health tip you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => navigate('/health-tips')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Health Tips
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-gray-100 min-h-screen mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex w-14 h-14 bg-[#263B6A] rounded-2xl items-center justify-center shadow-lg shadow-blue-900/20 shrink-0">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-[#263B6A] pb-1">
                Health Tip Details
              </h2>
              <p className="text-gray-500 text-sm font-medium mt-1">
                Read and learn from expert health advice.
              </p>
            </div>
          </div>
          <button onClick={() => navigate('/health-tips')} className="px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-white hover:border-gray-300 transition-all flex items-center justify-center gap-2 shadow-sm w-full md:w-auto shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to List
          </button>
        </div>

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
