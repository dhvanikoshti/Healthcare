import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';

import { doc, getDoc, onSnapshot, collection, query, where, getDocs, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isFullImageView, setIsFullImageView] = useState(false);
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
  const [userData, setUserData] = useState({ name: 'Admin', email: '', profileImage: null });
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Subscribe to accurate Firestore data
    const auth = getAuth();
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

        // Update lastActive once upon authentication
        updateDoc(docRef, { lastActive: serverTimestamp() }).catch(err => console.error("Error updating admin lastActive:", err));

        const fetchUser = async () => {
          const docSnap = await getDoc(docRef);
          const data = docSnap.exists() ? docSnap.data() : {};
          setUserData({
            name: data.name || (user.email === 'dhvanikoshti26@gmail.com' ? 'Dhvani Koshti' : 'Admin'),
            email: user.email || data.email || 'admin@healthcare.com',
            profileImage: data.profileImage || null
          });
        };
        fetchUser();
      } else {
        if (unsubscribeSessions) unsubscribeSessions();
      }
    });

    return () => {
      unsubscribeAuth();
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
    { name: 'My Profile', path: '/admin/settings', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', iconBg: '#64748b' },
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
              <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center md:gap-3 p-0.5 md:p-1 md:pr-4 rounded-full hover:bg-white/10 transition-colors shrink-0 w-10 h-10 md:w-auto md:h-auto justify-center md:justify-start">
                {userData.profileImage ? (
                  <img src={userData.profileImage} alt="Admin" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: '#547792' }}>{getFirstLetter(userData.name)}</div>
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
                        <div onClick={() => setIsFullImageView(true)} className="w-12 h-12 rounded-full overflow-hidden cursor-pointer ring-2 ring-gray-100 hover:ring-[#263B6A] transition-all shrink-0">
                          <img src={userData.profileImage} alt="Admin" className="w-full h-full object-cover rounded-full" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: '#547792' }}>{getFirstLetter(userData.name)}</div>
                      )}
                      <div>
                        <p className="font-bold text-gray-800">{userData.name || 'Admin'}</p>
                        <p className="text-sm text-gray-500">{userData.email || 'admin@healthcare.com'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="py-2"><button onClick={() => { setProfileOpen(false); navigate('/admin/settings'); }} className="w-full px-5 py-3 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-3 transition-colors"><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>My Profile</button></div>
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

      <aside className={`lg:hidden fixed left-0 top-[60px] bottom-0 z-40 bg-white pt-4 shadow-2xl w-72 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

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
        <div className="p-4 sm:p-6 lg:p-6 xl:p-10" style={{ backgroundColor: 'white' }}>{children}</div>
      </main>

      {/* Full Screen Image Modal */}
      {isFullImageView && userData.profileImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-fade-in backdrop-blur-sm">
          <button
            onClick={() => setIsFullImageView(false)}
            className="absolute top-6 right-6 w-12 h-12 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all transform hover:scale-110 shadow-2xl"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <img
            src={userData.profileImage}
            alt="Full Screen Profile"
            className="w-auto h-auto max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl shadow-black/50 pointer-events-none select-none"
          />
        </div>
      )}
    </div>
  );
};

export default AdminLayout;

