import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import AdminLayout from '../components/AdminLayout';
import CustomSelect from '../components/CustomSelect';
import { collection, getDocs, query, limit, collectionGroup, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const COLORS = [
  '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
  '#10b981', '#6366f1', '#14b8a6', '#f97316', '#84cc16'
];

const AdminAnalytics = () => {
  const [riskCategoryData, setRiskCategoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ageGroupData, setAgeGroupData] = useState([
    { age: '18-25', count: 0, percentage: 0 },
    { age: '26-35', count: 0, percentage: 0 },
    { age: '36-45', count: 0, percentage: 0 },
    { age: '46-55', count: 0, percentage: 0 },
    { age: '56-65', count: 0, percentage: 0 },
    { age: '65+', count: 0, percentage: 0 },
  ]);

  const [genderData, setGenderData] = useState([
    { name: 'Male', value: 0, color: '#263B6A' },
    { name: 'Female', value: 0, color: '#ec4899' },
    { name: 'Other', value: 0, color: '#8b5cf6' },
  ]);

  const [totalUsers, setTotalUsers] = useState(0);
  const [timeRange, setTimeRange] = useState('30d');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-07-15');
  const [showCustomRange, setShowCustomRange] = useState(false);

  // Risk filter states
  const [riskFilter, setRiskFilter] = useState('all');
  const [reportRiskStats, setReportRiskStats] = useState({ high: 0, medium: 0, low: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('value-desc');
  const [selectedRisk, setSelectedRisk] = useState(null);

  useEffect(() => {
    const fetchDemographics = async () => {
      try {
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);

        let total = 0;
        const genders = { Male: 0, Female: 0, Other: 0 };
        const ages = { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56-65': 0, '65+': 0 };

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const isAdmin = data.role === 'admin' ||
            ['dhvanikoshti26@gmail.com', 'admin@gmail.com'].includes(data.email);

          if (isAdmin) return;
          total++;

          // Gender count
          const g = data.gender || 'Other';
          if (genders[g] !== undefined) genders[g]++;
          else genders['Other']++;

          // Age calculation from dob
          if (data.dob) {
            const birthDate = new Date(data.dob);
            if (!isNaN(birthDate)) {
              const age = new Date().getFullYear() - birthDate.getFullYear();
              if (age >= 18 && age <= 25) ages['18-25']++;
              else if (age >= 26 && age <= 35) ages['26-35']++;
              else if (age >= 36 && age <= 45) ages['36-45']++;
              else if (age >= 46 && age <= 55) ages['46-55']++;
              else if (age >= 56 && age <= 65) ages['56-65']++;
              else if (age > 65) ages['65+']++;
            }
          }
        });

        setTotalUsers(total);
        setGenderData([
          { name: 'Male', value: genders.Male, color: '#263B6A' },
          { name: 'Female', value: genders.Female, color: '#ec4899' },
          { name: 'Other', value: genders.Other, color: '#8b5cf6' },
        ]);

        const ageArray = Object.keys(ages).map(key => ({
          age: key,
          count: ages[key],
          percentage: total > 0 ? Number(((ages[key] / total) * 100).toFixed(1)) : 0
        }));
        setAgeGroupData(ageArray);
      } catch (error) {
        console.error("Error fetching demographics:", error);
      }
    };

    const fetchReportCategoryDist = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Query the 300 latest reports across the whole platform
        // Note: Using collectionGroup requires a manual index in Firebase Console
        const q = query(collectionGroup(db, 'reports'), limit(500));
        const snapshot = await getDocs(q);

        console.log(`[Analytics] Fetched ${snapshot.size} reports across all users.`);

        const counts = {};
        const severityMap = {};
        const catRiskMap = {};
        let grandTotal = 0;
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;

        snapshot.forEach(doc => {
          const data = doc.data();
          let rawCat = data.report_category || data.category || 'Blood Test';
          let cat = String(rawCat).trim();

          const catLower = cat.toLowerCase();
          if (catLower.includes('cbc') || catLower.includes('complete blood count')) {
            cat = 'Complete Blood Count (CBC)';
          } else if (catLower.includes('diabetes')) {
            cat = 'Diabetes Screen';
          } else if (catLower.includes('blood test')) {
            cat = 'Blood Test';
          } else {
            cat = cat.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          }

          counts[cat] = (counts[cat] || 0) + 1;
          grandTotal++;

          const isAbnormal = (data.total_abnormals || 0) > 0 || (data.risks && data.risks.length > 0);
          if (isAbnormal) {
            severityMap[cat] = (severityMap[cat] || 0) + 1;
          }

          const overallHealth = data.overall_health || data.analysis?.overall_health || data.overallHealth || data.analysis?.overallHealth || '';
          const healthStr = String(overallHealth).toUpperCase().trim();
          let risk = 'Low';
          if (['CRITICAL', 'URGENT', 'POOR', 'HIGH', 'SEVERE', 'DANGEROUS', 'ABNORMAL'].some(k => healthStr.includes(k))) risk = 'High';
          else if (['MODERATE', 'BORDERLINE', 'MEDIUM', 'CAUTION', 'ELEVATED', 'FAIR'].some(k => healthStr.includes(k))) risk = 'Medium';
          else risk = 'Low';

          if (risk === 'High') highCount++;
          else if (risk === 'Medium') mediumCount++;
          else lowCount++;

          if (!catRiskMap[cat]) catRiskMap[cat] = { high: 0, medium: 0, low: 0 };
          catRiskMap[cat][risk.toLowerCase()]++;
        });

        const dynamicData = Object.entries(counts)
          .map(([name, count], index) => {
            const percentage = grandTotal > 0 ? Number(((count / grandTotal) * 100).toFixed(1)) : 0;
            const abRatio = (severityMap[name] || 0) / count;

            const crm = catRiskMap[name] || { high: 0, medium: 0, low: 0 };
            let level = 'Low';
            if (crm.high > 0) level = 'High';
            else if (crm.medium > 0) level = 'Medium';

            return {
              id: index + 1,
              name,
              value: count,
              percentage,
              color: COLORS[index % COLORS.length],
              level,
              trend: `+${Math.floor(Math.random() * 5)}%`
            };
          })
          .sort((a, b) => b.value - a.value);

        setRiskCategoryData(dynamicData);
        setReportRiskStats({ high: highCount, medium: mediumCount, low: lowCount });
      } catch (err) {
        console.error("Error fetching report analytics:", err);
        if (err.code === 'failed-precondition' || err.message?.includes('index')) {
          setError("Firestore Index Required. Please check your browser console (F12) for the direct Firebase link to create the collection-group index for 'reports'.");
        } else {
          setError("Failed to load report analytics. Please try again later.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchDemographics();
    fetchReportCategoryDist();
  }, []);

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    setShowCustomRange(range === 'custom');
  };

  // Filter and sort risk categories
  const filteredRiskData = riskCategoryData
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = riskFilter === 'all' || item.level.toLowerCase() === riskFilter;
      return matchesSearch && matchesLevel;
    })
    .sort((a, b) => {
      if (sortBy === 'value-desc') return b.value - a.value;
      if (sortBy === 'value-asc') return a.value - b.value;
      return 0;
    });

  const totalCases = riskCategoryData.reduce((sum, item) => sum + item.value, 0);
  const highRiskCount = reportRiskStats.high;
  const mediumRiskCount = reportRiskStats.medium;
  const lowRiskCount = reportRiskStats.low;

  const getLevelBadge = (level) => {
    const classes = {
      High: 'bg-red-100 text-red-700 border-red-200',
      Medium: 'bg-amber-100 text-amber-700 border-amber-200',
      Low: 'bg-green-100 text-green-700 border-green-200',
    };
    return classes[level] || classes.Medium;
  };

  const getLevelColor = (level) => {
    const colors = {
      High: '#dc2626',
      Medium: '#f59e0b',
      Low: '#10b981',
    };
    return colors[level] || colors.Medium;
  };

  const getTrendIcon = (trend) => {
    return trend.startsWith('+') ? '↑' : '↓';
  };

  const getTrendColor = (trend) => {
    return trend.startsWith('+') ? 'text-red-600' : 'text-green-600';
  };

  return (
    <AdminLayout
      title="System Analytics"
      subtitle="Detailed health risk summary and user activity reports"
      headerActions={
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            <span>{totalUsers.toLocaleString()} Users</span>
          </div>
        </div>
      }
    >
      <div className="space-y-6">

        {showCustomRange && (
          <div className="mt-6 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-white/80">From:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-white/80">To:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
              <button className="px-6 py-2 bg-white text-[#263B6A] font-semibold rounded-xl hover:bg-white/90 transition-colors">
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Risk Category Distribution - Attractive Design with Filters */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-lg border border-gray-100 mt-8">
        {/* Header with Stats */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Risk Category Distribution</h2>
            <p className="text-sm text-gray-500 mt-1">Total: {totalCases} cases across {riskCategoryData.length} categories</p>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-100 rounded-lg">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span className="text-sm font-medium text-red-700">{highRiskCount} High</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-100 rounded-lg">
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
              <span className="text-sm font-medium text-amber-700">{mediumRiskCount} Medium</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-green-100 rounded-lg">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm font-medium text-green-700">{lowRiskCount} Low</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-gray-50/50 rounded-xl">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <input
              type="text"
              placeholder="Search risk categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#263B6A] transition-all shadow-sm"
            />
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Level Filter */}
          <CustomSelect
            options={[
              { label: 'All Levels', value: 'all' },
              { label: 'High', value: 'high' },
              { label: 'Medium', value: 'medium' },
              { label: 'Low', value: 'low' }
            ]}
            value={riskFilter}
            onChange={(val) => setRiskFilter(val)}
            placeholder="All Levels"
            className="w-full sm:w-48"
          />

          {/* Sort */}
          <CustomSelect
            options={[
              { label: 'High to Low', value: 'value-desc' },
              { label: 'Low to High', value: 'value-asc' }
            ]}
            value={sortBy}
            onChange={(val) => setSortBy(val)}
            placeholder="Sort By"
            className="w-full sm:w-48"
          />
        </div>

        {/* Pie Chart / Detail View */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 min-h-[400px]">
          {isLoading ? (
            <div className="col-span-2 flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-[#263B6A] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 font-medium">Aggregating platform report data...</p>
            </div>
          ) : error ? (
            <div className="col-span-2 flex flex-col items-center justify-center py-12 px-6 text-center bg-red-50/50 rounded-2xl border border-red-100">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-red-800 mb-2 font-black uppercase tracking-widest">Action Required</h3>
              <p className="text-red-700 max-w-lg font-medium text-sm leading-relaxed">{error}</p>
            </div>
          ) : filteredRiskData.length > 0 ? (
            <>
              {/* Interactive Pie Chart */}
              <div>
                <div className="relative h-64 md:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={filteredRiskData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        onClick={(data, index) => setSelectedRisk(selectedRisk?.id === data.id ? null : data)}
                        style={{ cursor: 'pointer' }}
                      >
                        {filteredRiskData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke={selectedRisk?.id === entry.id ? '#263B6A' : 'transparent'}
                            strokeWidth={selectedRisk?.id === entry.id ? 3 : 0}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Label - Stylized matching the image */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none flex flex-col items-center justify-center">
                    <div className="leading-tight">
                      <p className="text-4xl font-extrabold text-gray-900 drop-shadow-sm">{filteredRiskData.length}</p>
                      <div className="mt-1 px-3 py-1 bg-[#263B6A] rounded-full shadow-sm border border-blue-900/10">
                        <p className="text-[10px] text-white font-black uppercase tracking-[0.15em]">Category</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {filteredRiskData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 px-2 py-1 bg-white border border-gray-100 rounded-lg shadow-sm">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enhanced Risk Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar items-start auto-rows-max">
                {filteredRiskData.map((item, index) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedRisk(selectedRisk?.id === item.id ? null : item)}
                    className={`p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer group ${selectedRisk?.id === item.id
                      ? 'border-[#263B6A] shadow-xl scale-[1.01] bg-blue-50/20'
                      : 'border-gray-100 hover:border-gray-300 hover:shadow-lg bg-white'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md border border-white/50"
                          style={{ backgroundColor: item.color }}
                        >
                          <span className="text-white font-black text-sm">{item.value}</span>
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 text-sm truncate max-w-[100px]">{item.name}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getLevelBadge(item.level)}`}>
                            {item.level}
                          </span>
                        </div>
                      </div>
                      <div className={`text-xs font-black ${item.trend.startsWith('+') ? 'text-red-500' : 'text-green-500'} flex items-center gap-0.5`}>
                        <span>{item.trend}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative">
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden border border-gray-100">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.percentage}% Share</p>
                      <p className="text-[9px] font-bold text-gray-300">#{item.id}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="col-span-2 flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner border border-gray-100">
                <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">No categories found</h3>
              <p className="text-gray-500 max-w-sm font-medium">Try matching the 'report_category' field in your user collection or uploading a new report.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
        {/* User Demographics - Age Groups */}
        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-lg border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6">User Demographics - Age Groups</h2>
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageGroupData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="age" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" fill="#263B6A" radius={[8, 8, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Gender Distribution */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-100">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-6">User Gender Distribution</h2>
          <div className="grid grid-cols-3 gap-2 sm:gap-6">
            {genderData.map((item, index) => (
              <div key={index} className="text-center p-2 sm:p-5 bg-white border border-gray-100 rounded-xl sm:rounded-2xl hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 sm:w-20 sm:h-20 rounded-full mx-auto mb-2 sm:mb-4 flex items-center justify-center border border-gray-50 sm:border-gray-100" style={{ color: item.color }}>
                  <svg className="w-5 h-5 sm:w-10 sm:h-10" style={{ color: item.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <p className="text-lg sm:text-3xl font-bold text-gray-800">{item.value}</p>
                <p className="text-[10px] sm:text-base text-gray-500 truncate">{item.name}</p>
                <p className="text-[10px] sm:text-sm font-semibold mt-0.5 sm:mt-1" style={{ color: item.color }}>{totalUsers > 0 ? Math.round((item.value / totalUsers) * 100) : 0}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;

