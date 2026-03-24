const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database error:', err.message);
    } else {
        console.log('✅ SQLite Database Connected');
        initDatabase();
    }
});

function initDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'student',
        room_number TEXT,
        hostel_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        category TEXT,
        status TEXT DEFAULT 'pending',
        student_id INTEGER,
        student_name TEXT,
        room_number TEXT,
        hostel_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME
    )`);
    
    console.log('📊 Database tables ready');
}

// Helper functions
const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
};

const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// ============ API ROUTES ============

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is running!', status: 'active' });
});

// Register user
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, roomNumber, hostelName } = req.body;
        
        const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        const result = await dbRun(
            'INSERT INTO users (name, email, password, room_number, hostel_name) VALUES (?, ?, ?, ?, ?)',
            [name, email, password, roomNumber, hostelName]
        );
        
        res.json({ message: 'Registration successful!', id: result.lastID });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Login user
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await dbGet('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            roomNumber: user.room_number,
            hostelName: user.hostel_name,
            message: 'Login successful!'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Submit complaint
app.post('/api/complaints', async (req, res) => {
    try {
        const { title, description, category, studentId, studentName, roomNumber, hostelName } = req.body;
        
        await dbRun(
            `INSERT INTO complaints (title, description, category, student_id, student_name, room_number, hostel_name) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [title, description, category, studentId, studentName, roomNumber, hostelName]
        );
        
        res.json({ message: 'Complaint submitted successfully!' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all complaints
app.get('/api/complaints', async (req, res) => {
    try {
        const complaints = await dbAll('SELECT * FROM complaints ORDER BY created_at DESC', []);
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update complaint status
app.put('/api/complaints/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const complaintId = req.params.id;
        
        let resolvedAt = null;
        if (status === 'resolved') {
            resolvedAt = new Date().toISOString();
        }
        
        await dbRun(
            `UPDATE complaints SET status = ?, resolved_at = ? WHERE id = ?`,
            [status, resolvedAt, complaintId]
        );
        
        res.json({ message: `Complaint marked as ${status}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
    try {
        const total = await dbGet('SELECT COUNT(*) as count FROM complaints');
        const pending = await dbGet("SELECT COUNT(*) as count FROM complaints WHERE status = 'pending'");
        const inProgress = await dbGet("SELECT COUNT(*) as count FROM complaints WHERE status = 'in-progress'");
        const resolved = await dbGet("SELECT COUNT(*) as count FROM complaints WHERE status = 'resolved'");
        
        res.json({
            total: total.count || 0,
            pending: pending.count || 0,
            inProgress: inProgress.count || 0,
            resolved: resolved.count || 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Make admin (optional)
app.post('/api/make-admin', async (req, res) => {
    try {
        const { email } = req.body;
        await dbRun('UPDATE users SET role = ? WHERE email = ?', ['admin', email]);
        res.json({ message: `User ${email} is now admin!` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ============ SERVE FRONTEND ============
// THIS IS THE IMPORTANT PART - serves your HTML file
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Test API: http://localhost:${PORT}/api/test`);
    console.log(`🌐 Open your browser at: http://localhost:${PORT}\n`);
});