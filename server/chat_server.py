from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
import sqlite3
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)
app.secret_key = 'your_strong_secret_key_here'  # Should be more complex in production
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False  # True in production with HTTPS

# Enable CORS
CORS(app, supports_credentials=True, origins=["http://localhost:3000"])

# Initialize SocketIO
socketio = SocketIO(app, 
                   cors_allowed_origins="http://localhost:3000",
                   logger=True,
                   engineio_logger=True)

# Database initialization
def init_db():
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')
    
    # Create a single messages table for all conversations
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT NOT NULL,
            receiver TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(sender) REFERENCES users(username),
            FOREIGN KEY(receiver) REFERENCES users(username)
        )
    ''')
    
    # Create indexes for better performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages (receiver)')
    
    # Insert default users if they don't exist
    default_users = [
        ('user1', 'userpass', 'user'),
        ('user2', 'userpass', 'user'),
        ('admin1', 'adminpass', 'admin')
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)",
        default_users
    )
    
    conn.commit()
    conn.close()

# Database helper functions
def get_db_connection():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row  # Return rows as dictionaries
    return conn

def get_user_from_db(username):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT username, password, role FROM users WHERE username=?", (username,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def save_message(sender, receiver, message):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO messages (sender, receiver, message) VALUES (?, ?, ?)",
        (sender, receiver, message)
    )
    conn.commit()
    conn.close()

# API Routes
@app.route('/api/users', methods=['GET'])
def get_all_users():
    # Only admin can access user list
    if session.get('role') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT username FROM users WHERE role = 'user'")
    users = [row['username'] for row in cursor.fetchall()]
    conn.close()
    return jsonify(users)

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user = get_user_from_db(username)
    if user and user["password"] == password:
        session['username'] = username
        session['role'] = user["role"]
        return jsonify({
            "message": "Амжилттай нэвтэрлээ",
            "username": username,
            "role": user["role"]
        }), 200
    return jsonify({"error": "Нэвтэрэх нэр эсвэл нууц үг буруу"}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Гарав"}), 200

@app.route('/api/messages', methods=['GET'])
def get_messages():
    username = session.get('username')
    role = session.get('role')
    
    if not username:
        return jsonify([]), 401
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if role == 'admin':
        target_user = request.args.get('user')
        if target_user:
            # ✅ Хэрэглэгч болон тухайн админ хоёрын хоорондын бүх мессеж
            cursor.execute('''
                SELECT * FROM messages 
                WHERE (sender = ? AND receiver = ?) 
                   OR (sender = ? AND receiver = ?)
                ORDER BY timestamp ASC
            ''', (target_user, username, username, target_user))
        else:
            cursor.execute('SELECT * FROM messages ORDER BY timestamp ASC')
    else:
       
        cursor.execute('''
            SELECT * FROM messages 
            WHERE sender = ? OR receiver = ?
            ORDER BY timestamp ASC
        ''', (username, username))
    
    messages = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(messages)


@app.route('/api/session', methods=['GET'])
def get_session_info():
    username = session.get('username')
    role = session.get('role')
    if not username:
        return jsonify({"role": "guest"}), 200
    return jsonify({"username": username, "role": role})

# SocketIO Handlers
@socketio.on('connect')
def handle_connect():
    username = session.get('username')
    if username:
        join_room(username)  # Join user's personal room
        if session.get('role') == 'admin':
            join_room('admin')  # Admin joins special admin room
        emit('connection_status', {'status': 'connected', 'username': username})

@socketio.on('send_message')
def handle_send_message(data):
    username = session.get('username')
    if not username:
        emit('error', {'message': 'Authentication required'})
        return
    
    message = data.get('message')
    if not message:
        emit('error', {'message': 'Message cannot be empty'})
        return
    
    # Determine receiver based on user role
    if session.get('role') == 'user':
        receiver = 'admin'  # Users always message admin
    else:
        receiver = data.get('receiver')
        if not receiver:
            emit('error', {'message': 'Receiver must be specified for admin'})
            return
    
    # Save message to database
    save_message(username, receiver, message)
    
    # Prepare message data
    message_data = {
        'sender': username,
        'receiver': receiver,
        'message': message,
        'timestamp': datetime.now().isoformat()
    }
    
    # Send to receiver
    emit('receive_message', message_data, room=receiver)
    
    # Also send to sender for their chat UI
    emit('receive_message', message_data, room=username)

if __name__ == '__main__':
    init_db()  # Initialize database tables
    socketio.run(app, 
                debug=True, 
                host='0.0.0.0', 
                port=5000, 
                allow_unsafe_werkzeug=True)