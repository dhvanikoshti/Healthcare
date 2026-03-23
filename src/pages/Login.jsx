import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { getSystemFingerprint, getSystemName, getBrowserName } from '../utils/deviceFingerprint';

const Login = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: Yup.object({
      email: Yup.string()
        .email('Invalid email address')
        .required('Email is required'),
      password: Yup.string()
        .min(8, 'Password must be at least 8 characters')
        .required('Password is required'),
    }),
    onSubmit: async (values) => {
      setIsSubmitting(true);
      setLoginError('');
      try {
        const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
        const user = userCredential.user;

        // Record Session Info
        const systemId = getSystemFingerprint();
        const systemName = getSystemName();
        const browserName = getBrowserName();
        
        // Check for existing session on this system
        const sessionRef = doc(db, 'users', user.uid, 'sessions', systemId);
        const sessionSnap = await getDoc(sessionRef);
        
        let sessionId;
        if (sessionSnap.exists()) {
          // Reuse existing sessionId to allow concurrent browsers on same system
          sessionId = sessionSnap.data().sessionId;
          await setDoc(sessionRef, {
            lastActive: serverTimestamp(),
            deviceName: `${browserName} on ${systemName}`,
            browser: browserName,
            userAgent: window.navigator.userAgent
          }, { merge: true });
        } else {
          // New system, generate new sessionId
          sessionId = Math.random().toString(36).substring(2, 15);
          const sessionData = {
            sessionId,
            systemId,
            deviceName: `${browserName} on ${systemName}`,
            userAgent: window.navigator.userAgent,
            loginTime: serverTimestamp(),
            lastActive: serverTimestamp(),
            browser: browserName,
            os: systemName
          };
          await setDoc(sessionRef, sessionData);
        }

        localStorage.setItem('currentSessionId', sessionId);

        // Get user role from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        let isAdmin = false;
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role === 'admin') {
            isAdmin = true;
          }
        }

        // Hardcoded fallback for the primary admin email
        if (user.email && user.email.toLowerCase() === 'admin@gmail.com') {
          isAdmin = true;
        }

        setIsSubmitting(false);
        setLoginSuccess(true);

        setTimeout(() => {
          if (isAdmin) {
            navigate('/admin/dashboard');
          } else {
            navigate('/dashboard');
          }
        }, 1000);

      } catch (error) {
        console.error('Login error:', error);
        setIsSubmitting(false);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          setLoginError('Invalid email or password.');
        } else {
          setLoginError('Failed to login. Please try again.');
        }
      }
    },
  });

  const inputClasses = "w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#547792] focus:border-[#547792] transition-all duration-300 text-base";
  const labelClasses = "block text-sm font-bold text-gray-700 mb-2";
  const errorClasses = "text-red-500 text-xs mt-1 font-medium";

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Side - Image */}
      <div className="w-full md:w-1/2 h-64 md:h-auto relative" style={{ backgroundColor: '#B7BDF7' }}>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?ixlib=rb-4.0.3&auto=format&fit=crop&w=2074&q=80")' }}>
          <div className="absolute inset-0" style={{ backgroundColor: '#547792', opacity: 0.7 }}></div>
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center h-full p-10 text-center">
          <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm">
            <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">Welcome Back</h2>
          <p className="text-white/90 text-lg max-w-md">Connect with us and start your journey to better health</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-12" style={{ backgroundColor: '#B7BDF7' }}>
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10 relative">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold" style={{ color: '#547792' }}>Sign In</h2>
              <p className="text-gray-500 mt-2">Please enter your details to continue</p>
            </div>

            {/* Success Modal */}
            {loginSuccess && (
              <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-8 md:p-10 shadow-2xl transform animate-bounce-in max-w-sm mx-4 text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Login Success!</h3>
                  <p className="text-gray-600 mb-4">Welcome back to Healthcare</p>
                  <div className="flex justify-center">
                    <div className="w-10 h-10 border-4 border-[#547792] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-red-800">Login Failed</p>
                    <p className="text-sm text-red-600">{loginError}</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={formik.handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className={labelClasses}>Email Address</label>
                <input
                  id="email"
                  type="email"
                  {...formik.getFieldProps('email')}
                  className={inputClasses}
                  placeholder="Enter your email"
                />
                {formik.touched.email && formik.errors.email ? (
                  <div className={errorClasses}>{formik.errors.email}</div>
                ) : null}
              </div>

              <div>
                <label htmlFor="password" className={labelClasses}>Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...formik.getFieldProps('password')}
                    className={inputClasses}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#547792] transition-colors p-1"
                  >
                    {showPassword ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
                {formik.touched.password && formik.errors.password ? (
                  <div className={errorClasses}>{formik.errors.password}</div>
                ) : null}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: '#547792' }}
                  />
                  <span className="ml-2 text-gray-600">Remember me</span>
                </label>
                <Link to="/forgot-password" className="font-medium hover:underline" style={{ color: '#547792' }}>
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 text-white font-bold rounded-lg shadow-lg transform hover:scale-[1.01] transition-all disabled:opacity-50"
                style={{ backgroundColor: '#547792' }}
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-4 text-gray-400">or</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <button
                type="button"
                className="w-full py-4 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-lg flex items-center justify-center gap-3 transition-all"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <div className="text-center pt-2">
                <p className="text-gray-600">
                  Don't have an account?{' '}
                  <Link to="/register" className="font-bold hover:underline" style={{ color: '#547792' }}>
                    Sign up
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
