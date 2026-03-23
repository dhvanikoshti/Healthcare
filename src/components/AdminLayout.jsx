import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';

import { doc, getDoc, onSnapshot, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';

const AdminLayout = ({ children }) => {
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

  const [activeMenu, setActiveMenu] = useState('/admin/dashboard');
  const [userData, setUserData] = useState({ name: '', email: '', profileImage: null });
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Subscribe to accurate Firestore data
    const auth = getAuth();
    let unsubscribeSnapshot = null;
    let unsubscribeSessions = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Session validation check
        const sessionId = localStorage.getItem('currentSessionId');
        if (sessionId) {
          const sessionsRef = collection(db, 'users', user.uid, 'sessions');
          const q = query(sessionsRef, where('sessionId', '==', sessionId));

          unsubscribeSessions = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
              console.log('Admin session invalidated remotely');
              localStorage.removeItem('currentSessionId');
              auth.signOut();
              navigate('/login');
            }
          });
        }

        const docRef = doc(db, 'users', user.uid);
        unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData({ name: data.name || 'Admin', email: user.email || 'admin@healthcare.com', profileImage: data.profileImage || null });
          }
        });
      } else {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        if (unsubscribeSessions) unsubscribeSessions();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (unsubscribeSessions) unsubscribeSessions();
    };
  }, []);

  useEffect(() => { setActiveMenu(location.pathname); }, [location.pathname]);
  const getFirstLetter = (name) => name ? name.charAt(0).toUpperCase() : 'A';
  const handleLogout = async () => {
    try {
      const auth = getAuth();
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
  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
  const toggleMobileSidebar = () => setSidebarOpen(!sidebarOpen);

  const menuItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', iconBg: '#06b6d4' },
    { name: 'User Management', path: '/admin/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', iconBg: '#8b5cf6' },
    { name: 'System Analytics', path: '/admin/analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', iconBg: '#10b981' },
    { name: 'Health Tips', path: '/admin/health-tips', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z', iconBg: '#ec4899' },
    { name: 'My Profile', path: '/admin/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', iconBg: '#64748b' },
  ];

  const sidebarWidth = sidebarCollapsed ? 'w-20' : 'w-72';
  const mainMargin = sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72';

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#263B6A]/30 shadow-[0_2px_8px_rgba(0,0,0,0.18)]" style={{ backgroundColor: '#263B6A' }}>
        <div className="flex items-center justify-between px-4 lg:px-6 py-3">
          <div className="flex items-center gap-4">
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
            <img src="/src/assets/logo.png" alt="Logo" className="w-45 h-15 p-1" />
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="relative" ref={profileRef}>
              <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-3 p-1.5 pr-4 rounded-xl hover:bg-white/10 transition-colors">
                {userData.profileImage ? (
                  <img src={userData.profileImage} alt="Admin" className="w-9 h-9 rounded-xl object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#547792' }}>{getFirstLetter(userData.name)}</div>
                )}
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-white">{userData.name || 'Admin'}</p>
                </div>
                <svg className="hidden md:block w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden z-50">
                  <div className="px-5 py-4 bg-white border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {userData.profileImage ? (
                        <img src={userData.profileImage} alt="Admin" className="w-12 h-12 rounded-xl object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: '#547792' }}>{getFirstLetter(userData.name)}</div>
                      )}
                      <div><p className="font-bold text-gray-800">{userData.name || 'Admin'}</p><p className="text-sm text-gray-500">{userData.email || 'admin@gmail.com'}</p></div>
                    </div>
                  </div>
                  <div className="py-2"><Link to="/admin/settings" className="w-full px-5 py-3 text-left text-sm text-gray-600 hover:bg-white flex items-center gap-3">My Profile</Link></div>
                  <div className="py-2 border-t border-gray-100"><button onClick={handleLogout} className="w-full px-5 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3">Logout</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <aside className={`hidden lg:flex pt-4 flex-col fixed left-0 top-[60px] bottom-0 z-40 bg-white border-r border-gray-200 shadow-[2px_0_8px_rgba(0,0,0,0.06)] transition-all duration-300 ${sidebarWidth}`}>

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

      <aside className={`lg:hidden fixed left-0 top-[60px] bottom-0 z-40 bg-white shadow-2xl w-72 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-4 py-4 border-b border-gray-200">

        </div>
        <div className="h-[calc(100%-70px)] overflow-y-auto py-4 px-3">
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <Link key={item.name} to={item.path} onClick={() => setSidebarOpen(false)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl ${activeMenu === item.path ? 'text-white' : 'text-gray-600 hover:bg-white'}`} style={activeMenu === item.path ? { backgroundColor: '#263B6A' } : {}}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: activeMenu === item.path ? 'rgba(255,255,255,0.2)' : item.iconBg + '20' }}>
                  <svg className="w-5 h-5" style={{ color: activeMenu === item.path ? 'white' : item.iconBg }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} /></svg>
                </div>
                <span className="font-semibold">{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)}></div>}

      <main className={`pt-[60px] transition-all duration-300 ${mainMargin}`} style={{ backgroundColor: 'white' }}>
        <div className="p-4 lg:p-6 xl:p-8" style={{ backgroundColor: 'white' }}>{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;

