/**
 * AI Skills Marketplace - Main API Server
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load environment variables
require('dotenv').config();

const { initDatabase, prepared, getOrCreateUser } = require('../db');
const { executeSkill } = require('../execution/engine');
const { createPayment, confirmPayment, getPaymentSummary } = require('../payments');
const { initCronJobs } = require('../cron');

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')));

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// ====================
// Health Check
// ====================
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ====================
// Categories
// ====================
app.get('/api/categories', (req, res) => {
    try {
        const categories = prepared.getCategories();
        res.json({ success: true, data: categories });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ====================
// Skills API
// ====================

// List all skills
app.get('/api/skills', (req, res) => {
    try {
        const { category, query } = req.query;
        
        let skills;
        if (query) {
            skills = prepared.searchSkills(query);
        } else if (category) {
            skills = prepared.getSkillsByCategory(category);
        } else {
            skills = prepared.getActiveSkills();
        }
        
        res.json({ success: true, data: skills });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get skill by ID
app.get('/api/skills/:id', (req, res) => {
    try {
        const skill = prepared.getSkillById(parseInt(req.params.id));
        if (!skill) {
            return res.status(404).json({ success: false, error: 'Skill not found' });
        }
        
        // Parse JSON schemas
        skill.input_schema = JSON.parse(skill.input_schema);
        if (skill.output_schema) {
            skill.output_schema = JSON.parse(skill.output_schema);
        }
        
        res.json({ success: true, data: skill });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create a new skill
app.post('/api/skills', (req, res) => {
    try {
        const { wallet_address, name, description, category, input_schema, price, price_type } = req.body;
        
        if (!wallet_address || !name || !description || !category || !price) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }
        
        // Get or create seller
        const seller = getOrCreateUser(wallet_address);
        
        const result = prepared.createSkill({
            seller_id: seller.id,
            name,
            description,
            category,
            input_schema: JSON.stringify(input_schema),
            price,
            price_type: price_type || 'execution'
        });
        
        const skill = prepared.getSkillById(result.id);
        
        res.status(201).json({ success: true, data: skill });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get skills by seller
app.get('/api/users/:wallet/skills', (req, res) => {
    try {
        const user = prepared.getUserByWallet(req.params.wallet);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        const skills = prepared.getSkillsBySeller(user.id);
        res.json({ success: true, data: skills });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ====================
// Users API
// ====================

// Get user by wallet
app.get('/api/users/:wallet', (req, res) => {
    try {
        const user = prepared.getUserByWallet(req.params.wallet);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create or update user
app.post('/api/users', (req, res) => {
    try {
        const { wallet_address, username, email, bio } = req.body;
        
        if (!wallet_address) {
            return res.status(400).json({ success: false, error: 'wallet_address required' });
        }
        
        const user = getOrCreateUser(wallet_address, username, email, bio);
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ====================
// Transactions API
// ====================

// Create a transaction (initiate purchase)
app.post('/api/transactions', (req, res) => {
    try {
        const { buyer_wallet, skill_id } = req.body;
        
        if (!buyer_wallet || !skill_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Get buyer
        const buyer = prepared.getUserByWallet(buyer_wallet);
        if (!buyer) {
            return res.status(404).json({ success: false, error: 'Buyer not found' });
        }
        
        // Get skill
        const skill = prepared.getSkillById(parseInt(skill_id));
        if (!skill) {
            return res.status(404).json({ success: false, error: 'Skill not found' });
        }
        
        // Create transaction
        const result = prepared.createTransaction({
            buyer_id: buyer.id,
            seller_id: skill.seller_id,
            skill_id: skill.id,
            amount: skill.price,
            status: 'pending'
        });
        
        const transaction = prepared.getTransactionById(result.id);
        
        res.status(201).json({ 
            success: true, 
            data: {
                id: transaction.id,
                status: transaction.status,
                amount: transaction.amount,
                skill: {
                    id: skill.id,
                    name: skill.name,
                    price: skill.price
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get transaction status
app.get('/api/transactions/:id', (req, res) => {
    try {
        const transaction = prepared.getTransactionById(parseInt(req.params.id));
        if (!transaction) {
            return res.status(404).json({ success: false, error: 'Transaction not found' });
        }
        res.json({ success: true, data: transaction });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ====================
// Payments API
// ====================

// Get payment options for a transaction
app.post('/api/payments/options', (req, res) => {
    try {
        const { transaction_id } = req.body;
        
        const transaction = prepared.getTransactionById(parseInt(transaction_id));
        if (!transaction) {
            return res.status(404).json({ success: false, error: 'Transaction not found' });
        }
        
        const skill = prepared.getSkillById(transaction.skill_id);
        
        // Return payment options (without creating actual payment)
        res.json({
            success: true,
            data: {
                transaction_id: transaction.id,
                amount: transaction.amount,
                skill: skill.name,
                options: [
                    { method: 'crypto', label: 'Crypto (USDT/ETH/SOL)', recommended: true },
                    { method: 'stripe', label: 'Credit Card (Stripe)', requires_key: true }
                ]
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create checkout session
app.post('/api/payments/checkout', (req, res) => {
    try {
        const { transaction_id, method } = req.body;
        
        const transaction = prepared.getTransactionById(parseInt(transaction_id));
        if (!transaction) {
            return res.status(404).json({ success: false, error: 'Transaction not found' });
        }
        
        const skill = prepared.getSkillById(transaction.skill_id);
        
        if (method === 'stripe') {
            // Stripe checkout
            res.json({
                success: true,
                data: {
                    provider: 'stripe',
                    message: 'Stripe integration coming soon',
                    amount: transaction.amount
                }
            });
        } else {
            // Crypto payment
            res.json({
                success: true,
                data: {
                    provider: 'crypto',
                    currencies: [
                        { currency: 'USDT', network: 'ERC-20', address: '0x6BB903FD399E321cF3075d65a73909F300B01A24' },
                        { currency: 'ETH', network: 'ERC-20', address: '0x6BB903FD399E321cF3075d65a73909F300B01A24' },
                        { currency: 'SOL', network: 'Solana', address: '5yHXp64gv52LhX9WLH1WEC8G6cY8wdK6vResEuabHT1h' }
                    ],
                    instructions: `Send $${transaction.amount} USDT/ETH to the address above with memo: TX${transaction.id}`,
                    transaction_id: transaction.id
                }
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Confirm payment (manual for crypto)
app.post('/api/payments/confirm', (req, res) => {
    try {
        const { transaction_id } = req.body;
        
        const result = confirmPayment(parseInt(transaction_id));
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get payment summary for user
app.get('/api/payments/summary/:wallet', (req, res) => {
    try {
        const summary = getPaymentSummary(req.params.wallet);
        res.json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ====================
// Executions API
// ====================

// Execute a skill
app.post('/api/execute', async (req, res) => {
    try {
        const { transaction_id, inputs } = req.body;
        
        if (!transaction_id) {
            return res.status(400).json({ success: false, error: 'transaction_id required' });
        }
        
        // Get transaction
        const transaction = prepared.getTransactionById(parseInt(transaction_id));
        if (!transaction) {
            return res.status(404).json({ success: false, error: 'Transaction not found' });
        }
        
        if (transaction.status !== 'completed') {
            return res.status(400).json({ 
                success: false, 
                error: `Transaction status is ${transaction.status}. Please complete payment first.` 
            });
        }
        
        // Get skill
        const skill = prepared.getSkillById(transaction.skill_id);
        
        // Run execution
        const result = await executeSkill(skill.id, inputs || {});
        
        res.json({ 
            success: true, 
            data: {
                execution_id: result.executionId,
                status: result.status,
                message: 'Execution started'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get execution status
app.get('/api/executions/:id', (req, res) => {
    try {
        const execution = prepared.getExecutionById(parseInt(req.params.id));
        if (!execution) {
            return res.status(404).json({ success: false, error: 'Execution not found' });
        }
        
        if (execution.output_data) {
            execution.output_data = JSON.parse(execution.output_data);
        }
        if (execution.input_data) {
            execution.input_data = JSON.parse(execution.input_data);
        }
        
        res.json({ success: true, data: execution });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ====================
// Reviews API
// ====================

app.post('/api/reviews', (req, res) => {
    try {
        const { execution_id, buyer_wallet, rating, review } = req.body;
        
        const buyer = prepared.getUserByWallet(buyer_wallet);
        if (!buyer) {
            return res.status(404).json({ success: false, error: 'Buyer not found' });
        }
        
        const execution = prepared.getExecutionById(parseInt(execution_id));
        if (!execution) {
            return res.status(404).json({ success: false, error: 'Execution not found' });
        }
        
        prepared.createReview({
            execution_id: parseInt(execution_id),
            buyer_id: buyer.id,
            skill_id: execution.skill_id,
            rating,
            review
        });
        
        res.status(201).json({ success: true, message: 'Review submitted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ====================
// Stats API
// ====================

app.get('/api/stats', (req, res) => {
    try {
        const stats = {
            skills_count: prepared.getActiveSkills().length,
            categories_count: prepared.getCategories().length,
            transactions_today: 0,
            revenue_today: 0
        };
        
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ====================
// Error Handler
// ====================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message 
    });
});

// ====================
// Start Server (Local only)
// ====================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Only start server locally - Vercel handles the server
if (!process.env.VERCEL) {
    async function start() {
        // Initialize database
        await initDatabase();
        
        // Start cron jobs (local only)
        initCronJobs();
        
        // Start server
        app.listen(PORT, HOST, () => {
            console.log(`
🚀 AgentForge API v1.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Server: http://${HOST}:${PORT}
📍 Health: http://${HOST}:${PORT}/health
🔗 API Base: http://${HOST}:${PORT}/api
🎨 UI: http://${HOST}:${PORT}/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            `);
        });
    }
    
    start().catch(err => {
        console.error('Failed to start:', err);
        process.exit(1);
    });
}

module.exports = app;