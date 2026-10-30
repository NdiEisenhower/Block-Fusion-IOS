/**
 * ============================================================================
 * Block Rush 2K - iKhokha Payment Gateway Service (iK Pay API)
 * ============================================================================
 * Official integration for direct web purchases, supporting South African
 * Debit/Credit Cards (Visa, Mastercard), Instant EFT & Capitec Pay.
 * 
 * Documentation: https://developer.ikhokha.com/overview
 */

class IKhokhaService {
    static CONFIG = {
        appId: 'IKI2JTBTW4Z4B1AH5UNE7198IK3S5174',
        // Primary backend endpoint via Firebase Hosting rewrite (same-origin, eliminates CORS)
        backendEndpoint: '/api/create-ikhokha-payment',
        // Direct Cloud Function endpoint fallback
        directFunctionEndpoint: 'https://us-central1-games-7b902.cloudfunctions.net/createIkhokhaPayment',
        path: '/public-api/v1/api/payment',
        currency: 'ZAR',
        // Default to live production mode for real web checkout
        mode: 'live' 
    };

    static STORAGE_KEYS = {
        PENDING_TX: 'br2k_ikhokha_pending_tx',
        TX_HISTORY: 'br2k_ikhokha_history',
        MODE_OVERRIDE: 'br2k_ikhokha_mode_override'
    };

    /**
     * Initialize iKhokha service on app startup:
     * - Restores saved mode preference (sandbox vs live)
     * - Inspects URL parameters for redirect returns (?payment=success, ?payment=cancelled)
     */
    static init() {
        console.log('💳 iKhokha Service initialized');

        // Check if environment mode override exists in localStorage
        const savedMode = localStorage.getItem(this.STORAGE_KEYS.MODE_OVERRIDE);
        if (savedMode === 'sandbox' || savedMode === 'live') {
            this.CONFIG.mode = savedMode;
        }

        console.log(`💳 iKhokha active mode: [${this.CONFIG.mode.toUpperCase()}]`);

        // Check for return from payment redirect
        this.checkPaymentReturn();
    }

    /**
     * Get active mode
     */
    static getMode() {
        return this.CONFIG.mode;
    }

    /**
     * Set active mode ('sandbox' | 'live')
     */
    static setMode(mode) {
        if (mode === 'sandbox' || mode === 'live') {
            this.CONFIG.mode = mode;
            localStorage.setItem(this.STORAGE_KEYS.MODE_OVERRIDE, mode);
            console.log(`💳 iKhokha mode switched to: [${mode.toUpperCase()}]`);
            if (typeof Store !== 'undefined' && Store.renderStoreContent) {
                Store.renderStoreContent();
            }
        }
    }

    /**
     * Helper to map product ID to product info and minor currency unit (cents)
     */
    static getProductDetails(productId) {
        const coinPacks = (typeof CONFIG !== 'undefined' && CONFIG.STORE_ITEMS && CONFIG.STORE_ITEMS.coinPacks) 
            ? CONFIG.STORE_ITEMS.coinPacks 
            : [
                { id: 'coins_pack_3000', name: 'Starter Pack', coins: 3000, price: 'R14.99', icon: '💰' },
                { id: 'coins_pack_5000', name: '5000 Coins', coins: 5000, price: 'R22.99', icon: '💰' },
                { id: 'coins_pack_15000', name: '15000 Coins', coins: 15000, price: 'R45.99', icon: '💰', bestValue: true }
            ];

        let pack = coinPacks.find(p => p.id === productId);
        if (pack) {
            const rawPrice = pack.price || 'R14.99';
            const cents = Math.round(parseFloat(rawPrice.replace(/[^0-9.]/g, '')) * 100) || 1499;
            return {
                id: pack.id,
                name: pack.name,
                coins: pack.coins,
                priceText: rawPrice,
                amountCents: cents,
                icon: pack.icon || '💰',
                desc: `+${(pack.coins || 0).toLocaleString()} Coins added to your balance`
            };
        }

        if (productId === 'remove_ads') {
            return {
                id: 'remove_ads',
                name: 'Remove Ads Permanently',
                coins: 200,
                priceText: 'R56.99',
                amountCents: 5699,
                icon: '🚫',
                desc: 'Ad-free couch gameplay forever + 200 bonus coins'
            };
        }

        if (productId === 'buy_me_coffee') {
            return {
                id: 'buy_me_coffee',
                name: 'Buy Me a Coffee',
                coins: 500,
                priceText: 'R28.99',
                amountCents: 2899,
                icon: '☕',
                desc: 'Support the developer + 500 bonus coins'
            };
        }

        return {
            id: productId,
            name: 'Block Rush 2K Store Item',
            coins: 1000,
            priceText: 'R14.99',
            amountCents: 1499,
            icon: '💎',
            desc: 'Digital Item Purchase'
        };
    }

    /**
     * Request an official iKhokha Paylink via secure backend endpoint.
     * Eliminates CORS preflight blocks and keeps merchant credentials secure.
     */
    static async createPaymentLink(productId, customerData = {}) {
        const item = this.getProductDetails(productId);
        const origin = window.location.origin;
        const uid = (typeof App !== 'undefined' && App.state && App.state.uid) ? App.state.uid : 'guest';
        const userEmail = customerData.customerEmail || (typeof App !== 'undefined' && App.state && App.state.userEmail) || localStorage.getItem('ikhokha_customer_email') || 'guest';
        const customerName = customerData.customerName || (typeof App !== 'undefined' && App.state && App.state.playerName) || localStorage.getItem('ikhokha_customer_name') || 'Player';

        const payload = {
            productId: item.id,
            requesterUrl: origin,
            uid: uid,
            userEmail: userEmail,
            customerEmail: userEmail,
            customerName: customerName
        };

        // Try same-origin rewrite first (/api/create-ikhokha-payment), then fallback to direct Cloud Function
        const targetEndpoints = [
            this.CONFIG.backendEndpoint,
            this.CONFIG.directFunctionEndpoint
        ];

        let lastError = null;

        for (const endpoint of targetEndpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    let parsedErr;
                    try { parsedErr = JSON.parse(errorText); } catch (e) {}
                    throw new Error((parsedErr && (parsedErr.message || parsedErr.error)) || `HTTP ${response.status}`);
                }

                const data = await response.json();

                if (data.success && data.paylinkUrl) {
                    // Record in pending transactions locally
                    const pendingRecord = {
                        txId: data.txId,
                        productId: item.id,
                        productName: item.name,
                        amountCents: item.amountCents,
                        priceText: item.priceText,
                        coins: item.coins || 0,
                        customerEmail: userEmail,
                        customerName: customerName,
                        mode: this.CONFIG.mode,
                        createdAt: Date.now(),
                        status: 'pending'
                    };
                    localStorage.setItem(this.STORAGE_KEYS.PENDING_TX + '_' + data.txId, JSON.stringify(pendingRecord));

                    return {
                        success: true,
                        paylinkUrl: data.paylinkUrl,
                        paylinkID: data.paylinkID,
                        txId: data.txId,
                        item: item
                    };
                } else {
                    throw new Error(data.message || 'Payment link generation failed');
                }
            } catch (err) {
                lastError = err;
            }
        }

        throw lastError || new Error('Could not connect to payment gateway');
    }

    /**
     * Show the iKhokha Checkout Modal
     */
    static openCheckoutModal(productId) {
        // Strict platform safeguard: iKhokha is strictly for web browsers, never for Android or Huawei apps
        if (typeof Store !== 'undefined' && Store.isNativeBillingAvailable && Store.isNativeBillingAvailable()) {
            console.log('💳 iKhokha ignored: Native Android (Google Play) or Huawei (HMS) environment active.');
            return;
        }

        const item = this.getProductDetails(productId);
        const isSandbox = this.CONFIG.mode === 'sandbox';

        // Auto-detect existing customer details
        const savedEmail = (typeof App !== 'undefined' && App.state && App.state.userEmail && App.state.userEmail !== 'guest') 
            ? App.state.userEmail 
            : (localStorage.getItem('ikhokha_customer_email') || '');
        const savedName = (typeof App !== 'undefined' && App.state && App.state.playerName) 
            ? App.state.playerName 
            : (localStorage.getItem('ikhokha_customer_name') || '');

        // Remove any existing checkout modal
        const existing = document.getElementById('ikhokha-checkout-modal');
        if (existing) existing.remove();

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'ikhokha-checkout-modal';
        modalOverlay.className = 'ikhokha-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="ikhokha-modal-card">
                <button class="ikhokha-modal-close" onclick="IKhokhaService.closeCheckoutModal()">✕</button>

                <!-- Header / Brand -->
                <div class="ikhokha-modal-header">
                    <div class="ikhokha-brand-pill">
                        <span class="ikhokha-dot"></span>
                        <strong style="color: #fff; letter-spacing: 0.5px;">iKhokha</strong>
                        <span style="color: #94a3b8; font-size: 11px;">iK Pay Checkout</span>
                    </div>
                    ${isSandbox ? `
                        <div class="ikhokha-mode-badge sandbox" title="Click to switch modes" onclick="IKhokhaService.toggleModeFromModal()">
                            🧪 SANDBOX MODE
                        </div>
                    ` : `
                        <div class="ikhokha-mode-badge live" title="Click to switch modes" onclick="IKhokhaService.toggleModeFromModal()">
                            🟢 LIVE GATEWAY
                        </div>
                    `}
                </div>

                <!-- Product Summary -->
                <div class="ikhokha-product-box">
                    <div class="ikhokha-product-icon">${item.icon}</div>
                    <div class="ikhokha-product-info">
                        <div class="ikhokha-product-name">${item.name}</div>
                        <div class="ikhokha-product-desc">${item.desc}</div>
                    </div>
                    <div class="ikhokha-product-price">${item.priceText}</div>
                </div>

                <!-- Customer Reference Information -->
                <div class="ikhokha-customer-box">
                    <div class="ikhokha-customer-header">
                        <span class="ikhokha-customer-title">👤 Customer Information</span>
                        <span class="ikhokha-customer-sub">Used for receipt &amp; order tracking</span>
                    </div>
                    <div class="ikhokha-input-grid">
                        <div class="ikhokha-field-group">
                            <label class="ikhokha-field-label" for="ikhokha-field-email">Email Address (Receipt &amp; Cloud Sync)</label>
                            <input type="email" id="ikhokha-field-email" class="ikhokha-field-input" placeholder="e.g. name@example.com" value="${savedEmail}">
                        </div>
                        <div class="ikhokha-field-group">
                            <label class="ikhokha-field-label" for="ikhokha-field-name">Player / Customer Name</label>
                            <input type="text" id="ikhokha-field-name" class="ikhokha-field-input" placeholder="e.g. Alex" value="${savedName}">
                        </div>
                    </div>
                </div>

                <!-- Payment Methods Badges -->
                <div class="ikhokha-methods-row">
                    <div class="ikhokha-method-tag">💳 Visa / Mastercard</div>
                    <div class="ikhokha-method-tag">🏦 Instant EFT</div>
                    <div class="ikhokha-method-tag">📱 Capitec Pay</div>
                </div>

                <!-- Actions Container -->
                <div class="ikhokha-actions-group" id="ikhokha-actions-container">
                    <button class="btn btn-gold ikhokha-pay-btn" id="btn-ikhokha-launch" onclick="IKhokhaService.handleLaunchPayment('${item.id}')">
                        <span id="btn-ikhokha-text">🔒 Pay ${item.priceText} with iKhokha</span>
                    </button>

                    ${isSandbox ? `
                        <div class="ikhokha-sandbox-divider">
                            <span>OR SANDBOX TEST SIMULATION</span>
                        </div>
                        <button class="btn btn-outline ikhokha-test-btn" id="btn-ikhokha-simulate" onclick="IKhokhaService.simulateSandboxPayment('${item.id}')">
                            ⚡ Instant Test Approval (Simulated)
                        </button>
                    ` : ''}
                </div>

                <!-- Status / Error Feedback -->
                <div id="ikhokha-modal-status" class="ikhokha-status-msg" style="display: none;"></div>

                <!-- Security Guarantee Footer -->
                <div class="ikhokha-modal-footer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span>PCI-DSS Level 1 Encrypted • 3D Secure Protection</span>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        // Add backdrop entrance animation
        requestAnimationFrame(() => {
            modalOverlay.classList.add('active');
        });
    }

    static closeCheckoutModal() {
        const modal = document.getElementById('ikhokha-checkout-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 250);
        }
    }

    static toggleModeFromModal() {
        const newMode = this.CONFIG.mode === 'sandbox' ? 'live' : 'sandbox';
        this.setMode(newMode);
        App.showToast(`Switched iKhokha to ${newMode.toUpperCase()} mode`);
        this.closeCheckoutModal();
    }

    /**
     * Launch real iKhokha Payment Link
     */
    static async handleLaunchPayment(productId) {
        const btn = document.getElementById('btn-ikhokha-launch');
        const textSpan = document.getElementById('btn-ikhokha-text');
        const statusEl = document.getElementById('ikhokha-modal-status');

        // Extract customer input details
        const emailInput = document.getElementById('ikhokha-field-email');
        const nameInput = document.getElementById('ikhokha-field-name');
        const customerEmail = emailInput ? emailInput.value.trim() : '';
        const customerName = nameInput ? nameInput.value.trim() : '';

        // Persist for convenience
        if (customerEmail) localStorage.setItem('ikhokha_customer_email', customerEmail);
        if (customerName) localStorage.setItem('ikhokha_customer_name', customerName);

        try {
            if (btn) btn.disabled = true;
            if (textSpan) textSpan.innerHTML = '<span class="ikhokha-spinner"></span> Connecting to iKhokha...';
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.className = 'ikhokha-status-msg info';
                statusEl.innerHTML = 'Generating secure payment link with iKhokha gateway...';
            }

            const result = await this.createPaymentLink(productId, { customerEmail, customerName });

            if (statusEl) {
                statusEl.className = 'ikhokha-status-msg success';
                statusEl.innerHTML = '✓ Payment link ready! Redirecting to secure checkout...';
            }

            // Short transition delay before redirect
            setTimeout(() => {
                window.location.href = result.paylinkUrl;
            }, 800);

        } catch (err) {
            console.error('💳 Payment link initiation error:', err);
            if (btn) btn.disabled = false;
            const item = this.getProductDetails(productId);
            if (textSpan) textSpan.textContent = `🔒 Pay ${item.priceText} with iKhokha`;

            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.className = 'ikhokha-status-msg error';
                statusEl.innerHTML = `⚠️ Error: ${err.message || 'Could not connect to payment gateway'}.`;
            }
        }
    }

    /**
     * Sandbox Simulator: Simulates a verified iKhokha card payment for instant local testing
     */
    static async simulateSandboxPayment(productId) {
        const item = this.getProductDetails(productId);
        const container = document.getElementById('ikhokha-actions-container');
        const statusEl = document.getElementById('ikhokha-modal-status');

        if (container) {
            container.innerHTML = `
                <div style="background: rgba(15, 23, 42, 0.85); border: 1px dashed rgba(245, 158, 11, 0.4); border-radius: 12px; padding: 14px; text-align: center;">
                    <div style="font-size: 13px; font-weight: 700; color: #f59e0b; margin-bottom: 6px;">
                        🧪 Simulating Test Sandbox Transaction
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 12px;">
                        Verifying test card authorization with iKhokha sandbox simulator...
                    </div>
                    <div class="ikhokha-progress-bar">
                        <div class="ikhokha-progress-fill" id="sandbox-progress-fill"></div>
                    </div>
                </div>
            `;
        }

        const txId = 'BR2K-SANDBOX-' + Date.now();
        const fill = document.getElementById('sandbox-progress-fill');

        // Animate simulation progress
        if (fill) {
            requestAnimationFrame(() => { fill.style.width = '60%'; });
        }

        setTimeout(() => {
            if (fill) fill.style.width = '100%';
        }, 1000);

        setTimeout(() => {
            // Close checkout modal
            this.closeCheckoutModal();

            // Fulfill purchase in game engine
            this.fulfillPurchase(productId, txId, 'Sandbox Test Simulation');
        }, 1800);
    }

    /**
     * Inspect URL params on page load for payment callback returns
     */
    static checkPaymentReturn() {
        // Strict platform safeguard: Ignore on native mobile wrappers
        if (typeof Store !== 'undefined' && Store.isNativeBillingAvailable && Store.isNativeBillingAvailable()) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const paymentStatus = params.get('payment');
        const txId = params.get('txId');
        const productId = params.get('item');

        if (!paymentStatus) return;

        console.log(`💳 Payment return detected: status=[${paymentStatus}], txId=[${txId}], product=[${productId}]`);

        if (paymentStatus === 'success' && productId) {
            // Fulfill the purchase
            this.fulfillPurchase(productId, txId || 'TX-' + Date.now(), 'iKhokha Gateway Return');
        } else if (paymentStatus === 'cancelled') {
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('ℹ️ Payment was cancelled. No charges were made.');
            }
        } else if (paymentStatus === 'failed') {
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('❌ Payment was not completed. Please try again.');
            }
        }

        // Clean query parameters from URL without reloading
        try {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        } catch (e) {}
    }

    /**
     * Master fulfillment method: calls App.handlePurchaseSuccess, updates Firebase,
     * triggers celebratory fireworks and shows the confirmation popup.
     */
    static fulfillPurchase(productId, txId, channel = 'iKhokha') {
        const item = this.getProductDetails(productId);
        console.log(`🎉 Fulfilling purchase for [${productId}] (${item.name}) via ${channel}`);

        // Fulfill through App engine
        if (typeof App !== 'undefined' && App.handlePurchaseSuccess) {
            App.handlePurchaseSuccess(productId, txId);
        } else {
            console.warn('App.handlePurchaseSuccess not available, fulfilling directly');
            if (typeof App !== 'undefined' && App.state) {
                if (item.coins) App.state.coins = (App.state.coins || 0) + item.coins;
                if (productId === 'remove_ads') App.state.adsRemoved = true;
                if (App.saveState) App.saveState();
                if (App.updateAllCoinDisplays) App.updateAllCoinDisplays();
            }
        }

        // Trigger victory sound and fireworks
        try { if (typeof SoundManager !== 'undefined' && SoundManager.coin) SoundManager.coin(); } catch (e) {}
        try { if (typeof Fireworks !== 'undefined' && Fireworks.start) Fireworks.start(3500); } catch (e) {}

        // Log transaction to Firebase Realtime Database
        this.saveCompletedTransactionToFirebase(item, txId, channel);

        // Show celebratory popup
        this.showPurchaseSuccessPopup(item, txId, channel);
    }

    /**
     * Celebratory purchase success popup
     */
    static showPurchaseSuccessPopup(item, txId, channel) {
        if (typeof PopupManager !== 'undefined' && PopupManager.show) {
            PopupManager.show({
                icon: '🎉',
                title: 'Purchase Successful!',
                subtitle: 'Your items are now active & synced',
                details: [
                    { label: 'Item', value: item.name },
                    { label: 'Reward', value: item.coins ? `+${item.coins.toLocaleString()} Coins` : 'Ad-Free Permanent' },
                    { label: 'Method', value: 'iKhokha iK Pay' },
                    { label: 'Reference', value: txId.substring(0, 18) }
                ],
                customContent: `
                    <div style="padding: 12px 0 6px; font-size: 13px; color: #cbd5e1; line-height: 1.5; text-align: center;">
                        Thank you for supporting <strong>Block Rush 2K</strong>!<br>
                        Your new balance is ready to spend on dynamic world themes and puzzle powerups.
                    </div>
                `,
                confirmText: 'Awesome! 🚀',
                onConfirm: () => {},
                showCancel: false
            });
        } else {
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast(`🎉 ${item.name} added successfully!`);
            }
        }
    }

    /**
     * Persist pending transaction to Firebase Realtime Database
     */
    static savePendingTransactionToFirebase(record) {
        try {
            if (typeof firebase !== 'undefined' && firebase.database) {
                const uid = (typeof App !== 'undefined' && App.state && App.state.uid) ? App.state.uid : 'guest';
                const db = firebase.database();
                db.ref(`transactions/pending/${record.txId}`).set({
                    ...record,
                    userId: uid
                });
            }
        } catch (e) {
            console.warn('Could not save pending transaction to Firebase:', e);
        }
    }

    /**
     * Persist completed transaction to Firebase Realtime Database & local history
     */
    static saveCompletedTransactionToFirebase(item, txId, channel) {
        try {
            const uid = (typeof App !== 'undefined' && App.state && App.state.uid) ? App.state.uid : 'guest';
            const userEmail = (typeof App !== 'undefined' && App.state && App.state.userEmail && App.state.userEmail !== 'guest') 
                ? App.state.userEmail 
                : (localStorage.getItem('ikhokha_customer_email') || 'guest');
            const customerName = (typeof App !== 'undefined' && App.state && App.state.playerName) 
                ? App.state.playerName 
                : (localStorage.getItem('ikhokha_customer_name') || 'Player');

            const record = {
                txId: txId,
                productId: item.id,
                productName: item.name,
                amountCents: item.amountCents,
                priceText: item.priceText,
                coins: item.coins || 0,
                channel: channel,
                gateway: 'iKhokha iK Pay',
                userId: uid,
                userEmail: userEmail,
                customerEmail: userEmail,
                customerName: customerName,
                timestamp: Date.now(),
                dateFormatted: new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                status: 'completed'
            };

            // Save to localStorage 'br2k_ikhokha_history'
            try {
                let history = JSON.parse(localStorage.getItem('br2k_ikhokha_history') || '[]');
                if (!Array.isArray(history)) history = [];
                if (!history.find(h => h.txId === txId)) {
                    history.unshift(record);
                    localStorage.setItem('br2k_ikhokha_history', JSON.stringify(history.slice(0, 50)));
                }
            } catch (e) {}

            // Save to Firebase
            if (typeof firebase !== 'undefined' && firebase.database) {
                const db = firebase.database();

                // Save under user's purchases
                if (uid && uid !== 'guest') {
                    db.ref(`users/${uid}/purchases/${txId}`).set(record);
                }

                // Save under global transactions ledger for tracking and portal reporting
                db.ref(`transactions/completed/${txId}`).set(record);
            }
        } catch (e) {
            console.warn('Could not save completed transaction:', e);
        }
    }

    /**
     * Query all past payments for this user (Firebase Realtime Database + local cache + endpoint)
     */
    static async getPaymentHistory() {
        const uid = (typeof App !== 'undefined' && App.state && App.state.uid) ? App.state.uid : 'guest';
        const email = (typeof App !== 'undefined' && App.state && App.state.userEmail && App.state.userEmail !== 'guest') 
            ? App.state.userEmail 
            : (localStorage.getItem('ikhokha_customer_email') || '');

        const combined = new Map();

        // 1. Local history cache
        try {
            const localHist = JSON.parse(localStorage.getItem('br2k_ikhokha_history') || '[]');
            if (Array.isArray(localHist)) {
                localHist.forEach(tx => { if (tx && tx.txId) combined.set(tx.txId, tx); });
            }
        } catch (e) {}

        // 2. Direct Firebase Realtime Database
        try {
            if (typeof firebase !== 'undefined' && firebase.database && uid && uid !== 'guest') {
                const snap = await firebase.database().ref(`users/${uid}/purchases`).once('value');
                const val = snap.val();
                if (val) {
                    Object.values(val).forEach(tx => { if (tx && tx.txId) combined.set(tx.txId, tx); });
                }
            }
        } catch (e) {}

        // 3. Fallback Cloud Function endpoint (/api/get-payment-history)
        if (combined.size === 0 && (uid !== 'guest' || email)) {
            try {
                const url = `/api/get-payment-history?uid=${encodeURIComponent(uid)}&email=${encodeURIComponent(email)}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.history)) {
                        data.history.forEach(tx => { if (tx && tx.txId) combined.set(tx.txId, tx); });
                    }
                }
            } catch (e) {}
        }

        const list = Array.from(combined.values());
        list.sort((a, b) => (b.timestamp || b.completedAt || b.createdAt || 0) - (a.timestamp || a.completedAt || a.createdAt || 0));
        return list;
    }

    /**
     * Display Payment History Modal
     */
    static async openHistoryModal() {
        const existing = document.getElementById('ikhokha-history-modal');
        if (existing) existing.remove();

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'ikhokha-history-modal';
        modalOverlay.className = 'ikhokha-modal-overlay active';
        modalOverlay.innerHTML = `
            <div class="ikhokha-modal-card ikhokha-history-card">
                <button class="ikhokha-modal-close" onclick="IKhokhaService.closeHistoryModal()">✕</button>

                <div class="ikhokha-modal-header" style="margin-bottom: 14px;">
                    <div class="ikhokha-brand-pill">
                        <span class="ikhokha-dot"></span>
                        <strong style="color: #fff;">My Purchases &amp; Receipts</strong>
                    </div>
                    <span style="font-size: 11px; color: #38bdf8; font-weight: 700;">iKhokha Secured</span>
                </div>

                <div id="ikhokha-history-content" style="min-height: 180px;">
                    <div style="text-align:center; padding: 40px 0; color: #94a3b8;">
                        <span class="ikhokha-spinner"></span> Loading payment history...
                    </div>
                </div>

                <div class="ikhokha-modal-footer" style="margin-top: auto;">
                    <span>All web payments are processed via iKhokha iK Pay API</span>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        const history = await this.getPaymentHistory();
        const container = document.getElementById('ikhokha-history-content');
        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = `
                <div class="ikhokha-history-empty">
                    <div class="ikhokha-empty-icon">🧾</div>
                    <div style="font-size: 14px; font-weight: 800; color: #fff; margin-bottom: 4px;">No Payments Yet</div>
                    <div style="font-size: 12px; line-height: 1.4;">Your completed coin packages, subscriptions, and store purchases will appear here with instant digital receipts.</div>
                </div>
            `;
            return;
        }

        let totalCents = 0;
        let rowsHtml = '';

        history.forEach(tx => {
            const cents = tx.amountCents || (tx.item && tx.item.amount) || 0;
            totalCents += cents;
            const price = tx.priceText || (tx.item && tx.item.price) || `R${(cents / 100).toFixed(2)}`;
            const dateStr = tx.dateFormatted || (tx.timestamp || tx.completedAt ? new Date(tx.timestamp || tx.completedAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Verified');
            const name = tx.productName || (tx.item && tx.item.name) || tx.productId || 'Store Item';
            const icon = tx.productId === 'remove_ads' ? '🚫' : (tx.productId === 'buy_me_coffee' ? '☕' : (tx.coins ? '🪙' : '💎'));
            const ref = tx.txId || 'TX';

            rowsHtml += `
                <div class="ikhokha-tx-row" onclick="IKhokhaService.showReceiptModal('${ref}')" style="cursor: pointer;" title="Click to view digital receipt">
                    <div class="ikhokha-tx-left">
                        <div class="ikhokha-tx-icon">${icon}</div>
                        <div class="ikhokha-tx-info">
                            <div class="ikhokha-tx-name">${name}</div>
                            <div class="ikhokha-tx-meta">
                                <span>📅 ${dateStr}</span>
                                <span>•</span>
                                <span class="ikhokha-tx-ref">${ref.substring(0, 16)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="ikhokha-tx-right">
                        <div class="ikhokha-tx-price">${price}</div>
                        <span class="ikhokha-tx-badge">✓ Paid</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;">
                <span style="font-size: 12px; color: #cbd5e1; font-weight: 600;">Total Completed Orders</span>
                <span style="font-size: 14px; color: #38bdf8; font-weight: 800;">${history.length} (${ 'R' + (totalCents / 100).toFixed(2) })</span>
            </div>
            <div class="ikhokha-history-list">
                ${rowsHtml}
            </div>
        `;
    }

    static closeHistoryModal() {
        const modal = document.getElementById('ikhokha-history-modal');
        if (modal) modal.remove();
    }

    /**
     * Show detailed Digital Receipt Modal
     */
    static async showReceiptModal(txId) {
        const history = await this.getPaymentHistory();
        const tx = history.find(t => t.txId === txId) || { txId };
        const price = tx.priceText || (tx.amountCents ? `R${(tx.amountCents / 100).toFixed(2)}` : 'R14.99');
        const name = tx.productName || tx.productId || 'Store Item';
        const email = tx.customerEmail || tx.userEmail || 'Customer';
        const dateStr = tx.dateFormatted || (tx.timestamp ? new Date(tx.timestamp).toLocaleString('en-ZA') : new Date().toLocaleString('en-ZA'));

        const receiptOverlay = document.createElement('div');
        receiptOverlay.id = 'ikhokha-receipt-modal';
        receiptOverlay.className = 'ikhokha-modal-overlay active';
        receiptOverlay.style.zIndex = '100000';
        receiptOverlay.innerHTML = `
            <div class="ikhokha-modal-card" style="max-width: 420px;">
                <button class="ikhokha-modal-close" onclick="document.getElementById('ikhokha-receipt-modal').remove()">✕</button>

                <div class="ikhokha-receipt-sheet">
                    <div class="ikhokha-receipt-header">
                        <div style="font-size: 18px; font-weight: 900; color: #fff; letter-spacing: 0.5px;">BLOCK RUSH 2K</div>
                        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Official iKhokha Payment Receipt</div>
                        <div style="font-size: 10px; color: #4ade80; font-weight: 800; margin-top: 6px; letter-spacing: 1px;">✓ PAYMENT COMPLETED &amp; SYNCED</div>
                    </div>

                    <table class="ikhokha-receipt-table">
                        <tr>
                            <td style="color: #94a3b8;">Transaction Reference</td>
                            <td style="font-family: monospace; color: #38bdf8;">${tx.txId}</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8;">Date &amp; Time</td>
                            <td>${dateStr}</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8;">Customer Reference</td>
                            <td>${email}</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8;">Item Description</td>
                            <td>${name}</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8;">Payment Gateway</td>
                            <td>iKhokha iK Pay API</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8;">Status</td>
                            <td style="color: #4ade80;">PAID</td>
                        </tr>
                        <tr style="border-top: 2px solid rgba(255,255,255,0.15);">
                            <td style="font-size: 14px; font-weight: 800; color: #fff; padding-top: 10px;">Total Paid</td>
                            <td style="font-size: 16px; font-weight: 900; color: #4ade80; padding-top: 10px;">${price}</td>
                        </tr>
                    </table>

                    <div style="display: flex; gap: 8px; margin-top: 16px;">
                        <button class="btn btn-outline" onclick="window.print()" style="flex: 1; height: 38px; font-size: 12px; font-weight: 700; border-radius: 10px;">
                            🖨️ Print Receipt
                        </button>
                        <button class="btn btn-gold" onclick="document.getElementById('ikhokha-receipt-modal').remove()" style="flex: 1; height: 38px; font-size: 12px; font-weight: 700; border-radius: 10px;">
                            Done
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(receiptOverlay);
    }
}

// Attach to window
window.IKhokhaService = IKhokhaService;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => IKhokhaService.init());
} else {
    IKhokhaService.init();
}
