import { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';
import ReactMarkdown from 'react-markdown';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';

const AIChat = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const quickQuestions = [
    'Explain my latest blood test',
    'What foods should I avoid?',
    'How can I improve my hemoglobin?',
    'When should I schedule my next checkup?',
  ];

  // 1. Get the current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Chat History from Firebase on Page Load
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!currentUser) return;

      const q = query(
        collection(db, 'users', currentUser.uid, 'chats'),
        orderBy('timestamp', 'asc') // Orders messages from oldest to newest
      );

      try {
        const snapshot = await getDocs(q);
        const history = snapshot.docs.map(doc => ({
          id: doc.id,
          type: doc.data().type,
          text: doc.data().text,
          time: doc.data().time
        }));

        // If there's history, load it. If not, set a default welcome message.
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
        console.error("Error fetching chat history:", error);
      }
    };

    fetchChatHistory();
  }, [currentUser]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. Handle sending a message
  const handleSend = async () => {
    if (!inputText.trim() || !currentUser) return;

    const userText = inputText;
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: userText,
      time: timeNow,
    };

    // Add user message to UI immediately
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      // Save User Message to Firebase
      await addDoc(collection(db, 'users', currentUser.uid, 'chats'), {
        type: 'user',
        text: userText,
        time: timeNow,
        timestamp: serverTimestamp()
      });

      // Send to n8n Webhook
      const webhookUrl = 'http://localhost:5678/webhook/healthchat'; // Change to /webhook/ in production
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: currentUser.uid, // Uses Firebase UID for permanent n8n memory
          chatInput: userText
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const aiResponseText = data.reply || data.output || "I couldn't process that.";
      const aiTimeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const aiResponse = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        text: aiResponseText,
        time: aiTimeNow,
      };

      // Add Bot Message to UI
      setMessages((prev) => [...prev, aiResponse]);

      // Save Bot Message to Firebase
      await addDoc(collection(db, 'users', currentUser.uid, 'chats'), {
        type: 'ai',
        text: aiResponseText,
        time: aiTimeNow,
        timestamp: serverTimestamp()
      });

    } catch (error) {
      console.error("Error communicating with n8n:", error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        text: 'Sorry, I am having trouble connecting to the server right now. Make sure your n8n workflow is active.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickQuestion = (question) => {
    setInputText(question);
    inputRef.current?.focus();
  };

  const clearAllChats = () => {
    setShowClearModal(true);
  };

  const confirmClearChats = async () => {
    if (currentUser) {
      try {
        // Delete all chat documents from Firebase for this user
        const q = query(collection(db, 'users', currentUser.uid, 'chats'));
        const snapshot = await getDocs(q);

        // Delete each document
        const deletePromises = snapshot.docs.map(document =>
          deleteDoc(doc(db, 'users', currentUser.uid, 'chats', document.id))
        );
        await Promise.all(deletePromises);
      } catch (error) {
        console.error("Error clearing chats from Firebase:", error);
      }
    }

    // Reset UI
    setMessages([{
      id: 'welcome-msg',
      type: 'ai',
      text: "Hello! I'm your AI Health Assistant. How can I help you today?",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setShowClearModal(false);
  };

  return (
    <Layout
      title="Health Assistant"
      headerActions={
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-2">
            <p className="text-[10px] font-black text-[#263B6A] uppercase tracking-widest leading-none mb-1">Your Intelligent</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Health Companion</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            Online & Ready
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 text-[10px] font-bold uppercase tracking-wider">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            24/7 Available
          </div>
        </div>
      }
    >
      <div className="h-[calc(100vh-160px)] flex flex-col">
        {/* Chat Container */}
        <div className="flex-1 bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-4 bg-white">
              {/* Welcome Message */}
              {messages.length === 1 && (
                <div className="text-center py-4 sm:py-10">
                  <div className="w-12 h-12 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-5 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#263B6A' }}>
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2" style={{ color: '#263B6A' }}>How can I help you today?</h3>
                  <p className="text-gray-500 mb-4 lg:mb-6 max-w-md mx-auto text-xs sm:text-base">Ask me anything about your health reports or get personalized advice</p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                    {quickQuestions.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickQuestion(question)}
                        className="px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:shadow-md border border-gray-200"
                        style={{ backgroundColor: '#FFFFFF', color: '#263B6A' }}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`max-w-[75%] ${message.type === 'user' ? 'order-2' : 'order-1'} group-hover:bg-white/70 dark:group-hover:bg-gray-800/50 transition-colors duration-200 rounded-2xl p-2 -m-2`}>
                    <div className={`flex items-end gap-2.5 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${message.type === 'ai'
                        ? 'shadow-md'
                        : ''
                        }`} style={message.type === 'ai' ? { backgroundColor: '#263B6A' } : { backgroundColor: '#547792' }}>
                        {message.type === 'ai' ? (
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <span className="text-white text-xs font-bold">ME</span>
                        )}
                      </div>
                      <div className={`px-4 sm:px-5 py-3 rounded-2xl shadow-sm ${message.type === 'user'
                        ? 'text-white rounded-br-md'
                        : 'text-gray-800 rounded-bl-md border'
                        }`} style={message.type === 'user' ? { backgroundColor: '#547792' } : { backgroundColor: '#FFFFFF', borderColor: '#d4cfc7' }}>
                        <div className="text-sm sm:text-base leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown>
                            {message.text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                    <p className={`text-xs text-gray-400 mt-2 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                      {message.time}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-end gap-2.5">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-md" style={{ backgroundColor: '#263B6A' }}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="px-5 py-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-200" style={{ backgroundColor: '#FFFFFF' }}>
                      <div className="flex gap-1">
                        <span className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ backgroundColor: '#263B6A' }}></span>
                        <span className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ backgroundColor: '#263B6A', animationDelay: '0.1s' }}></span>
                        <span className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ backgroundColor: '#263B6A', animationDelay: '0.2s' }}></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 sm:p-5 bg-white border-t border-gray-200">
              <div className="flex gap-3 items-end">
                {/* Professional Icon Only Clear Chat */}
                <button
                  onClick={clearAllChats}
                  className="p-4 bg-white hover:bg-gray-50 shadow-md hover:shadow-lg border border-gray-200 backdrop-blur-sm rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center w-14 h-14 lg:w-16 lg:h-16 group relative"
                  title="Clear Chat"
                >
                  <svg className="w-6 h-6 text-slate-700 group-hover:text-red-600 transition-colors duration-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type your health question..."
                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:border-transparent transition-all text-gray-700 placeholder-gray-400"
                    style={{ '--tw-ring-color': '#547792' }}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className="px-6 py-4 lg:px-10 lg:py-4 font-bold rounded-2xl hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center text-white active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#263B6A' }}
                  title="Send Message"
                >
                  <span>Send</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 mt-3">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-xs text-gray-400">
                  AI Assistant provides general health information. Always consult a healthcare professional for medical advice.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Clear Chat Modal */}
        {showClearModal && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowClearModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 max-w-md w-full mx-4 pointer-events-auto">
                <div className="p-8 pt-12 pb-6 text-center border-b border-gray-100">
                  <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center shadow-xl">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Clear Chat History</h2>
                  <p className="text-gray-600 text-lg mb-1">This action will permanently delete all messages.</p>
                  <p className="text-sm text-gray-500">Chat will reset to welcome message.</p>
                </div>
                <div className="p-8 pt-0 space-y-3 mt-6">
                  <button
                    onClick={confirmClearChats}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-4 px-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border border-red-400/30 text-lg"
                  >
                    Clear All Chats
                  </button>
                  <button
                    onClick={() => setShowClearModal(false)}
                    className="w-full bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-800 font-semibold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border border-slate-300/50 text-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AIChat;