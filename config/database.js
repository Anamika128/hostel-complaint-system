const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path (will create database.sqlite in your project root)
const dbPath = path.join(__dirname, '../database.sqlite');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
    } else {
        console.log('✅ SQLite Database Connected Successfully');
        console.log(`📁 Database file: ${dbPath}`);
        initDatabase();
    }
});

// Initialize database tables
function initDatabase() {
    // Create users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'student',
            room_number TEXT,
            hostel_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Error creating users table:', err);
        else console.log('✅ Users table ready');
    });

    // Create complaints table
    db.run(`
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            student_id INTEGER NOT NULL,
            student_name TEXT,
            room_number TEXT,
            hostel_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME,
            FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error('Error creating complaints table:', err);
        else console.log('✅ Complaints table ready');
    });

    console.log('📊 Database initialization complete!');
}

// Promisify functions for async/await
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

module.exports = { db, dbRun, dbGet, dbAll };