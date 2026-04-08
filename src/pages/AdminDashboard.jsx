import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AdminLayout from '../components/AdminLayout';
import { collection, getDocs, query, limit, collectionGroup } from 'firebase/firestore';
import { db } from '../firebase';
import CustomSelect from '../components/CustomSelect';

const riskData = [
  { name: 'Diabetes', count: 245, color: '#dc2626' },
  { name: 'High Cholesterol', count: 312, color: '#f59e0b' },
  { name: 'Anemia', count: 186, color: '#8b5cf6' },
  { name: 'Hypertension', count: 278, color: '#ec4899' },
  { name: 'Obesity', count: 156, color: '#06b6d4' },
];

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    monthlyReg: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    reliabilityScore: 0,
    successfulReports: 0,
    failedReports: 0,
    failureReasons: { missingAnalysis: 0, incompleteResults: 0 }
  });
  const [yearlyRegData, setYearlyRegData] = useState([]);

  const currentYear = new Date().getFullYear();
  const [year1, setYear1] = useState(currentYear);
  const [year2, setYear2] = useState(currentYear - 1);
  const [mode, setMode] = useState('compare');

  // Derive years from data or provide defaults
  // Dynamically derive a gap-free list of years from 2024 up to the current year
  const years = useMemo(() => {
    const startYear = 2024;
    const endYear = Math.max(startYear, currentYear);
    const baseline = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
    const dataYears = Array.from(new Set(yearlyRegData.map(d => d.year)));
    const allYears = Array.from(new Set([...baseline, ...dataYears]));
    return allYears.sort((a, b) => a - b);
  }, [yearlyRegData, currentYear]);

  // Ensure year1 and year2 are valid when data loads
  useEffect(() => {
    if (years.length > 0 && !years.includes(year1)) setYear1(years[years.length - 1]);
    if (years.length > 1 && !years.includes(year2)) setYear2(years[years.length - 2]);
  }, [years]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const usersRef = collection(db, 'users');
        const qUsers = query(usersRef, limit(500));
        const usersSnapshot = await getDocs(qUsers);

        // Fetch ALL reports across all users to audit the AI pipeline
        const reportsRef = collectionGroup(db, 'reports');
        const reportsSnapshot = await getDocs(query(reportsRef, limit(1000)));

        let totalReports = reportsSnapshot.size;
        let successfulAnalysis = 0;
        let failedAnalysis = 0;
        let reasonCounts = { missingAnalysis: 0, incompleteResults: 0 };

        reportsSnapshot.forEach(doc => {
          const data = doc.data();
          // A report is "Success" if it has an analysis object with valid summary/health/risks
          const hasValidAnalysis = data.analysis && (data.analysis.summary || data.analysis.overall_health || data.analysis.risks);

          if (hasValidAnalysis) {
            successfulAnalysis++;
          } else {
            failedAnalysis++;
            if (!data.analysis) {
              reasonCounts.missingAnalysis++;
            } else {
              reasonCounts.incompleteResults++;
            }
          }
        });

        const reliabilityScore = totalReports > 0 ? Math.round((successfulAnalysis / totalReports) * 100) : 100;

        let total = 0;
        let active = 0;
        let inactive = 0;

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const regDataMap = {};

        usersSnapshot.forEach((doc) => {
          const data = doc.data();
          // Exclude any user with admin role or known admin emails
          const isAdmin = data.role === 'admin' ||
            (data.email && (
              data.email === 'dhvanikoshti26@gmail.com' ||
              data.email === 'admin@gmail.com'
            ));
          if (isAdmin) return;

          total++;

          // Compute status dynamically: inactive if last active > 2 months ago
          const twoMonthsAgo = new Date();
          twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

          let lastActiveDate;
          if (data.lastActive?.toDate) {
            lastActiveDate = data.lastActive.toDate();
          } else if (data.lastActive) {
            lastActiveDate = new Date(data.lastActive);
          } else if (data.createdAt?.toDate) {
            lastActiveDate = data.createdAt.toDate();
          } else if (data.joinedDate) {
            lastActiveDate = new Date(data.joinedDate);
          } else {
            lastActiveDate = new Date(); // Fallback to current year
          }

          const dynamicStatus = lastActiveDate < twoMonthsAgo ? 'Inactive' : 'Active';

          if (dynamicStatus === 'Inactive') {
            inactive++;
          } else {
            active++;
          }

          let date;
          if (data.createdAt) {
            if (data.createdAt.toDate) {
              date = data.createdAt.toDate();
            } else {
              // Handle string format e.g., "26 March 2024 at 15:27:14 UTC+5:30"
              const cleanDateStr = typeof data.createdAt === 'string'
                ? data.createdAt.split(' at ')[0]
                : data.createdAt;
              date = new Date(cleanDateStr);
            }
          } else if (data.joinedDate) {
            date = new Date(data.joinedDate);
          } else {
            date = new Date(); // Fallback to current year
          }

          if (date) {
            const y = date.getFullYear();
            const m = monthNames[date.getMonth()];

            if (!regDataMap[y]) {
              regDataMap[y] = {};
              monthNames.forEach(name => regDataMap[y][name] = 0);
            }
            regDataMap[y][m]++;
          }
        });

        // Identify years from data plus our baseline baseline (2024 to current year)
        const startYear = 2024;
        const endYear = Math.max(startYear, currentYear);
        const baseline = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
        let dataYearsFound = Object.keys(regDataMap).map(Number);
        const availableYears = Array.from(new Set([...baseline, ...dataYearsFound, currentYear])).sort((a, b) => a - b);

        availableYears.forEach(y => {
          if (!regDataMap[y]) {
            regDataMap[y] = {};
            monthNames.forEach(name => regDataMap[y][name] = 0);
          }
        });

        const chartDataArray = [];
        availableYears.forEach(y => {
          monthNames.forEach(m => {
            chartDataArray.push({
              year: y,
              month: m,
              reg: regDataMap[y]?.[m] || 0
            });
          });
        });

        setYearlyRegData(chartDataArray);

        const thisMonth = monthNames[new Date().getMonth()];
        const monthlyReg = regDataMap[currentYear]?.[thisMonth] || 0;

        const target = {
          totalUsers: total,
          monthlyReg: monthlyReg,
          activeUsers: active,
          inactiveUsers: inactive,
          reliabilityScore: reliabilityScore,
          successfulReports: successfulAnalysis,
          failedReports: failedAnalysis,
          failureReasons: reasonCounts
        };
        let step = 0;
        const timer = setInterval(() => {
          step++;
          const p = step / 60;
          const e = 1 - Math.pow(1 - p, 3);
          setStats({
            totalUsers: Math.round(target.totalUsers * e),
            monthlyReg: Math.round(target.monthlyReg * e),
            activeUsers: Math.round(target.activeUsers * e),
            inactiveUsers: Math.round(target.inactiveUsers * e),
            reliabilityScore: Math.round(target.reliabilityScore * e),
            successfulReports: Math.round(target.successfulReports * e),
            failedReports: Math.round(target.failedReports * e),
            failureReasons: target.failureReasons
          });
          if (step >= 60) clearInterval(timer);
        }, 25);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchDashboardData();
  }, [currentYear]);

  const cards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      bg: '#2563EB', // Blue-600
      light: '#EFF6FF' // Blue-50
    },
    {
      title: 'Monthly Registration',
      value: stats.monthlyReg,
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      bg: '#8B5CF6', // Violet-500
      light: '#F5F3FF' // Violet-50
    },
    {
      title: 'Active Users',
      value: stats.activeUsers,
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      bg: '#10B981', // Emerald-500
      light: '#ECFDF5' // Emerald-50
    },
    {
      title: 'Inactive Users',
      value: stats.inactiveUsers,
      icon: 'M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zm11-4h-4v-2h4v2z',
      bg: '#946161ff', // Red-500
      light: '#FEF2F2' // Red-50
    },
  ];


  const chartData = useMemo(() => {
    if (yearlyRegData.length === 0) return [];

    if (mode === 'all') {
      return years.map(y => ({
        year: y.toString(),
        registrations: yearlyRegData.filter(i => i.year === y).reduce((s, i) => s + i.reg, 0)
      }));
    }
    if (mode === 'compare') {
      const total1 = yearlyRegData.filter(i => i.year === year1).reduce((s, i) => s + i.reg, 0);
      const total2 = yearlyRegData.filter(i => i.year === year2).reduce((s, i) => s + i.reg, 0);
      return [
        { year: year1.toString(), registrations: total1 },
        { year: year2.toString(), registrations: total2 }
      ];
    }
    return yearlyRegData.filter(i => i.year === year1).map(i => ({ month: i.month, registrations: i.reg }));
  }, [yearlyRegData, year1, year2, mode, years]);

  const total1 = useMemo(() => yearlyRegData.filter(i => i.year === year1).reduce((s, i) => s + i.reg, 0), [yearlyRegData, year1]);
  const total2 = useMemo(() => yearlyRegData.filter(i => i.year === year2).reduce((s, i) => s + i.reg, 0), [yearlyRegData, year2]);
  const totalsByYear = useMemo(() => {
    const totals = {};
    years.forEach(y => {
      totals[y] = yearlyRegData.filter(i => i.year === y).reduce((s, i) => s + i.reg, 0);
    });
    return totals;
  }, [yearlyRegData, years]);

  return (
    <AdminLayout
      title="Admin Dashboard"
      subtitle="Welcome back! Here is your platform overview."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Column 1: Total Users */}
          <div className="flex flex-col">
            <div className="premium-card relative p-4 lg:p-5 cursor-pointer group overflow-hidden flex flex-col justify-between min-h-[120px]">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none" style={{ backgroundColor: '#2563EB' }}></div>
              <div className="relative z-10 flex items-start justify-between">
                <div className="p-3 rounded-xl shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-sm backdrop-blur-md" style={{ backgroundColor: '#EFF6FF90', borderColor: '#2563EB30', color: '#2563EB' }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse shadow-sm" style={{ backgroundColor: '#2563EB' }}></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Overall</span>
                </div>
              </div>
              <div className="relative z-10 mt-4 lg:mt-5">
                <p className="text-xl lg:text-3xl font-bold text-gray-600 tracking-tight drop-shadow-sm tabular-nums">{stats.totalUsers.toLocaleString()}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5 uppercase tracking-wide">Total Users</p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 opacity-80 group-hover:h-1.5 transition-all duration-300" style={{ background: 'linear-gradient(90deg, #EFF6FF, #2563EB)' }}></div>
            </div>
          </div>

          {/* Column 2: Monthly Registration */}
          <div className="flex flex-col">
            <div className="premium-card relative p-4 lg:p-5 cursor-pointer group overflow-hidden flex flex-col justify-between min-h-[120px]">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none" style={{ backgroundColor: '#8B5CF6' }}></div>
              <div className="relative z-10 flex items-start justify-between">
                <div className="p-3 rounded-xl shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: '#F5F3FF', color: '#8B5CF6' }}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-sm backdrop-blur-md" style={{ backgroundColor: '#F5F3FF90', borderColor: '#8B5CF630', color: '#8B5CF6' }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse shadow-sm" style={{ backgroundColor: '#8B5CF6' }}></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider">New</span>
                </div>
              </div>
              <div className="relative z-10 mt-4 lg:mt-5">
                <p className="text-xl lg:text-3xl font-bold text-gray-600 tracking-tight drop-shadow-sm tabular-nums">{stats.monthlyReg.toLocaleString()}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5 uppercase tracking-wide">Monthly Registration</p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 opacity-80 group-hover:h-1.5 transition-all duration-300" style={{ background: 'linear-gradient(90deg, #F5F3FF, #8B5CF6)' }}></div>
            </div>
          </div>

          {/* Column 3: Active Users */}
          <div className="flex flex-col">
            <div className="premium-card relative p-4 lg:p-5 cursor-pointer group overflow-hidden flex flex-col justify-between min-h-[120px]">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none" style={{ backgroundColor: '#10B981' }}></div>
              <div className="relative z-10 flex items-start justify-between">
                <div className="p-3 rounded-xl shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: '#ECFDF5', color: '#10B981' }}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-sm backdrop-blur-md" style={{ backgroundColor: '#ECFDF590', borderColor: '#10B98130', color: '#10B981' }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse shadow-sm" style={{ backgroundColor: '#10B981' }}></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Active</span>
                </div>
              </div>
              <div className="relative z-10 mt-4 lg:mt-5">
                <p className="text-xl lg:text-3xl font-bold text-gray-600 tracking-tight drop-shadow-sm tabular-nums">{stats.activeUsers.toLocaleString()}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5 uppercase tracking-wide">Active Users</p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 opacity-80 group-hover:h-1.5 transition-all duration-300" style={{ background: 'linear-gradient(90deg, #ECFDF5, #10B981)' }}></div>
            </div>
          </div>

          {/* Column 4: Inactive Users */}
          <div className="flex flex-col">
            <div className="premium-card relative p-4 lg:p-5 cursor-pointer group overflow-hidden flex flex-col justify-between min-h-[120px]">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none" style={{ backgroundColor: '#946161ff' }}></div>
              <div className="relative z-10 flex items-start justify-between">
                <div className="p-3 rounded-xl shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: '#FEF2F2', color: '#946161ff' }}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zm11-4h-4v-2h4v2z" /></svg>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-sm backdrop-blur-md" style={{ backgroundColor: '#FEF2F290', borderColor: '#94616130', color: '#946161ff' }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse shadow-sm" style={{ backgroundColor: '#946161ff' }}></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Inactive</span>
                </div>
              </div>
              <div className="relative z-10 mt-4 lg:mt-5">
                <p className="text-xl lg:text-3xl font-bold text-gray-600 tracking-tight drop-shadow-sm tabular-nums">{stats.inactiveUsers.toLocaleString()}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5 uppercase tracking-wide">Inactive Users</p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 opacity-80 group-hover:h-1.5 transition-all duration-300" style={{ background: 'linear-gradient(90deg, #FEF2F2, #946161ff)' }}></div>
            </div>
          </div>
        </div>

        {/* --- ENHANCED AI DIAGNOSTIC HEALTH (Positioned below the cards row) --- */}
        <div className="premium-card relative p-6 lg:p-8 border-slate-200/60 bg-white/50 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-700 overflow-hidden group">
          {/* Subtle background decoration */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-100/20 rounded-full blur-3xl group-hover:bg-cyan-100/30 transition-colors duration-700"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-100/20 rounded-full blur-3xl group-hover:bg-indigo-100/30 transition-colors duration-700"></div>

          <div className="relative z-10">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-cyan-600 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:rotate-6 transition-transform duration-500">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <div>
                  <h3 className="text-2xl font-Arial font-bold text-slate-700">AI Performance Monitor</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5">Automated Intelligence Pipeline Integrity</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-100 rounded-full">
                <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${stats.reliabilityScore > 90 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stats.reliabilityScore > 80 ? 'System Optimal' : 'Degraded Performance'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Reliability Gauge */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 shadow-inner">
                <div className="w-32 h-32 lg:w-40 lg:h-40 relative flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="50%" cy="50%" r="42%" className="stroke-slate-200/50 fill-none" strokeWidth="12" />
                    <circle
                      cx="50%" cy="50%" r="42%"
                      className={`${stats.reliabilityScore > 80 ? 'stroke-cyan-500' : 'stroke-amber-500'} fill-none transition-all duration-1000 ease-out`}
                      strokeWidth="12"
                      strokeDasharray="264"
                      strokeDashoffset={264 - (264 * stats.reliabilityScore) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl lg:text-5xl font-black text-slate-800 tracking-tighter tabular-nums">{stats.reliabilityScore}<span className="text-xl lg:text-3xl">%</span></span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] leading-none mt-2">Stability</span>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Global Extraction Health</p>
                  <div className="flex items-center gap-2 mt-2 justify-center">
                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                    <span className="text-[10px] font-bold text-slate-400 italic">Auditing {stats.successfulReports + stats.failedReports} recent pulses</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Mini Cards & Audit Logs */}
              <div className="lg:col-span-8 space-y-6">
                {/* 2 Success/Failed Inner Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 uppercase tracking-tight">
                  <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100/50 shadow-sm transition-transform hover:-translate-y-1 duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                        <svg className="w-6 h-6 shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[9px] font-black tracking-widest">Optimal</span>
                    </div>
                    <p className="text-4xl font-black text-slate-800 tabular-nums leading-none mb-1">{stats.successfulReports}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Successful Executions</p>
                  </div>

                  <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-50 to-white border border-rose-100/50 shadow-sm transition-transform hover:-translate-y-1 duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-600">
                        <svg className="w-6 h-6 shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </div>
                      <span className={`px-2 py-0.5 ${stats.failedReports > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-400'} rounded-md text-[9px] font-black tracking-widest uppercase`}>{stats.failedReports > 0 ? 'Alert' : 'Stable'}</span>
                    </div>
                    <p className={`text-4xl font-black tabular-nums leading-none mb-1 ${stats.failedReports > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{stats.failedReports}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Processing Incidents</p>
                  </div>
                </div>

                {/* Audit Breakthrough / Reasons */}
                <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-[15px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      Processing Reason Audit
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span className="text-[11px] text-slate-400 lowercase font-bold tracking-normal italic font-serif">Deep Extraction analysis</span>
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-slate-400 uppercase tracking-widest">Stability Profile:</span>
                      <span className={`text-[14px] font-black uppercase ${stats.reliabilityScore > 85 ? 'text-emerald-500' : 'text-amber-500'}`}>{stats.reliabilityScore > 85 ? 'A+' : 'Check Config'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-12 bg-rose-400 rounded-full"></div>
                        <div>
                          <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">Missing AI Signal</p>
                          <p className="text-[10px] font-bold text-slate-400 leading-none mt-1.5 uppercase">n8n payload empty</p>
                        </div>
                      </div>
                      <span className="text-xl font-black text-slate-800 tabular-nums">{stats.failureReasons.missingAnalysis}</span>
                    </div>

                    <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-12 bg-amber-400 rounded-full"></div>
                        <div>
                          <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">Partial Extraction</p>
                          <p className="text-[10px] font-bold text-slate-400 leading-none mt-1.5 uppercase">Schema mismatch</p>
                        </div>
                      </div>
                      <span className="text-xl font-black text-slate-800 tabular-nums">{stats.failureReasons.incompleteResults}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-3 pt-6 border-t border-slate-100/50">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                      Note: AI reliability is computed across all users globally. High failure rates may indicate webhook timeouts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="premium-card p-4 sm:p-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#547792] to-[#263B6A] flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Monthly Registrations</h2>
                <p className="text-sm text-gray-500">{mode === 'all' ? `Yearly totals comparison (${years.join(', ')})` : mode === 'compare' ? `Comparing ${year1} vs ${year2}` : `Monthly registrations in ${year1}`}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
              <div className="flex bg-white rounded-xl p-0.5 sm:p-1 shadow-sm border border-gray-200 shrink-0">
                <button onClick={() => setMode('single')} className={`px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm font-semibold rounded-lg transition-all duration-200 ${mode === 'single' ? 'bg-[#547792] text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Single</button>
                <button onClick={() => setMode('compare')} className={`px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm font-semibold rounded-lg transition-all duration-200 ${mode === 'compare' ? 'bg-white text-[#547792] shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Compare</button>
                <button onClick={() => setMode('all')} className={`px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm font-semibold rounded-lg transition-all duration-200 ${mode === 'all' ? 'bg-white text-[#547792] shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>All</button>
              </div>

              {mode === 'single' && (
                <CustomSelect
                  options={years.map(y => ({ label: y.toString(), value: y }))}
                  value={year1}
                  onChange={(val) => setYear1(val)}
                  placeholder="Year"
                  className="w-20 sm:w-32 shrink-0"
                />
              )}

              {mode === 'compare' && (
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <CustomSelect
                    options={years.map(y => ({ label: y.toString(), value: y }))}
                    value={year1}
                    onChange={(val) => setYear1(val)}
                    placeholder="Year"
                    className="w-20 sm:w-32"
                  />
                  <span className="text-gray-400 font-bold text-[9px] sm:text-xs uppercase shrink-0">vs</span>
                  <CustomSelect
                    options={years.map(y => ({ label: y.toString(), value: y }))}
                    value={year2}
                    onChange={(val) => setYear2(val)}
                    placeholder="Year"
                    className="w-20 sm:w-32"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              {mode === 'all' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="registrations" name="Total Registrations" fill="#263B6A" radius={[8, 8, 0, 0]} />
                </BarChart>
              ) : mode === 'compare' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="registrations" name="Yearly Total" fill="#263B6A" radius={[8, 8, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="registrations" name={`${year1} Registrations`} fill="#547792" radius={[8, 8, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            {mode === 'all' && years.map((y, idx) => (
              <div key={y} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: idx % 2 === 0 ? '#263B6A' : '#547792' }}></div>
                <span className="text-sm font-semibold text-gray-700">{y}</span>
                <span className="text-xs text-gray-500">({totalsByYear[y] || 0})</span>
              </div>
            ))}
            {mode === 'compare' && (
              <>
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-100">
                  <div className="w-4 h-4 rounded bg-[#547792]"></div>
                  <span className="text-sm font-semibold text-gray-700">{year1}</span>
                  <span className="text-xs text-gray-500">({total1})</span>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-100">
                  <div className="w-4 h-4 rounded bg-[#263B6A]"></div>
                  <span className="text-sm font-semibold text-gray-700">{year2}</span>
                  <span className="text-xs text-gray-500">({total2})</span>
                </div>
              </>
            )}
            {mode === 'single' && (
              <div className="flex items-center gap-2 bg-white border border-blue-100 px-3 py-2 rounded-lg">
                <div className="w-4 h-4 rounded bg-[#547792]"></div>
                <span className="text-sm font-semibold text-gray-700">{year1} Total</span>
                <span className="text-xs text-gray-500">({total1})</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
