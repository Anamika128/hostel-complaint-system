const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// CORS for mobile access
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Simple password hashing
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Database error:', err);
    } else {
        console.log('✅ Connected to SQLite database');
        initDatabase();
    }
});

function initDatabase() {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        room_number TEXT,
        hostel_name TEXT,
        role TEXT DEFAULT 'student',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Complaints table
    db.run(`CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        admin_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Comments table
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(complaint_id) REFERENCES complaints(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Create default admin
    db.get("SELECT * FROM users WHERE email = ?", ['admin@hostel.com'], (err, user) => {
        if (!user) {
            const hashedPassword = hashPassword('admin123');
            db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
                ['Admin', 'admin@hostel.com', hashedPassword, 'admin']);
            console.log('✅ Admin created: admin@hostel.com / admin123');
        }
    });

    // Create test student
    db.get("SELECT * FROM users WHERE email = ?", ['student@test.com'], (err, user) => {
        if (!user) {
            const hashedPassword = hashPassword('student123');
            db.run("INSERT INTO users (name, email, password, room_number, hostel_name) VALUES (?, ?, ?, ?, ?)",
                ['Test Student', 'student@test.com', hashedPassword, 'A-101', 'Boys Hostel']);
            console.log('✅ Student created: student@test.com / student123');
        }
    });
}

// Token generation
function generateToken(user) {
    return Buffer.from(JSON.stringify({ 
        id: user.id, 
        email: user.email, 
        role: user.role,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    })).toString('base64');
}

function verifyToken(token) {
    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        if (decoded.exp < Date.now()) return null;
        return decoded;
    } catch(e) {
        return null;
    }
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied. Please login.' });
    }
    
    const user = verifyToken(token);
    if (!user) {
        return res.status(403).json({ error: 'Invalid or expired token. Please login again.' });
    }
    
    req.user = user;
    next();
}

// ==================== API ROUTES ====================

// Register
app.post('/api/register', (req, res) => {
    const { name, email, password, room_number, hostel_name } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email and password are required' });
    }
    
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (user) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        const hashedPassword = hashPassword(password);
        
        db.run("INSERT INTO users (name, email, password, room_number, hostel_name) VALUES (?, ?, ?, ?, ?)",
            [name, email, hashedPassword, room_number || null, hostel_name || null],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                const token = generateToken({ id: this.lastID, email, role: 'student' });
                res.json({
                    success: true,
                    message: 'Registration successful',
                    token,
                    user: { 
                        id: this.lastID, 
                        name, 
                        email, 
                        room_number: room_number || null, 
                        hostel_name: hostel_name || null, 
                        role: 'student' 
                    }
                });
            });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = hashPassword(password);
    
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, hashedPassword], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        const token = generateToken({ id: user.id, email: user.email, role: user.role });
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                room_number: user.room_number,
                hostel_name: user.hostel_name,
                role: user.role
            }
        });
    });
});

// Update profile
app.put('/api/users/profile', authenticateToken, (req, res) => {
    const { room_number, hostel_name } = req.body;
    const userId = req.user.id;
    
    db.run("UPDATE users SET room_number = ?, hostel_name = ? WHERE id = ?",
        [room_number, hostel_name, userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            db.get("SELECT id, name, email, room_number, hostel_name, role FROM users WHERE id = ?",
                [userId], (err, user) => {
                    if (err || !user) {
                        return res.status(404).json({ error: 'User not found' });
                    }
                    res.json({ success: true, message: 'Profile updated', user });
                });
        });
});

// Get profile
app.get('/api/users/profile', authenticateToken, (req, res) => {
    db.get("SELECT id, name, email, room_number, hostel_name, role FROM users WHERE id = ?",
        [req.user.id], (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({ user });
        });
});

// Submit complaint
app.post('/api/complaints', authenticateToken, (req, res) => {
    const { title, description, category } = req.body;
    const userId = req.user.id;
    
    if (!title || !description || !category) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    db.run("INSERT INTO complaints (user_id, title, description, category) VALUES (?, ?, ?, ?)",
        [userId, title, description, category],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            db.run("INSERT INTO comments (complaint_id, user_id, comment) VALUES (?, ?, ?)",
                [this.lastID, userId, `Complaint submitted: ${title}`]);
            
            db.get(`SELECT c.*, u.name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
                [this.lastID], (err, complaint) => {
                    if (err || !complaint) {
                        return res.status(500).json({ error: 'Error retrieving complaint' });
                    }
                    res.json({ success: true, message: 'Complaint submitted successfully', complaint });
                });
        });
});

// Get complaints
app.get('/api/complaints', authenticateToken, (req, res) => {
    let query;
    let params = [];
    
    if (req.user.role === 'admin') {
        query = `SELECT c.*, u.name, u.email, u.room_number, u.hostel_name 
                 FROM complaints c 
                 JOIN users u ON c.user_id = u.id 
                 ORDER BY c.created_at DESC`;
    } else {
        query = `SELECT c.*, u.name, u.room_number, u.hostel_name 
                 FROM complaints c 
                 JOIN users u ON c.user_id = u.id 
                 WHERE c.user_id = ? 
                 ORDER BY c.created_at DESC`;
        params = [req.user.id];
    }
    
    db.all(query, params, (err, complaints) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ complaints: complaints || [] });
    });
});

// Get single complaint
app.get('/api/complaints/:id', authenticateToken, (req, res) => {
    const complaintId = req.params.id;
    
    db.get(`SELECT c.*, u.name, u.email FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
        [complaintId], (err, complaint) => {
            if (err || !complaint) {
                return res.status(404).json({ error: 'Complaint not found' });
            }
            
            db.all("SELECT cc.*, u.name, u.role FROM comments cc JOIN users u ON cc.user_id = u.id WHERE cc.complaint_id = ? ORDER BY cc.created_at ASC",
                [complaintId], (err, comments) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.json({ complaint, comments: comments || [] });
                });
        });
});

// Add comment
app.post('/api/complaints/:id/comments', authenticateToken, (req, res) => {
    const { comment } = req.body;
    const complaintId = req.params.id;
    
    if (!comment) {
        return res.status(400).json({ error: 'Comment is required' });
    }
    
    db.run("INSERT INTO comments (complaint_id, user_id, comment) VALUES (?, ?, ?)",
        [complaintId, req.user.id, comment],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, message: 'Comment added successfully' });
        });
});

// Dashboard stats
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
    if (req.user.role === 'admin') {
        db.all(`SELECT status, COUNT(*) as count FROM complaints GROUP BY status`, [], (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            const stats = { total: 0, pending: 0, inProgress: 0, resolved: 0 };
            (results || []).forEach(r => {
                stats.total += r.count;
                stats[r.status] = r.count;
            });
            res.json({ stats });
        });
    } else {
        db.all(`SELECT status, COUNT(*) as count FROM complaints WHERE user_id = ? GROUP BY status`,
            [req.user.id], (err, results) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                const stats = { total: 0, pending: 0, inProgress: 0, resolved: 0 };
                (results || []).forEach(r => {
                    stats.total += r.count;
                    stats[r.status] = r.count;
                });
                res.json({ stats });
            });
    }
});

// Serve frontend - MUST be last route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on:`);
    console.log(`   Local: http://localhost:${PORT}`);
    console.log(`\n📝 Test Accounts:`);
    console.log(`   Admin: admin@hostel.com / admin123`);
    console.log(`   Student: student@test.com / student123`);
    console.log(`\n💡 To access from mobile, use your computer's IP address\n`);
});