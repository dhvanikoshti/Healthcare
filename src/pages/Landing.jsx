import { useState } from 'react';
import { Link } from 'react-router-dom';

const Landing = () => {
  const [openFaq, setOpenFaq] = useState(null);
  const [showDemo, setShowDemo] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const demoSteps = [
    {
      title: "Upload Your Health Reports",
      desc: "Start by uploading your medical reports, lab results, or health documents",
      image: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&q=80",
      highlight: "📄 Upload PDF, Images, or Documents"
    },
    {
      title: "AI Analysis in Progress",
      desc: "Our advanced AI analyzes your health data to extract meaningful insights",
      image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80",
      highlight: "🔬 Processing Health Metrics..."
    },
    {
      title: "View Comprehensive Reports",
      desc: "Get detailed reports with charts, trends, and risk assessments",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
      highlight: "📊 Health Dashboard & Analytics"
    },
    {
      title: "AI Chat Assistance",
      desc: "Interact with our AI chatbot to get answers about your health questions",
      image: "https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=800&q=80",
      highlight: "💬 24/7 AI Health Assistant"
    }
  ];

  const startDemo = () => {
    setShowDemo(true);
    setDemoStep(0);
  };

  const nextStep = () => {
    if (demoStep < demoSteps.length - 1) {
      setDemoStep(demoStep + 1);
    } else {
      setShowDemo(false);
    }
  };

  const prevStep = () => {
    if (demoStep > 0) {
      setDemoStep(demoStep - 1);
    }
  };

  const features = [
    {
      icon: "🤖",
      title: "AI Health Summary",
      desc: "Get instant AI-powered summaries of your health data and trends"
    },
    {
      icon: "📊",
      title: "Risk Analysis",
      desc: "Advanced algorithms analyze your health risks with precision"
    },
    {
      icon: "📈",
      title: "Fluctuation Tracking",
      desc: "Track health metrics fluctuations over time with detailed charts"
    },
    {
      icon: "💬",
      title: "AI Chatbot",
      desc: "24/7 AI assistant to answer your health questions instantly"
    }
  ];

  const steps = [
    { num: "01", title: "Create Account", desc: "Sign up with your basic information" },
    { num: "02", title: "Add Health Data", desc: "Input your health metrics and records" },
    { num: "03", title: "Get Insights", desc: "Receive AI-powered health insights" }
  ];

  const faqs = [
    { q: "Is this a replacement for medical advice?", a: "No, this platform is for informational purposes only. Always consult your doctor." },
    { q: "Can I export my health data?", a: "Yes, you can export your data in PDF format at any time." },
    { q: "Is the AI chatbot accurate?", a: "Our AI is trained on medical data but should not replace professional medical advice." },
    { q: "How much does this service cost?", a: "We offer a free tier with basic features. " },
    { q: "What types of health reports can I upload?", a: "You can upload PDF documents, images (JPEG, PNG), and medical records." },
    { q: "How long does AI analysis take?", a: "Most reports are analyzed within seconds to a few minutes." },
    { q: "Can I use this on mobile devices?", a: "Yes! Our platform is fully responsive and works on all devices." },
    { q: "Is my personal health data shared with third parties?", a: "No, we never share your personal health data with third parties." },
    { q: "How do I get started?", a: "Simply create an account, upload your first health report, and our AI will provide instant insights." }
  ];

  const toggleFaq = (idx) => setOpenFaq(openFaq === idx ? null : idx);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: '#FFFFFF' }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ backgroundColor: '#263B6A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img
                src="./src/assets/logo.png"
                alt="HealthCare AI Logo"
                className="w-40 sm:w-48 lg:w-56 h-auto p-1"
              />
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-white/80 hover:text-white transition">Features</a>
              <a href="#how-it-works" className="text-white/80 hover:text-white transition">How it Works</a>
              <a href="#faq" className="text-white/80 hover:text-white transition">FAQ</a>
            </div>

            {/* Desktop Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <Link to="/login" className="text-white hover:text-white/80 transition">Login</Link>
              <Link to="/register" className="px-5 py-2 rounded-lg text-white font-medium transition hover:opacity-90" style={{ backgroundColor: '#547792' }}>Get Started</Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-white p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-white/10">
              <div className="flex flex-col gap-4">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-white/80 hover:text-white transition py-2">Features</a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-white/80 hover:text-white transition py-2">How it Works</a>
                <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-white/80 hover:text-white transition py-2">FAQ</a>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-white/80 transition py-2">Login</Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="px-5 py-2 rounded-lg text-white font-medium transition hover:opacity-90 text-center" style={{ backgroundColor: '#547792' }}>Get Started</Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section
        className="mt-16 pt-4 sm:mt-0 sm:pt-24 lg:pt-28 pb-8 sm:pb-12 lg:pb-16 px-4 sm:px-6 lg:px-8 bg-top sm:bg-center bg-[length:100%_auto] sm:bg-contain bg-no-repeat"
        style={{
          backgroundImage: 'linear-gradient(rgba(38, 59, 106, 0.45), rgba(38, 59, 106, 0.45)), url(/src/assets/hero_section.png)',
          backgroundColor: '#263B6A'
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center min-h-[20vh] sm:min-h-[50vh] lg:min-h-[60vh]">
            {/* Left side - Empty spacer for desktop backdrop framing */}
            <div className="hidden md:block md:col-span-6 lg:col-span-7"></div>
            {/* Right side - Content */}
            <div className="md:col-span-6 lg:col-span-5 text-right relative z-10">
              <h1 className="mt-4 sm:mt-0 md:mt-0 lg:mt-0 text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight">
                Your Health,<br className="md:hidden" />{" "}
                <span className="whitespace-nowrap">
                  <span style={{ color: '#547792' }}>Smarter</span>
                  <span className="text-white"> & Simpler</span>
                </span>
              </h1>
              <p className="hidden md:block mt-4 lg:mt-6 text-sm sm:text-base lg:text-lg text-white/90 max-w-2xl ml-auto mr-0">
                {/* Experience the future of healthcare with AI-powered insights. Our neural engine analyzes your health data in real-time to health tracking, personalized recommendations and predict risks before they become problems.
                 */}
                AI-powered technology analyzes your health data in real time to track the progress , deliver personalized recommendations , and detect potential risks before they become serious problems.
              </p>
              <div className="mt-6 sm:mt-15 lg:mt-6 flex flex-col md:flex-row gap-3 sm:gap-4 lg:gap-6 items-end md:items-center justify-end">
                <Link to="/register" className="w-full md:w-auto text-center px-5 sm:px-6 lg:px-7 py-2.5 sm:py-3 lg:py-3.5 rounded-xl text-white font-bold text-sm sm:text-base lg:text-lg shadow-lg hover:scale-105 transition transform" style={{ backgroundColor: '#547792' }}>Start Free Trial</Link>
                <button onClick={startDemo} className="w-full md:w-auto px-5 sm:px-6 lg:px-7 py-2.5 sm:py-3 lg:py-3.5 rounded-xl text-white font-bold text-sm sm:text-base lg:text-lg border-2 border-white/30 hover:bg-white/10 transition">Watch Demo</button>
              </div>
            </div>
          </div>
        </div>
      </section>






      {/* Features Section */}
      <section id="features" className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ color: '#263B6A' }}>Powerful AI Features</h2>
            <p className="mt-2 sm:mt-3 lg:mt-4 text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">Everything you need to understand and improve your health with the power of artificial intelligence</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="bg-white border-gray-100 border-1 rounded-2xl p-4 sm:p-5 lg:p-6 shadow-lg hover:shadow-xl transition hover:-translate-y-1">
                <div className="w-10 h-10 sm:w-12 lg:w-14 rounded-xl flex items-center justify-center text-xl sm:text-2xl lg:text-3xl mb-2.5 sm:mb-3 lg:mb-4" style={{ backgroundColor: '#FFFFFF' }}>{feature.icon}</div>
                <h3 className="font-bold text-base lg:text-lg mb-1.5 lg:mb-2" style={{ color: '#263B6A' }}>{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#263B6A' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">How It Works</h2>
            <p className="mt-2 sm:mt-3 lg:mt-4 text-white/70 max-w-2xl mx-auto text-sm sm:text-base">Get started in three simple steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="text-center relative flex flex-col items-center px-2">
                {idx < 2 && <div className="hidden md:block absolute top-8 left-[55%] lg:left-[60%] w-[70%] lg:w-[80%] h-0.5 bg-white/20"></div>}
                <div className="w-14 h-14 sm:w-16 lg:w-18 xl:w-20 rounded-full bg-white/10 flex items-center justify-center mb-3 sm:mb-4 lg:mb-5 border-2 border-white/30">
                  <span className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-white">{step.num}</span>
                </div>
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white mb-1.5 lg:mb-2">{step.title}</h3>
                <p className="text-white/70 text-sm sm:text-base">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Chat Preview */}
      <section className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 xl:gap-10 items-center">
            <div className="order-2 lg:order-1">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 lg:mb-5" style={{ color: '#263B6A' }}>Your Personal AI Health Assistant</h2>
              <p className="text-gray-600 mb-4 sm:mb-5 lg:mb-6 text-sm sm:text-base">Ask questions about your health, get instant answers, and receive personalized recommendations powered by advanced AI.</p>
              <div className="space-y-2.5 sm:space-y-3 lg:space-y-4">
                {["What does my heart rate data mean?", "How can I improve my sleep quality?", "What foods should I avoid?"].map((q, i) => (
                  <div key={i} className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 lg:p-4 rounded-xl" style={{ backgroundColor: '#FFFFFF' }}>
                    <span>💬</span>
                    <span className="text-gray-700 text-sm sm:text-base">{q}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-5 lg:p-6 border order-1 lg:order-2">
              <div className="flex items-center gap-2.5 sm:gap-3 mb-3.5 sm:mb-4 lg:mb-5 pb-3 sm:pb-4 border-b">
                <div className="w-9 h-9 sm:w-10 lg:w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#547792' }}>
                  <span>🤖</span>
                </div>
                <div>
                  <div className="font-bold text-sm sm:text-base" style={{ color: '#263B6A' }}>Health AI</div>
                  <div className="text-xs text-green-500">● Online</div>
                </div>
              </div>
              <div className="space-y-2.5 sm:space-y-3 lg:space-y-4">
                <div className="bg-gray-100 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-4 max-w-[80%]">
                  <p className="text-gray-700 text-sm">Hello! I'm your AI health assistant. How can I help you today?</p>
                </div>
                <div className="bg-blue-100 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-4 max-w-[80%] ml-auto">
                  <p className="text-gray-700 text-sm">What does my recent heart rate data indicate?</p>
                </div>
                <div className="bg-gray-100 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 lg:p-4 max-w-[80%]">
                  <p className="text-gray-700 text-sm">Your heart rate has been stable between 68-75 BPM, which is within the healthy range. Keep maintaining your exercise routine!</p>
                </div>
              </div>
              <div className="mt-3 sm:mt-3.5 lg:mt-4 flex gap-2">
                <input type="text" placeholder="Ask something..." className="flex-1 px-3 lg:px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 text-sm sm:text-base" style={{ borderColor: '#547792' }} />
                <button className="px-3 lg:px-4 py-2 rounded-lg text-white text-sm sm:text-base" style={{ backgroundColor: '#547792' }}>Send</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#263B6A' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-2.5 sm:space-y-3 lg:space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white/10 rounded-xl overflow-hidden">
                <button onClick={() => toggleFaq(idx)} className="w-full px-4 sm:px-5 lg:px-6 py-2.5 sm:py-3 lg:py-3.5 text-left flex justify-between items-center text-white">
                  <span className="font-medium text-sm sm:text-base">{faq.q}</span>
                  <span className="text-lg sm:text-xl lg:text-2xl">{openFaq === idx ? '−' : '+'}</span>
                </button>
                {openFaq === idx && <div className="px-4 sm:px-5 lg:px-6 pb-3 sm:pb-3.5 lg:pb-4 text-white/80 text-sm sm:text-base">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#547792' }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4 lg:mb-5">Ready to Transform Your Health?</h2>
          <p className="text-white/80 text-sm sm:text-base lg:text-lg mb-5 sm:mb-6 lg:mb-7">Join thousands of users already benefiting from AI-powered health insights</p>
          <Link to="/register" className="inline-block px-7 sm:px-8 lg:px-9 py-2.5 sm:py-3 lg:py-3.5 bg-white text-[#547792] font-bold text-sm sm:text-base lg:text-lg rounded-xl shadow-lg hover:scale-105 transition transform">Get Started Free</Link>
        </div>
      </section>

      {/* Demo Modal */}
      {showDemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden">
            <button
              onClick={() => setShowDemo(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex gap-2 p-4 bg-white">
              {demoSteps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${idx <= demoStep ? 'bg-[#263B6A]' : 'bg-gray-200'}`}
                />
              ))}
            </div>

            <div className="grid md:grid-cols-2">
              <div className="p-8 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-[#263B6A]/10 text-[#263B6A] text-sm font-medium rounded-full">
                    Step {demoStep + 1} of {demoSteps.length}
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
                  {demoSteps[demoStep].title}
                </h3>
                <p className="text-gray-600 mb-6">
                  {demoSteps[demoStep].desc}
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#263B6A]/10 text-[#263B6A] rounded-lg font-medium">
                  {demoSteps[demoStep].highlight}
                </div>
              </div>
              <div className="relative h-64 md:h-auto">
                <img
                  src={demoSteps[demoStep].image}
                  alt={demoSteps[demoStep].title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent md:from-transparent md:bg-gradient-to-r md:from-black/30 md:to-transparent" />
              </div>
            </div>

            <div className="flex items-center justify-between p-6 bg-white border-t">
              <button
                onClick={prevStep}
                disabled={demoStep === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition ${demoStep === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <div className="flex gap-2">
                {demoSteps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-all ${idx === demoStep ? 'w-6 bg-[#263B6A]' : 'bg-gray-300'}`}
                  />
                ))}
              </div>
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#263B6A] text-white rounded-xl font-medium hover:bg-[#2a4a7f] transition shadow-lg hover:shadow-xl"
              >
                {demoStep === demoSteps.length - 1 ? 'Finish' : 'Next'}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer - Beautiful & Unique Design */}
      <footer className="relative" style={{ backgroundColor: '#FFFFFF' }}>
        {/* Decorative Wave Top */}
        <div className="absolute top-0 left-0 right-0 overflow-hidden leading-none">
          <svg className="relative block w-full h-16 sm:h-20" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="#263B6A"></path>
          </svg>
        </div>

        {/* Main Footer Content */}
        <div className="pt-12 pb-8 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Top Section - 3 Column Layout */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-10 mb-12">
              {/* Brand Column */}
              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#263B6A' }}>
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L4 7V17L12 22L20 17V7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12 8V16M8 12H16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-bold text-2xl block" style={{ color: '#263B6A' }}>Health Analyzer</span>
                    <span className="text-xs text-gray-500">Smart Health</span>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">
                  Revolutionizing healthcare with AI-powered insights. Track, analyze, and improve your health journey with cutting-edge technology.
                </p>
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 text-center shadow-md">
                    <div className="text-2xl font-bold" style={{ color: '#263B6A' }}>50K+</div>
                    <div className="text-xs text-gray-500">Active Users</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center shadow-md">
                    <div className="text-2xl font-bold" style={{ color: '#263B6A' }}>99.9%</div>
                    <div className="text-xs text-gray-500">Accuracy</div>
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h4 className="font-bold text-lg mb-5 flex items-center gap-2" style={{ color: '#263B6A' }}>
                  <span className="w-2 h-6 rounded-full" style={{ backgroundColor: '#547792' }}></span>
                  Quick Links
                </h4>
                <ul className="space-y-3">
                  <li><Link to="/register" className="text-gray-600 hover:text-[#547792] hover:translate-x-2 transition-all duration-300 flex items-center gap-2"><span style={{ color: '#547792' }}>▹</span> Get Started</Link></li>
                  <li><Link to="/login" className="text-gray-600 hover:text-[#547792] hover:translate-x-2 transition-all duration-300 flex items-center gap-2"><span style={{ color: '#547792' }}>▹</span> Login</Link></li>
                  <li><a href="#features" className="text-gray-600 hover:text-[#547792] hover:translate-x-2 transition-all duration-300 flex items-center gap-2"><span style={{ color: '#547792' }}>▹</span> Features</a></li>
                  <li><a href="#how-it-works" className="text-gray-600 hover:text-[#547792] hover:translate-x-2 transition-all duration-300 flex items-center gap-2"><span style={{ color: '#547792' }}>▹</span> How it Works</a></li>
                  <li><a href="#faq" className="text-gray-600 hover:text-[#547792] hover:translate-x-2 transition-all duration-300 flex items-center gap-2"><span style={{ color: '#547792' }}>▹</span> FAQ</a></li>
                </ul>
              </div>

              {/* Services */}
              <div>
                <h4 className="font-bold text-lg mb-5 flex items-center gap-2" style={{ color: '#263B6A' }}>
                  <span className="w-2 h-6 rounded-full" style={{ backgroundColor: '#547792' }}></span>
                  Services
                </h4>
                <ul className="space-y-3">
                  <li><a href="#" className="text-gray-600 hover:text-[#547792] hover:translate-x-2 transition-all duration-300 flex items-center gap-2"><span style={{ color: '#547792' }}>▹</span> AI Health Analysis</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-[#547792] hover:translate-x-2 transition-all duration-300 flex items-center gap-2"><span style={{ color: '#547792' }}>▹</span> Report Upload</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-[#547792] hover:translate-x-2 transition-all duration-300 flex items-center gap-2"><span style={{ color: '#547792' }}>▹</span> Risk Assessment</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-[#547792] hover:translate-x-2 transition-all duration-300 flex items-center gap-2"><span style={{ color: '#547792' }}>▹</span> Health Trends</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-[#547792] hover:translate-x-2 transition-all duration-300 flex items-center gap-2"><span style={{ color: '#547792' }}>▹</span> AI Chatbot</a></li>
                </ul>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="pt-8 border-t border-gray-400">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-gray-500 text-center md:text-left">
                  <p>&copy; {new Date().getFullYear()} <span className="font-semibold" style={{ color: '#263B6A' }}>Health Analyzer</span>. All rights reserved.</p>
                </div>
                <div className="flex gap-6 text-sm">
                  <a href="#" className="text-gray-500 hover:text-[#263B6A] transition">Privacy Policy</a>
                  <a href="#" className="text-gray-500 hover:text-[#263B6A] transition">Terms of Service</a>
                  <a href="#" className="text-gray-500 hover:text-[#263B6A] transition">Cookie Policy</a>
                </div>
              </div>

              {/* Made with love */}
              <div className="mt-6 text-center">
                <p className="text-gray-400 text-sm flex items-center justify-center gap-2">
                  <span>Powered by AI </span>
                  <span className="text-red-500">❤</span>
                  <span>for Smarter Healthcare</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
