import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

const Diagnosis = () => {
  const [animatedStats, setAnimatedStats] = useState({ reports: 0, score: 0, risks: 0 });

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setAnimatedStats({
        reports: Math.round(96 * progress),
        score: Math.round(95 * progress),
        risks: Math.round(2 * progress),
      });

      if (step >= steps) {
        clearInterval(timer);
        setAnimatedStats({ reports: 96, score: 95, risks: 2 });
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const diagnoses = [
    {
      id: 1,
      title: 'No Anemia Detected',
      status: 'good',
      description: 'Hemoglobin levels are within normal range (13.5-17.5 g/dL for males)',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      id: 2,
      title: 'Borderline Cholesterol',
      status: 'warning',
      description: 'LDL cholesterol slightly elevated at 135 mg/dL (optimal: below 100 mg/dL)',
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
    },
    {
      id: 3,
      title: 'Normal Blood Sugar',
      status: 'good',
      description: 'Fasting glucose level is normal at 95 mg/dL',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
  ];

  const advice = [
    {
      id: 1,
      title: 'Dietary Changes',
      description: 'Reduce saturated fat intake. Include more fiber-rich foods like oats, beans, and fruits. Limit red meat consumption to twice a week.',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      color: '#06b6d4'
    },
    {
      id: 2,
      title: 'Exercise Routine',
      description: 'Engage in moderate aerobic exercise for at least 150 minutes per week. Include activities like walking, swimming, or cycling.',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      color: '#22c55e'
    },
    {
      id: 3,
      title: 'Follow-up Testing',
      description: 'Schedule a lipid panel test in 3 months to monitor cholesterol levels. Continue annual comprehensive blood work.',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: '#8b5cf6'
    },
  ];

  const lifestyle = [
    { icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', title: 'Exercise', desc: '30 mins daily moderate activity' },
    { icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', title: 'Diet', desc: 'Balanced, low-fat meals' },
    { icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z', title: 'Sleep', desc: '7-8 hours per night' },
    { icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Stress Management', desc: 'Meditation and relaxation' },
  ];

  const getStatusStyle = (status) => {
    switch (status) {
      case 'good': return { bg: '#FFFFFF', text: '#16a34a', border: '#86efac', iconBg: '#22c55e' };
      case 'warning': return { bg: '#FFFFFF', text: '#d97706', border: '#fcd34d', iconBg: '#f59e0b' };
      case 'critical': return { bg: '#FFFFFF', text: '#dc2626', border: '#fca5a5', iconBg: '#ef4444' };
      default: return { bg: '#FFFFFF', text: '#6b7280', border: '#d1d5db', iconBg: '#9ca3af' };
    }
  };

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="rounded-3xl p-6 lg:p-8 mb-8 text-white shadow-xl relative overflow-hidden" style={{ backgroundColor: '#263B6A' }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">Diagnosis & Advice</h1>
                <p className="text-cyan-100 text-lg">Your personalized health analysis and recommendations</p>
                <div className="flex flex-wrap gap-3 mt-5">
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="text-sm font-medium">Latest Report: <span className="text-green-400 font-bold">July 15, 2024</span></span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-sm font-medium">Total Diagnoses: <span className="text-cyan-400 font-bold">3</span></span>
                  </div>
                </div>
              </div>

              {/* Diagnosis Icon */}
              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-300">Health Status</p>
                  <p className="text-lg font-bold text-green-400">Good</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Medical Summary Card */}
        <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl border border-gray-200 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">Medical Summary Report</h2>
              <p className="text-gray-500">Generated on July 15, 2024</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-white text-green-700 rounded-xl font-semibold text-sm border border-green-200">
                Good Health
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl text-center border border-gray-100 shadow-sm">
              <p className="text-3xl font-bold text-gray-800">{animatedStats.reports}</p>
              <p className="text-sm text-gray-500 mt-1">Reports Analyzed</p>
            </div>
            <div className="p-4 bg-white rounded-xl text-center border border-gray-100 shadow-sm">
              <p className="text-3xl font-bold text-gray-800">{animatedStats.score}</p>
              <p className="text-sm text-gray-500 mt-1">Overall Score</p>
            </div>
            <div className="p-4 bg-white rounded-xl text-center border border-gray-100 shadow-sm">
              <p className="text-3xl font-bold text-gray-800">{animatedStats.risks}</p>
              <p className="text-sm text-gray-500 mt-1">Risks Found</p>
            </div>
            <div className="p-4 bg-white rounded-xl text-center border border-gray-100 shadow-sm">
              <p className="text-3xl font-bold text-green-600">Good</p>
              <p className="text-sm text-gray-500 mt-1">Health Status</p>
            </div>
          </div>
        </div>

        {/* Diagnosis Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-4 bg-white border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Diagnosis
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {diagnoses.map((diagnosis) => {
                const style = getStatusStyle(diagnosis.status);
                return (
                  <div
                    key={diagnosis.id}
                    className="flex items-start gap-4 p-4 rounded-xl transition-all duration-200 border"
                    style={{ backgroundColor: '#FFFFFF', borderColor: style.border }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100"
                      style={{ backgroundColor: 'white' }}
                    >
                      <svg
                        className="w-5 h-5"
                        style={{ color: style.iconBg }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={diagnosis.icon} />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800" style={{ color: style.text }}>{diagnosis.title}</h4>
                      <p className="text-sm mt-1" style={{ color: '#4b5563' }}>{diagnosis.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Personalized Advice */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-4 bg-white border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Personalized Advice
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {advice.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-all duration-200 hover:shadow-md"
                  style={{ backgroundColor: '#FFFFFF' }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-100"
                    style={{ backgroundColor: '#FFFFFF' }}
                  >
                    <span className="text-xl font-bold" style={{ color: item.color }}>{item.id}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 mb-1">{item.title}</h4>
                    <p className="text-sm text-gray-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lifestyle Recommendations */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-4 bg-white border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Lifestyle Recommendations
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {lifestyle.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white hover:bg-gray-100 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center group-hover:bg-gray-50 transition-colors">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">{item.title}</h4>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Download Button */}
        <div className="flex justify-center">
          <button className="flex items-center gap-2 px-8 py-4 bg-gray-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 hover:bg-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Full Report
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default Diagnosis;
