/**
 * Cron Jobs for AI Skills Marketplace
 * Handles scheduled tasks like:
 * - Payment processing
 * - Execution queue processing
 * - Analytics aggregation
 * - Notification sending
 */

const cron = require('node-cron');
const { db, prepared } = require('../db');
const { executeSkill } = require('../execution/engine');

// Store scheduled jobs
const scheduledJobs = new Map();

/**
 * Initialize all cron jobs
 */
function initCronJobs() {
    console.log('📅 Initializing cron jobs...');
    
    // Process execution queue every minute
    scheduleJob('execution-queue', '* * * * *', processExecutionQueue);
    
    // Check for pending transactions every 5 minutes
    scheduleJob('pending-transactions', '*/5 * * * *', checkPendingTransactions);
    
    // Aggregate daily stats at midnight
    scheduleJob('daily-stats', '0 0 * * *', aggregateDailyStats);
    
    // Clean up old executions (older than 30 days) weekly
    scheduleJob('cleanup', '0 3 * * 0', cleanupOldExecutions);
    
    console.log('✅ Cron jobs initialized');
}

/**
 * Schedule a cron job
 */
function scheduleJob(name, schedule, task) {
    const job = cron.schedule(schedule, async () => {
        try {
            console.log(`🔄 Running cron job: ${name}`);
            await task();
            console.log(`✅ Completed cron job: ${name}`);
        } catch (error) {
            console.error(`❌ Cron job ${name} failed:`, error.message);
        }
    });
    
    scheduledJobs.set(name, job);
    console.log(`📅 Scheduled: ${name} (${schedule})`);
}

/**
 * Process pending executions in queue
 */
async function processExecutionQueue() {
    if (!db) {
        console.log('⏳ Database not ready, skipping execution queue');
        return;
    }
    
    const pending = db.prepare(`
        SELECT * FROM executions WHERE status = 'pending'
        ORDER BY created_at ASC LIMIT 10
    `).all();
    
    for (const execution of pending) {
        try {
            const inputs = JSON.parse(execution.input_data);
            await executeSkill(execution.skill_id, inputs);
        } catch (error) {
            console.error(`Execution ${execution.id} failed:`, error.message);
        }
    }
}

/**
 * Check for pending transactions that need processing
 */
async function checkPendingTransactions() {
    if (!db) {
        console.log('⏳ Database not ready, skipping pending transactions check');
        return;
    }
    
    const pending = db.prepare(`
        SELECT * FROM transactions WHERE status = 'pending'
        ORDER BY created_at ASC LIMIT 50
    `).all();
    
    // For now, just log pending count
    if (pending.length > 0) {
        console.log(`📋 ${pending.length} pending transactions waiting for payment`);
    }
}

/**
 * Aggregate daily statistics
 */
async function aggregateDailyStats() {
    if (!db) {
        console.log('⏳ Database not ready, skipping daily stats');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Count today's transactions
    const todayTx = db.prepare(`
        SELECT COUNT(*) as count, SUM(amount) as total
        FROM transactions 
        WHERE status = 'completed' 
        AND date(created_at) = date(?)
    `).get(today);
    
    // Count today's executions
    const todayExec = db.prepare(`
        SELECT COUNT(*) as count 
        FROM executions 
        WHERE status = 'completed'
        AND date(created_at) = date(?)
    `).get(today);
    
    console.log(`📊 Daily Stats for ${today}:`);
    console.log(`   Transactions: ${todayTx.count}, Total: $${todayTx.total || 0}`);
    console.log(`   Executions: ${todayExec.count}`);
    
    // Store in a simple stats table or file
    const statsDir = './data/stats';
    const statsFile = `${statsDir}/${today}.json`;
    
    const fs = require('fs');
    if (!fs.existsSync(statsDir)) {
        fs.mkdirSync(statsDir, { recursive: true });
    }
    
    fs.writeFileSync(statsFile, JSON.stringify({
        date: today,
        transactions: todayTx.count,
        revenue: todayTx.total || 0,
        executions: todayExec.count
    }));
}

/**
 * Clean up old execution data
 */
async function cleanupOldExecutions() {
    if (!db) {
        console.log('⏳ Database not ready, skipping cleanup');
        return;
    }
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const old = db.prepare(`
        SELECT COUNT(*) as count FROM executions 
        WHERE created_at < ?
    `).get(thirtyDaysAgo.toISOString());
    
    console.log(`🧹 Found ${old.count} executions older than 30 days`);
    
    // In production, you'd archive or delete old data
    // For now, just log
}

/**
 * Stop all scheduled jobs
 */
function stopAllJobs() {
    console.log('🛑 Stopping all cron jobs...');
    for (const [name, job] of scheduledJobs) {
        job.stop();
    }
    scheduledJobs.clear();
    console.log('✅ All cron jobs stopped');
}

/**
 * Get status of all jobs
 */
function getJobsStatus() {
    const status = {};
    for (const [name, job] of scheduledJobs) {
        status[name] = job ? 'running' : 'stopped';
    }
    return status;
}

module.exports = {
    initCronJobs,
    stopAllJobs,
    getJobsStatus,
    processExecutionQueue,
    aggregateDailyStats,
    cleanupOldExecutions
};