-- AI Skills Marketplace Database Schema
-- SQLite (MVP) - migrates to Supabase later

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    email TEXT,
    bio TEXT,
    rating REAL DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    total_earnings REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Skills table (what creators sell)
CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    input_schema TEXT NOT NULL,  -- JSON schema for inputs
    output_schema TEXT,           -- JSON schema for outputs
    price REAL NOT NULL,
    price_type TEXT DEFAULT 'execution', -- 'execution', 'subscription', 'api'
    execution_time_seconds INTEGER DEFAULT 300,
    is_active INTEGER DEFAULT 1,
    rating REAL DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending', -- pending, completed, failed, refunded
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (buyer_id) REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (skill_id) REFERENCES skills(id)
);

-- Executions table (actual skill runs)
CREATE TABLE IF NOT EXISTS executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    buyer_id INTEGER NOT NULL,
    input_data TEXT NOT NULL,  -- JSON inputs
    output_data TEXT,          -- JSON outputs
    status TEXT DEFAULT 'pending', -- pending, running, completed, failed
    error_message TEXT,
    cost_compute REAL DEFAULT 0,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (skill_id) REFERENCES skills(id),
    FOREIGN KEY (buyer_id) REFERENCES users(id)
);

-- Skill ratings/reviews
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id INTEGER NOT NULL,
    buyer_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    review TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (execution_id) REFERENCES executions(id),
    FOREIGN KEY (buyer_id) REFERENCES users(id),
    FOREIGN KEY (skill_id) REFERENCES skills(id)
);

-- Categories for browsing
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Insert default categories
INSERT OR IGNORE INTO categories (name, slug, description, icon) VALUES
('Productivity', 'productivity', 'Boost your daily productivity', '⚡'),
('Marketing', 'marketing', 'Content and growth automation', '📈'),
('Research', 'research', 'Deep dive and analysis', '🔍'),
('Development', 'development', 'Coding and technical tasks', '💻'),
('Finance', 'finance', 'Crypto and financial analysis', '💰'),
('Design', 'design', 'Visual and creative work', '🎨'),
('Writing', 'writing', 'Content creation and editing', '✍️'),
('Data', 'data', 'Data analysis and processing', '📊');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_seller ON skills(seller_id);
CREATE INDEX IF NOT EXISTS idx_skills_active ON skills(is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_executions_transaction ON executions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);