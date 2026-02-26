export const storage = {
  getToken: () => localStorage.getItem('bearer_token'),
  
  setToken: (token) => {
    localStorage.setItem('bearer_token', token);
  },
  
  removeToken: () => {
    localStorage.removeItem('bearer_token');
  },
  
  hasToken: () => !!localStorage.getItem('bearer_token'),
};

export const sessionStorage = {
  getHistory: () => {
    const history = localStorage.getItem('query_history');
    return history ? JSON.parse(history) : [];
  },
  
  addToHistory: (item) => {
    const history = sessionStorage.getHistory();
    const newHistory = [
      {
        ...item,
        timestamp: new Date().toISOString(),
        id: Date.now(),
      },
      ...history,
    ].slice(0, 50);
    
    localStorage.setItem('query_history', JSON.stringify(newHistory));
  },
  
  clearHistory: () => {
    localStorage.removeItem('query_history');
  },
};