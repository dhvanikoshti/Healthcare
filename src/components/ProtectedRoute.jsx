import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ProtectedRoute = ({ children, requiredRole }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthenticated(true);
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            let role = data.role || 'user';
            
            // Hardcoded fallback for primary admin
            if (user.email && user.email.toLowerCase() === 'dhvanikoshti26@gmail.com') {
              role = 'admin';
            }
            setUserRole(role);
          } else {
            setUserRole('user');
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole('user');
        }
      } else {
        setAuthenticated(false);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-[#263B6A] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    // If user is admin trying to access user page, or user trying to access admin page
    const redirectPath = userRole === 'admin' ? '/admin/dashboard' : '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

export default ProtectedRoute;
