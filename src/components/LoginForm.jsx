import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './LoginForm.css';

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // Loading state нэмэх
  const [error, setError] = useState(null); // Алдаа мессежийг хадгалах
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Хэрэглэгчийн нэр болон нууц үг хоосон байвал
    if (!username || !password) {
      setError('Хэрэглэгчийн нэр болон нууц үг заавал байх ёстой!');
      return;
    }

    setError(null); // Алдааг арилгах
    setLoading(true); // Ачааллаж эхлэх

    try {
      const response = await axios.post('http://localhost:5000/api/login', {
        username,
        password
      }, {
        withCredentials: true
      });
      onLogin(response.data); // Login функц
      navigate('/chat'); // Шилжүүлэх
    } catch (err) {
      setLoading(false); // Ачаалал дууссан
      if (err.response) {
        console.error("Login error:", err.response.data);
        setError(`Нэвтрэхэд алдаа гарлаа: ${err.response.data.message}`);
      } else {
        console.error("Unknown error:", err);
        setError("Нэвтрэхэд алдаа гарлаа");
      }
    }
  };

  return (
    <div className="login-form">
      <h2>Нэвтрэх</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <input
            type="text"
            placeholder="Хэрэглэгчийн нэр"
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={loading} // Ачаалж байгаа үед оролдохгүй
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Нууц үг"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading} // Ачаалж байгаа үед оролдохгүй
          />
        </div>
        {error && <div className="error-message">{error}</div>} {/* Алдаа харуулах */}
        <div>
          <button type="submit" disabled={loading}>
            {loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;
