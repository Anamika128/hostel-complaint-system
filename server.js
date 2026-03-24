const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('DB error:', err);
    else console.log('✅ Database connected');
});

// Create tables
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user'
)`);

db.run(`CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// API Routes
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is running!', status: 'active' });
});

app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, [name, email, password], function(err) {
        if (err) res.status(400).json({ message: 'User already exists' });
        else res.json({ message: 'Registration successful!' });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
        if (user) res.json({ _id: user.id, name: user.name, message: 'Login successful!' });
        else res.status(401).json({ message: 'Invalid credentials' });
    });
});

app.post('/api/complaints', (req, res) => {
    const { title, description } = req.body;
    db.run(`INSERT INTO complaints (title, description) VALUES (?, ?)`, [title, description], function(err) {
        res.json({ message: 'Complaint submitted!' });
    });
});

app.get('/api/complaints', (req, res) => {
    db.all(`SELECT * FROM complaints ORDER BY id DESC`, [], (err, rows) => {
        res.json(rows);
    });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});