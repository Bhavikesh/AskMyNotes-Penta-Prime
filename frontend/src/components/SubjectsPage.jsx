import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FolderOpen, Upload, FileText, Loader2 } from 'lucide-react';
import { subjectsAPI, uploadAPI } from '../api/endpoints';

export default function SubjectsPage({ onSelectSubject }) {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [uploadingFor, setUploadingFor] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('');
    const [error, setError] = useState('');

    const fetchSubjects = async () => {
        try {
            setLoading(true);
            const data = await subjectsAPI.list();
            setSubjects(data.subjects || []);
        } catch (e) {
            setError('Failed to load subjects');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSubjects(); }, []);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        setError('');
        try {
            await subjectsAPI.create(newName.trim());
            setNewName('');
            fetchSubjects();
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to create subject');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this subject and all its documents?')) return;
        try {
            await subjectsAPI.delete(id);
            fetchSubjects();
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to delete');
        }
    };

    const handleUpload = async (subjectId) => {
        if (!uploadFile) return;
        setUploadStatus('uploading');
        try {
            await uploadAPI.uploadFile(uploadFile, subjectId);
            setUploadStatus('done');
            setUploadFile(null);
            setUploadingFor(null);
            fetchSubjects();
        } catch (e) {
            setUploadStatus('error');
            setError(e.response?.data?.detail || 'Upload failed');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Create Subject */}
            <div className="card mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">📚 My Subjects ({subjects.length}/3)</h2>
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-3 text-sm">
                        {error}
                        <button onClick={() => setError('')} className="ml-2 font-bold">×</button>
                    </div>
                )}
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="e.g. Operating Systems"
                        className="input flex-1"
                        maxLength={50}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        disabled={subjects.length >= 3}
                    />
                    <button
                        onClick={handleCreate}
                        disabled={creating || !newName.trim() || subjects.length >= 3}
                        className="btn-primary flex items-center space-x-1 whitespace-nowrap"
                    >
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        <span>Add Subject</span>
                    </button>
                </div>
                {subjects.length >= 3 && (
                    <p className="text-xs text-amber-600 mt-2">Maximum 3 subjects reached. Delete one to add another.</p>
                )}
            </div>

            {/* Subject List */}
            {loading ? (
                <div className="text-center py-12 text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    Loading subjects...
                </div>
            ) : subjects.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-40" />
                    <p className="text-lg">No subjects yet</p>
                    <p className="text-sm">Create your first subject to get started</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {subjects.map(subj => (
                        <div key={subj.id} className="card hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 cursor-pointer flex-1" onClick={() => onSelectSubject(subj)}>
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl shadow">
                                        📖
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-lg">{subj.name}</h3>
                                        <p className="text-sm text-gray-500">
                                            {subj.document_count || 0} document{subj.document_count !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => setUploadingFor(uploadingFor === subj.id ? null : subj.id)}
                                        className="btn-secondary flex items-center space-x-1 text-sm"
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span>Upload</span>
                                    </button>
                                    <button
                                        onClick={() => onSelectSubject(subj)}
                                        className="btn-primary flex items-center space-x-1 text-sm"
                                    >
                                        <span>Ask Questions →</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(subj.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Upload area */}
                            {uploadingFor === subj.id && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <div className="flex items-center space-x-3">
                                        <input
                                            type="file"
                                            accept=".pdf,.docx,.txt,.eml"
                                            onChange={e => setUploadFile(e.target.files[0])}
                                            className="flex-1 text-sm"
                                        />
                                        <button
                                            onClick={() => handleUpload(subj.id)}
                                            disabled={!uploadFile || uploadStatus === 'uploading'}
                                            className="btn-primary text-sm flex items-center space-x-1"
                                        >
                                            {uploadStatus === 'uploading' ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /><span>Uploading...</span></>
                                            ) : (
                                                <><FileText className="w-4 h-4" /><span>Upload & Index</span></>
                                            )}
                                        </button>
                                    </div>
                                    {uploadStatus === 'done' && <p className="text-sm text-green-600 mt-2">✅ Upload successful!</p>}
                                    {uploadStatus === 'error' && <p className="text-sm text-red-600 mt-2">❌ Upload failed</p>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
