import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Header from './components/Header';
import SubjectsPage from './components/SubjectsPage';
import QueryPage from './components/QueryPage';
import StudyPage from './components/StudyPage';
import AnalyticsPage from './components/AnalyticsPage';
import VoicePage from './components/VoicePage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

function AppContent() {
  const [page, setPage] = useState('home');
  const [selectedSubject, setSelectedSubject] = useState(null);

  const handleSelectSubject = (subj) => {
    setSelectedSubject(subj);
    setPage('query');
  };

  const handleNavigate = (p) => {
    setPage(p);
    if (p === 'home') setSelectedSubject(null);
  };

  const renderPage = () => {
    switch (page) {
      case 'query':
        return selectedSubject ? (
          <QueryPage subject={selectedSubject} onBack={() => handleNavigate('home')} />
        ) : (
          <SubjectsPage onSelectSubject={handleSelectSubject} />
        );
      case 'voice':
        return <VoicePage />;
      case 'study':
        return <StudyPage />;
      case 'analytics':
        return <AnalyticsPage />;
      default:
        return <SubjectsPage onSelectSubject={handleSelectSubject} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header currentPage={page} onNavigate={handleNavigate} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderPage()}
      </main>
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>AskMyNotes v2.0 — Your notes, your AI tutor</p>
          <p className="mt-1">Powered by AI • Built with React & FastAPI</p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;