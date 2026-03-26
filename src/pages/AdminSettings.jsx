import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, orderBy, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase.js';
import AdminLayout from '../components/AdminLayout';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import CustomSelect from '../components/CustomSelect';

const AdminSettings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isFullImageView, setIsFullImageView] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordState, setPasswordState] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({ old: '', new: '', confirm: '', global: '' });
  const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const toastTimeoutRef = useRef(null);

  const [activeSessions, setActiveSessions] = useState([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const currentSessionId = localStorage.getItem('currentSessionId');

  const showToastMsg = (message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ show: true, message, type });
    toastTimeoutRef.current = setTimeout(() => setToast({ show: false, message: '', type }), 3000);
  };

  const [userData, setUserData] = useState({
    name: '',
    dob: '',
    gender: '',
    bloodGroup: '',
    contactNumber: '',
    email: '',
    profileImage: ''
  });

  useEffect(() => {
    const auth = onAuthStateChanged(getAuth(), async (user) => {
      if (user) {
        // Set up real-time listener for profile data
        const docRef = doc(db, 'users', user.uid);
        const fetchUser = async () => {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData({
              name: data.name || (user.email === 'dhvanikoshti26@gmail.com' ? 'Dhvani Koshti' : 'Admin'),
              dob: data.dob || '',
              gender: data.gender || '',
              bloodGroup: data.bloodGroup || '',
              contactNumber: data.contactNumber || '',
              email: user.email || 'admin@healthcare.com',
              profileImage: data.profileImage || null
            });
            setProfileImage(data.profileImage || null);
          } else {
            // Document doesn't exist, use fallbacks
            setUserData(prev => ({
              ...prev,
              email: user.email,
              name: user.email === 'dhvanikoshti26@gmail.com' ? 'Dhvani Koshti' : 'Admin User',
              profileImage: ''
            }));
            setProfileImage(null);
          }
        };
        fetchUser();

        // Fetch active sessions
        const sessionsQuery = query(
          collection(db, 'users', user.uid, 'sessions'),
          orderBy('loginTime', 'desc')
        );

        const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
          const sessionsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setActiveSessions(sessionsList);
        });

        return () => {
          unsubscribeSessions();
        };
      } else {
        navigate('/login');
      }
    });

    return () => auth();
  }, [navigate]);

  const handleProfileImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToastMsg('Image must be under 2MB', 'error');
        return;
      }
      setSelectedImageFile(file);
      setIsUploading(true);

      try {
        // Show local preview immediately
        const previewUrl = URL.createObjectURL(file);
        setProfileImage(previewUrl);

        // Upload to Cloudinary
        const result = await uploadToCloudinary(file);
        const cloudUrl = result.secure_url;

        setProfileImage(cloudUrl);
        setUserData(prev => ({ ...prev, profileImage: cloudUrl }));

        // Save to Firestore silently in the background
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          await setDoc(doc(db, 'users', user.uid), { profileImage: cloudUrl }, { merge: true });
          showToastMsg('Profile photo updated', 'success');
        }
      } catch (err) {
        console.error('Upload error:', err);
        showToastMsg(err.message || 'Failed to upload photo.', 'error');
        // Revert to old image if possible
        setProfileImage(userData.profileImage);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleRemoveProfileImage = () => {
    setProfileImage(null);
    setSelectedImageFile(null);
    setUserData(prev => ({ ...prev, profileImage: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsFullImageView(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    let updatedUserData = { ...userData };
    if (profileImage) {
      updatedUserData.profileImage = profileImage;
    }

    // Update UI instantly
    setUserData(updatedUserData);
    setSelectedImageFile(null);
    setIsEditing(false);
    showToastMsg('Profile updated successfully!', 'success');

    // Save to Firestore silently in the background
    setDoc(doc(db, 'users', user.uid), updatedUserData, { merge: true })
      .catch(error => {
        console.error('Error saving user data:', error);
        showToastMsg('Failed to update profile.', 'error');
      });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordErrors({ old: '', new: '', confirm: '', global: '' });
    setPasswordSuccess('');

    let hasError = false;
    const newErrors = { old: '', new: '', confirm: '', global: '' };

    if (!passwordState.oldPassword) {
      newErrors.old = 'Please enter your current password.';
      hasError = true;
    }
    if (passwordState.newPassword.length < 8) {
      newErrors.new = 'Password must be at least 8 characters long.';
      hasError = true;
    }
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      newErrors.confirm = 'Passwords do not match.';
      hasError = true;
    }

    if (hasError) {
      setPasswordErrors(newErrors);
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        const credential = EmailAuthProvider.credential(user.email, passwordState.oldPassword);
        await reauthenticateWithCredential(user, credential);

        await updatePassword(user, passwordState.newPassword);
        setPasswordSuccess('Password updated successfully');
        setPasswordState({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswords({ old: false, new: false, confirm: false });
        setTimeout(() => setShowPasswordForm(false), 2000);
      }
    } catch (error) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setPasswordErrors({ ...newErrors, old: 'Incorrect current password.' });
      } else if (error.code === 'auth/requires-recent-login') {
        setPasswordErrors({ ...newErrors, global: 'Please log out and log back in to change your password for security reasons.' });
      } else {
        setPasswordErrors({ ...newErrors, global: 'Failed to update password. ' + error.message });
      }
    }
    setIsUpdatingPassword(false);
  };

  const handleLogoutSession = async (sessionId) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        // If it's the current session, use standard logout
        if (sessionId === currentSessionId) {
          localStorage.removeItem('currentSessionId');
          await signOut(auth);
          navigate('/login');
          return;
        }

        // For remote sessions, just delete the doc from Firestore
        await deleteDoc(doc(db, 'users', user.uid, 'sessions', sessionId));
        // You might want to add a toast/notification here if you have one
        console.log('Device logged out successfully');
      }
    } catch (error) {
      console.error('Error logging out device:', error);
    }
  };

  const handleLogoutAll = async () => {
    setIsUpdating(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        const sessionsRef = collection(db, 'users', user.uid, 'sessions');
        const sessionDocs = await getDocs(sessionsRef);

        const deletePromises = sessionDocs.docs.map(sessionDoc => deleteDoc(sessionDoc.ref));
        await Promise.all(deletePromises);

        localStorage.removeItem('currentSessionId');
        await signOut(auth);
        navigate('/login');
      }
    } catch (error) {
      console.error('Error logging out from all devices:', error);
      showToastMsg('Failed to logout from all devices', 'error');
    }
    setIsUpdating(false);
    setShowLogoutModal(false);
    showToastMsg('Successfully logged out from all devices');
  };

  const getInitials = (name) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'security', label: 'Security', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  ];

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const genders = ['Male', 'Female', 'Other'];

  const genderOptions = genders.map(g => ({ label: g, value: g }));
  const bloodGroupOptions = bloodGroups.map(bg => ({ label: bg, value: bg }));

  return (
    <AdminLayout>

      <div>
        {/* Header */}
        <div className="rounded-3xl p-6 lg:p-10 mb-8 text-white relative overflow-hidden" style={{ backgroundColor: '#263B6A' }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>
          <div className="relative z-10 text-center md:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Admin Settings</h1>
            <p className="text-cyan-100/90 text-lg">Manage your account and preferences</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setIsFullImageView(false); }}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium capitalize transition-all whitespace-nowrap ${activeTab === tab.id
                ? 'bg-gray-800 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Section */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-500">
            {/* Profile Info Summary */}
            <div className="px-6 md:px-10 pt-6 md:pt-10 pb-10 relative">
              <div className="absolute top-6 md:top-10 right-6 md:right-10 flex gap-2 z-20">
                {!isEditing ? (
                  <button onClick={() => setIsEditing(true)} className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 text-gray-700 rounded-full border border-gray-200 shadow-sm transition-all hover:scale-110" title="Edit Profile">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                ) : (
                  <>
                    <button onClick={() => setIsEditing(false)} className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 text-gray-700 rounded-full border border-gray-200 shadow-sm transition-all hover:scale-110" title="Cancel">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <button onClick={handleSave} className="flex items-center justify-center w-10 h-10 bg-gray-800 text-white rounded-full shadow-md transition-all hover:scale-110" title="Save Changes">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6 mb-8 pb-8 border-b border-gray-100">
                <div className="relative group z-10 mt-12 md:mt-0">

                  {profileImage ? (
                    <div onClick={() => !isUploading && setIsFullImageView(true)} className="w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden shadow-md cursor-pointer ring-2 ring-gray-100 hover:ring-gray-300 transition-all bg-white relative">
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center text-gray-700 text-5xl font-bold shadow-sm">
                      {getInitials(userData.name)}
                    </div>
                  )}
                  <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 w-10 h-10 bg-gray-700 text-white rounded-full border-4 border-white flex items-center justify-center hover:bg-gray-800 shadow-lg transition-all transform hover:scale-105" title="Upload Photo">
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>

                  {isEditing && profileImage && (
                    <button onClick={handleRemoveProfileImage} className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full border-2 border-white flex items-center justify-center hover:bg-red-600 shadow-lg transition-all transform hover:scale-105 z-30" title="Remove Photo">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                <div className="text-center md:text-left mt-2 md:mt-0 flex-1">
                  <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">{userData.name || 'Admin User'}</h2>
                  <div className="flex items-center justify-center md:justify-start gap-2 mt-2 text-gray-500 font-medium">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {userData.email || 'No email'}
                  </div>
                </div>
              </div>

              {/* Details Form/Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Full Name */}
                <div className="bg-white p-1">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide"><svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>Full Name</label>
                  {isEditing ? <input type="text" name="name" value={userData.name} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:bg-white object-contain block" /> : <p className="text-gray-900 font-medium px-4 py-3 bg-white rounded-xl border border-gray-100">{userData.name || 'Not set'}</p>}
                </div>

                {/* Email Address */}
                <div className="bg-white p-1">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide"><svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>Email Address</label>
                  {isEditing ? <input type="email" name="email" value={userData.email} onChange={handleChange} disabled className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:bg-white object-contain block" /> : <p className="text-gray-900 font-medium px-4 py-3 bg-white rounded-xl border border-gray-100">{userData.email || 'Not set'}</p>}
                </div>

                {/* Contact Number */}
                <div className="bg-white p-1">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide"><svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>Contact Number</label>
                  {isEditing ? <input type="tel" name="contactNumber" value={userData.contactNumber} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:bg-white object-contain block" /> : <p className="text-gray-900 font-medium px-4 py-3 bg-white rounded-xl border border-gray-100">{userData.contactNumber || 'Not set'}</p>}
                </div>

                {/* Date of Birth */}
                <div className="bg-white p-1">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide"><svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>Date of Birth</label>
                  {isEditing ? <input type="date" name="dob" value={userData.dob} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:bg-white object-contain block" /> : <p className="text-gray-900 font-medium px-4 py-3 bg-white rounded-xl border border-gray-100">{userData.dob || 'Not set'}</p>}
                </div>

                {/* Gender */}
                <div className="bg-white p-1">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide"><svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>Gender</label>
                  {isEditing ? (
                    <CustomSelect
                      options={genderOptions}
                      value={userData.gender}
                      onChange={(val) => setUserData(prev => ({ ...prev, gender: val }))}
                      placeholder="Select gender"
                    />
                  ) : <p className="text-gray-900 font-medium px-4 py-3 bg-white rounded-xl border border-gray-100">{userData.gender || 'Not set'}</p>}
                </div>

                {/* Blood Group */}
                <div className="bg-white p-1">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide"><svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>Blood Group</label>
                  {isEditing ? (
                    <CustomSelect
                      options={bloodGroupOptions}
                      value={userData.bloodGroup}
                      onChange={(val) => setUserData(prev => ({ ...prev, bloodGroup: val }))}
                      placeholder="Select blood group"
                    />
                  ) : <p className="text-gray-900 font-medium px-4 py-3 bg-white rounded-xl border border-gray-100">{userData.bloodGroup || 'Not set'}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Section */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-500">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
              <h2 className="text-lg font-bold text-gray-800">Security Settings</h2>
            </div>
            <div className="p-6 space-y-8">
              {/* Change Password */}
              <div>
                <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-transparent hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white border border-blue-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Change Password</h3>
                      <p className="text-sm text-gray-500">Update your password regularly</p>
                    </div>
                  </div>
                  <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="px-5 py-2 border-2 border-gray-800 text-gray-800 rounded-xl font-bold hover:bg-gray-800 hover:text-white transition-all text-sm shadow-sm hover:shadow-md">
                    {showPasswordForm ? 'Cancel' : 'Change'}
                  </button>
                </div>

                {showPasswordForm && (
                  <div className="p-5 mt-4 bg-white border border-gray-200 rounded-xl animate-fade-in">
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Current Password</label>
                        <div className="relative">
                          <input type={showPasswords.old ? "text" : "password"} value={passwordState.oldPassword} onChange={(e) => setPasswordState({ ...passwordState, oldPassword: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 outline-none pr-12" placeholder="Enter current password" />
                          <button type="button" onClick={() => setShowPasswords({ ...showPasswords, old: !showPasswords.old })} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700">
                            {showPasswords.old ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943-9.543-7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943-9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            )}
                          </button>
                        </div>
                        {passwordErrors.old && <p className="text-red-500 text-xs font-medium mt-1">{passwordErrors.old}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                        <div className="relative">
                          <input type={showPasswords.new ? "text" : "password"} value={passwordState.newPassword} onChange={(e) => setPasswordState({ ...passwordState, newPassword: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 outline-none pr-12" placeholder="Enter new password" />
                          <button type="button" onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700">
                            {showPasswords.new ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943-9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            )}
                          </button>
                        </div>
                        {passwordErrors.new && <p className="text-red-500 text-xs font-medium mt-1">{passwordErrors.new}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
                        <div className="relative">
                          <input type={showPasswords.confirm ? "text" : "password"} value={passwordState.confirmPassword} onChange={(e) => setPasswordState({ ...passwordState, confirmPassword: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 outline-none pr-12" placeholder="Confirm new password" />
                          <button type="button" onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700">
                            {showPasswords.confirm ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943-9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            )}
                          </button>
                        </div>
                        {passwordErrors.confirm && <p className="text-red-500 text-xs font-medium mt-1">{passwordErrors.confirm}</p>}
                      </div>
                      {passwordErrors.global && <p className="text-red-500 text-sm font-medium">{passwordErrors.global}</p>}
                      {passwordSuccess && <p className="text-green-600 text-sm font-medium">{passwordSuccess}</p>}
                      <button type="submit" disabled={isUpdatingPassword} className="px-6 py-3 bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 mt-2">
                        {isUpdatingPassword ? 'Updating...' : 'Save Password'}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Active Sessions */}
              <div className="pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Active Sessions</h3>
                    <p className="text-sm text-gray-500">Devices currently logged into your account</p>
                  </div>
                  <button onClick={() => setShowLogoutModal(true)} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors">
                    Logout from All Devices
                  </button>
                </div>

                <div className="space-y-3">
                  {activeSessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200 shadow-sm">
                          {session.os?.includes('Windows') || session.deviceName?.includes('Windows') ? (
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          ) : (
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-800">{session.deviceName}</h4>
                            {session.sessionId === currentSessionId && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wider">Current</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {session.loginTime?.toDate().toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleLogoutSession(session.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Logout this device"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Logout All Devices Modal */}
              {showLogoutModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transform animate-bounce-in">
                    <div className="p-8 text-center">
                      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Logout All Devices?</h3>
                      <p className="text-gray-600 mb-8">
                        This will sign you out from all {activeSessions.length} active devices. You will need to log in again on each device.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setShowLogoutModal(false)} className="px-6 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all">
                          Cancel
                        </button>
                        <button onClick={handleLogoutAll} className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg hover:shadow-xl">
                          Logout All
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hidden File Input */}
        <input type="file" ref={fileInputRef} onChange={handleProfileImageUpload} accept="image/*,.pdf" className="hidden" />
      </div>

      {/* Global Toast Notification */}
      <div className={`fixed top-24 right-6 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-150 z-50 ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'} ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
        {toast.type === 'success' ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        )}
        <span className="font-semibold">{toast.message}</span>
      </div>

      {/* Full Screen Image Modal */}
      {isFullImageView && profileImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-fade-in backdrop-blur-sm">
          <button
            onClick={() => setIsFullImageView(false)}
            className="absolute top-6 right-6 w-12 h-12 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all transform hover:scale-110 shadow-2xl"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <img
            src={profileImage}
            alt="Full Screen Profile"
            className="w-auto h-auto max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl shadow-black/50 pointer-events-none select-none"
          />
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminSettings;
