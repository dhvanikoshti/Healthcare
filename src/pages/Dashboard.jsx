import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import Layout from '../components/Layout';

const quickActions = [
  { name: 'Upload Report', path: '/upload', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12', color: '#06b6d4' },
  { name: 'View Reports', path: '/reports', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: '#8b5cf6' },
  { name: 'Risk Assessment', path: '/risk', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: '#f59e0b' },
  { name: 'Trend Analysis', path: '/trends', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z', color: '#10b981' },
];

const healthTips = [
  { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', title: 'Regular Checkups', desc: 'Schedule annual health screenings' },
  { icon: 'M13 10V3L4 14h7v7l9-11h-7z', title: 'Stay Active', desc: '30 mins of exercise daily' },
  { icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', title: 'Balanced Diet', desc: 'Nutrient-rich meals' },
  { icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z', title: 'Quality Sleep', desc: '7-8 hours per night' },
  { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', title: 'Stay Hydrated', desc: 'Drink 8 glasses of water daily' },
  { icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Mental Wellness', desc: 'Practice stress management techniques' },
  { icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z', title: 'Sun Protection', desc: 'Use sunscreen SPF 30+ daily' },
  { icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3', title: 'Healthy Weight', desc: 'Maintain a healthy BMI' },
];

const hemoglobinRanges = {
  male: { min: 13.5, max: 17.5 },
  female: { min: 12.0, max: 15.5 }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();

  const [stats, setStats] = useState({
    totalReports: 0,
    criticalAlerts: 0,
    activeRisks: 0,
    latestUpload: 'None',
    lastCheckup: 'None'
  });

  const [trendData, setTrendData] = useState([]);
  const [avgHemoglobin, setAvgHemoglobin] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setUserName(user.displayName || 'User');
        fetchDashboardData(user.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchDashboardData = async (uid) => {
    try {
      // Fetch user profile for name if not in auth
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setUserName(userDoc.data().name || userDoc.data().displayName || 'User');
      }

      // Fetch reports
      const reportsRef = collection(db, 'users', uid, 'reports');
      const q = query(reportsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (reports.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate Stats
      let totalAlerts = 0;
      let totalRisks = 0;
      let hemoglobinSum = 0;
      let hemoglobinCount = 0;

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const yearlyTrend = months.map(m => ({ month: m, reports: 0, risks: 0, hemoglobin: null }));

      reports.forEach(report => {
        const date = report.createdAt?.toDate() || new Date(report.date);
        const monthIdx = date.getMonth();
        const year = date.getFullYear();

        if (year === currentYear) {
          yearlyTrend[monthIdx].reports++;
        }

        if (report.medicalData) {
          report.medicalData.forEach(test => {
            if (test.status === 'Abnormal') {
              totalAlerts++;
              totalRisks++;
              if (year === currentYear) yearlyTrend[monthIdx].risks++;
            } else if (test.status === 'Borderline') {
              totalRisks++;
              if (year === currentYear) yearlyTrend[monthIdx].risks++;
            }

            if (test.testName.toLowerCase().includes('hemoglobin')) {
              const val = parseFloat(test.testValue);
              if (!isNaN(val)) {
                hemoglobinSum += val;
                hemoglobinCount++;
                if (year === currentYear) {
                  // Keep the latest hemoglobin value for that month in the trend
                  yearlyTrend[monthIdx].hemoglobin = val;
                }
              }
            }
          });
        }
      });

      setStats({
        totalReports: reports.length,
        criticalAlerts: totalAlerts,
        activeRisks: totalRisks,
        latestUpload: reports[0].name.length > 15 ? reports[0].name.substring(0, 12) + '...' : reports[0].name,
        lastCheckup: reports[0].date ? new Date(reports[0].date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently'
      });

      setTrendData(yearlyTrend);
      setAvgHemoglobin(hemoglobinCount > 0 ? (hemoglobinSum / hemoglobinCount).toFixed(1) : 0);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="rounded-3xl p-6 lg:p-10 mb-8 text-white relative overflow-hidden" style={{ backgroundColor: '#263B6A' }}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Welcome, {userName}</h1>
              <p className="text-cyan-100 text-lg">Your health insights are synchronized and up to date.</p>

            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {[
          { title: 'Total Reports', value: stats.totalReports, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', bg: '#2c5e67ff', light: '#dbe9ebff', badge: 'Reports' },
          { title: 'Critical Alerts', value: stats.criticalAlerts, icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', bg: '#602727ff', light: '#fee2e2', badge: 'Alerts' },
          { title: 'Active Risks', value: stats.activeRisks, icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', bg: '#9e7f4aff', light: '#fef3c7', badge: 'Risks' },
          { title: 'Latest Upload', value: stats.latestUpload, icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12', bg: '#2c6854ff', light: '#d1fae5', badge: 'Upload' },
        ].map((c, i) => (
          <div key={i} className="premium-card relative p-4 lg:p-5 cursor-pointer group overflow-hidden flex flex-col justify-between min-h-[120px]">
            {/* Soft Gradient Background Blob */}
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none" style={{ backgroundColor: c.bg }}></div>

            <div className="relative z-10 flex items-start justify-between">
              <div className="p-3 rounded-xl shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: c.light, color: c.bg }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={c.icon} />
                </svg>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-sm backdrop-blur-md"
                style={{ backgroundColor: `${c.light}90`, borderColor: `${c.bg}30`, color: c.bg }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse shadow-sm" style={{ backgroundColor: c.bg }}></div>
                <span className="text-[10px] font-bold uppercase tracking-wider">{c.badge}</span>
              </div>
            </div>

            <div className="relative z-10 mt-4 lg:mt-5">
              <p className="text-xl lg:text-2xl font-bold text-slate-700 tracking-tight tabular-nums truncate md:whitespace-normal">{typeof c.value === 'number' ? c.value.toLocaleString() : c.value}</p>
              <p className="text-xs font-semibold text-gray-500 mt-0.5 uppercase tracking-wide">{c.title}</p>
            </div>

            {/* Bottom decorative accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 opacity-80 group-hover:h-1.5 transition-all duration-300" style={{ background: `linear-gradient(90deg, ${c.light}, ${c.bg})` }}></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <div className="xl:col-span-2 premium-card p-5 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Health Trends - {currentYear}</h2>
              <p className="text-sm text-gray-500">Reports and Risk Analysis for {currentYear}</p>
            </div>
            <div className="flex items-center gap-2 bg-white border border-cyan-100 px-4 py-2 rounded-xl shadow-sm">
              <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-cyan-700">{currentYear}</span>
            </div>
          </div>
          <div className="h-72">
            {stats.totalReports === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-slate-50/50 rounded-2xl border border-dashed border-gray-200 p-6">
                <div className="w-16 h-16 mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-gray-700">No reports uploaded yet</p>
                <p className="text-sm text-gray-500 max-w-[220px] text-center mt-1">Upload your first report to see your health trends and analysis.</p>
                <button
                  onClick={() => navigate('/upload')}
                  className="mt-5 px-6 py-2.5 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2"
                  style={{ backgroundColor: '#263B6A' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload Now
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReportsNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRisksNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="reports" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorReportsNew)" name="Reports" />
                  <Area type="monotone" dataKey="risks" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorRisksNew)" name="Risks" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#06b6d4]"></div>
              <span className="text-sm text-gray-600">Reports</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#f97316]"></div>
              <span className="text-sm text-gray-600">Risks</span>
            </div>
          </div>
        </div>

        <div className="premium-card p-5 lg:p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Quick Actions</h2>
          <div className="space-y-3">
            {quickActions.map((action, index) => (
              <button key={index} onClick={() => navigate(action.path)} className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-gray-300 hover:shadow-lg transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 bg-white border border-gray-100 shadow-sm" style={{ color: action.color }}>
                  <svg className="w-6 h-6" style={{ color: action.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
                  </svg>
                </div>
                <span className="font-semibold text-gray-700 group-hover:text-gray-900">{action.name}</span>
                <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="premium-card p-4 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">Health Tips & Recommendations</h2>
            <p className="text-sm text-gray-500 mt-0.5">Advice based on your health profile</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Daily Insight
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {healthTips.map((tip, index) => (
            <div key={index} className="flex items-start gap-4 p-4 rounded-xl bg-white hover:bg-slate-50 transition-all duration-300 cursor-pointer group border border-gray-100 hover:border-blue-200 hover:shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-gray-100 flex items-center justify-center group-hover:bg-white group-hover:scale-105 transition-all duration-300 shadow-sm shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tip.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors uppercase tracking-tight truncate">{tip.title}</h3>
                <p className="text-gray-500 leading-snug mt-0.5 text-xs line-clamp-2">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;

