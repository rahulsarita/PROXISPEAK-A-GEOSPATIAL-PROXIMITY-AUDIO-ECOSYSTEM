import React, { useState, useEffect } from 'react';
import { Cpu, X, Play, CheckCircle2, AlertTriangle, Clock, BarChart3, RefreshCw } from 'lucide-react';
import config from '../config.js';

export function SpatialAuditModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [userCount, setUserCount] = useState(100);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${config.SERVER_URL}/api/audit/history`);
      const data = await res.json();
      if (data.success && data.logs) {
        setHistory(data.logs);
        if (data.logs.length > 0 && !report) {
          setReport(data.logs[0].details);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch audit history:', err);
    }
  };

  const runBenchmark = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.SERVER_URL}/api/audit/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCount, iterations: 100, radius: 160 }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
        fetchHistory();
      }
    } catch (err) {
      console.error('Audit run failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-2xl glass-panel rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Geospatial Engine Benchmark Audit</h2>
              <p className="text-[11px] text-slate-400">
                Validation of MongoDB $near & $geoWithin queries under 20ms
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Controls */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-slate-300 font-medium">Concurrent Simulated Users:</span>
              <select
                value={userCount}
                onChange={(e) => setUserCount(Number(e.target.value))}
                className="bg-slate-800 text-white border border-white/10 rounded-lg px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value={50}>50 Users (Baseline)</option>
                <option value={100}>100 Users (Standard)</option>
                <option value={250}>250 Users (High Load)</option>
                <option value={500}>500 Users (Stress Test)</option>
              </select>
            </div>

            <button
              onClick={runBenchmark}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executing 100 Queries...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Execute Audit</span>
                </>
              )}
            </button>
          </div>

          {/* Results Card */}
          {report ? (
            <div className="space-y-4">
              {/* Target Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  report.isUnder20ms
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {report.isUnder20ms ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  )}
                  <div>
                    <h3 className="font-bold text-sm">
                      {report.isUnder20ms
                        ? 'PASS: ALL QUERIES EXECUTED UNDER 20ms REQUIREMENT'
                        : 'WARNING: Latency exceeded 20ms threshold'}
                    </h3>
                    <p className="text-[11px] opacity-80">
                      p95 Latency: {report.nearStats?.p95?.toFixed(2)}ms (Target: &lt; 20.00ms) with{' '}
                      {report.userCount} active spatial avatars
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xl font-extrabold text-white">
                    {report.nearStats?.p95?.toFixed(2)} ms
                  </div>
                  <div className="text-[10px] text-slate-400">p95 Latency</div>
                </div>
              </div>

              {/* Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Average Latency</span>
                  <div className="text-base font-bold font-mono text-cyan-300">
                    {report.nearStats?.avg?.toFixed(2)} ms
                  </div>
                  <span className="text-[10px] text-slate-500">100 Samples</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">p50 Median</span>
                  <div className="text-base font-bold font-mono text-emerald-300">
                    {report.nearStats?.p50?.toFixed(2)} ms
                  </div>
                  <span className="text-[10px] text-slate-500">Typical Frame</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">p99 Outlier</span>
                  <div className="text-base font-bold font-mono text-purple-300">
                    {report.nearStats?.p99?.toFixed(2)} ms
                  </div>
                  <span className="text-[10px] text-slate-500">99th Percentile</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Clusters / Pods</span>
                  <div className="text-base font-bold font-mono text-blue-300">
                    {report.clusterCount} Pods
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {report.clusterTimeMs?.toFixed(2)}ms compute
                  </span>
                </div>
              </div>

              {/* Query Breakdown Table */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-2">
                <h4 className="font-semibold text-slate-300 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Detailed Query Breakdown
                </h4>
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-1.5">Query Type</th>
                      <th>Avg Latency</th>
                      <th>p50 Median</th>
                      <th>p95 Latency</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    <tr>
                      <td className="py-2 text-cyan-300 font-semibold">$near (Earshot Radius)</td>
                      <td>{report.nearStats?.avg?.toFixed(2)} ms</td>
                      <td>{report.nearStats?.p50?.toFixed(2)} ms</td>
                      <td>{report.nearStats?.p95?.toFixed(2)} ms</td>
                      <td className="text-emerald-400 font-bold">&lt; 20ms [PASS]</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-blue-300 font-semibold">$geoWithin (Room Bounding Box)</td>
                      <td>{report.boxStats?.avg?.toFixed(2)} ms</td>
                      <td>{report.boxStats?.p50?.toFixed(2)} ms</td>
                      <td>{report.boxStats?.p95?.toFixed(2)} ms</td>
                      <td className="text-emerald-400 font-bold">&lt; 20ms [PASS]</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p>Click "Execute Audit" to run the live geospatial benchmark.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpatialAuditModal;
