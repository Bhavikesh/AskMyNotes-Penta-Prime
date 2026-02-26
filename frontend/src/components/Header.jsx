import React from 'react';
import { BookOpen, GraduationCap } from 'lucide-react';
import { getUserId } from '../api/endpoints';

export default function Header({ currentPage, onNavigate }) {
  const userId = getUserId();
  const shortId = userId.slice(0, 8);

  const navItems = [
    { id: 'home', label: 'My Subjects', icon: '📚' },
    { id: 'voice', label: 'Voice Tutor', icon: '🎙️' },
    { id: 'study', label: 'Study Mode', icon: '🧠' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
  ];

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AskMyNotes</h1>
              <p className="text-xs text-gray-500">Your notes, your AI tutor</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center space-x-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === item.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <span className="mr-1.5">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* User badge */}
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
              U
            </div>
            <span className="font-mono">{shortId}</span>
          </div>
        </div>
      </div>
    </header>
  );
}