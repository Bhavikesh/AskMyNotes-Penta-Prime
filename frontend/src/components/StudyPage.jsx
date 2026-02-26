import React, { useState } from 'react';
import { ArrowLeft, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { studyAPI, subjectsAPI } from '../api/endpoints';

export default function StudyPage() {
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [result, setResult] = useState(null);
    const [userAnswers, setUserAnswers] = useState({});
    const [saqAnswers, setSaqAnswers] = useState({});
    const [showResults, setShowResults] = useState(false);
    const [saqEvaluation, setSaqEvaluation] = useState(null);
    const [evaluating, setEvaluating] = useState(false);

    React.useEffect(() => {
        (async () => {
            try {
                const data = await subjectsAPI.list();
                setSubjects(data.subjects || []);
            } catch (e) { }
            setLoadingSubjects(false);
        })();
    }, []);

    const handleGenerate = async (subj) => {
        setSelectedSubject(subj);
        setLoading(true);
        setResult(null);
        setUserAnswers({});
        setSaqAnswers({});
        setShowResults(false);
        setSaqEvaluation(null);
        try {
            const data = await studyAPI.generate(subj.id);
            setResult(data);
        } catch (e) {
            alert(e.response?.data?.detail || 'Failed to generate questions');
        } finally {
            setLoading(false);
        }
    };

    const handleMCQSelect = (qIdx, option) => {
        if (showResults) return;
        setUserAnswers(prev => ({ ...prev, [`mcq_${qIdx}`]: option }));
    };

    const handleSaqChange = (idx, value) => {
        setSaqAnswers(prev => ({ ...prev, [`saq_${idx}`]: value }));
    };

    const calculateMCQScore = () => {
        if (!result) return { correct: 0, total: 0 };
        let correct = 0;
        const total = (result.mcqs || []).length;
        result.mcqs.forEach((q, i) => {
            if (userAnswers[`mcq_${i}`] === q.correct_answer) correct++;
        });
        return { correct, total };
    };

    const handleCheckAnswers = async () => {
        setShowResults(true);

        // Evaluate SAQs via backend
        const saqs = result?.short_answers || [];
        const answeredSaqs = saqs
            .map((q, i) => ({
                question: q.question,
                correct_answer: q.answer,
                user_answer: saqAnswers[`saq_${i}`] || '',
            }))
            .filter(a => a.user_answer.trim() !== '');

        if (answeredSaqs.length > 0) {
            setEvaluating(true);
            try {
                const evalResult = await studyAPI.evaluate(selectedSubject.id, answeredSaqs);
                setSaqEvaluation(evalResult);
            } catch (e) {
                console.error('SAQ evaluation failed:', e);
            } finally {
                setEvaluating(false);
            }
        }
    };

    const getVerdictStyle = (verdict) => {
        switch (verdict) {
            case 'Correct': return 'bg-green-50 border-green-300 text-green-800';
            case 'Partially Correct': return 'bg-yellow-50 border-yellow-300 text-yellow-800';
            default: return 'bg-red-50 border-red-300 text-red-800';
        }
    };

    const getVerdictIcon = (verdict) => {
        switch (verdict) {
            case 'Correct': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'Partially Correct': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
            default: return <XCircle className="w-5 h-5 text-red-500" />;
        }
    };

    // Subject selection
    if (!selectedSubject) {
        return (
            <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">🧠 Study Mode</h2>
                <p className="text-gray-500 mb-6">Select a subject to generate MCQs and short answer questions from your notes.</p>

                {loadingSubjects ? (
                    <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
                ) : subjects.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <p>No subjects yet. Create subjects and upload documents first.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {subjects.map(s => (
                            <button key={s.id} onClick={() => handleGenerate(s)}
                                className="card text-left hover:shadow-md transition-shadow flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-xl shadow">🧠</div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{s.name}</h3>
                                    <p className="text-sm text-gray-500">{s.document_count || 0} documents</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-3 mb-6">
                <button onClick={() => { setSelectedSubject(null); setResult(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-xl font-bold text-gray-900">🧠 Study: {selectedSubject.name}</h2>
            </div>

            {loading && (
                <div className="text-center py-16">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-purple-500 mb-4" />
                    <p className="text-gray-600 font-medium">Generating study questions from your notes...</p>
                    <p className="text-sm text-gray-400 mt-1">This may take 10-15 seconds</p>
                </div>
            )}

            {result && (
                <div>
                    {/* MCQs */}
                    {result.mcqs && result.mcqs.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Multiple Choice Questions</h3>
                            {result.mcqs.map((q, idx) => (
                                <div key={idx} className="card mb-4">
                                    <p className="font-medium text-gray-900 mb-3">Q{idx + 1}. {q.question}</p>
                                    <div className="space-y-2">
                                        {['A', 'B', 'C', 'D'].map(opt => {
                                            const selected = userAnswers[`mcq_${idx}`] === opt;
                                            const isCorrect = q.correct_answer === opt;
                                            let borderColor = 'border-gray-200 hover:border-blue-300';
                                            if (showResults) {
                                                if (isCorrect) borderColor = 'border-green-500 bg-green-50';
                                                else if (selected && !isCorrect) borderColor = 'border-red-400 bg-red-50';
                                            } else if (selected) {
                                                borderColor = 'border-blue-500 bg-blue-50';
                                            }
                                            return (
                                                <button key={opt} onClick={() => handleMCQSelect(idx, opt)}
                                                    className={`w-full flex items-center space-x-3 p-3 rounded-lg border-2 text-left transition-colors ${borderColor}`}>
                                                    <span className="w-7 h-7 rounded-full border-2 border-gray-300 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                                        {opt}
                                                    </span>
                                                    <span className="text-sm text-gray-700">{q.options[opt]}</span>
                                                    {showResults && isCorrect && <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />}
                                                    {showResults && selected && !isCorrect && <XCircle className="w-5 h-5 text-red-400 ml-auto" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {showResults && q.evidence && q.evidence.length > 0 && (
                                        <div className="mt-3 bg-blue-50 p-3 rounded-lg text-xs text-gray-600 italic">
                                            📎 {q.evidence[0].slice(0, 200)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* SAQs */}
                    {result.short_answers && result.short_answers.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Short Answer Questions</h3>
                            {result.short_answers.map((q, idx) => {
                                const evalItem = saqEvaluation?.results?.find(r => r.question === q.question);
                                return (
                                    <div key={idx} className="card mb-4">
                                        <p className="font-medium text-gray-900 mb-3">Q{idx + 1}. {q.question}</p>

                                        {/* Answer input */}
                                        <textarea
                                            value={saqAnswers[`saq_${idx}`] || ''}
                                            onChange={e => handleSaqChange(idx, e.target.value)}
                                            placeholder="Type your answer here..."
                                            className="input min-h-[80px] resize-y mb-3"
                                            disabled={showResults}
                                            rows={3}
                                        />

                                        {/* Evaluation result */}
                                        {showResults && evalItem && (
                                            <div className={`border-2 rounded-lg p-4 mb-3 ${getVerdictStyle(evalItem.verdict)}`}>
                                                <div className="flex items-center space-x-2 mb-2">
                                                    {getVerdictIcon(evalItem.verdict)}
                                                    <span className="font-semibold">{evalItem.verdict}</span>
                                                    <span className="text-sm opacity-75">({evalItem.score}/1.0)</span>
                                                </div>
                                                {evalItem.feedback && (
                                                    <p className="text-sm mb-2">💬 {evalItem.feedback}</p>
                                                )}
                                                <div className="bg-white/60 p-2 rounded text-sm">
                                                    <span className="font-semibold text-gray-600">Correct answer: </span>
                                                    {evalItem.correct_answer}
                                                </div>
                                            </div>
                                        )}

                                        {/* Show answer if no user input */}
                                        {showResults && !evalItem && (
                                            <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                                                <p className="text-sm text-gray-500 italic mb-1">You didn't answer this question.</p>
                                                <p className="text-sm"><span className="font-semibold">Answer:</span> {q.answer}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Submit / Score */}
                    {!showResults ? (
                        <button onClick={handleCheckAnswers} className="btn-primary w-full py-3 text-lg">
                            ✅ Check My Answers
                        </button>
                    ) : (
                        <div className="card bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 text-center">
                            {evaluating ? (
                                <div className="flex items-center justify-center space-x-2 text-purple-600">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Evaluating your short answers...</span>
                                </div>
                            ) : (
                                <>
                                    {/* MCQ Score */}
                                    <h3 className="text-xl font-bold text-purple-800 mb-1">
                                        MCQ Score: {calculateMCQScore().correct} / {calculateMCQScore().total}
                                    </h3>

                                    {/* SAQ Score */}
                                    {saqEvaluation && (
                                        <h3 className="text-xl font-bold text-indigo-800 mb-1">
                                            SAQ Score: {saqEvaluation.total_score} / {saqEvaluation.max_score}
                                        </h3>
                                    )}

                                    {/* Combined */}
                                    {saqEvaluation && (
                                        <p className="text-lg text-purple-600 mt-2">
                                            Total: {calculateMCQScore().correct + saqEvaluation.total_score} / {calculateMCQScore().total + saqEvaluation.max_score}
                                            {' — '}
                                            {(() => {
                                                const pct = ((calculateMCQScore().correct + saqEvaluation.total_score) / (calculateMCQScore().total + saqEvaluation.max_score) * 100).toFixed(0);
                                                return pct >= 80 ? '🎉 Excellent!' : pct >= 50 ? '👍 Good job!' : '📚 Keep studying!';
                                            })()}
                                        </p>
                                    )}

                                    <button onClick={() => handleGenerate(selectedSubject)} className="btn-primary mt-4">
                                        🔄 Generate New Questions
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
