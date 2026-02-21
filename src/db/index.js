/**
 * Database Connection and Helpers using sql.js
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Get database path from environment or use default
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/marketplace.db');

let db = null;

// Initialize database
async function initDatabase() {
    if (db) return db;
    
    const SQL = await initSqlJs();
    
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }
    
    // Run schema
    await runSchema();
    
    // Save to disk
    saveDatabase();
    
    console.log('✅ Database initialized');
    return db;
}

async function runSchema() {
    // Read schema file
    const schemaPath = path.resolve(__dirname, '..', '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Parse SQL file - handle multi-line statements
    let currentStatement = '';
    let inComment = false;
    
    for (let i = 0; i < schema.length; i++) {
        const char = schema[i];
        
        // Handle multi-line comments
        if (schema.substring(i, i + 2) === '/*') {
            inComment = true;
            i++;
            continue;
        }
        if (schema.substring(i, i + 2) === '*/') {
            inComment = false;
            i++;
            continue;
        }
        if (inComment) continue;
        
        // Skip single-line comments
        if (schema.substring(i, i + 2) === '--') {
            while (i < schema.length && schema[i] !== '\n') i++;
            continue;
        }
        
        currentStatement += char;
        
        // Check for statement end
        if (char === ';' && currentStatement.trim().length > 10) {
            try {
                const stmt = currentStatement.trim();
                db.run(stmt);
            } catch (error) {
                const msg = error.message || '';
                if (!msg.includes('already exists') && 
                    !msg.includes('no such table') &&
                    !msg.includes('duplicate column') &&
                    !msg.includes('UNIQUE constraint failed')) {
                    console.log('Schema note:', msg.substring(0, 80));
                }
            }
            currentStatement = '';
        }
    }
    
    saveDatabase();
    console.log('✅ Schema loaded');
}

function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

// Helper functions
function all(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

function get(sql, params = []) {
    const results = all(sql, params);
    return results[0] || null;
}

function run(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    db.run(sql, params);
    saveDatabase();
    const result = db.exec("SELECT last_insert_rowid()");
    return {
        lastInsertRowid: result[0]?.values[0]?.[0] || 0
    };
}

// Prepared statements helpers
const prepared = {
    // Users
    getUserByWallet: (wallet) => get('SELECT * FROM users WHERE wallet_address = ?', [wallet]),
    
    createUser: (user) => {
        const result = run(
            'INSERT INTO users (wallet_address, username, email, bio) VALUES (?, ?, ?, ?)',
            [user.wallet_address, user.username, user.email, user.bio]
        );
        return { ...user, id: result.lastInsertRowid };
    },
    
    // Skills
    getSkillById: (id) => get('SELECT * FROM skills WHERE id = ?', [id]),
    getSkillsBySeller: (sellerId) => all('SELECT * FROM skills WHERE seller_id = ?', [sellerId]),
    getActiveSkills: () => all('SELECT * FROM skills WHERE is_active = 1 ORDER BY created_at DESC'),
    getSkillsByCategory: (category) => all('SELECT * FROM skills WHERE category = ? AND is_active = 1', [category]),
    searchSkills: (query) => all(
        'SELECT * FROM skills WHERE is_active = 1 AND (name LIKE ? OR description LIKE ?) ORDER BY rating DESC',
        [`%${query}%`, `%${query}%`]
    ),
    
    createSkill: (skill) => {
        const result = run(
            `INSERT INTO skills (seller_id, name, description, category, input_schema, price, price_type)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [skill.seller_id, skill.name, skill.description, skill.category, skill.input_schema, skill.price, skill.price_type]
        );
        return { ...skill, id: result.lastInsertRowid };
    },
    
    updateSkillRating: (id, rating) => {
        run(
            'UPDATE skills SET rating = ?, total_sales = total_sales + 1 WHERE id = ?',
            [rating, id]
        );
    },
    
    // Transactions
    createTransaction: (tx) => {
        const result = run(
            'INSERT INTO transactions (buyer_id, seller_id, skill_id, amount, status) VALUES (?, ?, ?, ?, ?)',
            [tx.buyer_id, tx.seller_id, tx.skill_id, tx.amount, tx.status || 'pending']
        );
        return { ...tx, id: result.lastInsertRowid };
    },
    
    getTransactionById: (id) => get('SELECT * FROM transactions WHERE id = ?', [id]),
    
    updateTransactionStatus: (params) => {
        run(
            'UPDATE transactions SET status = ?, completed_at = ? WHERE id = ?',
            [params.status, params.completed || new Date().toISOString(), params.id]
        );
    },
    
    // Executions
    createExecution: (exec) => {
        const result = run(
            'INSERT INTO executions (transaction_id, skill_id, buyer_id, input_data, status) VALUES (?, ?, ?, ?, ?)',
            [exec.transaction_id, exec.skill_id, exec.buyer_id, exec.input_data, exec.status || 'pending']
        );
        return { ...exec, id: result.lastInsertRowid };
    },
    
    getExecutionById: (id) => get('SELECT * FROM executions WHERE id = ?', [id]),
    
    updateExecution: (params) => {
        run(
            'UPDATE executions SET output_data = ?, status = ?, completed_at = ? WHERE id = ?',
            [params.output_data, params.status, params.completed || new Date().toISOString(), params.id]
        );
    },
    
    updateExecutionError: (params) => {
        run(
            'UPDATE executions SET status = "failed", error_message = ?, completed_at = ? WHERE id = ?',
            [params.error, params.completed || new Date().toISOString(), params.id]
        );
    },
    
    // Reviews
    createReview: (review) => {
        run(
            'INSERT INTO reviews (execution_id, buyer_id, skill_id, rating, review) VALUES (?, ?, ?, ?, ?)',
            [review.execution_id, review.buyer_id, review.skill_id, review.rating, review.review]
        );
    },
    
    // Categories
    getCategories: () => all('SELECT * FROM categories ORDER BY sort_order')
};

// Helper to get or create user
function getOrCreateUser(walletAddress, username = null, email = null, bio = null) {
    let user = prepared.getUserByWallet(walletAddress);
    if (!user) {
        user = prepared.createUser({ wallet_address: walletAddress, username, email, bio });
    }
    return user;
}

// Helper to calculate platform fee
function calculatePlatformFee(amount) {
    const feePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT) || 10;
    return amount * (feePercent / 100);
}

// Helper to get seller earnings after fee
function getSellerEarnings(amount) {
    return amount - calculatePlatformFee(amount);
}

module.exports = {
    initDatabase,
    db,
    prepared,
    all,
    get,
    run,
    getOrCreateUser,
    calculatePlatformFee,
    getSellerEarnings,
    saveDatabase
};