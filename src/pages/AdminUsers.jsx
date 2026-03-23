import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [viewUser, setViewUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const usersPerPage = 8;

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = [];
      querySnapshot.forEach((document) => {
        const data = document.data();
        if (data.email === 'admin@gmail.com' || data.role === 'admin') return;

        let dateObj = new Date();
        if (data.createdAt && data.createdAt.toDate) {
          dateObj = data.createdAt.toDate();
        } else if (data.joinedDate) {
          dateObj = new Date(data.joinedDate);
        }

        usersList.push({
          id: document.id,
          name: data.name || 'Unknown',
          email: data.email || 'No email',
          phone: data.contactNumber || 'N/A',
          status: data.status || 'Active',
          riskLevel: data.riskLevel || 'Low',
          reports: data.reports || 0,
          lastActive: data.lastActive || dateObj.toISOString().split('T')[0],
          joinedDate: dateObj.toISOString().split('T')[0],
          avatar: getInitials(data.name || data.email),
          gender: data.gender || 'N/A',
          dob: data.dob || 'N/A',
          address: data.address || 'N/A',
          bloodType: data.bloodGroup || 'N/A',
          emergencyContact: data.emergencyContact || 'N/A',
          medicalConditions: data.medicalConditions || 'None'
        });
      });
      usersList.sort((a, b) => new Date(b.joinedDate) - new Date(a.joinedDate));
      setUsers(usersList);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching users:", error);
      setLoading(false);
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

  return (
    <AdminLayout>
      {viewUser ? (
        <div className="premium-card overflow-hidden animate-fade-in flex flex-col h-full min-h-[calc(100vh-10rem)]">
          {/* Header with Background */}
          <div className="bg-gradient-to-r from-[#263B6A] to-[#547792] p-8 md:p-12 text-white relative flex-shrink-0">
            <button
              onClick={() => setViewUser(null)}
              className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/40 rounded-xl transition-all duration-300 backdrop-blur-sm shadow-sm"
              title="Close Details"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-28 h-28 rounded-3xl bg-white text-[#263B6A] flex items-center justify-center text-4xl font-extrabold shadow-2xl shrink-0">
                {viewUser.avatar}
              </div>
              <div className="text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-extrabold">{viewUser.name}</h2>
                <p className="text-white/80 text-lg mt-1 font-medium">{viewUser.email}</p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border shadow-sm ${viewUser.status === 'Active' ? 'bg-green-500/20 border-green-500/50 text-green-50' : 'bg-red-500/20 border-red-500/50 text-red-50'}`}>
                    Status: {viewUser.status}
                  </span>
                  <span className={`px-4 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-bold uppercase tracking-wide backdrop-blur-md shadow-sm`}>
                    Risk: {viewUser.riskLevel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Content */}
          <div className="p-6 md:p-8 bg-white flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="premium-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                </div>
                <h3 className="font-bold text-gray-800">Contact Details</h3>
              </div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Phone Number</p>
              <p className="text-gray-800 font-medium mt-1 mb-4">{viewUser.phone}</p>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Emergency Contact</p>
              <p className="text-gray-800 font-medium mt-1">{viewUser.emergencyContact}</p>
            </div>

            <div className="premium-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <h3 className="font-bold text-gray-800">Personal Info</h3>
              </div>
              <div className="grid grid-cols-2 gap-y-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Gender</p>
                  <p className="text-gray-800 font-medium mt-1">{viewUser.gender}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Date of Birth</p>
                  <p className="text-gray-800 font-medium mt-1">{viewUser.dob}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Blood Type</p>
                  <span className="inline-block mt-1 px-2.5 py-1 bg-red-50 text-red-600 font-bold text-xs rounded-md border border-red-100">{viewUser.bloodType}</span>
                </div>
              </div>
            </div>

            <div className="premium-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white border border-amber-100 text-amber-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2v3m0 0h-2m-2 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="font-bold text-gray-800">Health Overview</h3>
              </div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Medical Conditions</p>
              <p className="text-gray-800 font-medium mt-1 mb-4">{viewUser.medicalConditions}</p>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Associated Reports</p>
              <p className="text-gray-800 font-medium mt-1">
                <span className="px-2 py-0.5 bg-gray-100 rounded text-sm font-bold mr-1">{viewUser.reports}</span> matching documents
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow md:col-span-2 lg:col-span-3 flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-white text-gray-500 border border-gray-200 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Residential Address</p>
                <p className="text-gray-800 font-medium mt-1 text-sm sm:text-base">{viewUser.address}</p>
              </div>
            </div>

            <div className="premium-card p-6 md:col-span-1 lg:col-span-1 border-l-4 border-l-[#263B6A]">
              <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Joined Date</p>
              <p className="text-gray-800 font-medium">{viewUser.joinedDate}</p>
            </div>
            <div className="premium-card p-6 md:col-span-1 lg:col-span-1 border-l-4 border-l-emerald-500">
              <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Last Active</p>
              <p className="text-gray-800 font-medium">{viewUser.lastActive}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* User Management Header */}
          <div className="bg-gradient-to-r from-[#263B6A] to-[#547792] rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">User Management</h1>
                <p className="text-white/80 mt-2">Manage and monitor all registered users</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            {[
              { label: 'Total Users', value: users.length, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', color: '#263B6A', light: '#eff6ff', badge: 'Platform' },
              { label: 'Low Risk', value: users.filter(u => u.riskLevel === 'Low').length, icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: '#10b981', light: '#ecfdf5', badge: 'Active' },
              { label: 'Medium Risk', value: users.filter(u => u.riskLevel === 'Medium').length, icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', color: '#f59e0b', light: '#fffbeb', badge: 'Review' },
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

              <div className="flex items-center gap-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-[#263B6A] transition-all cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-[#263B6A] transition-all cursor-pointer"
                >
                  <option value="all">All Risk Levels</option>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="premium-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
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
                          <div className="w-10 h-10 rounded-xl bg-[#263B6A] flex items-center justify-center text-white font-semibold text-sm">
                            {user.avatar}
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
                            className="p-2 text-gray-500 hover:text-[#263B6A] hover:bg-[#e8eef5] rounded-lg transition-colors border border-transparent hover:border-[#263B6A]/20"
                            title="View Full Profile"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`p-2 rounded-lg transition-colors border border-transparent ${user.status === 'Active' ? 'text-gray-500 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200' : 'text-gray-500 hover:text-green-600 hover:bg-green-50 hover:border-green-200'}`}
                            title={user.status === 'Active' ? "Deactivate User" : "Activate User"}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                              <line x1="12" y1="2" x2="12" y2="12"></line>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
    </AdminLayout>
  );
};

export default AdminUsers;
