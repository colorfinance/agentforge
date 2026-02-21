/**
 * Database Setup Script
 * Initializes SQLite database with schema
 */

const { initDatabase, getOrCreateUser, prepared, run, saveDatabase } = require('../src/db');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    console.log('🗄️ Setting up database...');

    try {
        // Initialize database connection
        await initDatabase();
        console.log('✅ Database connected');

        // Seed initial data
        await seedData();

        console.log('🎉 Database setup complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
}

async function seedData() {
    console.log('🌱 Seeding initial data...');

    // Check if we already have users
    const existingUser = prepared.getUserByWallet('0x6BB903FD399E321cF3075d65a73909F300B01A24');
    if (existingUser) {
        console.log('Database already seeded, skipping...');
        return;
    }

    // Create demo seller
    const seller = getOrCreateUser(
        '0x6BB903FD399E321cF3075d65a73909F300B01A24',
        'sirg_builder',
        'sirg@openclaw.ai',
        'AI agent builder and automation expert'
    );

    console.log(`Created demo seller: ${seller.username} (ID: ${seller.id})`);

    // Create initial skills
    const skills = [
        {
            name: 'Email Triage',
            description: 'Sort and prioritize your inbox. Identify urgent emails and categorize the rest.',
            category: 'productivity',
            price: 5.00,
            input_schema: JSON.stringify({
                type: 'object',
                properties: {
                    max_emails: { type: 'integer', default: 50, description: 'Max emails to process' },
                    priority_keywords: { type: 'array', items: { type: 'string' }, description: 'Keywords for urgent emails' }
                },
                required: ['max_emails']
            })
        },
        {
            name: 'Meeting Prep',
            description: 'Research meeting attendees and create a briefing document.',
            category: 'productivity',
            price: 10.00,
            input_schema: JSON.stringify({
                type: 'object',
                properties: {
                    meeting_topic: { type: 'string', description: 'Main topic of meeting' },
                    attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee names/emails' },
                    duration_minutes: { type: 'integer', default: 60 }
                },
                required: ['meeting_topic', 'attendees']
            })
        },
        {
            name: 'Content Generator',
            description: 'Generate a blog post or article from a topic outline.',
            category: 'marketing',
            price: 15.00,
            input_schema: JSON.stringify({
                type: 'object',
                properties: {
                    topic: { type: 'string', description: 'Main topic or headline' },
                    keywords: { type: 'array', items: { type: 'string' }, description: 'SEO keywords to include' },
                    word_count: { type: 'integer', default: 1000 },
                    tone: { type: 'string', enum: ['professional', 'casual', 'technical'], default: 'professional' }
                },
                required: ['topic']
            })
        },
        {
            name: 'Competitor Monitor',
            description: 'Weekly summary of competitor activities and market changes.',
            category: 'marketing',
            price: 20.00,
            input_schema: JSON.stringify({
                type: 'object',
                properties: {
                    competitors: { type: 'array', items: { type: 'string' }, description: 'Competitor names/domains' },
                    watch_items: { type: 'array', items: { type: 'string' }, description: 'What to monitor' },
                    frequency: { type: 'string', enum: ['daily', 'weekly'], default: 'weekly' }
                },
                required: ['competitors']
            })
        },
        {
            name: 'Web Research',
            description: 'Deep research on any topic with sources and citations.',
            category: 'research',
            price: 25.00,
            input_schema: JSON.stringify({
                type: 'object',
                properties: {
                    topic: { type: 'string', description: 'Research topic or question' },
                    sources_needed: { type: 'integer', default: 5, description: 'Number of sources' },
                    format: { type: 'string', enum: ['summary', 'detailed', 'report'], default: 'summary' }
                },
                required: ['topic']
            })
        },
        {
            name: 'Crypto Scanner',
            description: 'Scan for altcoins with momentum and volume spikes.',
            category: 'finance',
            price: 10.00,
            input_schema: JSON.stringify({
                type: 'object',
                properties: {
                    min_market_cap: { type: 'integer', default: 1000000, description: 'Minimum market cap' },
                    min_volume: { type: 'integer', default: 50000, description: 'Minimum 24h volume' },
                    timeframe: { type: 'string', enum: ['1h', '24h', '7d'], default: '24h' }
                }
            })
        },
        {
            name: 'Image Generator',
            description: 'Generate AI images from text descriptions.',
            category: 'design',
            price: 0.50,
            input_schema: JSON.stringify({
                type: 'object',
                properties: {
                    prompt: { type: 'string', description: 'Image description' },
                    style: { type: 'string', enum: ['realistic', 'cartoon', 'abstract', 'minimal'], default: 'realistic' },
                    size: { type: 'string', enum: ['256x256', '512x512', '1024x1024'], default: '512x512' }
                },
                required: ['prompt']
            })
        },
        {
            name: 'Document Summarizer',
            description: 'Extract key points from PDFs or long articles.',
            category: 'productivity',
            price: 5.00,
            input_schema: JSON.stringify({
                type: 'object',
                properties: {
                    content: { type: 'string', description: 'Text to summarize OR URL to fetch' },
                    max_length: { type: 'integer', default: 200, description: 'Max summary length in words' },
                    style: { type: 'string', enum: ['bullet', 'paragraph', 'tl;dr'], default: 'bullet' }
                },
                required: ['content']
            })
        }
    ];

    for (const skill of skills) {
        prepared.createSkill({
            seller_id: seller.id,
            name: skill.name,
            description: skill.description,
            category: skill.category,
            input_schema: skill.input_schema,
            price: skill.price,
            price_type: 'execution'
        });
    }

    console.log(`Created ${skills.length} initial skills`);
}

// Run if called directly
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };