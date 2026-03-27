import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import AdminLayout from '../components/AdminLayout';
import CustomSelect from '../components/CustomSelect';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';

const riskCategoryData = [
  { id: 1, name: 'Diabetes', value: 245, color: '#dc2626', percentage: 12.5, level: 'High', trend: '+5%' },
  { id: 2, name: 'High Cholesterol', value: 312, color: '#f59e0b', percentage: 15.9, level: 'Medium', trend: '+3%' },
  { id: 3, name: 'Anemia', value: 186, color: '#8b5cf6', percentage: 9.5, level: 'Medium', trend: '-2%' },
  { id: 4, name: 'Hypertension', value: 278, color: '#ec4899', percentage: 14.2, level: 'High', trend: '+8%' },
  { id: 5, name: 'Obesity', value: 156, color: '#06b6d4', percentage: 8.0, level: 'Medium', trend: '+1%' },
  { id: 6, name: 'Heart Disease', value: 70, color: '#10b981', percentage: 3.6, level: 'High', trend: '+12%' },
  { id: 7, name: 'Asthma', value: 145, color: '#6366f1', percentage: 7.4, level: 'Low', trend: '-1%' },
  { id: 8, name: 'Arthritis', value: 98, color: '#14b8a6', percentage: 5.0, level: 'Low', trend: '+2%' },
  { id: 9, name: 'Thyroid', value: 124, color: '#f97316', percentage: 6.3, level: 'Medium', trend: '+4%' },
  { id: 10, name: 'Migraine', value: 87, color: '#84cc16', percentage: 4.4, level: 'Low', trend: '-3%' },
  { id: 11, name: 'Anxiety', value: 156, color: '#06b6d4', percentage: 8.0, level: 'Medium', trend: '+6%' },
  { id: 12, name: 'Depression', value: 112, color: '#a855f7', percentage: 5.7, level: 'Medium', trend: '+7%' },
];

const AdminAnalytics = () => {
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

    fetchDemographics();
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
  const highRiskCount = riskCategoryData.filter(item => item.level === 'High').length;
  const mediumRiskCount = riskCategoryData.filter(item => item.level === 'Medium').length;
  const lowRiskCount = riskCategoryData.filter(item => item.level === 'Low').length;

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
    <AdminLayout>
      <div className="space-y-6">
        {/* Analytics Header */}
        <div className="bg-gradient-to-r from-[#263B6A] to-[#547792] rounded-2xl p-6 lg:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">System Analytics</h1>
              <p className="text-white/80 mt-2">Detailed health risk summary and user activity reports</p>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-white/80">System Operational</span>
                </div>
                <span className="text-white/40">|</span>
                <span className="text-sm text-white/80">{totalUsers.toLocaleString()} Total Users</span>
              </div>
            </div>

          </div>

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
        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-lg border border-gray-100">
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Interactive Pie Chart */}
            <div className="relative">
              <div className="h-64 md:h-72">
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
              </div>

              {/* Center Label */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <p className="text-3xl font-bold text-gray-800">{filteredRiskData.length}</p>
                <p className="text-xs text-gray-500">Categories</p>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {filteredRiskData.map((item, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs text-gray-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Enhanced Risk Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
              {filteredRiskData.length > 0 ? (
                filteredRiskData.map((item, index) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedRisk(selectedRisk?.id === item.id ? null : item)}
                    className={`p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer group ${selectedRisk?.id === item.id
                      ? 'border-[#263B6A] shadow-xl scale-[1.02]'
                      : 'border-gray-100 hover:border-gray-300 hover:shadow-lg'
                      }`}
                    style={{
                      background: 'white'
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                          style={{ backgroundColor: item.color }}
                        >
                          <span className="text-white font-bold text-sm">{item.value}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{item.name}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getLevelBadge(item.level)}`}>
                            {item.level} Risk
                          </span>
                        </div>
                      </div>
                      <div className={`text-sm font-semibold ${getTrendColor(item.trend)} flex items-center gap-1`}>
                        <span>{getTrendIcon(item.trend)}</span>
                        <span>{item.trend}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative">
                      <div className="w-full bg-white border border-gray-100 rounded-full h-3 mb-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out group-hover:shadow-lg"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                            boxShadow: `0 0 15px ${item.color}60`
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500">{item.percentage}% of total</p>
                      <p className="text-xs text-gray-400">ID: #{item.id}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-8">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-500">No risk categories found</p>
                  <p className="text-sm text-gray-400">Try adjusting your filters</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;

