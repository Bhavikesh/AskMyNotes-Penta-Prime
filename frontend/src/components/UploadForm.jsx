import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useUpload } from '../hooks/useUpload';
import { formatFileSize } from '../utils/formatters';

const UploadForm = ({ onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [company, setCompany] = useState('');
  const upload = useUpload();

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      
      // Validate file size (50MB)
      if (file.size > 50 * 1024 * 1024) {
        alert('File too large. Maximum size is 50MB.');
        return;
      }

      setSelectedFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'message/rfc822': ['.eml'],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      const result = await upload.mutateAsync({
        file: selectedFile,
        company: company || null,
      });

      // Notify parent component
      if (onUploadSuccess) {
        onUploadSuccess(result.document);
      }

      // Reset form
      setSelectedFile(null);
      setCompany('');

      alert('Document uploaded successfully!');
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Upload Document
      </h2>

      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          
          <Upload className={`w-12 h-12 mx-auto mb-3 ${
            isDragActive ? 'text-primary-600' : 'text-gray-400'
          }`} />
          
          {isDragActive ? (
            <p className="text-primary-600 font-medium">Drop the file here...</p>
          ) : (
            <>
              <p className="text-gray-700 font-medium mb-1">
                Drag & drop a document here
              </p>
              <p className="text-sm text-gray-500 mb-3">
                or click to browse
              </p>
              <p className="text-xs text-gray-400">
                Supported: PDF, DOCX, EML (Max 50MB)
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selected file display */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <FileText className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemoveFile}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Company input (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name (Optional)
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g., Bajaj Allianz, HDFC ERGO..."
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave blank for automatic detection
            </p>
          </div>

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={upload.isPending}
            className="btn-primary w-full flex items-center justify-center space-x-2"
          >
            {upload.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload Document</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Status messages */}
      {upload.isSuccess && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">Upload successful!</p>
            <p className="text-xs text-green-700 mt-0.5">
              Document is now available for querying
            </p>
          </div>
        </div>
      )}

      {upload.isError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Upload failed</p>
            <p className="text-xs text-red-700 mt-0.5">
              {upload.error?.response?.data?.detail || upload.error?.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadForm;