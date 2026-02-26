import React, { useState } from 'react';
import { ArrowLeft, Send, Loader2, FileText, BookOpen, AlertTriangle, CheckCircle } from 'lucide-react';
import { queryAPI } from '../api/endpoints';

function ConfidenceBadge({ level }) {
    const colors = {
        High: 'bg-green-100 text-green-800 border-green-200',
        Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        Low: 'bg-orange-100 text-orange-800 border-orange-200',
        'Not Found': 'bg-red-100 text-red-800 border-red-200',
    };
    return (
        <span className={`badge border ${colors[level] || colors.Low}`}>
            {level === 'High' && <CheckCircle className="w-3.5 h-3.5 mr-1" />}
            {level === 'Not Found' && <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
            {level}
        </span>
    );
}

export default function QueryPage({ subject, onBack }) {
    const [question, setQuestion] = useState('');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);

    const handleAsk = async () => {
        if (!question.trim()) return;
        const q = question.trim();
        setQuestion('');
        setLoading(true);
        try {
            const result = await queryAPI.ask(subject.id, q);
            setHistory(prev => [{ question: q, ...result }, ...prev]);
        } catch (e) {
            setHistory(prev => [{
                question: q,
                answer: e.response?.data?.detail || 'Request failed',
                confidence: 'Not Found',
                citations: [],
                evidence: [],
            }, ...prev]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center space-x-3 mb-6">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow">
                    📖
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{subject.name}</h2>
                    <p className="text-sm text-gray-500">Ask questions about your uploaded notes</p>
                </div>
            </div>

            {/* Question Input */}
            <div className="card mb-6">
                <div className="flex space-x-3">
                    <input
                        type="text"
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        placeholder="Ask a question about your notes..."
                        className="input flex-1"
                        onKeyDown={e => e.key === 'Enter' && !loading && handleAsk()}
                        disabled={loading}
                    />
                    <button
                        onClick={handleAsk}
                        disabled={loading || !question.trim()}
                        className="btn-primary flex items-center space-x-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>Ask</span>
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="card mb-4 animate-pulse">
                    <div className="flex items-center space-x-3 text-blue-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-medium">Searching your notes...</span>
                    </div>
                </div>
            )}

            {/* Answer History */}
            {history.length === 0 && !loading && (
                <div className="text-center py-16 text-gray-400">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-40" />
                    <p className="text-lg">Ask your first question</p>
                    <p className="text-sm">Answers will be grounded in your uploaded notes</p>
                </div>
            )}

            {history.map((item, idx) => (
                <div key={idx} className="card mb-4">
                    {/* Question */}
                    <div className="flex items-start space-x-3 mb-3">
                        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0 mt-0.5">Q</div>
                        <p className="text-gray-900 font-medium">{item.question}</p>
                    </div>

                    {/* Answer */}
                    <div className="flex items-start space-x-3 mb-3">
                        <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-xs flex-shrink-0 mt-0.5">A</div>
                        <div className="flex-1">
                            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{item.answer}</p>
                            <div className="mt-2">
                                <ConfidenceBadge level={item.confidence} />
                            </div>
                        </div>
                    </div>

                    {/* Citations */}
                    {item.citations && item.citations.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">📎 Citations</p>
                            <div className="flex flex-wrap gap-2">
                                {item.citations.map((c, i) => (
                                    <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 text-xs text-gray-600">
                                        <FileText className="w-3 h-3 mr-1" />
                                        {c.file}{c.page ? ` • p.${c.page}` : ''}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Evidence */}
                    {item.evidence && item.evidence.length > 0 && item.confidence !== 'Not Found' && (
                        <details className="mt-3 pt-3 border-t border-gray-100">
                            <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">
                                🔍 Evidence snippets ({item.evidence.length})
                            </summary>
                            <div className="mt-2 space-y-2">
                                {item.evidence.map((e, i) => (
                                    <div key={i} className="bg-blue-50 border-l-3 border-blue-400 p-3 rounded-r text-sm text-gray-700 italic">
                                        "{e.slice(0, 300)}{e.length > 300 ? '...' : ''}"
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </div>
            ))}
        </div>
    );
}
