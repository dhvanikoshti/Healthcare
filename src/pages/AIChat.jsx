import { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';

const AIChat = () => {
  const [messages, setMessages] = useState([
    { id: 1, type: 'ai', text: 'Hello! I\'m your AI Health Assistant. How can I help you today?', time: '10:00 AM' },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const conversationHistory = [
    { id: 1, title: 'Recent Health Query', date: 'Today', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 2, title: 'Cholesterol Advice', date: 'Yesterday', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { id: 3, title: 'Diet Recommendations', date: '2 days ago', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 4, title: 'Blood Test Results', date: 'Last week', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 5, title: 'General Checkup Info', date: 'Last week', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  ];

  const dummyResponses = [
    'Based on your recent blood test results, your hemoglobin levels are within the normal range. Keep up the healthy lifestyle!',
    'For maintaining good cholesterol levels, I recommend regular exercise and a balanced diet low in saturated fats.',
    'Your risk assessment shows moderate results. It\'s recommended to follow up with your healthcare provider in 3 months.',
    'Staying hydrated and maintaining a balanced diet rich in iron can help improve your hemoglobin levels naturally.',
    'Regular health check-ups are important for early detection of any potential health issues.',
  ];

  const quickQuestions = [
    'Explain my latest blood test',
    'What foods should I avoid?',
    'How can I improve my hemoglobin?',
    'When should I schedule my next checkup?',
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const aiResponse = {
        id: Date.now() + 1,
        type: 'ai',
        text: dummyResponses[Math.floor(Math.random() * dummyResponses.length)],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleQuickQuestion = (question) => {
    setInputText(question);
    inputRef.current?.focus();
  };

  const [showClearModal, setShowClearModal] = useState(false);

  const clearAllChats = () => {
    setShowClearModal(true);
  };

  const confirmClearChats = () => {
    setMessages([
      { id: 1, type: 'ai', text: "Hello! I'm your AI Health Assistant. How can I help you today?", time: '10:00 AM' }
    ]);
    setShowClearModal(false);
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-140px)] flex flex-col">
        {/* Header */}
        <div className="rounded-3xl p-6 lg:p-8 mb-8 text-white  relative overflow-hidden" style={{ backgroundColor: '#263B6A' }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">Health Assistant</h1>
                <p className="text-cyan-100 text-lg">Your intelligent health companion, ready to help</p>
                <div className="flex flex-wrap gap-3 mt-5">
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <span className="text-sm font-medium">Online & Ready</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-sm font-medium">24/7 Available</span>
                  </div>
                </div>
              </div>

              {/* AI Assistant Icon + Clear Chat */}
              <div className="flex items-center gap-4">
                {/* AI Status */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-center mt-2">
                    <p className="text-xs text-gray-300">AI Status</p>
                    <p className="text-sm font-bold text-green-400">Active</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-white">
              {/* Welcome Message */}
              {messages.length === 1 && (
                <div className="text-center py-8 sm:py-10">
                  <div className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#263B6A' }}>
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2" style={{ color: '#263B6A' }}>How can I help you today?</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto text-sm sm:text-base">Ask me anything about your health reports, get personalized advice, or learn about medical topics</p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                    {quickQuestions.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickQuestion(question)}
                        className="px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:shadow-md"
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
                          <span className="text-white text-xs font-bold">DK</span>
                        )}
                      </div>
                      <div className={`px-4 sm:px-5 py-3 rounded-2xl shadow-sm ${message.type === 'user'
                          ? 'text-white rounded-br-md'
                          : 'text-gray-800 rounded-bl-md border'
                        }`} style={message.type === 'user' ? { backgroundColor: '#547792' } : { backgroundColor: '#FFFFFF', borderColor: '#d4cfc7' }}>
                        <p className="text-sm sm:text-base leading-relaxed pr-8">{message.text}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete this ${message.type === 'user' ? 'user' : 'AI'} message?`)) {
                              setMessages(prev => prev.filter(m => m.id !== message.id));
                            }
                          }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 hover:bg-red-500/20 rounded-full text-red-500 hover:text-red-400 hover:bg-red-100/80 shadow-lg hover:shadow-red-200 hover:scale-110 bg-white/90 backdrop-blur-sm border border-red-200/50"
                          title={`Delete ${message.type === 'user' ? 'user' : 'AI'} message`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
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
                    <div className="px-5 py-3 rounded-2xl rounded-bl-md shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
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
                  className="p-4 bg-white hover:bg-gray-50 shadow-lg hover:shadow-xl border border-gray-200 backdrop-blur-sm rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center w-14 h-14 lg:w-16 lg:h-16 group relative"
                  title="Clear Chat"
                >
                  <svg className="w-6 h-6 text-slate-700 group-hover:text-blue-600 transition-colors duration-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
                  className="px-6 py-4 font-semibold rounded-2xl hover:opacity-90 transition-colors shadow-md flex items-center gap-2 text-white"
                  style={{ backgroundColor: '#263B6A' }}
                >
                  <span className="hidden sm:inline">Send</span>

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
        {showClearModal && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowClearModal(false)}
            />
            {/* Custom Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
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
                {/* Actions */}
                <div className="p-8 pt-0 space-y-3">
                  <button
                    onClick={confirmClearChats}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-4 px-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border border-red-400/30 backdrop-blur-sm text-lg"
                  >
                    Clear All Chats
                  </button>
                  <button
                    onClick={() => setShowClearModal(false)}
                    className="w-full bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-800 font-semibold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border border-slate-300/50 backdrop-blur-sm text-lg"
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

