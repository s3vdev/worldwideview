"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";
import { CameraStream } from "@/components/video/CameraStream";
import type { GdotCameraFeature } from "@/app/api/camera/gdot/gdotFetcher";

interface TestResult {
    feature: GdotCameraFeature;
    status: "pending" | "testing" | "ok" | "error" | "timeout";
    httpStatus?: number | string;
    contentType?: string | null;
    latencyMs?: number;
    errorMsg?: string;
    testStartTime?: number;
}

const LiveTimer = ({ start }: { start: number }) => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(interval);
    }, []);
    return <span>{(Math.max(0, now - start) / 1000).toFixed(1)}s</span>;
};

export default function CameraTestPage() {
    const [cameras, setCameras] = useState<TestResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [filterSources, setFilterSources] = useState<string[]>(["all"]);
    const [filterStatuses, setFilterStatuses] = useState<string[]>(["all"]);

    // New independent state for test targets
    const [testSources, setTestSources] = useState<string[]>(["all"]);
    const [testStatuses, setTestStatuses] = useState<string[]>(["all"]);

    const [previewId, setPreviewId] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        fetchCameras();
    }, []);

    const fetchCameras = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/camera/traffic");
            const data = await res.json();

            let staticFeatures: any[] = [];
            try {
                const staticRes = await fetch("/public-cameras.json");
                if (staticRes.ok) {
                    const staticData = await staticRes.json();
                    if (staticData.features) {
                        staticFeatures = staticData.features.map((f: any) => ({
                            ...f,
                            properties: {
                                ...f.properties,
                                name: f.properties.city || f.properties.region || "Public Camera",
                                source: f.properties.source || "cameras_json"
                            }
                        }));
                    }
                }
            } catch (staticErr) {
                console.error("Failed to fetch static cameras:", staticErr);
            }

            let combinedFeatures: any[] = [];
            if (data.cameras) {
                combinedFeatures = [...data.cameras];
            }
            combinedFeatures = [...combinedFeatures, ...staticFeatures];

            setCameras(combinedFeatures.map((c: any) => ({
                feature: c,
                status: "pending"
            })));
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const runTests = async () => {
        if (testing) return;
        setTesting(true);

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const maxConcurrent = 20;
        let index = 0;
        let active = 0;

        const itemsToTest = cameras
            .map((c, originalIndex) => ({ c, originalIndex }))
            .filter(({ c }) => {
                const sourceMatches = testSources.includes("all") || testSources.includes(c.feature.properties.source || "Unknown");
                const statusMatches = testStatuses.includes("all") || testStatuses.includes(c.status);
                return sourceMatches && statusMatches;
            });

        setCameras(prev => {
            const nextState = [...prev];
            for (const { originalIndex } of itemsToTest) {
                nextState[originalIndex] = { ...nextState[originalIndex], status: "pending" as const, testStartTime: undefined, latencyMs: undefined, errorMsg: undefined, httpStatus: undefined, contentType: undefined };
            }
            return nextState;
        });

        await new Promise<void>((resolve) => {
            const next = () => {
                if (signal.aborted) {
                    resolve();
                    return;
                }
                while (active < maxConcurrent && index < itemsToTest.length) {
                    const item = itemsToTest[index++];
                    const currentIndex = item.originalIndex;
                    active++;

                    const cam = item.c;
                    let streamUrl = cam.feature.properties.stream;

                    if (!streamUrl) {
                        setCameras(prev => {
                            const nextState = [...prev];
                            nextState[currentIndex] = {
                                ...nextState[currentIndex],
                                status: "error",
                                errorMsg: "No stream URL provided"
                            };
                            return nextState;
                        });
                        active--;
                        next();
                        continue;
                    }

                    // For HLS streams, some might be blocked by CORS normally, but server API bypasses browser CORS.
                    setCameras(prev => {
                        const nextState = [...prev];
                        nextState[currentIndex] = { ...nextState[currentIndex], status: "testing", testStartTime: Date.now() };
                        return nextState;
                    });

                    fetch(`/api/camera/test?url=${encodeURIComponent(streamUrl)}`, { signal })
                        .then(res => res.json())
                        .then(data => {
                            setCameras(prev => {
                                const nextState = [...prev];
                                const isOk = data.status === 200 || data.status === 204 || data.status === 206;
                                nextState[currentIndex] = {
                                    ...nextState[currentIndex],
                                    status: isOk ? "ok" : (data.status === "timeout" ? "timeout" : "error"),
                                    httpStatus: data.status,
                                    contentType: data.contentType,
                                    latencyMs: data.latencyMs,
                                    errorMsg: data.error
                                };
                                return nextState;
                            });
                        })
                        .catch(err => {
                            if (err.name === 'AbortError') return;
                            setCameras(prev => {
                                const nextState = [...prev];
                                nextState[currentIndex] = {
                                    ...nextState[currentIndex],
                                    status: "error",
                                    errorMsg: err.message
                                };
                                return nextState;
                            });
                        })
                        .finally(() => {
                            active--;
                            next();
                        });
                }

                if (active === 0 && index >= itemsToTest.length) {
                    resolve();
                }
            };
            next();
        });

        setTesting(false);
    };

    const stopTests = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setTesting(false);
        }
    };

    const retestCamera = async (globalIndex: number) => {
        const cam = cameras[globalIndex];
        const streamUrl = cam.feature.properties.stream;
        if (!streamUrl) return;

        setCameras(prev => {
            const nextState = [...prev];
            nextState[globalIndex] = { ...nextState[globalIndex], status: "testing", testStartTime: Date.now(), latencyMs: undefined, errorMsg: undefined, httpStatus: undefined, contentType: undefined };
            return nextState;
        });

        try {
            const res = await fetch(`/api/camera/test?url=${encodeURIComponent(streamUrl)}`);
            const data = await res.json();
            setCameras(prev => {
                const nextState = [...prev];
                const isOk = data.status === 200 || data.status === 204 || data.status === 206;
                nextState[globalIndex] = {
                    ...nextState[globalIndex],
                    status: isOk ? "ok" : (data.status === "timeout" ? "timeout" : "error"),
                    httpStatus: data.status,
                    contentType: data.contentType,
                    latencyMs: data.latencyMs,
                    errorMsg: data.error
                };
                return nextState;
            });
        } catch (err: any) {
            setCameras(prev => {
                const nextState = [...prev];
                nextState[globalIndex] = {
                    ...nextState[globalIndex],
                    status: "error",
                    errorMsg: err.message
                };
                return nextState;
            });
        }
    };

    const filtered = cameras.filter(c => {
        const sourceMatches = filterSources.includes("all") || filterSources.includes(c.feature.properties.source || "Unknown");
        const statusMatches = filterStatuses.includes("all") || filterStatuses.includes(c.status);
        return sourceMatches && statusMatches;
    });

    const handleMultiSelect = (e: React.ChangeEvent<HTMLSelectElement>, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
        const selected = Array.from(e.target.selectedOptions, o => o.value);
        if (selected.length === 0) setter(["all"]);
        // If they click 'all' while others are selected, and they explicitly clicked it, 
        // we'll just allow it. The filter logic says "if includes 'all', match everything".
        else setter(selected);
    };

    const stats = {
        total: cameras.length,
        ok: cameras.filter(c => c.status === "ok").length,
        error: cameras.filter(c => c.status === "error").length,
        timeout: cameras.filter(c => c.status === "timeout").length,
        pending: cameras.filter(c => c.status === "pending").length,
        testing: cameras.filter(c => c.status === "testing").length
    };

    const dStats = {
        total: filtered.length,
        ok: filtered.filter(c => c.status === "ok").length,
        error: filtered.filter(c => c.status === "error").length,
        timeout: filtered.filter(c => c.status === "timeout").length,
        pending: filtered.filter(c => c.status === "pending").length,
        testing: filtered.filter(c => c.status === "testing").length
    };

    const sources = Array.from(new Set(cameras.map(c => c.feature.properties.source || "Unknown"))).sort();

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Camera Stream Diagnostics</h1>
                <p>Run parallel checks on all traffic camera streams to detect compatibility and offline issues.</p>
            </div>

            <div className={styles.stats}>
                <div className={styles.statCard}><h3>Total Cameras</h3><p>{stats.total} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({dStats.total} shown)</span></p></div>
                <div className={styles.statCard}><h3>Responsive (OK)</h3><p className={styles.badgeOk} style={{ background: 'none', padding: 0, border: 'none' }}>{stats.ok} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({dStats.ok} shown)</span></p></div>
                <div className={styles.statCard}><h3>Errors / Blocked</h3><p className={styles.badgeError} style={{ background: 'none', padding: 0, border: 'none' }}>{stats.error} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({dStats.error} shown)</span></p></div>
                <div className={styles.statCard}><h3>Timeouts</h3><p className={styles.badgeWarn} style={{ background: 'none', padding: 0, border: 'none' }}>{stats.timeout} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({dStats.timeout} shown)</span></p></div>
                <div className={styles.statCard}><h3>Pending</h3><p className={stats.testing > 0 ? styles.badgeTesting : ''} style={{ background: 'none', padding: 0, border: 'none', color: stats.testing > 0 ? '#60a5fa' : 'inherit' }}>{stats.pending + stats.testing} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({dStats.pending + dStats.testing} shown)</span></p></div>
            </div>

            <div className={styles.controls} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>Target Tests:</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Hold Ctrl/Cmd to select multiple</span>
                </div>

                <select multiple className={styles.select} style={{ height: '120px' }} value={testSources} onChange={e => handleMultiSelect(e, setTestSources)} disabled={testing}>
                    <option value="all">🌍 All Sources</option>
                    {sources.map(src => (
                        <option key={src as string} value={src as string}>
                            {String(src).toUpperCase()}
                        </option>
                    ))}
                </select>

                <select multiple className={styles.select} style={{ height: '120px' }} value={testStatuses} onChange={e => handleMultiSelect(e, setTestStatuses)} disabled={testing}>
                    <option value="all">🔍 All Statuses</option>
                    <option value="ok">✅ OK</option>
                    <option value="error">❌ Error</option>
                    <option value="timeout">⏱️ Timeout</option>
                    <option value="pending">⏳ Pending</option>
                </select>

                {loading ? (
                    <button className={styles.button} disabled>
                        <span>Loading Cameras...</span>
                    </button>
                ) : testing ? (
                    <button className={styles.button} onClick={stopTests} style={{ background: '#ef4444' }}>
                        🛑 Stop Tests
                    </button>
                ) : (
                    <button className={styles.button} onClick={runTests} disabled={cameras.length === 0}>
                        ▶ Run Tests
                    </button>
                )}
            </div>

            <div className={styles.controls} style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>Display View:</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Hold Ctrl/Cmd to select multiple</span>
                </div>

                <select multiple className={styles.select} style={{ height: '140px' }} value={filterSources} onChange={e => handleMultiSelect(e, setFilterSources)}>
                    <option value="all">🌍 Show All Sources</option>
                    {sources.map(src => (
                        <option key={src as string} value={src as string}>
                            {String(src).toUpperCase()}
                        </option>
                    ))}
                </select>

                <select multiple className={styles.select} style={{ height: '140px' }} value={filterStatuses} onChange={e => handleMultiSelect(e, setFilterStatuses)}>
                    <option value="all">🔍 Show All Statuses</option>
                    <option value="ok">✅ OK</option>
                    <option value="error">❌ Error</option>
                    <option value="timeout">⏱️ Timeout</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="testing">🔄 Testing</option>
                </select>

                <button className={styles.button} style={{ background: 'rgba(255,255,255,0.1)', marginLeft: 'auto' }} onClick={() => {
                    const exportData = cameras.map(c => ({
                        id: c.feature.properties.name,
                        source: c.feature.properties.source,
                        url: c.feature.properties.stream,
                        status: c.status,
                        httpCode: c.httpStatus,
                        contentType: c.contentType,
                        error: c.errorMsg
                    }));
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `camera-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                }}>
                    ⬇ Export Report
                </button>
            </div>

            <div className={styles.grid}>
                {filtered.map((c, i) => {
                    const { feature, status, httpStatus, contentType, latencyMs, errorMsg } = c;
                    const { stream, name, source, region } = feature.properties;
                    const id = stream + i;

                    let statusClass = styles.badge;
                    if (status === "ok") statusClass += ` ${styles.badgeOk}`;
                    else if (status === "error") statusClass += ` ${styles.badgeError}`;
                    else if (status === "timeout") statusClass += ` ${styles.badgeWarn}`;
                    else if (status === "testing") statusClass += ` ${styles.badgeTesting}`;

                    return (
                        <div key={id} className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3 className={styles.title} title={name}>{name || "Unknown Camera"}</h3>
                                <span className={styles.badge}>{source}</span>
                            </div>

                            <div className={styles.badges}>
                                <span className={statusClass}>
                                    {status === "testing" ? (
                                        <>Testing... <LiveTimer start={c.testStartTime || Date.now()} /></>
                                    ) : (
                                        status.toUpperCase()
                                    )}
                                    {httpStatus && ` (${httpStatus})`}
                                </span>
                                {latencyMs !== undefined && <span className={styles.badge}>{latencyMs}ms</span>}
                                {contentType && <span className={styles.badge}>{contentType.split(';')[0]}</span>}
                            </div>

                            <div className={styles.url}>
                                {stream || "No stream URL"}
                            </div>

                            {errorMsg && <div className={styles.errorMsg}>{errorMsg}</div>}

                            <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className={styles.button}
                                    style={{
                                        padding: '0.4rem 0.8rem',
                                        fontSize: '0.8rem',
                                        flex: 1,
                                        justifyContent: 'center',
                                        background: 'rgba(255,255,255,0.1)'
                                    }}
                                    onClick={() => retestCamera(cameras.indexOf(c))}
                                >
                                    🔄 Retest
                                </button>
                                <button
                                    className={styles.button}
                                    style={{
                                        padding: '0.4rem 0.8rem',
                                        fontSize: '0.8rem',
                                        flex: 2,
                                        justifyContent: 'center',
                                        background: previewId === id ? 'rgba(255,255,255,0.15)' : '#334155'
                                    }}
                                    onClick={() => setPreviewId(previewId === id ? null : id)}
                                    disabled={!stream}
                                >
                                    {previewId === id ? "Close Preview" : "Live Preview"}
                                </button>
                            </div>

                            {previewId === id && stream && (
                                <div className={styles.preview}>
                                    <CameraStream
                                        streamUrl={stream}
                                        label={name}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
