// Vercel API Entry Point
const { initDatabase, prepared, getOrCreateUser } = require('./src/db');
const { executeSkill } = require('./src/execution/engine');
const { createPayment, confirmPayment, getPaymentSummary } = require('./src/payments');

let db = null;

// Initialize on first request
async function getDb() {
    if (!db) {
        db = await initDatabase();
    }
    return db;
}

module.exports = async function handler(req, res) {
    const { url, method } = req;
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
    }
    
    try {
        await getDb();
        
        // Parse URL
        const path = url.split('?')[0];
        
        // Routes
        if (path === '/api/skills') {
            const skills = prepared.getActiveSkills();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data: skills }));
            return;
        }
        
        if (path.startsWith('/api/skills/')) {
            const id = parseInt(path.split('/').pop());
            const skill = prepared.getSkillById(id);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data: skill }));
            return;
        }
        
        if (path === '/api/categories') {
            const categories = prepared.getCategories();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data: categories }));
            return;
        }
        
        if (path === '/health') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
            return;
        }
        
        // 404 for API routes not found
        if (path.startsWith('/api/')) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Not found' }));
            return;
        }
        
        // Serve static HTML for everything else
        const fs = require('fs');
        const htmlPath = './public/index.html';
        if (fs.existsSync(htmlPath)) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(fs.readFileSync(htmlPath));
        } else {
            res.statusCode = 404;
            res.end('Not Found');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
};