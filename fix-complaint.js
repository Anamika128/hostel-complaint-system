const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database('database.sqlite');

console.log('Updating complaints...');

// Resolve complaint #1
db.run("UPDATE complaints SET status = 'resolved', resolved_at = datetime('now') WHERE id = 1", function(err) {
    if (err) {
        console.log('❌ Error:', err.message);
    } else {
        console.log(`✅ Resolved ${this.changes} complaint(s)`);
    }
});

// Make user admin (change email to yours)
db.run("UPDATE users SET role = 'admin' WHERE email = 'anamika@example.com'", function(err) {
    if (err) {
        console.log('❌ Error:', err.message);
    } else {
        console.log(`✅ Made ${this.changes} user(s) admin`);
    }
});

// Show all complaints after update
setTimeout(() => {
    db.all("SELECT id, title, status FROM complaints", [], (err, rows) => {
        console.log('\n📋 Current Complaints:');
        rows.forEach(row => {
            console.log(`   #${row.id}: ${row.title} - ${row.status}`);
        });
        db.close();
    });
}, 500);