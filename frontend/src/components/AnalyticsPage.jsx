import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, BookOpen, Target } from 'lucide-react';
import { analyticsAPI } from '../api/endpoints';

export default function AnalyticsPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const res = await analyticsAPI.getPerformance();
                setData(res);
            } catch (e) {
                setError(e.response?.data?.detail || 'Failed to load analytics');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return (
            <div className="text-center py-16">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                <p className="text-gray-500 mt-2">Loading analytics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="card bg-red-50 border-red-200 text-red-700">⚠️ {error}</div>
            </div>
        );
    }

    const subjects = data?.subjects || [];
    const timeline = data?.timeline || [];

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">📊 Performance Analytics</h2>
            <p className="text-gray-500 mb-6">Track your study performance across subjects.</p>

            {subjects.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <Target className="w-16 h-16 mx-auto mb-4 opacity-40" />
                    <p className="text-lg">No analytics data yet</p>
                    <p className="text-sm">Start asking questions and using study mode to build your analytics</p>
                </div>
            ) : (
                <>
                    {/* Subject Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                        {subjects.map((s, i) => (
                            <div key={i} className="card">
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center text-white text-lg shadow">
                                        📖
                                    </div>
                                    <h3 className="font-semibold text-gray-900">{s.subject}</h3>
                                </div>

                                <div className="space-y-3">
                                    {/* Accuracy */}
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-500">Accuracy</span>
                                            <span className="font-semibold text-gray-800">{s.accuracy}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                                            <div
                                                className="h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                                                style={{ width: `${Math.min(s.accuracy, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex justify-between text-sm">
                                        <div className="text-center">
                                            <p className="text-gray-400 text-xs">Questions</p>
                                            <p className="font-bold text-gray-800">{s.questions_attempted}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-gray-400 text-xs">Confidence</p>
                                            <p className="font-bold text-gray-800">{(s.average_confidence * 100).toFixed(0)}%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Timeline */}
                    {timeline.length > 0 && (
                        <div className="card">
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                                <TrendingUp className="w-5 h-5 text-blue-500" />
                                <span>Accuracy Timeline</span>
                            </h3>
                            <div className="space-y-2">
                                {timeline.map((t, i) => (
                                    <div key={i} className="flex items-center space-x-4">
                                        <span className="text-sm text-gray-500 w-24 flex-shrink-0">{t.date}</span>
                                        <div className="flex-1 bg-gray-100 rounded-full h-3">
                                            <div
                                                className="h-3 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500"
                                                style={{ width: `${Math.min(t.accuracy, 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 w-12 text-right">{t.accuracy.toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
