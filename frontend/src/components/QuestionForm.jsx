import React, { useState } from 'react';
import { Send, Plus, X, Loader2 } from 'lucide-react';

const QuestionForm = ({ selectedDocument, onSubmit, isLoading }) => {
  const [questions, setQuestions] = useState(['']);

  const addQuestion = () => {
    if (questions.length < 5) {
      setQuestions([...questions, '']);
    }
  };

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index, value) => {
    const newQuestions = [...questions];
    newQuestions[index] = value;
    setQuestions(newQuestions);
  };

  const handleSubmit = () => {
    const validQuestions = questions.filter((q) => q.trim());
    
    if (validQuestions.length === 0) {
      alert('Please enter at least one question');
      return;
    }

    if (!selectedDocument) {
      alert('Please select a document first');
      return;
    }

    onSubmit(validQuestions);
  };

  const handleKeyPress = (e, index) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (index === questions.length - 1 && questions.length < 5) {
        addQuestion();
      } else {
        handleSubmit();
      }
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Ask Questions
        </h2>
        {selectedDocument && (
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
            {selectedDocument.display_name}
          </span>
        )}
      </div>

      {!selectedDocument && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          ⚠️ Please select or upload a document first
        </div>
      )}

      <div className="space-y-3 mb-4">
        {questions.map((question, index) => (
          <div key={index} className="relative">
            <div className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 mt-2">
                {index + 1}
              </span>
              <textarea
                value={question}
                onChange={(e) => updateQuestion(index, e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                placeholder={`Question ${index + 1}...`}
                className="input resize-none"
                rows="2"
                disabled={isLoading || !selectedDocument}
              />
              {questions.length > 1 && (
                <button
                  onClick={() => removeQuestion(index)}
                  className="flex-shrink-0 p-2 hover:bg-red-50 rounded-lg transition-colors mt-1"
                  disabled={isLoading}
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-red-600" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex space-x-2">
        {questions.length < 5 && (
          <button
            onClick={addQuestion}
            disabled={isLoading || !selectedDocument}
            className="btn-secondary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Question</span>
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={isLoading || !selectedDocument || questions.every((q) => !q.trim())}
          className="btn-primary flex-1 flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit Questions</span>
            </>
          )}
        </button>
      </div>

      {isLoading && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <div className="flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing your questions... This may take 30-90 seconds</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionForm;