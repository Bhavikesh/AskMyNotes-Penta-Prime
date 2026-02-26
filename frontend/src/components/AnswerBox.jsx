import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, Copy, Check } from 'lucide-react';
import { parseAnswer } from '../utils/formatters';

const AnswerBox = ({ answers, questions }) => {
  const [copiedIndex, setCopiedIndex] = React.useState(null);

  const getDecisionIcon = (decision) => {
    const upper = decision.toUpperCase();
    if (upper.includes('APPROVED')) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    } else if (upper.includes('REJECTED')) {
      return <XCircle className="w-5 h-5 text-red-600" />;
    } else if (upper.includes('PARTIAL')) {
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    } else {
      return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getDecisionColor = (decision) => {
    const upper = decision.toUpperCase();
    if (upper.includes('APPROVED')) {
      return 'bg-green-50 border-green-200 text-green-800';
    } else if (upper.includes('REJECTED')) {
      return 'bg-red-50 border-red-200 text-red-800';
    } else if (upper.includes('PARTIAL')) {
      return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    } else {
      return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!answers || answers.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-12 text-gray-500">
          <Info className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No answers yet</p>
          <p className="text-xs mt-1">Submit questions to see answers here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {answers.map((answer, index) => {
        const parsed = parseAnswer(answer);
        const question = questions?.[index] || `Question ${index + 1}`;

        return (
          <div key={index} className="card">
            {/* Question Header */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-xs font-bold text-primary-700">
                      {index + 1}
                    </span>
                    <h3 className="font-medium text-gray-900">Question</h3>
                  </div>
                  <p className="text-gray-700 ml-8">{question}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(answer, index)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Copy answer"
                >
                  {copiedIndex === index ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Answer Content */}
            <div className="space-y-4">
              {/* Decision */}
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  {getDecisionIcon(parsed.decision)}
                  <h4 className="font-semibold text-gray-900">Decision</h4>
                </div>
                <div className={`p-3 rounded-lg border ${getDecisionColor(parsed.decision)}`}>
                  <p className="font-medium">{parsed.decision}</p>
                </div>
              </div>

              {/* Relevant Clauses */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  📋 Relevant Clauses
                </h4>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {parsed.relevantClauses}
                  </p>
                </div>
              </div>

              {/* Explanation */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  💡 Explanation
                </h4>
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <p className="text-gray-800 leading-relaxed">
                    {parsed.explanation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AnswerBox;