import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import ReactMarkdown from 'react-markdown';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, getDocs, deleteDoc, doc, getDoc, updateDoc, addDoc, serverTimestamp, writeBatch, where, setDoc } from 'firebase/firestore';

const AIChat = () => {
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentUser, setCurrentUser] = useState(undefined); // undefined = loading, null = no user
  const [activeDocId, setActiveDocId] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const quickQuestions = [
    'Explain my latest blood test',
    'What foods should I avoid?',
    'How can I improve my hemoglobin?',
    'When should I schedule my next checkup?',
  ];

  // ─── AUTH LISTENER ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, u => setCurrentUser(u));
    return () => unsubscribe();
  }, []);

  // ─── FETCH SESSIONS ───────────────────────────────────────────────────────
  const fetchSessions = useCallback(async (userId) => {
    if (!userId) return;
    console.log("Fetching sessions from Firestore for user:", userId);
    try {
      const q = query(collection(db, 'users', userId, 'sessions'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const loadedSessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        _id: doc.id // compatibility
      }));
      console.log("Firestore Sessions loaded:", loadedSessions);
      setSessions(loadedSessions);
      return loadedSessions;
    } catch (error) {
      console.error("Error fetching sessions from Firestore:", error);
      setSessions([]);
    }
    return [];
  }, []);

  // ─── FETCH MESSAGES ───────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (userId, sessionId) => {
    if (!userId || !sessionId) return;
    setIsLoadingHistory(true);
    console.log("Fetching messages from Firestore for session:", sessionId);
    try {
      const q = query(
        collection(db, 'users', userId, 'chats'), 
        where('sessionId', '==', sessionId),
        orderBy('timestamp', 'asc')
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.message ? 'user' : 'ai',
          text: data.aiResponse || data.message || '',
          time: data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'
        };
      }).flatMap(msg => {
          // Double check if record contains both (backward compatibility)
          // Since our handleSend saves userText and aiResponse in one 'chats' record
          // we need to split if they are both there
          const docData = snapshot.docs.find(d => d.id === msg.id)?.data();
          if (docData?.message && docData?.aiResponse) {
             return [
               { id: msg.id + '-u', type: 'user', text: docData.message, time: msg.time },
               { id: msg.id + '-a', type: 'ai', text: docData.aiResponse, time: msg.time }
             ];
          }
          return [msg];
      });

      if (history.length > 0) {
        setMessages(history);
      } else {
        setMessages([{
          id: 'welcome-msg',
          type: 'ai',
          text: "Hello! I'm your AI Health Assistant. How can I help you today?",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } catch (error) {
      console.error("Error fetching messages from Firestore:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // ─── INITIAL LOAD ─────────────────────────────────────────────────────────
  useEffect(() => {
    // 0. Cleanup any legacy localStorage chat data
    const legacyKeys = ['activeChatSessionId', 'chats', 'messages', 'chatHistory'];
    legacyKeys.forEach(key => localStorage.removeItem(key));

    const initSessions = async () => {
      if (!currentUser) return;

      // 1. Fetch sessions from Firestore
      const loadedSessions = await fetchSessions(currentUser.uid);

      // 2. Fetch last active session from Firebase
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        const lastSessionIdFromFirebase = userSnap.exists() ? userSnap.data().lastActiveSessionId : null;

        if (lastSessionIdFromFirebase) {
          setActiveSessionId(lastSessionIdFromFirebase);
        } else if (loadedSessions && loadedSessions.length > 0) {
          // Auto-select most recent if nothing in Firebase
          const firstId = loadedSessions[0].id;
          setActiveSessionId(firstId);
        }
      } catch (error) {
        console.error("Error loading persistence from Firebase:", error);
      }
    };

    initSessions();
  }, [currentUser, fetchSessions]);

  // Save activeSessionId to Firebase whenever it changes
  useEffect(() => {
    const syncSessionToFirebase = async () => {
      if (currentUser && activeSessionId) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, { lastActiveSessionId: activeSessionId });
        } catch (error) {
          console.error("Error saving session to Firebase:", error);
        }
      }
    };
    syncSessionToFirebase();
  }, [activeSessionId, currentUser]);

  // Load active session messages
  useEffect(() => {
    if (currentUser && activeSessionId) {
      fetchMessages(currentUser.uid, activeSessionId);
    } else if (currentUser && !activeSessionId) {
      // Reset to welcome if no session selected
      setMessages([{
        id: 'welcome-msg',
        type: 'ai',
        text: "Hello! I'm your AI Health Assistant. How can I help you today?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  }, [currentUser, activeSessionId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle report context from location state
  useEffect(() => {
    if (location.state?.reportId && currentUser) {
      setActiveDocId(location.state.reportId);
      // Optional: if starting from a report link, we might want to start a new chat automatically
      window.history.replaceState({}, document.title);
    }
  }, [location.state, currentUser]);

  // ─── SEND MESSAGE ─────────────────────────────────────────────────────────
  const handleSend = async (customText = null) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || !currentUser) return;

    const userText = textToSend;
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: userText,
      time: timeNow,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const isNew = !activeSessionId;
      const response = await fetch('http://localhost:5678/webhook/ChatBotCollection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          message: userText,
          isNew: isNew,
          sessionId: activeSessionId,
          docContext: !!activeDocId,
          docId: activeDocId
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const text = await response.text();
      if (!text) throw new Error("Empty response from AI engine");

      const dataArr = JSON.parse(text);
      const data = Array.isArray(dataArr) ? dataArr[0] : dataArr;
      const aiResponseText = data.aiResponse || "I couldn't process that.";
      const newSessionId = data.sessionId;

      if (isNew && newSessionId) {
        // Create session metadata in Firestore
        await setDoc(doc(db, 'users', currentUser.uid, 'sessions', newSessionId), {
          chatName: userText.substring(0, 50) + (userText.length > 50 ? '...' : ''),
          sessionId: newSessionId,
          createdAt: serverTimestamp()
        });
        setActiveSessionId(newSessionId);
        fetchSessions(currentUser.uid);
      }

      // ─── SAVE TO FIREBASE ──────────────────────────────────────────────
      const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'chats'), {
        sessionId: activeSessionId || newSessionId,
        message: userText,
        aiResponse: aiResponseText,
        docId: activeDocId,
        timestamp: serverTimestamp()
      });

      const aiResponse = {
        id: docRef.id,
        type: 'ai',
        text: aiResponseText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error("Error communicating with AI:", error);
      setMessages(prev => [...prev, {
        id: 'err-' + Date.now(),
        type: 'ai',
        text: 'Sorry, I am having trouble connecting to the medical AI engine. Please ensure your n8n workflow is active.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleDeleteSession = async (sid) => {
    if (!currentUser) return;
    if (!window.confirm("Are you sure you want to permanently delete this session from your history? (It will be kept in MongoDB backup)")) return;
    
    try {
      console.log("Deleting session from Firestore (UI only):", sid);
      
      const batch = writeBatch(db);
      
      // Delete all messages in 'chats' collection for this session
      const chatsQ = query(collection(db, 'users', currentUser.uid, 'chats'), where('sessionId', '==', sid));
      const chatsSnapshot = await getDocs(chatsQ);
      chatsSnapshot.docs.forEach(d => batch.delete(d.ref));

      // Delete the session metadata record in Firebase
      batch.delete(doc(db, 'users', currentUser.uid, 'sessions', sid));

      // Clear lastActive if matched
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().lastActiveSessionId === sid) {
        batch.update(userRef, { lastActiveSessionId: null });
      }

      await batch.commit();

      // UI state update
      setSessions(prev => prev.filter(s => s.id !== sid));
      if (activeSessionId === sid) {
        setActiveSessionId(null);
        setMessages([{
          id: 'welcome-msg',
          type: 'ai',
          text: "Hello! I'm your AI Health Assistant. How can I help you today?",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
      console.log("Session deleted from Firebase. MongoDB backup preserved.");
    } catch (error) {
      console.error("Error during Firebase deletion:", error);
      alert("An error occurred while deleting from Firebase. Please ensure you are logged in.");
    }
  };

  const handleDeleteMessage = async (mid) => {
    if (!currentUser) return;
    try {
      console.log("Deleting message from Firestore (UI only):", mid);
      await deleteDoc(doc(db, 'users', currentUser.uid, 'chats', mid));
      setMessages(prev => prev.filter(m => m.id !== mid));
      console.log("Message deleted from Firebase.");
    } catch (error) {
      console.error("Error deleting message from Firestore:", error);
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([{
      id: 'welcome-msg',
      type: 'ai',
      text: "Hello! I'm your AI Health Assistant. How can I help you today?",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setActiveDocId(null);
  };

  const clearAllChats = () => setShowClearModal(true);

  const confirmClearChats = async () => {
    // This could be updated to call an n8n webhook for bulk deletion if needed
    // For now, we clear the local active session
    startNewChat();
    setShowClearModal(false);
  };

  if (currentUser === undefined) {
    return (
      <Layout title="Health Assistant">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 border-4 border-cyan-100 border-t-cyan-600 rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Health Assistant"
      headerActions={
        <div className="flex items-center gap-3">
          {activeDocId && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg shadow-sm text-[10px] font-black uppercase tracking-[0.15em] animate-in fade-in slide-in-from-right duration-500">
              <span className="w-2 h-2 bg-cyan-300 rounded-full animate-pulse"></span>
              Report Context Loaded
              <button onClick={() => setActiveDocId(null)} className="ml-1 hover:text-red-300 transition-colors">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      }
    >
      <div className="h-[calc(100vh-160px)] flex gap-6">
        {/* Sidebar */}
        <div className={`${isSidebarOpen ? 'flex' : 'hidden'} lg:flex flex-col w-72 bg-slate-50 border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm`}>
          <div className="p-4 border-b border-slate-200/60 bg-white">
            <button
              onClick={startNewChat}
              className="w-full flex items-center justify-center gap-3 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              New Session
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            <p className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Previous Chats</p>
            {sessions.length === 0 ? (
              <div className="p-8 text-center bg-white/50 rounded-2xl border border-dashed border-slate-200 mx-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">No History Found</p>
              </div>
            ) : (
              sessions.map(session => {
                const sid = session._id?.$oid || session._id;
                return (
                  <div key={sid} className="relative group/session">
                    <button
                      onClick={() => setActiveSessionId(sid)}
                      className={`w-full p-4 rounded-2xl text-left transition-all border relative overflow-hidden ${activeSessionId === sid ? 'bg-white border-indigo-200 shadow-md translate-x-1' : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'}`}
                    >
                      {activeSessionId === sid && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>}
                      <p className={`text-[11px] font-black leading-tight line-clamp-2 mb-2 pr-6 ${activeSessionId === sid ? 'text-indigo-600' : 'text-slate-700'}`}>
                        {session.chatName || 'New Conversation'}
                      </p>
                      <div className="flex items-center gap-2">
                        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-[9px] font-bold text-slate-400">
                          {new Date(session.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(sid); }}
                      className="absolute right-3 top-4 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover/session:opacity-100 transition-all active:scale-95"
                      title="Delete Session"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden relative">
          {/* Messages Container */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/30 custom-scrollbar">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 group/msg`}>
                    <div className={`max-w-[85%] sm:max-w-[70%] flex gap-4 ${message.type === 'user' ? 'flex-row-reverse' : ''} items-start`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${message.type === 'ai' ? 'bg-slate-900' : 'bg-indigo-600'}`}>
                        {message.type === 'ai' ? (
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        ) : (
                          <span className="text-white text-[10px] font-black uppercase tracking-tight">User</span>
                        )}
                      </div>
                      <div className="space-y-1.5 overflow-hidden flex-1">
                        <div className="relative group/msg-content">
                          <div className={`px-5 py-4 rounded-2xl shadow-sm text-sm leading-relaxed ${message.type === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'}`}>
                            <div className={`prose prose-sm max-w-none ${message.type === 'user' ? 'prose-invert' : 'prose-slate'}`}>
                              <ReactMarkdown>
                                {message.text}
                              </ReactMarkdown>
                            </div>
                          </div>
                          {message.id !== 'welcome-msg' && (
                            <button
                              onClick={() => handleDeleteMessage(message.id)}
                              className={`absolute ${message.type === 'user' ? '-left-10' : '-right-10'} top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover/msg-content:opacity-100 transition-all active:scale-90`}
                              title="Delete Message"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                        <p className={`text-[10px] font-black uppercase tracking-widest text-slate-400 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                          {message.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex justify-start animate-pulse">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </div>
                      <div className="px-5 py-4 bg-white rounded-2xl rounded-tl-none shadow-sm border border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce delay-75"></span>
                          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce delay-150"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-white border-t border-slate-100">
            <div className="max-w-4xl mx-auto flex gap-4 items-end">
              <button
                onClick={clearAllChats}
                className="p-4 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all border border-slate-100 hover:border-red-100 shadow-sm"
                title="Clear Session"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
              <div className="flex-1 relative group">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={activeDocId ? "Ask about this report..." : "Type your medical question..."}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white focus:border-indigo-400 transition-all text-sm font-medium"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="px-2 py-1 bg-slate-200 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest hidden sm:block">Enter to Send</span>
                </div>
              </div>
              <button
                onClick={() => handleSend()}
                disabled={!inputText.trim() || isTyping}
                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                Send
              </button>
            </div>
            <p className="mt-4 text-center text-[10px] font-medium text-slate-400 flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              AI can provide general guidance only. For medical emergencies or specific advice, please consult a clinical professional.
            </p>
          </div>
        </div>
      </div>

      {/* Clear Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowClearModal(false)}></div>
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 overflow-hidden text-center">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-100">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Reset Session?</h2>
            <p className="text-slate-500 font-medium text-sm mb-10 leading-relaxed">This will clear the current conversation window and reset context. Session history will remain in sidebar.</p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmClearChats} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-700 shadow-xl active:scale-95 transition-all">Yes, Clear Context</button>
              <button onClick={() => setShowClearModal(false)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 active:scale-95 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AIChat;