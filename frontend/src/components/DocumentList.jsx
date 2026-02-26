import React from 'react';
import { FileText, Building2, HardDrive, Trash2, Loader2 } from 'lucide-react';
import { useDocuments, useDeleteDocument } from '../hooks/useDocuments';
import { formatFileSize } from '../utils/formatters';

const DocumentList = ({ selectedDocId, onSelectDocument }) => {
  const { data, isLoading, error } = useDocuments();
  const deleteDocument = useDeleteDocument();

  const handleDelete = async (docId, source) => {
    if (source === 'dataset') {
      alert('Cannot delete dataset documents. Only uploaded documents can be deleted.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await deleteDocument.mutateAsync(docId);
      } catch (error) {
        alert('Failed to delete document: ' + error.message);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <p className="text-red-600 mb-2">Failed to load documents</p>
          <p className="text-sm text-gray-500">{error.message}</p>
        </div>
      </div>
    );
  }

  const documents = data?.documents || [];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Available Documents
        </h2>
        <span className="badge bg-primary-100 text-primary-700">
          {documents.length} {documents.length === 1 ? 'document' : 'documents'}
        </span>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No documents available</p>
          <p className="text-xs mt-1">Upload a document to get started</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => onSelectDocument(doc)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                selectedDocId === doc.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-primary-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className={`mt-1 p-2 rounded-lg ${
                    selectedDocId === doc.id ? 'bg-primary-200' : 'bg-gray-100'
                  }`}>
                    <FileText className={`w-5 h-5 ${
                      selectedDocId === doc.id ? 'text-primary-700' : 'text-gray-600'
                    }`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate mb-1">
                      {doc.display_name}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Building2 className="w-3 h-3" />
                        <span>{doc.company}</span>
                      </div>
                      
                      <span className="text-gray-300">•</span>
                      
                      <div className="flex items-center space-x-1">
                        <HardDrive className="w-3 h-3" />
                        <span>{formatFileSize(doc.size)}</span>
                      </div>
                      
                      <span className="text-gray-300">•</span>
                      
                      <span className={`px-2 py-0.5 rounded-full ${
                        doc.source === 'dataset' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {doc.source === 'dataset' ? 'Database' : 'Uploaded'}
                      </span>
                    </div>
                  </div>
                </div>

                {doc.source === 'upload' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc.id, doc.source);
                    }}
                    className="ml-2 p-1.5 hover:bg-red-50 rounded-lg transition-colors group"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-600" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentList;