export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const parseAnswer = (answer) => {
  const lines = answer.split('\n');
  
  let decision = '';
  let relevantClauses = '';
  let explanation = '';
  
  let currentSection = '';
  
  for (const line of lines) {
    if (line.startsWith('Decision:')) {
      currentSection = 'decision';
      decision = line.replace('Decision:', '').trim();
    } else if (line.startsWith('Relevant Clauses:')) {
      currentSection = 'clauses';
      relevantClauses = line.replace('Relevant Clauses:', '').trim();
    } else if (line.startsWith('Explanation:')) {
      currentSection = 'explanation';
      explanation = line.replace('Explanation:', '').trim();
    } else if (line.trim()) {
      if (currentSection === 'clauses') {
        relevantClauses += ' ' + line.trim();
      } else if (currentSection === 'explanation') {
        explanation += ' ' + line.trim();
      }
    }
  }
  
  return {
    decision: decision || 'N/A',
    relevantClauses: relevantClauses || 'N/A',
    explanation: explanation || answer,
  };
};

export const formatDate = (isoString) => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};