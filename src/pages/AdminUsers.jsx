import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { collection, getDocs, doc, updateDoc, query, orderBy, limit, startAfter, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import CustomSelect from '../components/CustomSelect';

// Maps the AI-analyzed overall_health string to a standardized risk level
const mapOverallHealthToRisk = (healthString) => {
  if (!healthString || typeof healthString !== 'string') return 'Low';
  const h = healthString.toUpperCase().trim();
  // High Risk keywords
  if (['CRITICAL', 'URGENT', 'POOR', 'HIGH', 'SEVERE', 'DANGEROUS', 'ABNORMAL', 'UNSTABLE', 'RISK'].some(k => h.includes(k))) return 'High';
  // Medium Risk keywords
  if (['MODERATE', 'BORDERLINE', 'MEDIUM', 'CAUTION', 'ELEVATED', 'FAIR', 'AVERAGE', 'OBSERVATION'].some(k => h.includes(k))) return 'Medium';
  // Default: Low Risk
  return 'Low';
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [viewUser, setViewUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFullImageView, setIsFullImageView] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);

  const usersPerPage = 8;

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const fetchUsers = async (isNextPage = false) => {
    try {
      if (isNextPage) setFetchingMore(true);
      else setLoading(true);

      const usersRef = collection(db, 'users');
      let q;

      if (isNextPage && lastDoc) {
        // Use a larger limit for the first few pages to keep the UI snappy
        q = query(usersRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(50));
      } else {
        q = query(usersRef, orderBy('createdAt', 'desc'), limit(50));
      }

      const querySnapshot = await getDocs(q);

      const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastDoc(newLastDoc);
      setHasMore(querySnapshot.docs.length === 50);

      const relevantDocs = querySnapshot.docs.filter((document) => {
        const data = document.data();
        const isAdmin = data.role === 'admin' ||
          (data.email && (
            data.email === 'dhvanikoshti26@gmail.com' ||
            data.email === 'admin@gmail.com'
          ));
        return !isAdmin;
      });

      const usersList = await Promise.all(relevantDocs.map(async (document) => {
        const data = document.data();

        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

        // Joined Date calculation
        let joinedDateObj = new Date();
        if (data.createdAt?.toDate) {
          joinedDateObj = data.createdAt.toDate();
        } else if (data.joinedDate) {
          joinedDateObj = new Date(data.joinedDate);
        }

        let lastActiveDate;
        if (data.lastActive?.toDate) {
          lastActiveDate = data.lastActive.toDate();
        } else if (data.lastActive) {
          lastActiveDate = new Date(data.lastActive);
        } else {
          lastActiveDate = joinedDateObj; // Fallback to joined date
        }

        const dynamicStatus = lastActiveDate < twoMonthsAgo ? 'Inactive' : 'Active';

        // Fetch report count efficiently from subcollection
        const reportsRef = collection(db, 'users', document.id, 'reports');
        const reportSnapshot = await getCountFromServer(reportsRef);
        const reportCount = reportSnapshot.data().count;

        // Fetch overall_health from the latest report to determine risk level dynamically
        let dynamicRiskLevel = 'Low';
        try {
          const allReportsSnap = await getDocs(reportsRef);
          if (!allReportsSnap.empty) {
            // Sort client-side to find the latest report (avoids needing a Firestore index)
            const sortedDocs = allReportsSnap.docs.sort((a, b) => {
              const aTime = a.data().createdAt?.toMillis?.() || a.data().createdAt?.seconds * 1000 || 0;
              const bTime = b.data().createdAt?.toMillis?.() || b.data().createdAt?.seconds * 1000 || 0;
              return bTime - aTime;
            });
            const latestReport = sortedDocs[0].data();

            // Check multiple possible locations for overall_health (Robust extraction)
            const overallHealth = 
                latestReport.analysis?.overall_health 
                || latestReport.overall_health
                || latestReport.analysis?.overallHealth
                || latestReport.overallHealth
                || latestReport.analysis?.summary // Fallback to summary if health status is missing
                || '';

            dynamicRiskLevel = mapOverallHealthToRisk(overallHealth);
          }
        } catch (riskErr) {
          console.warn(`Could not fetch risk for user ${document.id}:`, riskErr);
        }

        return {
          id: document.id,
          name: data.name || 'Unknown',
          email: data.email || 'No email',
          phone: data.contactNumber || 'N/A',
          status: dynamicStatus,
          riskLevel: dynamicRiskLevel,
          reports: reportCount,
          lastActive: lastActiveDate.toISOString().split('T')[0],
          joinedDate: joinedDateObj.toISOString().split('T')[0],
          avatar: getInitials(data.name || data.email),
          gender: data.gender || 'N/A',
          dob: data.dob || 'N/A',
          address: data.address || 'N/A',
          bloodType: data.bloodGroup || 'N/A',
          emergencyContact: data.emergencyContact || 'N/A',
          medicalConditions: data.medicalConditions || 'None',
          profileImage: data.profileImage || null
        };
      }));

      if (isNextPage) {
        setUsers(prev => [...prev, ...usersList]);
        setFetchingMore(false);
      } else {
        setUsers(usersList);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setLoading(false);
      setFetchingMore(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status.toLowerCase() === statusFilter;
    const matchesRisk = riskFilter === 'all' || user.riskLevel.toLowerCase() === riskFilter;
    return matchesSearch && matchesStatus && matchesRisk;
  });

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === currentUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(currentUsers.map(user => user.id));
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { status: newStatus });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      if (viewUser && viewUser.id === user.id) {
        setViewUser(prev => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
    }
  };

  const getRiskBadge = (risk) => {
    const classes = {
      Low: 'bg-green-100 text-green-700',
      Medium: 'bg-amber-100 text-amber-700',
      High: 'bg-red-100 text-red-700'
    };
    return classes[risk] || classes.Low;
  };

  const getStatusBadge = (status) => {
    return status === 'Active'
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700';
  };

  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' }
  ];

  const riskOptions = [
    { label: 'All Risk Levels', value: 'all' },
    { label: 'Low Risk', value: 'low' },
    { label: 'Medium Risk', value: 'medium' },
    { label: 'High Risk', value: 'high' }
  ];

  return (
    <AdminLayout
      title={viewUser ? "User Details" : "User Management"}
      subtitle={viewUser ? `Viewing profile and health records for ${viewUser.name}` : "Manage and monitor all registered users"}
    >
      {viewUser ? (
        <div className="animate-fade-in space-y-5">

          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setViewUser(null)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all font-semibold text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Users
            </button>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-widest">User Profile</span>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── LEFT CARD ── */}
            <div className="premium-card overflow-hidden">

              {/* Avatar + Name */}
              <div className="p-8 flex flex-col items-center text-center">
                <div
                  onClick={() => { if (viewUser.profileImage) { setPreviewImageUrl(viewUser.profileImage); setIsFullImageView(true); } }}
                  className={`w-28 h-28 rounded-full bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] shadow-lg border-4 border-white overflow-hidden flex items-center justify-center text-[#263B6A] text-4xl font-extrabold mb-5 ${viewUser.profileImage ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
                >
                  {viewUser.profileImage
                    ? <img src={viewUser.profileImage} alt={viewUser.name} className="w-full h-full object-cover" />
                    : viewUser.avatar}
                </div>
                <h2 className="text-xl font-extrabold text-gray-900">{viewUser.name}</h2>
                <p className="text-sm text-gray-500 mt-1 truncate max-w-full">{viewUser.email}</p>

                {/* Status + Risk pills */}
                <div className="flex items-center gap-2 mt-5 flex-wrap justify-center">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${viewUser.status === 'Active' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {viewUser.status}
                  </span>
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${viewUser.riskLevel === 'High' ? 'bg-red-50 border-red-200 text-red-700' :
                    viewUser.riskLevel === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                      'bg-green-50 border-green-200 text-green-700'
                    }`}>
                    {viewUser.riskLevel} Risk
                  </span>
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="lg:col-span-2 flex flex-col gap-5">

              {/* Personal Information */}
              <div className="premium-card p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <h3 className="font-bold text-gray-800 text-lg">Personal Information</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
                  {[
                    { label: 'Gender', value: viewUser.gender, icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
                    { label: 'Date of Birth', value: viewUser.dob, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                    { label: 'Blood Type', value: viewUser.bloodType, highlight: true, icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
                    { label: 'Phone Number', value: viewUser.phone || 'N/A', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
                    { label: 'Joined Date', value: viewUser.joinedDate, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                    { label: 'Last Active', value: viewUser.lastActive, icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                  ].map((f, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center shrink-0 border border-gray-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} /></svg>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{f.label}</p>
                        {f.highlight
                          ? <span className="inline-block px-3 py-1 bg-red-50 text-red-600 font-bold text-sm rounded-lg border border-red-100">{f.value}</span>
                          : <p className="text-gray-900 font-bold text-[15px]">{f.value}</p>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity & Reports */}
              <div className="premium-card p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <h3 className="font-bold text-gray-800 text-lg">Health Records Summary</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Stat: Reports */}
                  <div className="bg-[#eff6ff] rounded-2xl p-6 text-center shadow-sm border border-blue-100">
                    <p className="text-4xl font-black text-[#263B6A]">{viewUser.reports}</p>
                    <p className="text-[10px] text-gray-500 font-bold mt-2 uppercase tracking-widest">Medical Reports</p>
                  </div>
                  {/* Stat: Status */}
                  <div className={`rounded-2xl p-6 text-center shadow-sm border ${viewUser.status === 'Active' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <p className={`text-4xl font-black ${viewUser.status === 'Active' ? 'text-green-600' : 'text-red-500'}`}>
                      {viewUser.status === 'Active' ? '✓' : '✗'}
                    </p>
                    <p className={`text-[10px] font-bold mt-2 uppercase tracking-widest ${viewUser.status === 'Active' ? 'text-green-600' : 'text-red-500'}`}>
                      {viewUser.status}
                    </p>
                  </div>
                  {/* Stat: Risk */}
                  <div className={`rounded-2xl p-6 text-center shadow-sm border ${viewUser.riskLevel === 'High' ? 'bg-red-50 border-red-100' :
                    viewUser.riskLevel === 'Medium' ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'
                    }`}>
                    <p className={`text-4xl font-black ${viewUser.riskLevel === 'High' ? 'text-red-600' :
                      viewUser.riskLevel === 'Medium' ? 'text-amber-500' : 'text-green-600'
                      }`}>{viewUser.riskLevel[0]}</p>
                    <p className={`text-[10px] font-bold mt-2 uppercase tracking-widest ${viewUser.riskLevel === 'High' ? 'text-red-600' :
                      viewUser.riskLevel === 'Medium' ? 'text-amber-500' : 'text-green-600'
                      }`}>{viewUser.riskLevel} Risk</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
            {[
              { label: 'Total Users', value: users.length, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', color: '#263B6A', light: '#eff6ff', badge: 'Platform' },
              { label: 'Low Risk', value: users.filter(u => u.riskLevel === 'Low').length, icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: '#10b981', light: '#ecfdf5', badge: 'Safe' },
              { label: 'Medium Risk', value: users.filter(u => u.riskLevel === 'Medium').length, icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', color: '#f59e0b', light: '#fffbeb', badge: 'Monitor' },
              { label: 'High Risk', value: users.filter(u => u.riskLevel === 'High').length, icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: '#ef4444', light: '#fef2f2', badge: 'Critical' }
            ].map((c, i) => (
              <div key={i} className="premium-card relative p-4 group overflow-hidden flex flex-col justify-between min-h-[110px] transition-all duration-300 hover:-translate-y-1">
                {/* Soft Decorative Background Blob */}
                <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none" style={{ backgroundColor: c.color }}></div>

                <div className="relative z-10 flex items-start justify-between mb-3">
                  <div className="p-2.5 rounded-xl shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: c.light, color: c.color }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={c.icon} />
                    </svg>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-full border shadow-sm backdrop-blur-sm"
                    style={{ backgroundColor: `${c.light}90`, borderColor: `${c.color}20`, color: c.color }}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse shadow-sm" style={{ backgroundColor: c.color }}></div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest">{c.badge}</span>
                    </div>
                  </div>
                </div>

                <div className="relative z-10">
                  <p className="text-xl lg:text-2xl font-bold text-slate-700 tracking-tight tabular-nums">{c.value.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-gray-500 mt-0.5 uppercase tracking-wider">{c.label}</p>
                </div>

                {/* Bottom decorative accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(90deg, ${c.light}, ${c.color})` }}></div>
              </div>
            ))}
          </div>

          {/* Filters & Search */}
          <div className="premium-card p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#263B6A] transition-all"
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                <CustomSelect
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  placeholder="All Status"
                  className="sm:w-[180px]"
                />

                <CustomSelect
                  options={riskOptions}
                  value={riskFilter}
                  onChange={(val) => setRiskFilter(val)}
                  placeholder="All Risk Levels"
                  className="sm:w-[200px]"
                />
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="premium-card overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600">User</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600">Contact</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600">Risk Level</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600">Reports</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600">Last Active</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600">Joined</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-gray-600 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentUsers.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-gray-500">
                        {loading ? 'Loading users...' : 'No users found matching your criteria.'}
                      </td>
                    </tr>
                  ) : currentUsers.map((user, index) => (
                    <tr key={user.id} className="border-b border-gray-100 bg-white hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => {
                              if (user.profileImage) {
                                setPreviewImageUrl(user.profileImage);
                                setIsFullImageView(true);
                              }
                            }}
                            className={`w-10 h-10 rounded-full bg-[#263B6A] flex items-center justify-center text-white font-semibold text-sm overflow-hidden ${user.profileImage ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
                          >
                            {user.profileImage ? (
                              <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              user.avatar
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">{user.phone}</td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(user.status)}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRiskBadge(user.riskLevel)}`}>
                          {user.riskLevel}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">{user.reports}</td>
                      <td className="py-4 px-4 text-sm text-gray-600">{user.lastActive}</td>
                      <td className="py-4 px-4 text-sm text-gray-600">{user.joinedDate}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setViewUser(user)}
                            className="p-2 text-gray-400 hover:text-[#263B6A] hover:bg-[#e8eef5] rounded-lg transition-colors border border-transparent hover:border-[#263B6A]/20"
                            title="View Full Profile"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="flex justify-center py-6 bg-gray-50/30 border-t border-gray-100">
                <button
                  onClick={() => fetchUsers(true)}
                  disabled={fetchingMore}
                  className="flex items-center gap-2 px-8 py-2.5 bg-white border-2 border-[#263B6A] text-[#263B6A] rounded-xl font-bold hover:bg-[#263B6A] hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {fetchingMore ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </>
                  ) : 'Load More Users'}
                </button>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Showing {currentUsers.length > 0 ? indexOfFirstUser + 1 : 0} to {Math.min(indexOfLastUser, filteredUsers.length)} of {filteredUsers.length} users
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {Array.from({ length: totalPages || 1 }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-lg font-semibold transition-colors ${currentPage === page
                      ? 'bg-[#263B6A] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Full Screen Image Modal */}
      {isFullImageView && previewImageUrl && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-fade-in backdrop-blur-sm">
          <button
            onClick={() => {
              setIsFullImageView(false);
              setPreviewImageUrl(null);
            }}
            className="absolute top-6 right-6 w-12 h-12 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all transform hover:scale-110 shadow-2xl"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <img
            src={previewImageUrl}
            alt="Full Screen Profile"
            className="w-auto h-auto max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl shadow-black/50 pointer-events-none select-none"
          />
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminUsers;
