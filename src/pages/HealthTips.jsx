import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import Layout from '../components/Layout';

// Fallback images for when external images fail to load
const fallbackImages = [
  'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop',
];

const defaultCategories = ['All', 'Sleep', 'Diabetes', 'Heart Health', 'Weight Loss', 'Prevention', 'Nutrition', 'Endocrine', 'Lifestyle', 'Mental Health'];

const HealthTips = () => {
  const navigate = useNavigate();
  const [healthTips, setHealthTips] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    const fetchTips = async () => {
      try {
        const q = query(collection(db, 'healthTips'), orderBy('createdAt', 'desc'), limit(12));
        const querySnapshot = await getDocs(q);
        const tips = [];
        querySnapshot.forEach((doc) => {
          tips.push({ id: doc.id, ...doc.data() });
        });
        setHealthTips(tips);
      } catch (err) {
        console.error('Error fetching tips:', err);
      } finally {
        setIsDataLoaded(true);
      }
    };
    fetchTips();
  }, []);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [imageErrors, setImageErrors] = useState({});
  const [imageLoading, setImageLoading] = useState({});

  const handleImageError = (id) => {
    setImageErrors(prev => ({ ...prev, [id]: true }));
    setImageLoading(prev => ({ ...prev, [id]: false }));
  };

  const handleImageLoad = (id) => {
    setImageLoading(prev => ({ ...prev, [id]: false }));
  };

  // Initialize loading state for all images and preload images
  useEffect(() => {
    const initialLoading = {};
    const initialErrors = {};
    healthTips.forEach(tip => {
      initialLoading[tip.id] = true;
      initialErrors[tip.id] = false;
    });
    setImageLoading(initialLoading);
    setImageErrors(initialErrors);

    // Preload images using Image constructor for better loading detection
    healthTips.forEach(tip => {
      const img = new Image();
      img.onload = () => {
        setImageLoading(prev => ({ ...prev, [tip.id]: false }));
      };
      img.onerror = () => {
        setImageErrors(prev => ({ ...prev, [tip.id]: true }));
        setImageLoading(prev => ({ ...prev, [tip.id]: false }));
      };
      img.src = tip.image;
    });

    // Fallback timeout to hide loading after 1 second if image doesn't load
    const timeout = setTimeout(() => {
      setImageLoading(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(id => {
          if (updated[id]) {
            updated[id] = false;
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  const getImage = (tip) => {
    if (imageErrors[tip.id]) {
      // Use a hash of string ID if it's a string from firestore
      let hashStr = 0;
      if (typeof tip.id === 'string') {
        for (let i = 0; i < tip.id.length; i++) hashStr += tip.id.charCodeAt(i);
      } else {
        hashStr = tip.id;
      }
      return fallbackImages[hashStr % fallbackImages.length];
    }
    return tip.image;
  };

  const filteredTips = healthTips.filter(tip => {
    const matchesCategory = selectedCategory === 'All' || tip.category === selectedCategory;
    const matchesSearch = tip.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tip.shortDesc.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate dynamic counts
  const allCategories = ['All', ...new Set([
    ...defaultCategories.slice(1),
    ...healthTips.map(tip => tip.category).filter(Boolean)
  ])];
  const totalArticles = healthTips.length;
  const totalCategories = allCategories.filter(c => c !== 'All').length;

  return (
    <Layout
      title="Health Tips & Articles"
      headerActions={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg border border-slate-200/50 text-[10px] font-bold uppercase tracking-widest shadow-sm">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.993 7.993 0 002 12a7.993 7.993 0 007 7.196V4.804zM11 4.804v14.392A7.993 7.993 0 0018 12a7.993 7.993 0 00-7-7.196z" />
            </svg>
            {totalArticles} Articles
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg border border-slate-200/50 text-[10px] font-bold uppercase tracking-widest shadow-sm">
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 13h10v-2H7v2zm0-4h10V7H7v2zm0 8h10v-2H7v2zM5 21h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2z" />
            </svg>
            {totalCategories} Categories
          </div>
        </div>
      }
    >

      {/* Search & Filter */}
      <div className="premium-card p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search health tips..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-12 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
          {allCategories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === category
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Tips Grid */}
      {!isDataLoaded && (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTips.map((tip) => (
          <div
            key={tip.id}
            onClick={() => navigate(`/health-tips/${tip.id}`)}
            className="premium-card overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
          >
            {/* Image */}
            <div className="relative h-48 overflow-hidden">
              {imageLoading[tip.id] && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <img
                src={getImage(tip)}
                alt={tip.title}
                className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${imageLoading[tip.id] ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => handleImageLoad(tip.id)}
                onError={() => handleImageError(tip.id)}
                loading="lazy"
              />
              <div className="absolute top-3 left-3">
                <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-cyan-700 text-xs font-semibold rounded-full">
                  {tip.category}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-cyan-600 transition-colors line-clamp-2">
                {tip.title}
              </h3>
              <p className="text-gray-500 text-sm mb-1 line-clamp-2">
                {tip.shortDesc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* No Results */}
      {filteredTips.length === 0 && (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No tips found</h3>
          <p className="text-gray-500">Try adjusting your search or filter</p>
        </div>
      )}
    </Layout>
  );
};

export default HealthTips;
