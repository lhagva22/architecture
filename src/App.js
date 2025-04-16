import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import Chat from './components/chat';

function App() {
  const [user, setUser] = useState(null);
 
  const handleLogin = (userData) => {
    setUser(userData);
    
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginForm onLogin={handleLogin} />} />
        <Route path="/login" element={<LoginForm onLogin={handleLogin} />} />
        { <Route path="/chat" element={<Chat />} /> }
      </Routes>
    </Router>
  );
}

export default App;
