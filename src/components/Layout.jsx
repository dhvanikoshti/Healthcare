import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';


// Helper function to get initials from name
const getInitials = (name) => {
  if (!name) return 'U';
  const words = name.trim().split(' ');
  if (words.length >= 2) {
    return words[0][0].toUpperCase();
  }
  return name.charAt(0).toUpperCase();
};


const Layout = ({ children, title, titleBadge, headerActions }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState('');
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // Get user data from Firestore
  const [userData, setUserData] = useState({ name: 'User', email: '', profileImage: null });


  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setActiveMenu(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    let unsubscribeSnapshot = null;
    let unsubscribeSessions = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('Auth user:', user);

        // Session validation check
        const sessionId = localStorage.getItem('currentSessionId');
        if (sessionId) {
          const sessionsRef = collection(db, 'users', user.uid, 'sessions');
          const q = query(sessionsRef, where('sessionId', '==', sessionId));

          unsubscribeSessions = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
              console.log('Session invalidated remotely');
              localStorage.removeItem('currentSessionId');
              auth.signOut();
              navigate('/login');
            }
          });
        }

        const userRef = doc(db, 'users', user.uid);

        // Update lastActive once upon authentication
        updateDoc(userRef, { lastActive: serverTimestamp() }).catch(err => console.error("Error updating lastActive:", err));

        unsubscribeSnapshot = onSnapshot(userRef, (userSnap) => {
          const data = userSnap.exists() ? userSnap.data() : {};
          const fallbackName = (user.displayName || user.email?.split('@')[0] || 'User')
            .split(/[._ ]/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');

          setUserData({
            name: data.name || fallbackName,
            email: data.email || user.email || '',
            profileImage: data.profileImage || null
          });
        });
      } else {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        if (unsubscribeSessions) unsubscribeSessions();
        setUserData({ name: '', email: '', profileImage: null });
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (unsubscribeSessions) unsubscribeSessions();
    };
  }, []);


  const handleLogout = async () => {
    try {
      const user = auth.currentUser;
      const sessionId = localStorage.getItem('currentSessionId');
      if (user && sessionId) {
        const sessionsRef = collection(db, 'users', user.uid, 'sessions');
        const q = query(sessionsRef, where('sessionId', '==', sessionId));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }
      localStorage.removeItem('currentSessionId');
      await auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
    navigate('/login');
  };


  const sidebarWidth = sidebarCollapsed ? 'w-20' : 'w-72';
  const mainMargin = sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72';

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', iconBg: '#06b6d4' },
    { name: 'Upload Report', path: '/upload', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12', iconBg: '#8b5cf6' },
    { name: 'Reports', path: '/reports', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', iconBg: '#f59e0b' },
    { name: 'Trend Analysis', path: '/trends', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z', iconBg: '#10b981' },
    { name: 'Health Insights', path: '/health-insights', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', iconBg: '#8b5cf6' },
    { name: 'Health Tips', path: '/health-tips', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', iconBg: '#14b8a6' },
    { name: 'Health Chat', path: '/chat', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', iconBg: '#ec4899' },
    { name: 'My Profile', path: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', iconBg: '#64748b' },
  ];

  const notifications = [
    { id: 1, message: 'New lab results uploaded', time: '2 min ago', unread: true, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 2, message: 'Risk assessment completed', time: '1 hour ago', unread: true, icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { id: 3, message: 'Monthly health report ready', time: '1 day ago', unread: false, icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#263B6A]/30 shadow-[0_2px_8px_rgba(0,0,0,0.18)]" style={{ backgroundColor: '#263B6A' }}>
        <div className="flex items-center justify-between px-4 lg:px-6 py-3">
          {/* Left - Logo & Burger Menu */}
          <div className="flex items-center gap-4">
            {/* Toggle Button - Desktop with collapse, Mobile to open */}
            <button
              onClick={() => {
                if (isDesktop) {
                  setSidebarCollapsed(!sidebarCollapsed);
                } else {
                  setSidebarOpen(!sidebarOpen);
                }
              }}
              className={`p-2 rounded-lg hover:bg-white/10 transition-colors text-white ${isDesktop && sidebarCollapsed ? 'p-3 rounded-xl' : ''}`}
              title={isDesktop ? (sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar") : (sidebarOpen ? "Close menu" : "Open menu")}
            >
              <svg className={`${isDesktop && sidebarCollapsed ? 'w-7 h-7' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isDesktop ? (
                  sidebarCollapsed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  )
                ) : (
                  sidebarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )
                )}
              </svg>
            </button>

            <div className="flex items-center gap-3">
              <img
                src="/src/assets/logo.png"
                alt="HealthCare AI Logo"
                className="w-45 h-15 p-1"
              />

            </div>
          </div>

          {/* Right - Notifications, AI Chat & Profile */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* AI Chat Button */}
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 px-3 py-2 text-white rounded-xl hover:bg-white/10 transition-colors"
              title="AI Health Assistant"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="hidden sm:inline text-sm font-medium">AI Chat</span>
            </button>

            {/* Upload Button */}
            <Link
              to="/upload"
              className="p-2.5 rounded-xl hover:bg-white/10 transition-colors text-white"
              title="Upload Report"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </Link>


            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center md:gap-3 p-0.5 md:p-1 md:pr-4 rounded-full hover:bg-white/10 transition-colors shrink-0 w-10 h-10 md:w-auto md:h-auto justify-center md:justify-start"
              >
                {userData.profileImage ? (
                  <img src={userData.profileImage} alt="Profile" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: '#547792' }}>
                    {getInitials(userData.name)}
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-white">{userData.name || userData.email?.split('@')[0] || 'User'}</p>
                </div>

                <svg className="hidden md:block w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden z-50">
                  <div className="px-5 py-4 bg-white border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {userData.profileImage ? (
                        <img src={userData.profileImage} alt="Profile" className="w-12 h-12 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: '#547792' }}>
                          {getInitials(userData.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-800">{userData.name || userData.email?.split('@')[0] || 'User'}</p>
                        <p className="text-sm text-gray-500">{userData.email || 'No email'}</p>
                      </div>

                    </div>
                  </div>
                  <div className="py-2">
                    <Link to="/settings" className="w-full px-5 py-3 text-left text-sm text-gray-600 hover:bg-white flex items-center gap-3 transition-colors">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      My Profile
                    </Link>
                  </div>
                  <div className="py-2 border-t border-gray-100">
                    <button
                      onClick={handleLogout}
                      className="w-full px-5 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar - Collapsible */}
      <aside className={`hidden lg:flex pt-4 flex-col fixed left-0 top-[60px] bottom-0 z-40 bg-white border-r border-gray-200 transition-all duration-300 ${sidebarWidth}`}>

        <div className="flex-1 overflow-y-auto py-4 px-3">
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center rounded-2xl transition-all overflow-hidden ${activeMenu === item.path ? 'text-white' : 'text-gray-600 hover:bg-white'} ${sidebarCollapsed ? 'justify-center w-14 h-14 mx-auto' : 'gap-3 px-4 py-3.5'}`}
                style={activeMenu === item.path ? { backgroundColor: '#263B6A' } : {}}
                title={sidebarCollapsed ? item.name : ''}
              >
                <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center transition-all`} style={{ backgroundColor: activeMenu === item.path ? 'rgba(255,255,255,0.2)' : item.iconBg + '20' }}>
                  <svg className="w-5 h-5" style={{ color: activeMenu === item.path ? 'white' : item.iconBg }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                {!sidebarCollapsed && <span className="font-semibold whitespace-nowrap">{item.name}</span>}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile Sidebar - Slides in */}
      <aside
        className={`lg:hidden fixed left-0 top-[60px] bottom-0 pt-4 z-40 bg-white border-r border-gray-200 w-72 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >

        <div className="h-[calc(100%-70px)] overflow-y-auto py-4 px-3">
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${activeMenu === item.path
                  ? 'text-white'
                  : 'text-gray-600 hover:bg-white'
                  }`}
                style={activeMenu === item.path ? { backgroundColor: '#263B6A' } : {}}
              >
                {activeMenu === item.path && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full" style={{ backgroundColor: '#547792' }}></div>
                )}
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110`}
                  style={{ backgroundColor: activeMenu === item.path ? 'rgba(255,255,255,0.2)' : item.iconBg + '20' }}
                >
                  <svg
                    className="w-5 h-5 transition-all duration-300 group-hover:scale-110"
                    style={{ color: activeMenu === item.path ? 'white' : item.iconBg }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                <span className="font-semibold whitespace-nowrap">{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <main className={`pt-[60px] transition-all duration-300 ${mainMargin}`} style={{ backgroundColor: 'white' }}>
        {title && (
          <div className="bg-slate-100/100 border-b border-slate-200/80 pt-10 sm:pt-10 pb-1 sm:pb-5 px-6 sm:px-8 lg:px-10 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
            <div className="flex items-center justify-between w-full md:w-auto gap-3 sm:gap-4 min-w-0">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="h-6 w-1 bg-blue-600 rounded-full shrink-0"></div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight leading-none truncate max-w-[150px] sm:max-w-[300px] md:max-w-none">{title}</h1>
              </div>
              {titleBadge}
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              {headerActions}
            </div>
          </div>
        )}
        <div className="p-4 sm:p-6 lg:p-6" style={{ backgroundColor: 'white' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
