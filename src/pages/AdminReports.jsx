import { useState, useEffect } from 'react';
import { collectionGroup, getDocs, orderBy, limit, query, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import AdminLayout from '../components/AdminLayout';

const AdminReports = () => {
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    reliability: 0,
    reasons: { missingAnalysis: 0, incompleteResults: 0 }
  });
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditData();
  }, []);

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      const reportsRef = collectionGroup(db, 'reports');
      const allReportsQuery = query(reportsRef, orderBy('createdAt', 'desc'), limit(100));
      const snapshot = await getDocs(allReportsQuery);

      let success = 0;
      let failed = 0;
      let missingAnalysis = 0;
      let incompleteResults = 0;
      const executionList = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        const hasValidAnalysis = data.analysis && (data.analysis.summary || data.analysis.overall_health || data.analysis.risks);
        
        let status = 'Success';
        let reason = '';

        if (hasValidAnalysis) {
          success++;
        } else {
          failed++;
          status = 'Failed';
          if (!data.analysis) {
            missingAnalysis++;
            reason = 'Missing Analysis Object';
          } else {
            incompleteResults++;
            reason = 'Incomplete Extraction';
          }
        }

        executionList.push({
          id: doc.id,
          userName: data.userName || 'Unknown User',
          reportName: data.name || 'Medical Report',
          date: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : 'N/A',
          status,
          reason
        });
      });

      const total = snapshot.size;
      setStats({
        total,
        success,
        failed,
        reliability: total > 0 ? Math.round((success / total) * 100) : 100,
        reasons: { missingAnalysis, incompleteResults }
      });
      setExecutions(executionList);
    } catch (error) {
      console.error("Error fetching audit reports:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout 
      title="System Audit & AI Performance" 
      subtitle="Monitoring automated intelligence pipeline and extraction reliability"
    >
      <div className="space-y-8 animate-fade-in">
        
        {/* TOP STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="premium-card p-6 border-slate-200">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Executions</span>
            <p className="text-3xl font-black text-slate-800 mt-2">{stats.total}</p>
            <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-400 w-full"></div>
            </div>
          </div>

          <div className="premium-card p-6 border-emerald-100 bg-emerald-50/20">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Successful Pulses</span>
            <p className="text-3xl font-black text-emerald-600 mt-2">{stats.success}</p>
            <div className="mt-4 h-1 w-full bg-emerald-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${stats.reliability}%` }}></div>
            </div>
          </div>

          <div className="premium-card p-6 border-rose-100 bg-rose-50/20">
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Failed Extractions</span>
            <p className="text-3xl font-black text-rose-600 mt-2">{stats.failed}</p>
            <div className="mt-4 h-1 w-full bg-rose-100 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500" style={{ width: `${100 - stats.reliability}%` }}></div>
            </div>
          </div>

          <div className="premium-card p-6 border-cyan-100 bg-cyan-50/20">
            <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Reliability Score</span>
            <p className="text-3xl font-black text-cyan-600 mt-2">{stats.reliability}%</p>
            <div className="mt-4 h-1 w-full bg-cyan-100 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]" style={{ width: `${stats.reliability}%` }}></div>
            </div>
          </div>
        </div>

        {/* DETAILED LOG */}
        <div className="premium-card overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">Recent Pipeline Executions</h3>
            <button onClick={fetchAuditData} className="text-[10px] font-black text-cyan-600 uppercase hover:text-cyan-700 transition-colors">Refresh Logs</button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">User / Report</th>
                  <th className="px-6 py-4">Execution Date</th>
                  <th className="px-6 py-4 text-right">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {executions.map((exec, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className={`px-2 py-0.5 inline-flex rounded-full text-[9px] font-black uppercase tracking-widest ${exec.status === 'Success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {exec.status}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700">{exec.userName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{exec.reportName}</p>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                      {exec.date}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {exec.reason ? (
                        <span className="text-[9px] font-black text-rose-400 uppercase bg-rose-50/50 px-2 py-1 rounded-lg">
                          {exec.reason}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-emerald-400 uppercase">Successful Match</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && executions.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Recent Executions Found</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
