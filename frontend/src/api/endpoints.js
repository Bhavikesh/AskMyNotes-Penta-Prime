import apiClient from './axios';

// ── User ID management ─────────────────────────────────────────
function getUserId() {
  let uid = localStorage.getItem('askmynotes_user_id');
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem('askmynotes_user_id', uid);
  }
  return uid;
}

export { getUserId };

// ── Subjects ───────────────────────────────────────────────────
export const subjectsAPI = {
  list: async () => {
    const res = await apiClient.get('/subjects/', { params: { user_id: getUserId() } });
    return res.data;
  },
  create: async (name) => {
    const res = await apiClient.post('/subjects/', { user_id: getUserId(), name });
    return res.data;
  },
  delete: async (subjectId) => {
    const res = await apiClient.delete(`/subjects/${subjectId}`, { params: { user_id: getUserId() } });
    return res.data;
  },
};

// ── Upload ─────────────────────────────────────────────────────
export const uploadAPI = {
  uploadFile: async (file, subjectId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', getUserId());
    formData.append('subject_id', subjectId);
    const res = await apiClient.post('/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getAllowedTypes: async () => {
    const res = await apiClient.get('/upload/allowed-types');
    return res.data;
  },
};

// ── AskMyNotes Query ───────────────────────────────────────────
export const queryAPI = {
  ask: async (subjectId, question, conversationHistory = [], voiceMode = false) => {
    const res = await apiClient.post('/askmynotes/query', {
      user_id: getUserId(),
      subject_id: subjectId,
      question,
      conversation_history: conversationHistory,
      voice_mode: voiceMode,
    });
    return res.data;
  },
};

// ── Study Mode ─────────────────────────────────────────────────
export const studyAPI = {
  generate: async (subjectId) => {
    const res = await apiClient.post('/study-mode/', {
      user_id: getUserId(),
      subject_id: subjectId,
    });
    return res.data;
  },
  evaluate: async (subjectId, answers) => {
    const res = await apiClient.post('/study-mode/evaluate', {
      user_id: getUserId(),
      subject_id: subjectId,
      answers,
    });
    return res.data;
  },
};

// ── Analytics ──────────────────────────────────────────────────
export const analyticsAPI = {
  getPerformance: async () => {
    const res = await apiClient.get('/analytics/performance', { params: { user_id: getUserId() } });
    return res.data;
  },
};

// ── Voice Teacher ──────────────────────────────────────────────
export const voiceAPI = {
  /**
   * Send transcribed text → RAG → TTS audio bytes.
   * Returns { audioBlob, answer, followUp, confidence, citations, sessionId }
   */
  queryText: async (subjectId, question, sessionId = '') => {
    const formData = new FormData();
    formData.append('user_id', getUserId());
    formData.append('subject_id', subjectId);
    formData.append('question', question);
    formData.append('session_id', sessionId);

    const res = await apiClient.post('/voice/query-text', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'arraybuffer',
      validateStatus: (s) => s < 500,
    });

    // If we got JSON back (TTS failed path), parse it
    if (res.headers['content-type']?.includes('application/json')) {
      const json = JSON.parse(new TextDecoder().decode(res.data));
      return { audioBlob: null, ...json };
    }

    const audioBlob = new Blob([res.data], { type: 'audio/mpeg' });
    return {
      audioBlob,
      answer: res.headers['x-answer'] || '',
      followUp: res.headers['x-follow-up'] || '',
      question: res.headers['x-question'] || question,
      sessionId: res.headers['x-session-id'] || sessionId,
      confidence: res.headers['x-confidence'] || '',
    };
  },

  /** Send audio file (recorded from mic) directly to Whisper → RAG → TTS */
  queryAudio: async (subjectId, audioBlob, sessionId = '', mimeType = 'audio/webm') => {
    const formData = new FormData();
    formData.append('user_id', getUserId());
    formData.append('subject_id', subjectId);
    formData.append('audio_file', audioBlob, 'recording.webm');
    formData.append('session_id', sessionId);
    formData.append('mime_type', mimeType);

    const res = await apiClient.post('/voice/query', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'arraybuffer',
      validateStatus: (s) => s < 500,
    });

    if (res.headers['content-type']?.includes('application/json')) {
      const json = JSON.parse(new TextDecoder().decode(res.data));
      return { audioBlob: null, ...json };
    }

    const respBlob = new Blob([res.data], { type: 'audio/mpeg' });
    return {
      audioBlob: respBlob,
      answer: res.headers['x-answer'] || '',
      followUp: res.headers['x-follow-up'] || '',
      question: res.headers['x-question'] || '',
      sessionId: res.headers['x-session-id'] || sessionId,
      confidence: res.headers['x-confidence'] || '',
    };
  },

  /** Create a new conversation session */
  newSession: async (subjectId) => {
    const formData = new FormData();
    formData.append('user_id', getUserId());
    formData.append('subject_id', subjectId);
    const res = await apiClient.post('/voice/session/new', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.session_id || '';
  },
};

// ── Health ──────────────────────────────────────────────────────
export const healthAPI = {
  check: async () => {
    const res = await apiClient.get('/health');
    return res.data;
  },
};