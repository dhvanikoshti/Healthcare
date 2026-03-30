import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AdminLayout from '../components/AdminLayout';
import { collection, getDocs, query, limit } from 'firebase/firestore';
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
  const [stats, setStats] = useState({ totalUsers: 0, monthlyReg: 0, activeUsers: 0, inactiveUsers: 0 });
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
        const q = query(usersRef, limit(500));
        const querySnapshot = await getDocs(q);

        let total = 0;
        let active = 0;
        let inactive = 0;

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const regDataMap = {};

        querySnapshot.forEach((doc) => {
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

        const target = { totalUsers: total, monthlyReg: monthlyReg, activeUsers: active, inactiveUsers: inactive };
        let step = 0;
        const timer = setInterval(() => {
          step++;
          const p = step / 60;
          const e = 1 - Math.pow(1 - p, 3);
          setStats({
            totalUsers: Math.round(target.totalUsers * e),
            monthlyReg: Math.round(target.monthlyReg * e),
            activeUsers: Math.round(target.activeUsers * e),
            inactiveUsers: Math.round(target.inactiveUsers * e)
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
    <AdminLayout>
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-[#263B6A] to-[#547792] rounded-2xl p-6 lg:p-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-white/80 mt-2">Welcome back! Here is your platform overview.</p>
          <div className="flex items-center gap-2 mt-4">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-white/80">System Operational</span>
          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
          {cards.map((c, i) => (
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
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {i === 0 ? 'Overall' : i === 1 ? 'New' : i === 2 ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="relative z-10 mt-4 lg:mt-5">
                <p className="text-xl lg:text-3xl font-bold text-gray-600 tracking-tight drop-shadow-sm tabular-nums">{c.value.toLocaleString()}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5 uppercase tracking-wide">{c.title}</p>
              </div>

              {/* Bottom decorative accent line */}
              <div className="absolute bottom-0 left-0 right-0 h-1 opacity-80 group-hover:h-1.5 transition-all duration-300" style={{ background: `linear-gradient(90deg, ${c.light}, ${c.bg})` }}></div>
            </div>
          ))}
        </div>

        <div className="premium-card p-4 sm:p-6">
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
