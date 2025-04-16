import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const Chat = () => {
  const [socket, setSocket] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [userInfo, setUserInfo] = useState({ role: 'guest', username: '' });
  const [userList, setUserList] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const messagesEndRef = useRef(null);

  // Fetch session info
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/session', { withCredentials: true });
        setUserInfo({
          role: res.data.role,
          username: res.data.username || ''
        });
      } catch (err) {
        console.error('Session error:', err);
      }
    };
    fetchSession();
  }, []);

  // Fetch user list for admin
  useEffect(() => {
    if (userInfo.role === 'admin') {
      axios.get('http://localhost:5000/api/users', { withCredentials: true })
        .then(res => setUserList(res.data))
        .catch(err => console.error('Error fetching users:', err));
    }
  }, [userInfo.role]);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        let url = 'http://localhost:5000/api/messages';
        if (userInfo.role === 'admin' && selectedUser) {
          url += `?user=${selectedUser}`;
        }
        const response = await axios.get(url, { withCredentials: true });
         console.log('Fetched messages:', response.data);
        setMessages(response.data);
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };
    fetchMessages();
  }, [selectedUser, userInfo.role]);

  // Setup socket
  useEffect(() => {
    const socketInstance = io('http://localhost:5000', { withCredentials: true });

    socketInstance.on('connect', () => {
      console.log('Connected to socket server');
    });

    socketInstance.on('receive_message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    socketInstance.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(socketInstance);
    return () => socketInstance.disconnect();
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = () => {
    if (message.trim() && socket) {
      const receiver = userInfo.role === 'user' ? 'admin' : selectedUser;
      if (!receiver) return;

      socket.emit('send_message', {
        message,
        receiver
      });

      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2>Chat - {userInfo.role === 'admin' ? 'Admin Panel' : 'User Chat'}</h2>

      {userInfo.role === 'admin' && (
        <div style={{ marginBottom: '15px' }}>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            style={{ padding: '8px', width: '100%' }}
          >
            <option value="">Хэрэглэгч сонгох</option>
            {userList.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{
        height: '400px',
        overflowY: 'auto',
        border: '1px solid #ccc',
        padding: '10px',
        borderRadius: '5px',
        background: '#f8f8f8',
        marginBottom: '10px'
      }}>
        {messages.length === 0 ? (
          <p>No messages yet</p>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} style={{
              marginBottom: '10px',
              padding: '8px',
              borderRadius: '5px',
              backgroundColor: msg.sender === userInfo.username ? '#e1f5fe' : '#fff',
              borderLeft: `4px solid ${msg.sender === userInfo.username ? '#0288d1' : '#66bb6a'}`
            }}>
              <strong>{msg.sender === userInfo.username ? 'You' : msg.sender}</strong>
              <div>{msg.message}</div>
              <div style={{ fontSize: '0.8em', color: '#888' }}>
                {new Date(msg.timestamp).toLocaleString()}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex' }}>
        <input
          type="text"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          style={{
            flex: 1,
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            marginRight: '10px'
          }}
        />
       
      </div>
      <button
          onClick={handleSendMessage}
          disabled={!message.trim() || (userInfo.role === 'admin' && !selectedUser)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Send
        </button>
    </div>
  );
};

export default Chat;
