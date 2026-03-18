// src/pages/Dashboard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

// ── Token helpers ─────────────────────────────────────────────────────────
export const decodeToken = (token) => {
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
    } catch { return null; }
};
export const getUserRoles = () => {
    const token = localStorage.getItem('token');
    if (!token) return [];
    return decodeToken(token)?.realm_access?.roles || [];
};
export const isAdmin = () => getUserRoles().includes('admin');

// ── Constants ─────────────────────────────────────────────────────────────
const JAEGER_API = import.meta.env.VITE_JAEGER_API_URL || 'http://localhost:8000/proxy/jaeger';
const GATEWAY_METRICS = import.meta.env.VITE_GATEWAY_METRICS_URL || 'http://localhost:8000/proxy/gateway/metrics';
const TOOL_COLORS = {
    list_products: { bar: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700' },
    get_product_detail: { bar: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700' },
    add_product: { bar: 'bg-green-500', badge: 'bg-green-50 text-green-700' },
    get_store_profit_loss: { bar: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700' },
};
const getColor = (name, key) => TOOL_COLORS[name]?.[key] || (key === 'bar' ? 'bg-gray-400' : 'bg-gray-100 text-gray-600');

// ── Subcomponents ─────────────────────────────────────────────────────────
const MetricCard = ({ icon, title, value, sub, accent = 'blue' }) => (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-start mb-3">
            <span className="text-2xl">{icon}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-${accent}-50 text-${accent}-600`}>{sub}</span>
        </div>
        <div className={`text-3xl font-black text-${accent}-600 mb-0.5`}>{value}</div>
        <div className="text-xs text-gray-500 font-medium">{title}</div>
    </div>
);

const ToolBar = ({ name, count, total }) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getColor(name, 'badge')}`}>{name}</span>
                <span className="text-sm font-bold text-gray-700">{count} <span className="text-gray-400 font-normal text-xs">({pct}%)</span></span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${getColor(name, 'bar')} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

const TraceRow = ({ trace }) => {
    const [open, setOpen] = useState(false);
    const root = trace.spans?.[0];
    const ms = root ? (root.duration / 1000).toFixed(1) : '?';
    const time = root ? new Date(root.startTime / 1000).toLocaleTimeString('en-US', { hour12: false }) : '';
    const hasError = trace.spans?.some(s => s.tags?.some(t => t.key === 'error' && t.value === true));

    // Collect tags from all spans
    const allTags = trace.spans?.flatMap(s => s.tags || []) || [];
    const getTag = (key) => allTags.find(t => t.key === key)?.value;
    const mcpMethod = getTag('mcp.method') || root?.operationName || 'unknown';
    const jwtSub = getTag('jwt.sub');
    const httpStatus = getTag('http.status');
    const toolName = getTag('mcp.resource.name') || mcpMethod;

    return (
        <div className="border border-gray-100 rounded-xl overflow-hidden mb-2 hover:border-gray-200 transition-colors">
            <div className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-gray-50" onClick={() => setOpen(!open)}>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasError ? 'bg-red-500' : 'bg-green-400'}`} />
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getColor(toolName, 'badge')}`}>{toolName}</span>
                    {jwtSub && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                            👤 <span className="font-mono text-gray-600">{jwtSub.slice(0, 8)}...</span>
                        </span>
                    )}
                    {httpStatus && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${httpStatus === '200' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            HTTP {httpStatus}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>⏱ {ms}ms</span>
                    <span>{time}</span>
                    <span>{open ? '▲' : '▼'}</span>
                </div>
            </div>

            {open && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {[
                            { label: 'MCP Method', value: mcpMethod, icon: '📡' },
                            { label: 'JWT Sub', value: jwtSub ? jwtSub.slice(0, 8) + '...' : '—', icon: '👤' },
                            { label: 'HTTP Status', value: httpStatus || '—', icon: '🌐' },
                        ].map(({ label, value, icon }) => (
                            <div key={label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                                <div className="text-xs text-gray-400 mb-1">{icon} {label}</div>
                                <div className="text-xs font-semibold text-gray-700 truncate">{value}</div>
                            </div>
                        ))}
                    </div>
                    <div className="text-xs text-gray-400 font-mono mb-2">Trace ID: {trace.traceID}</div>
                    <div className="space-y-1.5">
                        {trace.spans?.map((span, i) => (
                            <div key={i} className="bg-white rounded-lg p-2.5 border border-gray-100">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-blue-500 font-semibold text-xs">{span.operationName}</span>
                                    <span className="text-gray-400 text-xs">{(span.duration / 1000).toFixed(1)}ms</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {span.tags?.filter(t => !['internal.span.format'].includes(t.key)).map(t => (
                                        <span key={t.key} className="text-xs bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">
                                            <span className="text-gray-400">{t.key}</span>=<span className="text-gray-600 font-medium">{String(t.value)}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const LogLine = ({ line }) => {
    const isError = line.toLowerCase().includes('error');
    const isWarn = line.toLowerCase().includes('warn');
    return (
        <div className={`font-mono text-xs px-3 py-1.5 rounded-lg mb-1 ${isError ? 'bg-red-950 text-red-300' :
            isWarn ? 'bg-yellow-950 text-yellow-300' :
                'bg-gray-900 text-green-300'
            }`}>
            {line}
        </div>
    );
};

const parseMetrics = (raw) => {
    const lines = raw.split('\n').filter(l => !l.startsWith('#') && l.trim());
    const result = {};
    lines.forEach(line => {
        const match = line.match(/^([a-zA-Z_]+)\{([^}]*)\}\s+([\d.]+)/);
        if (match) {
            const [, name, labels, value] = match;
            if (!result[name]) result[name] = [];
            const labelObj = {};
            labels.split(',').forEach(l => {
                const [k, v] = l.split('=');
                if (k && v) labelObj[k.trim()] = v.replace(/"/g, '').trim();
            });
            result[name].push({ labels: labelObj, value: parseFloat(value) });
        }
    });
    return result;
};

// ── Main Dashboard ────────────────────────────────────────────────────────
const Dashboard = () => {
    const [tab, setTab] = useState('overview');
    const [traces, setTraces] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [liveLog, setLiveLog] = useState(false);
    const [error, setError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const logRef = useRef(null);
    const liveInterval = useRef(null);

    const fetchTraces = useCallback(async () => {
        try {
            const end = Date.now() * 1000;
            const start = end - 3600 * 1000 * 1000;
            const res = await axios.get(`${JAEGER_API}/traces`, {
                params: { service: 'agentgateway', start, end, limit: 50 },
            });
            return res.data?.data || [];
        } catch { return []; }
    }, []);

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await axios.get(GATEWAY_METRICS);
            return parseMetrics(res.data.data);
        } catch { return null; }
    }, []);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [t, m] = await Promise.all([fetchTraces(), fetchMetrics()]);
            setTraces(t);
            setMetrics(m);
            setLastRefresh(new Date());
            // Generate log lines from traces
            const newLogs = t.slice(0, 30).flatMap(trace =>
                (trace.spans || []).map(span => {
                    const ts = new Date(span.startTime / 1000).toISOString();
                    const hasErr = span.tags?.some(tg => tg.key === 'error' && tg.value === true);
                    return `${ts}  ${hasErr ? 'ERROR' : 'INFO '}  mcp::gateway  ${span.operationName}  duration=${(span.duration / 1000).toFixed(1)}ms`;
                })
            );
            setLogs(newLogs);
            if (t.length === 0 && !m) {
                setError('Could not connect to Jaeger or Gateway metrics. Check if the services are running.');
            }
        } catch (e) {
            setError('Error fetching data: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, [fetchTraces, fetchMetrics]);

    useEffect(() => {
        refresh();
        const iv = setInterval(refresh, 30000);
        return () => clearInterval(iv);
    }, [refresh]);

    // Live log simulation
    useEffect(() => {
        if (liveLog) {
            const tools = ['list_products', 'get_product_detail', 'add_product', 'get_store_profit_loss'];
            liveInterval.current = setInterval(() => {
                const tool = tools[Math.floor(Math.random() * tools.length)];
                const ms = Math.floor(Math.random() * 200 + 20);
                const line = `${new Date().toISOString()}  INFO   mcp::gateway  call_tool  name="${tool}"  duration=${ms}ms`;
                setLogs(prev => [line, ...prev].slice(0, 100));
            }, 2000);
        } else {
            clearInterval(liveInterval.current);
        }
        return () => clearInterval(liveInterval.current);
    }, [liveLog]);

    // Statistics
    const toolStats = {};
    traces.forEach(trace => {
        (trace.spans || []).forEach(span => {
            const op = span.operationName;
            if (op) toolStats[op] = (toolStats[op] || 0) + 1;
        });
    });
    const totalCalls = Object.values(toolStats).reduce((a, b) => a + b, 0);
    const errorCount = traces.filter(t =>
        t.spans?.some(s => s.tags?.some(tg => tg.key === 'error' && tg.value === true))
    ).length;
    const avgMs = traces.length > 0
        ? Math.round(traces.reduce((s, t) => s + (t.spans?.[0]?.duration || 0), 0) / traces.length / 1000)
        : 0;
    const gatewayToolCalls = metrics?.['list_calls_total'] || [];

    const TABS = ['overview', 'traces', 'metrics', 'logs'];
    const TAB_LABELS = { overview: '📊 Overview', traces: '🔍 Traces', metrics: '📈 Metrics', logs: '📋 Logs' };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-8 py-5">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tighter">🔭 MCP Observability Dashboard</h1>
                        <p className="text-xs text-gray-400 mt-0.5">AgentGateway • Auto refresh: 30s • Last: {lastRefresh.toLocaleTimeString('en-US', { hour12: false })}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={refresh} disabled={loading}
                            className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {loading ? '⏳' : '🔄'} Refresh
                        </button>
                        <a href="http://localhost:16686" target="_blank" rel="noreferrer"
                            className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors">
                            Jaeger UI ↗
                        </a>
                        <a href="/home"
                            className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors">
                            ← Home
                        </a>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-8 py-6">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-6 text-sm flex items-start gap-2">
                        ⚠️ {error}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
                    {TABS.map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                            {TAB_LABELS[t]}
                        </button>
                    ))}
                </div>

                {/* OVERVIEW */}
                {tab === 'overview' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <MetricCard icon="📡" title="Total Traces" value={loading ? '...' : traces.length} sub="last 1h" accent="blue" />
                            <MetricCard icon="⚡" title="Tool Calls" value={loading ? '...' : totalCalls} sub="total" accent="indigo" />
                            <MetricCard icon="❌" title="Failed Requests" value={loading ? '...' : errorCount} sub="errors" accent="red" />
                            <MetricCard icon="⏱" title="Avg Latency" value={loading ? '...' : `${avgMs}ms`} sub="latency" accent="green" />
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                <h2 className="font-bold text-gray-800 mb-5">📊 Tool Usage Distribution</h2>
                                {loading ? (
                                    <div className="animate-pulse space-y-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-gray-100 rounded-lg" />)}</div>
                                ) : Object.keys(toolStats).length === 0 ? (
                                    <div className="text-center py-8 text-gray-400"><div className="text-3xl mb-2">📭</div><p className="text-sm">No data yet.</p></div>
                                ) : Object.entries(toolStats).sort(([, a], [, b]) => b - a).map(([name, count]) => (
                                    <ToolBar key={name} name={name} count={count} total={totalCalls} />
                                ))}
                            </div>
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                <h2 className="font-bold text-gray-800 mb-5">🕐 Last 5 Operations</h2>
                                {loading ? (
                                    <div className="animate-pulse space-y-3">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}</div>
                                ) : traces.slice(0, 5).map((trace, i) => {
                                    const root = trace.spans?.[0];
                                    const op = root?.operationName || 'unknown';
                                    const ms = root ? (root.duration / 1000).toFixed(1) : '?';
                                    const time = root ? new Date(root.startTime / 1000).toLocaleTimeString('en-US', { hour12: false }) : '';
                                    const err = trace.spans?.some(s => s.tags?.some(t => t.key === 'error' && t.value === true));
                                    return (
                                        <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${err ? 'bg-red-500' : 'bg-green-400'}`} />
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getColor(op, 'badge')}`}>{op}</span>
                                            </div>
                                            <div className="flex gap-3 text-xs text-gray-400"><span>{ms}ms</span><span>{time}</span></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* TRACES */}
                {tab === 'traces' && (
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="font-bold text-gray-800">🔍 All Traces ({traces.length})</h2>
                            <span className="text-xs text-gray-400">Click a row for details</span>
                        </div>
                        {loading ? (
                            <div className="animate-pulse space-y-3">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}</div>
                        ) : traces.length === 0 ? (
                            <div className="text-center py-16 text-gray-400"><div className="text-4xl mb-3">📭</div><p>No traces yet.</p></div>
                        ) : (
                            <div className="max-h-[600px] overflow-y-auto pr-1">
                                {traces.map((trace, i) => <TraceRow key={trace.traceID || i} trace={trace} />)}
                            </div>
                        )}
                    </div>
                )}

                {/* METRICS */}
                {tab === 'metrics' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <h2 className="font-bold text-gray-800 mb-5">📈 Gateway Tool Call Metrics</h2>
                            {!metrics ? (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
                                    ⚠️ Gateway metrics endpoint ({GATEWAY_METRICS}) could not be reached.
                                </div>
                            ) : gatewayToolCalls.length === 0 ? (
                                <p className="text-gray-400 text-sm">list_calls_total metric not found.</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead><tr className="text-left border-b border-gray-100">
                                        <th className="pb-3 font-semibold text-gray-600">Tool</th>
                                        <th className="pb-3 font-semibold text-gray-600">Server</th>
                                        <th className="pb-3 font-semibold text-gray-600 text-right">Calls</th>
                                    </tr></thead>
                                    <tbody>{gatewayToolCalls.map((m, i) => (
                                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                            <td className="py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getColor(m.labels.name, 'badge')}`}>{m.labels.name || '-'}</span></td>
                                            <td className="py-3 text-gray-500 text-xs font-mono">{m.labels.server || '-'}</td>
                                            <td className="py-3 text-right font-bold text-gray-800">{m.value}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            )}
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <h2 className="font-bold text-gray-800 mb-5">📊 Jaeger Source Metrics</h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 mb-4">Tool Call Count</h3>
                                    {Object.entries(toolStats).sort(([, a], [, b]) => b - a).map(([name, count]) => (
                                        <ToolBar key={name} name={name} count={count} total={totalCalls} />
                                    ))}
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 mb-4">Tool Average Duration</h3>
                                    {Object.keys(toolStats).map(toolName => {
                                        const toolTraces = traces.filter(t => t.spans?.[0]?.operationName === toolName);
                                        const avg = toolTraces.length > 0
                                            ? Math.round(toolTraces.reduce((s, t) => s + (t.spans?.[0]?.duration || 0), 0) / toolTraces.length / 1000) : 0;
                                        return (
                                            <div key={toolName} className="flex items-center justify-between py-2 border-b border-gray-50">
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getColor(toolName, 'badge')}`}>{toolName}</span>
                                                <span className="font-bold text-gray-700 text-sm">{avg}ms</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* LOGS */}
                {tab === 'logs' && (
                    <div className="bg-gray-950 rounded-2xl border border-gray-800 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500" /><div className="w-3 h-3 rounded-full bg-yellow-500" /><div className="w-3 h-3 rounded-full bg-green-500" />
                                </div>
                                <span className="text-gray-400 text-xs font-mono">agentgateway — stdout</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setLiveLog(v => !v)}
                                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${liveLog ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${liveLog ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                                    {liveLog ? 'LIVE' : 'Live'}
                                </button>
                                <button onClick={() => setLogs([])} className="text-xs text-gray-500 hover:text-gray-300">Clear</button>
                            </div>
                        </div>
                        <div ref={logRef} className="h-[500px] overflow-y-auto p-4">
                            {logs.length === 0 ? (
                                <div className="text-gray-600 text-xs text-center mt-20">No logs. Turn on "Live" or hit Refresh.</div>
                            ) : logs.map((line, i) => <LogLine key={i} line={line} />)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;