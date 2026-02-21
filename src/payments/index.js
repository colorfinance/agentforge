/**
 * Payment Integration Module
 * Supports Stripe and Crypto payments
 */

const { prepared, getSellerEarnings } = require('../db');

// Load Stripe if available
let stripe = null;
try {
    if (process.env.STRIPE_SECRET_KEY) {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
} catch (e) {
    console.log('Stripe not configured - using mock payments');
}

// Crypto wallet addresses
const CRYPTO_WALLETS = {
    ETH: process.env.ETH_WALLET_ADDRESS || '0x6BB903FD399E321cF3075d65a73909F300B01A24',
    USDT: process.env.USDT_WALLET_ADDRESS || '0x6BB903FD399E321cF3075d65a73909F300B01A24',
    SOL: process.env.SOL_WALLET_ADDRESS || '5yHXp64gv52LhX9WLH1WEC8G6cY8wdK6vResEuabHT1h'
};

/**
 * Create a payment intent/checkout session
 */
async function createPayment(transactionId, paymentMethod = 'crypto') {
    const transaction = prepared.getTransactionById(transactionId);
    if (!transaction) {
        throw new Error('Transaction not found');
    }
    
    const skill = prepared.getSkillById(transaction.skill_id);
    
    if (paymentMethod === 'stripe' && stripe) {
        return await createStripeCheckout(transaction);
    } else {
        return await createCryptoPayment(transaction, skill);
    }
}

/**
 * Create Stripe checkout session
 */
async function createStripeCheckout(transaction, skill) {
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
            price_data: {
                currency: 'usd',
                product_data: {
                    name: skill.name,
                    description: skill.description
                },
                unit_amount: Math.round(skill.price * 100)
            },
            quantity: 1
        }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/success?transaction=${transaction.id}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cancel?transaction=${transaction.id}`,
        metadata: {
            transaction_id: transaction.id,
            skill_id: skill.id
        }
    });
    
    return {
        provider: 'stripe',
        checkout_url: session.url,
        session_id: session.id
    };
}

/**
 * Create crypto payment instructions
 */
async function createCryptoPayment(transaction, skill) {
    const fee = prepared.calculatePlatformFee(skill.price);
    const sellerEarnings = skill.price - fee;
    
    return {
        provider: 'crypto',
        currencies: [
            {
                currency: 'USDT',
                network: 'ERC-20',
                address: CRYPTO_WALLETS.USDT,
                amount: skill.price.toFixed(2),
                memo: `TX${transaction.id}`
            },
            {
                currency: 'ETH',
                network: 'ERC-20',
                address: CRYPTO_WALLETS.ETH,
                amount: skill.price.toFixed(2),
                memo: `TX${transaction.id}`
            },
            {
                currency: 'SOL',
                network: 'Solana',
                address: CRYPTO_WALLETS.SOL,
                amount: skill.price.toFixed(2),
                memo: `TX${transaction.id}`
            }
        ],
        instructions: `
1. Send exactly $${skill.price.toFixed(2)} USDT/ETH/SOL to the address above
2. Include the transaction ID (TX${transaction.id}) in the memo/reference
3. Send payment screenshot to @sirg_builder on Moltbook
4. We'll confirm and start execution within 1 hour
        `.trim(),
        fee_percentage: 10,
        platform_fee: fee.toFixed(2),
        seller_receives: sellerEarnings.toFixed(2)
    };
}

/**
 * Verify payment (manual confirmation for crypto)
 */
async function confirmPayment(transactionId, paymentDetails = {}) {
    const transaction = prepared.getTransactionById(transactionId);
    if (!transaction) {
        throw new Error('Transaction not found');
    }
    
    // Update transaction status
    prepared.updateTransactionStatus({
        id: transactionId,
        status: 'completed',
        completed: new Date().toISOString()
    });
    
    // Update seller's earnings
    const skill = prepared.getSkillById(transaction.skill_id);
    const earnings = getSellerEarnings(skill.price);
    
    console.log(`💰 Payment confirmed for TX${transactionId}`);
    console.log(`   Amount: $${skill.price}`);
    console.log(`   Fee (10%): $${(skill.price * 0.1).toFixed(2)}`);
    console.log(`   Seller receives: $${earnings.toFixed(2)}`);
    
    return {
        success: true,
        transaction: {
            ...transaction,
            status: 'completed'
        },
        message: 'Payment confirmed. Skill execution will begin shortly.'
    };
}

/**
 * Process refund
 */
async function processRefund(transactionId, reason = 'requested') {
    const transaction = prepared.getTransactionById(transactionId);
    if (!transaction) {
        throw new Error('Transaction not found');
    }
    
    prepared.updateTransactionStatus({
        id: transactionId,
        status: 'refunded',
        completed: new Date().toISOString()
    });
    
    console.log(`🔴 Refund processed for TX${transactionId}: ${reason}`);
    
    return {
        success: true,
        transaction_id: transactionId,
        status: 'refunded',
        reason
    };
}

/**
 * Get payment summary for a user
 */
function getPaymentSummary(walletAddress) {
    const user = prepared.getUserByWallet(walletAddress);
    if (!user) {
        throw new Error('User not found');
    }
    
    // Get user's purchases (as buyer)
    const purchases = db.prepare(`
        SELECT t.*, s.name as skill_name, s.price as amount
        FROM transactions t
        JOIN skills s ON t.skill_id = s.id
        WHERE t.buyer_id = ?
        ORDER BY t.created_at DESC
    `).all(user.id);
    
    // Get user's sales (as seller)
    const sales = db.prepare(`
        SELECT t.*, s.name as skill_name, s.price as amount
        FROM transactions t
        JOIN skills s ON t.skill_id = s.id
        WHERE t.seller_id = ?
        ORDER BY t.created_at DESC
    `).all(user.id);
    
    // Calculate totals
    const totalSpent = purchases.reduce((sum, p) => sum + (p.status === 'completed' ? p.amount : 0), 0);
    const totalEarned = sales.reduce((sum, s) => sum + (s.status === 'completed' ? s.amount : 0), 0);
    
    return {
        user: {
            id: user.id,
            username: user.username,
            wallet: user.wallet_address
        },
        purchases: purchases.length,
        total_spent: totalSpent.toFixed(2),
        sales: sales.length,
        total_earned: totalEarned.toFixed(2),
        pending_payout: (totalEarned * 0.9).toFixed(2) // 10% fee held
    };
}

/**
 * Generate payout for seller
 */
function generatePayout(walletAddress, amount) {
    const user = prepared.getUserByWallet(walletAddress);
    if (!user) {
        throw new Error('User not found');
    }
    
    return {
        seller_id: user.id,
        wallet: walletAddress,
        amount: amount,
        currency: 'USDT',
        network: 'ERC-20',
        address: walletAddress,
        fee: (amount * 0.1).toFixed(2),
        net_amount: (amount * 0.9).toFixed(2),
        status: 'pending',
        created_at: new Date().toISOString()
    };
}

module.exports = {
    createPayment,
    confirmPayment,
    processRefund,
    getPaymentSummary,
    generatePayout,
    CRYPTO_WALLETS
};