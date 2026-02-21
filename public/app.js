/**
 * AI Skills Marketplace - Frontend Application
 */

const API_BASE = '/api';

// State
let skills = [];
let categories = [];
let selectedCategory = null;
let selectedSkill = null;
let walletAddress = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadSkills();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterSkills(e.target.value);
    });
    
    // Connect Wallet
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    
    // Modal Close Buttons
    document.getElementById('closeModal').addEventListener('click', () => {
        document.getElementById('skillModal').classList.remove('active');
    });
    
    document.getElementById('closeResultModal').addEventListener('click', () => {
        document.getElementById('resultModal').classList.remove('active');
    });
    
    // Close modal on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// Load Categories
async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/categories`);
        const data = await response.json();
        
        if (data.success) {
            categories = data.data;
            renderCategories();
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

// Render Categories
function renderCategories() {
    const grid = document.getElementById('categoryGrid');
    
    // Add "All" category
    let html = `
        <div class="category-card ${!selectedCategory ? 'active' : ''}" data-category="">
            <span>All</span>
        </div>
    `;
    
    categories.forEach(cat => {
        html += `
            <div class="category-card ${selectedCategory === cat.slug ? 'active' : ''}" data-category="${cat.slug}">
                <span>${cat.icon}</span>
                <span>${cat.name}</span>
            </div>
        `;
    });
    
    grid.innerHTML = html;
    
    // Add click handlers
    grid.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            selectedCategory = card.dataset.category;
            renderCategories();
            filterSkills(document.getElementById('searchInput').value);
        });
    });
}

// Load Skills
async function loadSkills() {
    try {
        const response = await fetch(`${API_BASE}/skills`);
        const data = await response.json();
        
        if (data.success) {
            skills = data.data;
            renderSkills();
            renderFeaturedSkills();
            updateStats();
        }
    } catch (error) {
        console.error('Failed to load skills:', error);
        document.getElementById('skillsGrid').innerHTML = '<div class="loading">Failed to load skills</div>';
    }
}

// Render Skills
function renderSkills(filteredSkills = null) {
    const grid = document.getElementById('skillsGrid');
    const displaySkills = filteredSkills || skills;
    
    if (displaySkills.length === 0) {
        grid.innerHTML = '<div class="loading">No skills found</div>';
        return;
    }
    
    let html = '';
    displaySkills.forEach(skill => {
        html += `
            <div class="skill-card" data-skill-id="${skill.id}">
                <div class="skill-header">
                    <span class="skill-name">${skill.name}</span>
                    <span class="skill-price">$${skill.price.toFixed(2)}</span>
                </div>
                <p class="skill-description">${skill.description}</p>
                <div class="skill-meta">
                    <span class="skill-category">${skill.category}</span>
                    <span class="skill-rating">⭐ ${skill.rating || 'New'}</span>
                    <span>${skill.total_sales || 0} sales</span>
                </div>
                <button class="btn btn-primary" onclick="openSkillModal(${skill.id})">View Details</button>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

// Render Featured Skills (Top 3)
function renderFeaturedSkills() {
    const grid = document.getElementById('featuredGrid');
    if (!grid) return;
    
    // Featured skill names
    const featuredNames = ['Content Generator', 'Crypto Scanner', 'Web Research'];
    
    const featured = skills.filter(s => featuredNames.includes(s.name)).slice(0, 3);
    
    if (featured.length === 0) {
        grid.innerHTML = '<p>Loading featured skills...</p>';
        return;
    }
    
    let html = '';
    featured.forEach(skill => {
        html += `
            <div class="skill-card featured" data-skill-id="${skill.id}" style="border: 2px solid var(--primary);">
                <div class="featured-badge">⭐ Featured</div>
                <div class="skill-header">
                    <span class="skill-name">${skill.name}</span>
                    <span class="skill-price">$${skill.price.toFixed(2)}</span>
                </div>
                <p class="skill-description">${skill.description}</p>
                <div class="skill-meta">
                    <span class="skill-category">${skill.category}</span>
                    <span class="skill-rating">⭐ ${skill.rating || 'New'}</span>
                </div>
                <button class="btn btn-primary" onclick="openSkillModal(${skill.id})">View Details</button>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

// Filter Skills
function filterSkills(searchTerm) {
    const term = searchTerm.toLowerCase();
    
    const filtered = skills.filter(skill => {
        const matchesSearch = skill.name.toLowerCase().includes(term) || 
                             skill.description.toLowerCase().includes(term);
        const matchesCategory = !selectedCategory || skill.category === selectedCategory;
        
        return matchesSearch && matchesCategory;
    });
    
    renderSkills(filtered);
}

// Update Stats
function updateStats() {
    document.getElementById('skillCount').textContent = skills.length;
    
    // Count unique sellers
    const sellers = new Set(skills.map(s => s.seller_id));
    document.getElementById('sellerCount').textContent = sellers.size;
}

// Open Skill Modal
async function openSkillModal(skillId) {
    try {
        const response = await fetch(`${API_BASE}/skills/${skillId}`);
        const data = await response.json();
        
        if (data.success) {
            selectedSkill = data.data;
            renderSkillModal();
            document.getElementById('skillModal').classList.add('active');
        }
    } catch (error) {
        console.error('Failed to load skill:', error);
        alert('Failed to load skill details');
    }
}

// Render Skill Modal
function renderSkillModal() {
    const modal = document.getElementById('modalBody');
    const skill = selectedSkill;
    
    // Parse input schema
    let inputFields = '';
    try {
        const schema = JSON.parse(skill.input_schema);
        
        if (schema.properties) {
            Object.entries(schema.properties).forEach(([key, prop]) => {
                const required = schema.required?.includes(key) ? 'required' : '';
                const defaultValue = prop.default ? `value="${prop.default}"` : '';
                const placeholder = prop.description ? `placeholder="${prop.description}"` : '';
                
                if (prop.enum) {
                    // Select for enums
                    const options = prop.enum.map(v => `<option value="${v}">${v}</option>`).join('');
                    inputFields += `
                        <div class="form-group">
                            <label>${key} ${schema.required?.includes(key) ? '*' : ''}</label>
                            <select id="input_${key}" ${required}>
                                ${options}
                            </select>
                        </div>
                    `;
                } else {
                    inputFields += `
                        <div class="form-group">
                            <label>${key} ${schema.required?.includes(key) ? '*' : ''}</label>
                            <input type="text" id="input_${key}" ${required} ${defaultValue} ${placeholder}>
                        </div>
                    `;
                }
            });
        }
    } catch (e) {
        inputFields = '<div class="form-group"><p>No input required</p></div>';
    }
    
    modal.innerHTML = `
        <h2>${skill.name}</h2>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">${skill.description}</p>
        
        <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
            <span class="skill-category">${skill.category}</span>
            <span class="skill-price">$${skill.price.toFixed(2)} / execution</span>
        </div>
        
        <hr style="border-color: var(--border); margin: 1.5rem 0;">
        
        <h3>Configure Execution</h3>
        <form id="executionForm" onsubmit="initiatePurchase(event)">
            ${inputFields}
            
            <button type="submit" class="btn btn-success" style="width: 100%; margin-top: 1rem;">
                Continue to Payment - $${skill.price.toFixed(2)}
            </button>
        </form>
    `;
}

// Initiate Purchase
async function initiatePurchase(event) {
    event.preventDefault();
    
    if (!walletAddress) {
        alert('Please connect your wallet first');
        connectWallet();
        return;
    }
    
    const skill = selectedSkill;
    
    // Collect inputs
    window.pendingInputs = {};
    try {
        const schema = JSON.parse(skill.input_schema);
        if (schema.properties) {
            Object.keys(schema.properties).forEach(key => {
                const element = document.getElementById(`input_${key}`);
                if (element) {
                    if (element.tagName === 'SELECT') {
                        window.pendingInputs[key] = element.value;
                    } else {
                        const val = element.value;
                        window.pendingInputs[key] = !isNaN(val) && val !== '' ? parseFloat(val) : val;
                    }
                }
            });
        }
    } catch (e) {
        console.error('Error parsing inputs:', e);
    }
    
    try {
        // Create transaction
        const txResponse = await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                buyer_wallet: walletAddress,
                skill_id: skill.id
            })
        });
        
        const txData = await txResponse.json();
        if (!txData.success) {
            throw new Error(txData.error || 'Failed to create transaction');
        }
        
        window.pendingTransactionId = txData.data.id;
        
        // Get crypto payment info
        const payResponse = await fetch(`${API_BASE}/payments/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transaction_id: window.pendingTransactionId,
                method: 'crypto'
            })
        });
        
        const payData = await payResponse.json();
        if (!payData.success) {
            throw new Error(payData.error || 'Failed to get payment info');
        }
        
        showCryptoPayment(payData.data);
        
    } catch (error) {
        console.error('Purchase init failed:', error);
        alert('Failed to initiate purchase: ' + error.message);
    }
}

// Show Crypto Payment Screen
function showCryptoPayment(paymentData) {
    const modal = document.getElementById('modalBody');
    
    let currenciesHtml = '';
    paymentData.currencies.forEach(c => {
        currenciesHtml += `
            <div class="crypto-option" style="background: var(--surface); padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <strong>${c.currency}</strong>
                    <span style="color: var(--text-muted);">${c.network}</span>
                </div>
                <code style="display: block; background: var(--background); padding: 0.5rem; border-radius: 4px; font-size: 0.85rem; word-break: break-all;">${c.address}</code>
                <button class="btn btn-secondary" style="margin-top: 0.5rem; width: 100%;" onclick="navigator.clipboard.writeText('${c.address}')">📋 Copy Address</button>
            </div>
        `;
    });
    
    modal.innerHTML = `
        <h2>💳 Pay with Crypto</h2>
        <p style="color: var(--text-muted); margin-bottom: 1rem;">Send exactly <strong>$${paymentData.amount}</strong> to any address below:</p>
        
        ${currenciesHtml}
        
        <div style="background: var(--warning-bg); padding: 1rem; border-radius: 8px; margin: 1.5rem 0; border: 1px solid var(--warning);">
            <strong>⚠️ Important:</strong>
            <ul style="margin: 0.5rem 0 0 1rem; padding: 0;">
                <li>Send on the correct network only</li>
                <li>Include memo: ${paymentData.instructions.split('memo: ')[1] || 'N/A'}</li>
                <li>Minimum confirmations: 1</li>
            </ul>
        </div>
        
        <div style="display: flex; gap: 1rem;">
            <button class="btn btn-secondary" onclick="openSkillModal(${selectedSkill.id})" style="flex: 1;">← Back</button>
            <button class="btn btn-success" onclick="confirmPaymentAndExecute()" style="flex: 2;">✅ I've Paid</button>
        </div>
        
        <p style="text-align: center; margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted);">
            Payment will be verified and execution will start automatically
        </p>
    `;
}

// Confirm Payment and Execute
async function confirmPaymentAndExecute() {
    try {
        // Mark payment as complete (in production, this would verify on-chain)
        await fetch(`${API_BASE}/payments/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transaction_id: window.pendingTransactionId })
        });
        
        // Close modal and show executing
        document.getElementById('skillModal').classList.remove('active');
        
        // Execute the skill
        const execResponse = await fetch(`${API_BASE}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transaction_id: window.pendingTransactionId,
                inputs: window.pendingInputs
            })
        });
        
        const execData = await execResponse.json();
        if (!execData.success) {
            throw new Error(execData.error || 'Failed to execute');
        }
        
        pollExecutionResult(execData.data.execution_id);
        
    } catch (error) {
        console.error('Execution failed:', error);
        alert('Execution failed: ' + error.message);
    }
}

// Poll for execution result
async function pollExecutionResult(executionId) {
    const resultModal = document.getElementById('resultModal');
    const resultBody = document.getElementById('resultModalBody');
    
    resultBody.innerHTML = `
        <h2>Executing Skill...</h2>
        <p>Please wait while your skill is running.</p>
        <div class="loading executing">⚡ Processing...</div>
    `;
    resultModal.classList.add('active');
    
    // Poll every 2 seconds
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/executions/${executionId}`);
            const data = await response.json();
            
            if (data.success) {
                const exec = data.data;
                
                if (exec.status === 'completed') {
                    clearInterval(pollInterval);
                    showExecutionResult(exec);
                } else if (exec.status === 'failed') {
                    clearInterval(pollInterval);
                    resultBody.innerHTML = `
                        <h2>Execution Failed</h2>
                        <p style="color: var(--error);">${exec.error_message || 'Unknown error'}</p>
                        <button class="btn btn-secondary" onclick="document.getElementById('resultModal').classList.remove('active')">Close</button>
                    `;
                }
            }
        } catch (error) {
            console.error('Poll error:', error);
        }
    }, 2000);
    
    // Timeout after 60 seconds
    setTimeout(() => {
        clearInterval(pollInterval);
        resultBody.innerHTML = `
            <h2>Execution Timed Out</h2>
            <p>The execution is taking longer than expected.</p>
            <button class="btn btn-secondary" onclick="document.getElementById('resultModal').classList.remove('active')">Close</button>
        `;
    }, 60000);
}

// Show execution result
function showExecutionResult(exec) {
    const resultBody = document.getElementById('resultModal');
    
    let outputDisplay = '';
    try {
        const output = typeof exec.output_data === 'string' 
            ? JSON.parse(exec.output_data) 
            : exec.output_data;
        outputDisplay = `<div class="result-box">${JSON.stringify(output, null, 2)}</div>`;
    } catch (e) {
        outputDisplay = `<div class="result-box">${exec.output_data || 'No output'}</div>`;
    }
    
    resultBody.innerHTML = `
        <h2 style="color: var(--success);">✅ Execution Complete!</h2>
        <p style="color: var(--text-muted);">Your skill has been executed successfully.</p>
        
        ${outputDisplay}
        
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
            <button class="btn btn-secondary" onclick="copyResult()">Copy Result</button>
            <button class="btn btn-primary" onclick="document.getElementById('resultModal').classList.remove('active')">Close</button>
        </div>
    `;
    
    // Store result for copying
    window.lastExecutionResult = exec.output_data;
}

// Copy result to clipboard
function copyResult() {
    if (window.lastExecutionResult) {
        navigator.clipboard.writeText(JSON.stringify(window.lastExecutionResult, null, 2))
            .then(() => alert('Copied to clipboard!'))
            .catch(() => alert('Failed to copy'));
    }
}

// Connect Wallet (Mock for demo)
function connectWallet() {
    // In production, this would connect to MetaMask or other wallet
    // For demo, we'll use a mock address
    walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f4C2e1';
    
    const btn = document.getElementById('connectWallet');
    btn.textContent = `${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}`;
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
    
    alert('Wallet connected! (Demo mode)');
}

// Make functions available globally
window.openSkillModal = openSkillModal;
window.initiatePurchase = initiatePurchase;
window.confirmPaymentAndExecute = confirmPaymentAndExecute;
window.connectWallet = connectWallet;
window.copyResult = copyResult;