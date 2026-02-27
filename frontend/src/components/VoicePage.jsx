import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Mic, MicOff, Volume2, VolumeX,
    Send, Loader2, FileText, CheckCircle, AlertTriangle,
    RefreshCw
} from 'lucide-react';
import { voiceAPI, subjectsAPI } from '../api/endpoints';

// ── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ level }) {
    const map = {
        High: 'bg-green-100 text-green-800',
        Medium: 'bg-yellow-100 text-yellow-800',
        Low: 'bg-orange-100 text-orange-800',
        'Not Found': 'bg-red-100 text-red-800',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[level] || 'bg-gray-100 text-gray-500'}`}>
            {level === 'High' && <CheckCircle className="w-3 h-3 mr-1" />}
            {level === 'Not Found' && <AlertTriangle className="w-3 h-3 mr-1" />}
            {level}
        </span>
    );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, onReplay }) {
    if (msg.role === 'user') {
        return (
            <div className="flex justify-end">
                <div className="max-w-[78%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-sm">
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-start">
            <div className="max-w-[82%] bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                {/* Answer */}
                <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{msg.answer}</p>

                {/* Follow-up question — distinct highlight */}
                {msg.followUp && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-xs font-semibold text-blue-600 mb-1">📚 Teacher's Question</p>
                        <p className="text-sm text-blue-800 font-medium">{msg.followUp}</p>
                    </div>
                )}

                {/* Meta row */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    {msg.confidence && <ConfidenceBadge level={msg.confidence} />}
                    {msg.citations?.length > 0 && msg.citations.map((c, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-50 text-xs text-gray-400">
                            <FileText className="w-3 h-3 mr-1" />
                            {c.file}{c.page ? ` p.${c.page}` : ''}
                        </span>
                    ))}
                    <button
                        onClick={() => onReplay(msg)}
                        className="ml-auto text-gray-300 hover:text-blue-500 transition-colors"
                        title="Replay"
                    >
                        <Volume2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VoicePage() {
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [loadingSubjects, setLoadingSubjects] = useState(true);

    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState('');

    // Voice states
    const [isListening, setIsListening] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [ttsMode, setTtsMode] = useState('server'); // 'server' | 'browser' | 'off'
    const [autoListen, setAutoListen] = useState(true);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [status, setStatus] = useState(''); // current status label shown to user

    const recognitionRef = useRef(null);
    const messagesEndRef = useRef(null);
    const audioRef = useRef(null);
    const autoListenRef = useRef(true);
    const ttsModeRef = useRef('server');
    const synthRef = useRef(window.speechSynthesis);
    const sendQuestionRef = useRef(null);

    useEffect(() => { autoListenRef.current = autoListen; }, [autoListen]);
    useEffect(() => { ttsModeRef.current = ttsMode; }, [ttsMode]);

    // ── Speech recognition setup ────────────────────────────────────────────────
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        setSpeechSupported(true);

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            setInputText(transcript);
            setIsListening(false);
            setStatus('');
            if (transcript.trim()) {
                setTimeout(() => sendQuestionRef.current?.(transcript.trim()), 300);
            }
        };
        recognition.onerror = () => { setIsListening(false); setStatus(''); };
        recognition.onend = () => { setIsListening(false); };
        recognitionRef.current = recognition;
    }, []); // eslint-disable-line

    // ── Load subjects ───────────────────────────────────────────────────────────
    useEffect(() => {
        subjectsAPI.list().then(d => {
            setSubjects(d.subjects || []);
            setLoadingSubjects(false);
        }).catch(() => setLoadingSubjects(false));
    }, []);

    // ── Auto-scroll ─────────────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Start a new session when subject selected ───────────────────────────────
    const initSession = useCallback(async (subject) => {
        try {
            const sid = await voiceAPI.newSession(subject.id);
            setSessionId(sid);
        } catch {
            setSessionId(''); // session creation failure is non-fatal
        }
        setMessages([]);
    }, []);

    // ── startListening ──────────────────────────────────────────────────────────
    const startListening = useCallback(() => {
        if (!recognitionRef.current || isListening || isPlayingAudio) return;
        try {
            recognitionRef.current.start();
            setIsListening(true);
            setStatus('🎤 Listening... speak now');
        } catch { /* already running */ }
    }, [isListening, isPlayingAudio]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setIsListening(false);
        setStatus('');
    }, []);

    // ── playAudio (server TTS) ──────────────────────────────────────────────────
    const playAudioBlob = useCallback((blob, onDone) => {
        if (!blob) { onDone?.(); return; }
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        setIsPlayingAudio(true);
        setStatus('🔊 Teacher is speaking...');

        audio.onended = () => {
            URL.revokeObjectURL(url);
            setIsPlayingAudio(false);
            setStatus('');
            onDone?.();
        };
        audio.onerror = () => {
            URL.revokeObjectURL(url);
            setIsPlayingAudio(false);
            setStatus('');
            onDone?.();
        };
        audio.play().catch(() => {
            setIsPlayingAudio(false);
            onDone?.();
        });
    }, []);

    // ── browserTTS (fallback) ──────────────────────────────────────────────────
    const browserTTS = useCallback((text, onDone) => {
        if (!synthRef.current) { onDone?.(); return; }
        synthRef.current.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = 1.05;
        const voices = synthRef.current.getVoices();
        const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
            || voices.find(v => v.lang.startsWith('en'));
        if (preferred) utt.voice = preferred;
        setIsPlayingAudio(true);
        setStatus('🔊 Teacher is speaking...');
        utt.onend = () => { setIsPlayingAudio(false); setStatus(''); onDone?.(); };
        utt.onerror = () => { setIsPlayingAudio(false); setStatus(''); onDone?.(); };
        synthRef.current.speak(utt);
    }, []);

    // ── After speaking, auto-listen ────────────────────────────────────────────
    const afterSpeak = useCallback(() => {
        if (autoListenRef.current && recognitionRef.current) {
            setTimeout(() => startListening(), 600);
        }
    }, [startListening]);

    // ── Core send function ─────────────────────────────────────────────────────
    const sendQuestion = useCallback(async (text) => {
        if (!text || !text.trim() || loading) return;
        const question = text.trim();
        setInputText('');
        setLoading(true);
        setStatus('🤔 Teacher is thinking...');

        // Add user message
        setMessages(prev => [...prev, {
            role: 'user',
            content: question,
            id: Date.now(),
        }]);

        try {
            const result = await voiceAPI.queryText(
                selectedSubject.id,
                question,
                sessionId,
            );

            const botMsg = {
                role: 'assistant',
                id: Date.now() + 1,
                content: result.answer || result.detail || 'No answer received.',
                answer: result.answer || '',
                followUp: result.followUp || result.follow_up_question || '',
                confidence: result.confidence || '',
                citations: result.citations || [],
                audioBlob: result.audioBlob || null,
            };

            if (result.sessionId) setSessionId(result.sessionId);

            setMessages(prev => [...prev, botMsg]);
            setLoading(false);
            setStatus('');

            // Play audio
            const mode = ttsModeRef.current;
            if (mode === 'server' && botMsg.audioBlob) {
                playAudioBlob(botMsg.audioBlob, afterSpeak);
            } else if (mode === 'browser' || (mode === 'server' && !botMsg.audioBlob)) {
                const spokenText = botMsg.followUp
                    ? `${botMsg.answer} ... ${botMsg.followUp}`
                    : botMsg.answer;
                browserTTS(spokenText, afterSpeak);
            } else {
                afterSpeak();
            }
        } catch (e) {
            setLoading(false);
            setStatus('');
            const errMsg = e.response?.data?.detail || 'Something went wrong. Please try again.';
            setMessages(prev => [...prev, {
                role: 'assistant',
                id: Date.now() + 2,
                content: errMsg,
                answer: errMsg,
                followUp: '',
                confidence: 'Not Found',
                citations: [],
                audioBlob: null,
            }]);
        }
    }, [loading, selectedSubject, sessionId, playAudioBlob, browserTTS, afterSpeak]);

    // Keep ref in sync so speech recognition callback always uses latest version
    useEffect(() => { sendQuestionRef.current = sendQuestion; }, [sendQuestion]);

    // ── Replay a message ───────────────────────────────────────────────────────
    const replayMessage = useCallback((msg) => {
        if (msg.audioBlob) {
            playAudioBlob(msg.audioBlob, () => { });
        } else {
            const text = msg.followUp ? `${msg.answer} ... ${msg.followUp}` : msg.answer;
            browserTTS(text, () => { });
        }
    }, [playAudioBlob, browserTTS]);

    // ── Stop audio ─────────────────────────────────────────────────────────────
    const stopAudio = () => {
        audioRef.current?.pause();
        synthRef.current?.cancel();
        setIsPlayingAudio(false);
        setStatus('');
    };

    // ══ SUBJECT SELECTION SCREEN ═══════════════════════════════════════════════
    if (!selectedSubject) {
        return (
            <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">🎙️ Voice Teacher</h2>
                <p className="text-gray-500 mb-6">Select a subject to start a live voice session with your AI teacher.</p>
                {loadingSubjects ? (
                    <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
                ) : subjects.length === 0 ? (
                    <p className="text-center py-12 text-gray-400">No subjects yet. Upload documents first.</p>
                ) : (
                    <div className="grid gap-4">
                        {subjects.map(s => (
                            <button key={s.id}
                                onClick={() => { setSelectedSubject(s); initSession(s); }}
                                className="card text-left hover:shadow-md transition-shadow flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-orange-500 rounded-xl flex items-center justify-center text-white text-xl shadow">🎙️</div>
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

    // ══ VOICE TEACHER CHAT SCREEN ══════════════════════════════════════════════
    return (
        <div className="max-w-4xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <button onClick={() => { setSelectedSubject(null); stopAudio(); stopListening(); }}
                        className="p-2 hover:bg-gray-100 rounded-lg">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-orange-500 rounded-xl flex items-center justify-center text-white shadow">🎓</div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Voice: {selectedSubject.name}</h2>
                        <p className="text-xs text-gray-500">Real-time AI teacher • asks follow-up questions</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center space-x-2">
                    {/* Auto-listen toggle */}
                    <button onClick={() => setAutoListen(!autoListen)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${autoListen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                        title="Toggle auto-listen after AI speaks">
                        {autoListen ? '🔄 Auto' : '🔄 Off'}
                    </button>

                    {/* TTS mode cycle */}
                    <button
                        onClick={() => setTtsMode(t => t === 'server' ? 'browser' : t === 'browser' ? 'off' : 'server')}
                        className={`p-2 rounded-lg transition-colors ${ttsMode !== 'off' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}
                        title={`TTS: ${ttsMode}`}>
                        {ttsMode !== 'off' ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>

                    {/* Stop audio */}
                    {isPlayingAudio && (
                        <button onClick={stopAudio}
                            className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
                            <VolumeX className="w-5 h-5" />
                        </button>
                    )}

                    {/* New session */}
                    <button onClick={() => initSession(selectedSubject)}
                        className="p-2 hover:bg-gray-100 rounded-lg" title="New conversation">
                        <RefreshCw className="w-4 h-4 text-gray-500" />
                    </button>
                </div>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
                {messages.length === 0 && (
                    <div className="text-center py-16 text-gray-400">
                        <div className="text-6xl mb-4">🎓</div>
                        <p className="text-lg font-medium text-gray-700">Hi! I'm your AI teacher for <strong>{selectedSubject.name}</strong></p>
                        <p className="text-sm mt-1">Ask me anything from your notes. I'll teach you and ask you questions!</p>
                        <div className="mt-2 flex justify-center gap-2 text-xs text-gray-400">
                            <span>🎙️ Speak or type</span>
                            <span>•</span>
                            <span>🔊 I'll respond in voice</span>
                            <span>•</span>
                            <span>📚 I'll quiz you after each answer</span>
                        </div>
                        {speechSupported && (
                            <button onClick={startListening}
                                disabled={loading || isPlayingAudio}
                                className="mt-6 btn-primary px-8 py-3 text-lg rounded-full shadow-lg shadow-blue-200">
                                🎙️ Start Talking
                            </button>
                        )}
                    </div>
                )}

                {messages.map((msg) =>
                    msg.role === 'user' ? (
                        <div key={msg.id} className="flex justify-end">
                            <div className="max-w-[78%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-sm">
                                <p className="text-sm leading-relaxed">{msg.content}</p>
                            </div>
                        </div>
                    ) : (
                        <div key={msg.id} className="flex justify-start">
                            <div className="max-w-[82%] bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                                <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{msg.answer}</p>
                                {msg.followUp && (
                                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                        <p className="text-xs font-semibold text-blue-600 mb-1">📚 Teacher's Question for You</p>
                                        <p className="text-sm text-blue-800 font-medium">{msg.followUp}</p>
                                    </div>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {msg.confidence && <ConfidenceBadge level={msg.confidence} />}
                                    {msg.citations?.map((c, i) => (
                                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-50 text-xs text-gray-400">
                                            <FileText className="w-3 h-3 mr-1" />
                                            {c.file}{c.page ? ` p.${c.page}` : ''}
                                        </span>
                                    ))}
                                    <button onClick={() => replayMessage(msg)}
                                        className="ml-auto text-gray-300 hover:text-blue-500 transition-colors" title="Replay">
                                        <Volume2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                )}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center space-x-2 text-blue-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Teacher is thinking...</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ── Input Bar ── */}
            <div className="border-t border-gray-200 pt-3 bg-gray-50 -mx-4 px-4 pb-2">
                <div className="flex items-center space-x-2">
                    {speechSupported && (
                        <button
                            onClick={() => isListening ? stopListening() : startListening()}
                            disabled={loading || isPlayingAudio}
                            className={`p-3 rounded-full transition-all ${isListening
                                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                                    : isPlayingAudio
                                        ? 'bg-purple-200 text-purple-400 cursor-not-allowed'
                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                }`}
                            title={isListening ? 'Listening…' : 'Click to speak'}>
                            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                    )}

                    <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !loading && !isListening && sendQuestion(inputText)}
                        placeholder={
                            isListening ? '🎤 Listening…'
                                : isPlayingAudio ? '🔊 Teacher speaking…'
                                    : loading ? '⏳ Processing…'
                                        : 'Type or speak your question…'
                        }
                        className="input flex-1"
                        disabled={loading || isListening || isPlayingAudio}
                    />

                    <button
                        onClick={() => sendQuestion(inputText)}
                        disabled={loading || !inputText.trim() || isListening}
                        className="btn-primary p-3 rounded-full">
                        <Send className="w-5 h-5" />
                    </button>
                </div>

                {/* Status bar */}
                <div className="h-5 mt-1 text-center">
                    {status && (
                        <span className="text-xs font-medium text-gray-500 animate-pulse">{status}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
