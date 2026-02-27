import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, BookOpen, Target, Clock, Award, BarChart3, Zap, Trophy, Brain } from 'lucide-react';
import { analyticsAPI } from '../api/endpoints';

// ── Circular Progress Ring ─────────────────────────────────────────────────
function ProgressRing({ value, size = 80, strokeWidth = 6, color = '#6366f1' }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(value, 100) / 100) * circumference;

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
                <circle cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke={color} strokeWidth={strokeWidth}
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-800">{Math.round(value)}%</span>
            </div>
        </div>
    );
}

// ── Gradient card colors per subject ──────────────────────────────────────
const GRADIENTS = [
    { border: 'from-violet-500 to-purple-600', bg: 'from-violet-50 to-purple-50', ring: '#8b5cf6', icon: '📐' },
    { border: 'from-blue-500 to-cyan-500', bg: 'from-blue-50 to-cyan-50', ring: '#3b82f6', icon: '⚛️' },
    { border: 'from-emerald-500 to-teal-500', bg: 'from-emerald-50 to-teal-50', ring: '#10b981', icon: '📖' },
    { border: 'from-amber-500 to-orange-500', bg: 'from-amber-50 to-orange-50', ring: '#f59e0b', icon: '🧪' },
    { border: 'from-rose-500 to-pink-500', bg: 'from-rose-50 to-pink-50', ring: '#f43f5e', icon: '🎨' },
];

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
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
                <p className="text-gray-500 mt-3">Loading analytics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl">⚠️ {error}</div>
            </div>
        );
    }

    const subjects = data?.subjects || [];
    const timeline = data?.timeline || [];
    const totalMinutes = data?.total_study_minutes || 0;
    const totalQuestions = data?.total_questions_asked || 0;
    const totalTests = data?.total_tests_taken || 0;

    const studyHours = Math.floor(totalMinutes / 60);
    const studyMins = Math.round(totalMinutes % 60);

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* ── Header ── */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="w-7 h-7 text-indigo-500" />
                    Performance Analytics
                </h2>
                <p className="text-gray-500 mt-1">Track your study performance and progress across subjects.</p>
            </div>

            {subjects.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <Target className="w-16 h-16 mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-medium">No analytics data yet</p>
                    <p className="text-sm mt-1">Start asking questions and taking tests to build your analytics</p>
                </div>
            ) : (
                <>
                    {/* ══ Overall Stats Banner ══ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Study Hours */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-5 text-white shadow-lg shadow-indigo-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-indigo-100 text-sm font-medium">Total Study Time</p>
                                    <p className="text-3xl font-bold mt-1">
                                        {studyHours > 0 ? `${studyHours}h ` : ''}{studyMins}m
                                    </p>
                                    <p className="text-indigo-200 text-xs mt-1">Estimated from activity</p>
                                </div>
                                <div className="bg-white/20 rounded-xl p-3">
                                    <Clock className="w-7 h-7" />
                                </div>
                            </div>
                            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full"></div>
                        </div>

                        {/* Questions Asked */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 p-5 text-white shadow-lg shadow-blue-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-sm font-medium">Questions Asked</p>
                                    <p className="text-3xl font-bold mt-1">{totalQuestions}</p>
                                    <p className="text-blue-200 text-xs mt-1">Across all subjects</p>
                                </div>
                                <div className="bg-white/20 rounded-xl p-3">
                                    <Brain className="w-7 h-7" />
                                </div>
                            </div>
                            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full"></div>
                        </div>

                        {/* Tests Taken */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 p-5 text-white shadow-lg shadow-emerald-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-emerald-100 text-sm font-medium">Tests Taken</p>
                                    <p className="text-3xl font-bold mt-1">{totalTests}</p>
                                    <p className="text-emerald-200 text-xs mt-1">Study mode quizzes</p>
                                </div>
                                <div className="bg-white/20 rounded-xl p-3">
                                    <Trophy className="w-7 h-7" />
                                </div>
                            </div>
                            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full"></div>
                        </div>
                    </div>

                    {/* ══ Per-Subject Cards ══ */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-indigo-500" />
                            Subject Performance
                        </h3>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {subjects.map((s, i) => {
                                const g = GRADIENTS[i % GRADIENTS.length];
                                return (
                                    <div key={i}
                                        className={`relative rounded-2xl border border-gray-100 bg-gradient-to-br ${g.bg} p-5 shadow-sm hover:shadow-md transition-all duration-300`}>

                                        {/* Top accent bar */}
                                        <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${g.border}`}></div>

                                        <div className="flex items-start gap-4">
                                            {/* Progress Ring */}
                                            <ProgressRing
                                                value={s.accuracy}
                                                color={g.ring}
                                                size={80}
                                                strokeWidth={7}
                                            />

                                            {/* Subject Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xl">{g.icon}</span>
                                                    <h4 className="text-lg font-bold text-gray-900 capitalize truncate">{s.subject}</h4>
                                                </div>

                                                {/* Stats Grid */}
                                                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                                    <div className="flex items-center gap-1.5">
                                                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                                                        <span className="text-gray-500">Questions:</span>
                                                        <span className="font-semibold text-gray-800">{s.questions_attempted}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Target className="w-3.5 h-3.5 text-blue-500" />
                                                        <span className="text-gray-500">Tests:</span>
                                                        <span className="font-semibold text-gray-800">{s.tests_taken}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Trophy className="w-3.5 h-3.5 text-emerald-500" />
                                                        <span className="text-gray-500">Best:</span>
                                                        <span className="font-semibold text-gray-800">{s.best_score}%</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Award className="w-3.5 h-3.5 text-purple-500" />
                                                        <span className="text-gray-500">Latest:</span>
                                                        <span className="font-semibold text-gray-800">{s.latest_score}%</span>
                                                    </div>
                                                </div>

                                                {/* Confidence bar */}
                                                <div className="mt-3">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-gray-500">Avg Confidence</span>
                                                        <span className="font-semibold text-gray-700">{(s.average_confidence * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <div className="w-full bg-white/70 rounded-full h-2">
                                                        <div
                                                            className={`h-2 rounded-full bg-gradient-to-r ${g.border} transition-all duration-700`}
                                                            style={{ width: `${Math.min(s.average_confidence * 100, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                {/* Study time */}
                                                <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                                                    <Clock className="w-3 h-3" />
                                                    <span>~{s.study_minutes >= 60 ? `${Math.floor(s.study_minutes / 60)}h ${Math.round(s.study_minutes % 60)}m` : `${Math.round(s.study_minutes)}m`} studied</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ══ Activity Timeline ══ */}
                    {timeline.length > 0 && (
                        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-500" />
                                Activity Timeline
                            </h3>
                            <div className="space-y-3">
                                {timeline.slice(-10).map((t, i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <span className="text-sm text-gray-500 w-24 flex-shrink-0 font-mono">{t.date}</span>
                                        <div className="flex-1 bg-gray-100 rounded-full h-3.5 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 transition-all duration-700"
                                                style={{ width: `${Math.min(t.accuracy, 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-sm font-bold text-gray-700 w-14 text-right">{t.accuracy.toFixed(0)}%</span>
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
