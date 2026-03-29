import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getSystemFingerprint, getSystemName, getBrowserName } from '../utils/deviceFingerprint';
import CustomSelect from '../components/CustomSelect';


const Register = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerError, setRegisterError] = useState('');

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const genders = ['Male', 'Female', 'Other'];

  // Handle contact number - only allow numbers and max 10 digits
  const handleContactChange = (e, formik) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-numeric characters
    const limitedValue = value.slice(0, 10); // Limit to 10 digits
    formik.setFieldValue('contactNumber', limitedValue);
  };

  const formik = useFormik({
    initialValues: {
      name: '',
      dob: '',
      gender: '',
      bloodGroup: '',
      contactNumber: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validationSchema: Yup.object({
      name: Yup.string().min(2, 'Name must be at least 2 characters').required('Name is required'),
      dob: Yup.date().max(new Date(), 'Date of birth cannot be in the future').required('Date of birth is required'),
      gender: Yup.string().required('Gender is required'),
      bloodGroup: Yup.string().required('Blood group is required'),
      contactNumber: Yup.string().matches(/^[0-9]{10}$/, 'Contact number must be 10 digits').required('Contact number is required'),
      email: Yup.string().email('Invalid email address').required('Email is required'),
      password: Yup.string().min(8, 'Password must be at least 8 characters').matches(/[A-Z]/, 'Password must contain at least one uppercase letter').matches(/[a-z]/, 'Password must contain at least one lowercase letter').matches(/[0-9]/, 'Password must contain at least one number').matches(/[!@#$%^&*]/, 'Password must contain at least one special character').required('Password is required'),
      confirmPassword: Yup.string().oneOf([Yup.ref('password'), null], 'Passwords must match').required('Confirm password is required'),
    }),
    onSubmit: async (values) => {
      try {
        setIsSubmitting(true);
        setRegisterError('');

        // ✅ Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          values.email,
          values.password
        );

        const user = userCredential.user;

        // ✅ Only displayName allowed here
        await updateProfile(user, {
          displayName: values.name,
        });

        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: values.name,
          email: values.email,
          dob: values.dob,
          gender: values.gender,
          bloodGroup: values.bloodGroup,
          contactNumber: values.contactNumber,
          role: 'user', // Default role
          createdAt: serverTimestamp(),
        });

        // Record Session Info
        const systemId = getSystemFingerprint();
        const systemName = getSystemName();
        const browserName = getBrowserName();

        // Use a stable sessionId or generate a new one if it's a new system
        const sessionId = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('currentSessionId', sessionId);

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

        // For registration, we always create a new session doc as it's the first time
        await setDoc(doc(db, 'users', user.uid, 'sessions', systemId), sessionData);

        setIsSubmitting(false);
        setShowSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } catch (error) {
        console.error("Error during registration:", error);
        setIsSubmitting(false);
        if (error.code === 'auth/email-already-in-use') {
          setRegisterError('This email is already registered. Please login.');
        } else if (error.code === 'auth/weak-password') {
          setRegisterError('Password is too weak. Please use a stronger password.');
        } else {
          setRegisterError('Failed to create account. Please try again.');
        }
      }
    },
  });

  const inputClasses = "w-full px-4 py-2.5 md:px-5 md:py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#547792] focus:border-[#547792] transition-all duration-300 text-sm md:text-base";
  const labelClasses = "block text-xs md:text-sm font-bold text-gray-700 mb-1.5";
  const errorClasses = "text-red-500 text-[10px] md:text-xs mt-0.5 font-medium";

  // Success Message Component
  const SuccessMessage = () => (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-8 md:p-10 shadow-2xl transform animate-bounce-in max-w-md mx-4 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl md:text-3xl font-bold text-gray-800 mb-3">Registration Successful!</h3>
        <p className="text-gray-600 mb-4">Your account has been created successfully.</p>
        <p className="text-sm text-gray-500">Redirecting to login page...</p>
        <div className="mt-6 flex justify-center">
          <div className="w-12 h-12 border-4 border-[#547792] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 relative">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?ixlib=rb-4.0.3&auto=format&fit=crop&w=2074&q=80")' }}>
        <div className="absolute inset-0" style={{ backgroundColor: '#547792', opacity: 0.85 }}></div>
      </div>

      <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse hidden md:block"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse hidden md:block"></div>

      <div className="relative w-full max-w-4xl animate-fade-in my-4 md:my-8 lg:my-10">
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 lg:p-10">
          <div className="flex items-center justify-center mb-6 md:mb-8">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#547792' }}>
                <svg className="w-5 h-5 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div className="text-left">
                <h2 className="text-xl md:text-3xl font-bold text-gray-800">Create Account</h2>
                <p className="text-gray-500 text-xs md:text-sm">Join us and start your healthcare journey</p>
              </div>
            </div>
          </div>

          {/* Success Modal */}
          {showSuccess && <SuccessMessage />}

          {/* Error Message */}
          {registerError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-red-800">Registration Failed</p>
                  <p className="text-sm text-red-600">{registerError}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={formik.handleSubmit} className="space-y-3 md:space-y-4">
            <div>
              <label htmlFor="name" className={labelClasses}>Full Name</label>
              <input id="name" type="text" {...formik.getFieldProps('name')} className={inputClasses} placeholder="Enter your full name" />
              {formik.touched.name && formik.errors.name ? <div className={errorClasses}>{formik.errors.name}</div> : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label htmlFor="dob" className={labelClasses}>Date of Birth</label>
                <input id="dob" type="date" {...formik.getFieldProps('dob')} className={inputClasses} />
                {formik.touched.dob && formik.errors.dob ? <div className={errorClasses}>{formik.errors.dob}</div> : null}
              </div>
              <div className="flex-1 w-full">
                <CustomSelect
                  label="Gender"
                  options={genders}
                  value={formik.values.gender}
                  onChange={(value) => formik.setFieldValue('gender', value)}
                  placeholder="Select gender"
                  error={formik.touched.gender && formik.errors.gender}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="flex-1 w-full">
                <CustomSelect
                  label="Blood Group"
                  options={bloodGroups}
                  value={formik.values.bloodGroup}
                  onChange={(value) => formik.setFieldValue('bloodGroup', value)}
                  placeholder="Select blood group"
                  error={formik.touched.bloodGroup && formik.errors.bloodGroup}
                />
              </div>
              <div>
                <label htmlFor="contactNumber" className={labelClasses}>Contact Number</label>
                <input
                  id="contactNumber"
                  type="tel"
                  value={formik.values.contactNumber}
                  onChange={(e) => handleContactChange(e, formik)}
                  onBlur={formik.handleBlur}
                  className={inputClasses}
                  placeholder="Enter 10-digit number"
                  inputMode="numeric"
                  maxLength={10}
                />
                {formik.touched.contactNumber && formik.errors.contactNumber ? <div className={errorClasses}>{formik.errors.contactNumber}</div> : null}
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClasses}>Email Address</label>
              <input id="email" type="email" {...formik.getFieldProps('email')} className={inputClasses} placeholder="Enter your email" />
              {formik.touched.email && formik.errors.email ? <div className={errorClasses}>{formik.errors.email}</div> : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label htmlFor="password" className={labelClasses}>Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...formik.getFieldProps('password')}
                    className={inputClasses}
                    placeholder="Create a password"
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
                {formik.touched.password && formik.errors.password ? <div className={errorClasses}>{formik.errors.password}</div> : null}
              </div>
              <div>
                <label htmlFor="confirmPassword" className={labelClasses}>Confirm Password</label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    {...formik.getFieldProps('confirmPassword')}
                    className={inputClasses}
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#547792] transition-colors p-1"
                  >
                    {showConfirmPassword ? (
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
                {formik.touched.confirmPassword && formik.errors.confirmPassword ? <div className={errorClasses}>{formik.errors.confirmPassword}</div> : null}
              </div>
            </div>

            <div className="pt-3 md:pt-5">
              <button type="submit" disabled={isSubmitting} className="w-full py-2.5 md:py-3.5 text-white font-bold text-base md:text-lg rounded-lg shadow-xl transform hover:scale-[1.01] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: '#547792' }}>
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>

            <div className="relative flex py-3 md:py-5 items-center">
              <div className="flex-grow border-t-2 border-gray-200"></div>
              <span className="flex-shrink mx-4 md:mx-6 text-gray-400 font-medium text-sm">or</span>
              <div className="flex-grow border-t-2 border-gray-200"></div>
            </div>

            <button type="button" className="w-full py-2.5 md:py-3.5 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold text-sm md:text-base rounded-lg flex items-center justify-center gap-3 transition-all duration-300 hover:shadow-lg">
              <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <div className="text-center pt-2 md:pt-4">
              <p className="text-gray-600 text-sm md:text-base">
                Already have an account?{' '}
                <Link to="/login" style={{ color: '#547792' }} className="font-bold transition-colors duration-300 hover:underline">
                  Login here
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};


export default Register;
