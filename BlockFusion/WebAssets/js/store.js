// Store Management - Unified for Web and Android with Google Play Billing
class Store {
    static init() {
        console.log('🛒 Store initialized');
        try {
            this.renderStoreContent();
        } catch (e) {
            console.error('Error in Store.init:', e);
        }
    }

    static isNativeBillingAvailable() {
        return (typeof Android !== 'undefined' && typeof Android.launchPurchase === 'function') ||
               (typeof Billing !== 'undefined' && typeof Billing.launchPurchase === 'function');
    }

    static renderStoreContent() {
        const container = document.getElementById('store-content');
        if (!container) return;

        try {
            const isNative = Store.isNativeBillingAvailable();
            const coinCount = (typeof App !== 'undefined' && App.state && App.state.coins) ? App.state.coins : 0;
            const prices = (typeof App !== 'undefined' && App.googlePlayPrices) ? App.googlePlayPrices : {};

            let html = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:0 4px;">
                    <span style="font-size:12px;color:#94a3b8;font-weight:600;display:flex;align-items:center;gap:6px;">
                        <span style="color:var(--accent-secondary)">●</span> ${isNative ? 'Store Connected (In-App)' : 'Web Store Preview'}
                    </span>
                    <button class="btn btn-sm btn-outline" onclick="Store.restorePurchases()" style="font-size:11px;padding:4px 10px;border-radius:20px;border-color:rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);">
                        🔄 Restore
                    </button>
                </div>
            `;

            // If on website without native billing bridge, show clear paywall/app guidance notice
            if (!isNative) {
                html += `
                <div class="store-web-notice" style="background:linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(30,41,59,0.95) 100%);border:1px solid rgba(245,158,11,0.35);border-radius:14px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 4px 14px rgba(0,0,0,0.3);">
                    <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                        <span style="font-size:24px;flex-shrink:0;">📲</span>
                        <div style="font-size:12px;color:#fde68a;line-height:1.4;">
                            <strong style="color:#fff;">Available on Mobile App:</strong> Coin packs and real-money purchases are currently available inside the official Block Rush 2K Mobile App. Download to buy &amp; your balance syncs right back here!
                        </div>
                    </div>
                    <a href="/download" class="btn btn-gold" style="font-size:12px;font-weight:900;padding:6px 14px;border-radius:10px;text-decoration:none;white-space:nowrap;width:auto;height:36px;flex-shrink:0;">
                        Get App
                    </a>
                </div>
                `;
            }

            // Coin Packs Section
            html += `
                <div class="store-section">
                    <h3 class="store-section-title" style="margin:12px 0 8px;color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;gap:8px;padding-left:4px;">
                        💰 Coin Packs
                    </h3>
                    <div class="store-grid">
            `;

            // Coin Packs
            const coinPacks = (typeof CONFIG !== 'undefined' && CONFIG.STORE_ITEMS && CONFIG.STORE_ITEMS.coinPacks) ? CONFIG.STORE_ITEMS.coinPacks : [
                { id: 'coins_pack_3000', name: 'Starter Pack', coins: 3000, price: 'R14.99', icon: '💰' },
                { id: 'coins_pack_5000', name: '5000 Coins', coins: 5000, price: 'R22.99', icon: '💰' },
                { id: 'coins_pack_15000', name: '15000 Coins', coins: 15000, price: 'R45.99', icon: '💰', bestValue: true }
            ];

            coinPacks.forEach(pack => {
                const displayPrice = prices[pack.id] || pack.price || 'R14.99';
                const isBestValue = pack.bestValue;

                html += `
                <div class="store-item ${isBestValue ? 'store-item-best-value' : ''}" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:${isBestValue ? 'linear-gradient(135deg, rgba(247, 201, 72, 0.14) 0%, rgba(30, 41, 59, 0.95) 100%)' : 'var(--bg-surface)'};border-radius:16px;border:1px solid rgba(255,255,255,0.05);position:relative;gap:12px;">
                    ${isBestValue ? `
                    <div class="store-badge-best-value" style="position:absolute;top:-11px;left:16px;background:linear-gradient(135deg, #FFD700 0%, #F59E0B 100%);color:#0f172a;font-size:9px;padding:3px 10px;border-radius:20px;font-weight:900;letter-spacing:0.8px;text-transform:uppercase;box-shadow:0 3px 10px rgba(245,158,11,0.45);border:1.5px solid #FFFBEB;z-index:10;display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;line-height:1.2;width:auto;height:auto;max-width:none;pointer-events:none;">
                        ⭐ BEST VALUE
                    </div>` : ''}
                    <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
                        <div style="width:40px;height:40px;background:${isBestValue ? 'rgba(247,201,72,0.2)' : 'rgba(247,201,72,0.1)'};border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <span class="custom-coin" style="width:22px;height:22px;"></span>
                        </div>
                        <div class="item-info" style="min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;">
                            <div class="item-name" style="font-weight:800;color:#fff;font-size:14px;margin-bottom:1px;white-space:normal;word-break:break-word;line-height:1.25;">
                                ${pack.name}
                            </div>
                            <div class="item-desc" style="color:var(--gold);font-size:12px;font-weight:700;white-space:normal;word-break:break-word;line-height:1.25;display:flex;align-items:center;gap:4px;">
                                +${(pack.coins || 3000).toLocaleString()} Coins
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-gold" onclick="Store.purchaseItem('${pack.id}')" style="min-width:80px;height:36px;font-weight:900;border-radius:12px;font-size:13px;box-shadow:var(--shadow-gold);flex-shrink:0;padding:0 12px;white-space:nowrap;">
                        ${displayPrice}
                    </button>
                </div>`;
            });
            html += `
                    </div>
                </div>
            `;

            // Special Offers
            // Remove Ads & Offline Subscription only apply to native mobile apps with active billing
            const showAdsUi = (typeof CONFIG !== 'undefined' && CONFIG.isAdsUiEnabled) ? CONFIG.isAdsUiEnabled() : true;
            const adsRemoved = (typeof App !== 'undefined' && App.state) ? App.state.adsRemoved : false;
            const removeAdsPrice = prices['remove_ads'] || (CONFIG && CONFIG.STORE_ITEMS && CONFIG.STORE_ITEMS.removeAds ? CONFIG.STORE_ITEMS.removeAds.price : 'R56.99');

            let specialOffersHtml = '';
            if (isNative && showAdsUi && !adsRemoved) {
                specialOffersHtml += `
                <div class="store-item" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-surface);border-radius:16px;border:1px solid rgba(255,255,255,0.05);gap:12px;">
                    <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
                        <div style="width:40px;height:40px;background:rgba(233,84,58,0.1);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">
                            🚫
                        </div>
                        <div class="item-info" style="min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;">
                            <div class="item-name" style="font-weight:800;color:#fff;font-size:14px;margin-bottom:1px;white-space:normal;word-break:break-word;line-height:1.25;">Remove Ads</div>
                            <div class="item-desc" style="color:#94a3b8;font-size:11px;line-height:1.25;white-space:normal;word-break:break-word;">No banners or popups <span style="color:var(--gold);font-weight:700;">+200 <span class="custom-coin"></span></span></div>
                        </div>
                    </div>
                    <button class="btn btn-primary"
                        onclick="Store.purchaseItem('remove_ads')"
                        style="min-width:80px;height:36px;font-weight:900;border-radius:12px;font-size:13px;flex-shrink:0;padding:0 12px;white-space:nowrap;">
                        ${removeAdsPrice}
                    </button>
                </div>
                `;
            }

            // Offline Subscription - only on native app wrapper and NOT on TV
            const isTvDevice = (typeof window.isTv !== 'undefined' && window.isTv) || (typeof Billing !== 'undefined' && typeof Billing.isTvDevice === 'function' && Billing.isTvDevice());

            if (isNative && !isTvDevice) {
                const offlineSubOwned = (typeof App !== 'undefined' && App.state) ? App.state.offlineSubOwned : false;
                const offlineSubPrice = prices['sub_offline_mode'] || (CONFIG && CONFIG.STORE_ITEMS && CONFIG.STORE_ITEMS.offlineSub ? CONFIG.STORE_ITEMS.offlineSub.price : 'R19.99/mo');
                specialOffersHtml += `
                    <div class="store-item store-item-offline" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(30, 41, 59, 0.95) 100%);border-radius:16px;border:1px solid rgba(96, 165, 250, 0.25);gap:10px;min-height:60px;box-sizing:border-box;">
                        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                            <div style="width:38px;height:38px;background:rgba(59, 130, 246, 0.22);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">
                                📶
                            </div>
                            <div class="item-info" style="min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;line-height:1.2;">
                                <div class="item-name" style="font-weight:900;color:#60A5FA;font-size:13px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Offline Subscription</div>
                                <div class="item-desc" style="color:#e2e8f0;font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Play offline • Zero ads</div>
                            </div>
                        </div>
                        <button class="btn ${offlineSubOwned ? 'btn-outline' : ''}"
                            ${offlineSubOwned ? 'disabled' : `onclick="Store.purchaseItem('sub_offline_mode')"`}
                            style="min-width:76px;height:34px;font-weight:900;border-radius:10px;font-size:12px;flex-shrink:0;padding:0 10px;white-space:nowrap;${offlineSubOwned ? 'background:transparent !important;border:2px solid var(--accent-secondary) !important;color:var(--accent-secondary) !important;' : 'background:linear-gradient(135deg, #3B82F6 0%, #2563EB 100%) !important;color:#fff !important;border:none !important;box-shadow:0 3px 10px rgba(37,99,235,0.4) !important;'}" >
                            ${offlineSubOwned ? 'ACTIVE' : offlineSubPrice}
                        </button>
                    </div>
                `;
            }

            // Support Developer / Coffee
            const coffeePrice = prices['buy_me_coffee'] || (CONFIG && CONFIG.STORE_ITEMS && CONFIG.STORE_ITEMS.buyCoffee ? CONFIG.STORE_ITEMS.buyCoffee.price : 'R28.99');
            specialOffersHtml += `
                <div class="store-item" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:linear-gradient(135deg, rgba(255, 129, 63, 0.14) 0%, rgba(30, 41, 59, 0.95) 100%);border-radius:16px;border:1px solid rgba(255,255,255,0.05);gap:12px;">
                    <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
                        <div style="width:40px;height:40px;background:rgba(255, 129, 63, 0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">
                            ☕
                        </div>
                        <div class="item-info" style="min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;">
                            <div class="item-name" style="font-weight:900;color:#FFA07A;font-size:14px;margin-bottom:1px;white-space:normal;word-break:break-word;line-height:1.25;">Buy Me a Coffee</div>
                            <div class="item-desc" style="color:#e2e8f0;font-size:11px;font-weight:600;line-height:1.25;white-space:normal;word-break:break-word;">Support the game! <span style="color:var(--gold);font-weight:700;">+500 <span class="custom-coin"></span></span></div>
                        </div>
                    </div>
                    <button class="btn btn-gold" onclick="Store.purchaseItem('buy_me_coffee')"
                        style="min-width:80px;height:36px;font-weight:900;border-radius:12px;font-size:13px;box-shadow:0 4px 12px rgba(255,129,63,0.3);flex-shrink:0;padding:0 12px;background:linear-gradient(135deg, #FF9966 0%, #FF5E62 100%);color:#fff;border:none;white-space:nowrap;">
                        ${coffeePrice}
                    </button>
                </div>
            `;

            if (specialOffersHtml.trim()) {
                html += `
                    <div class="store-section">
                        <h3 class="store-section-title" style="margin:16px 0 8px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:800;padding-left:4px;">
                            ⭐ Special Offers
                        </h3>
                        <div class="store-grid">
                            ${specialOffersHtml}
                        </div>
                    </div>
                `;
            }

            // Themes Section
            html += `
                <div class="store-section">
                    <h3 class="store-section-title" style="margin:16px 0 8px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:800;padding-left:4px;">
                        🎨 Unlock Themes (Coins)
                    </h3>
                    <div class="store-grid">
            `;

            const countryInfo = (typeof App !== 'undefined' && App.getCountryInfo) ? App.getCountryInfo() : { name: 'South Africa', flag: '🇿🇦' };

            const woodSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="vertical-align:middle;display:inline-block;"><path d="M12 3C6.5 3 2 5.2 2 8v8c0 2.8 4.5 5 10 5s10-2.2 10-5V8c0-2.8-4.5-5-10-5z" fill="#8B4513"/><ellipse cx="12" cy="8" rx="8" ry="3" fill="#D2691E" stroke="#A0522D" stroke-width="1.5"/><ellipse cx="12" cy="8" rx="5" ry="1.8" fill="#CD853F" stroke="#8B4513" stroke-width="1.2"/><circle cx="12" cy="8" r="1.5" fill="#8B4513"/></svg>`;

            const themeGradients = {
                numbers: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
                fruit: 'linear-gradient(135deg, #052e16, #14532d)',
                animals: 'linear-gradient(135deg, #2e1005, #4a1d0d)',
                space: 'linear-gradient(135deg, #030712, #2e1065)',
                southafrica: 'linear-gradient(135deg, #062c19, #2a1f0a)',
                theme_neon: 'linear-gradient(135deg, #0d001a, #2d004d)',
                theme_wood: 'linear-gradient(135deg, #1c0d02, #2d1808)'
            };

            const storeThemes = (CONFIG && CONFIG.STORE_ITEMS && CONFIG.STORE_ITEMS.themes) ? CONFIG.STORE_ITEMS.themes : [
                { id: 'numbers', name: 'Classic Numbers', cost: 0, icon: '🔢' },
                { id: 'fruit', name: 'Fruit Theme', cost: 2500, icon: '🍎' },
                { id: 'animals', name: 'Animals Theme', cost: 2500, icon: '🐾' },
                { id: 'space', name: 'Space Theme', cost: 4000, icon: '🚀' },
                { id: 'southafrica', name: 'Country Theme', cost: 4000, icon: '🌐' },
                { id: 'theme_neon', name: 'Neon Theme', cost: 5000, icon: '⚡' },
                { id: 'theme_wood', name: 'Wood Theme', cost: 5000, icon: woodSvg }
            ];

            storeThemes.forEach(theme => {
                const owned = (typeof App !== 'undefined' && App.state && App.state.unlockedThemes) ? App.state.unlockedThemes.includes(theme.id) : (theme.cost === 0);
                const isEquipped = (typeof App !== 'undefined' && App.state) ? App.state.activeTheme === theme.id : false;
                const themeName = theme.id === 'southafrica' ? `${countryInfo.name} Theme` : theme.name;
                const themeIcon = (theme.id === 'theme_wood' || theme.id === 'wood') ? woodSvg : (theme.id === 'southafrica' ? countryInfo.flag : theme.icon);
                const bgGrad = themeGradients[theme.id] || 'linear-gradient(135deg, #0f172a, #1e1b4b)';
                const cost = theme.cost || (CONFIG.THEME_COSTS ? CONFIG.THEME_COSTS[theme.id] : 0);

                html += `
                <div class="store-item" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:rgba(30,41,59,0.72);border-radius:14px;border:1px solid rgba(255,255,255,0.12);gap:10px;box-shadow:0 2px 8px rgba(0,0,0,0.22);">
                    <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                        <div style="width:38px;height:38px;padding:5px;background:${bgGrad};border:1.5px solid rgba(255,255,255,0.25);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,0.3);box-sizing:border-box;">
                            ${themeIcon}
                        </div>
                        <div class="item-info" style="min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;">
                            <div class="item-name" style="font-weight:800;color:#fff;font-size:14px;margin-bottom:1px;white-space:normal;word-break:break-word;line-height:1.25;">${themeName}</div>
                            <div class="item-desc" style="color:#94a3b8;font-size:12px;white-space:normal;word-break:break-word;line-height:1.25;">
                                ${owned ? (isEquipped ? '<span style="color:var(--accent-secondary,#22c55e);font-weight:800;">Equipped ✅</span>' : '<span style="color:var(--accent-secondary,#22c55e);font-weight:700;">Unlocked</span>') : `<span class="coin-label" style="font-size:12px;font-weight:800;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;color:var(--gold,#f59e0b);"><span class="custom-coin custom-coin-sm"></span> ${cost > 0 ? cost.toLocaleString() : 'Free'}</span>`}
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-sm ${owned ? (isEquipped ? 'btn-outline' : 'btn-primary') : 'btn-gold'}"
                        onclick="Store.buyTheme('${theme.id}')"
                        style="min-width:78px;border-radius:10px;font-weight:900;height:32px;font-size:12px;flex-shrink:0;padding:0 8px;white-space:nowrap;${isEquipped ? 'border-color:var(--accent-secondary,#22c55e);color:var(--accent-secondary,#22c55e);' : (owned ? 'background:#3B82F6;border:none;' : 'background:linear-gradient(135deg, #FFD700 0%, #F59E0B 100%);color:#0f172a;border:none;box-shadow:0 3px 8px rgba(245,158,11,0.3);')}">
                        ${owned ? (isEquipped ? 'EQUIPPED' : 'EQUIP') : 'UNLOCK'}
                    </button>
                </div>`;
            });
            html += `
                    </div>
                </div>
            `;

            container.innerHTML = html;
            if (typeof App !== 'undefined' && App.updateAllCoinDisplays) {
                App.updateAllCoinDisplays();
            }
        } catch (err) {
            console.error('🛒 Error rendering store content:', err);
        }
    }

    // Unified Purchase Launch
    static isPurchasing = false;

    static purchaseItem(productId) {
        if (Store.isPurchasing) {
            console.log('🛒 Purchase already in progress, ignoring duplicate tap');
            return;
        }

        console.log('🛒 Purchase requested for:', productId);
        Store.isPurchasing = true;
        setTimeout(() => { Store.isPurchasing = false; }, 45000);

        // Check if running on Android TV where remote payments are not supported
        if (typeof Billing !== 'undefined' && typeof Billing.isTvDevice === 'function' && Billing.isTvDevice()) {
            Store.isPurchasing = false;
            Store.showTvPurchaseModal(productId);
            return;
        }

        // Check if running on Android with Native Billing Bridge
        if (typeof Android !== 'undefined' && typeof Android.launchPurchase === 'function') {
            Android.launchPurchase(productId);
            return;
        }

        if (typeof Billing !== 'undefined' && typeof Billing.launchPurchase === 'function') {
            Billing.launchPurchase(productId);
            return;
        }

        // Web restriction: Website has no paywall yet. Direct user to mobile app download hub.
        Store.isPurchasing = false;
        Store.showWebPurchaseRestrictionModal(productId);
    }

    static showWebPurchaseRestrictionModal(productId) {
        const prices = (typeof App !== 'undefined' && App.googlePlayPrices) ? App.googlePlayPrices : {};
        const coinPacks = (typeof CONFIG !== 'undefined' && CONFIG.STORE_ITEMS && CONFIG.STORE_ITEMS.coinPacks) ? CONFIG.STORE_ITEMS.coinPacks : [];
        const pack = coinPacks.find(p => p.id === productId);
        const itemName = pack ? `${pack.name} (+${(pack.coins || 0).toLocaleString()} Coins)` : 'Coin Pack / Store Item';

        if (typeof PopupManager !== 'undefined' && PopupManager.show) {
            PopupManager.show({
                icon: '💰',
                title: 'Purchases on Mobile App',
                subtitle: 'Web paywall is currently being updated',
                details: [
                    { label: 'Item', value: itemName },
                    { label: 'Platform', value: 'Block Rush 2K Mobile App' },
                    { label: 'Available Stores', value: 'Huawei AppGallery & App Stores' },
                    { label: 'Cloud Sync', value: 'Instant sync across all your devices' }
                ],
                customContent: `
                    <div style="padding: 10px 0; font-size: 13px; color: #cbd5e1; line-height: 1.6; text-align: center;">
                        Direct coin checkout is temporarily available exclusively inside the official <strong>Block Rush 2K Mobile App</strong> while our web paywall is being prepared.<br><br>
                        Download or open the app on your mobile device to complete your purchase, and all your coins, stars, and levels will automatically sync here!
                    </div>
                `,
                confirmText: '📲 Get Mobile App',
                onConfirm: () => {
                    window.location.href = '/download';
                },
                cancelText: 'Continue Playing',
                showCancel: true
            });
        } else {
            alert('Coin purchases are currently available on the official Block Rush 2K mobile app. Please download the app to buy items!');
            window.location.href = '/download';
        }
    }

    static showTvPurchaseModal(productId) {
        const prices = (typeof App !== 'undefined' && App.googlePlayPrices) ? App.googlePlayPrices : {};
        const coinPacks = (typeof CONFIG !== 'undefined' && CONFIG.STORE_ITEMS && CONFIG.STORE_ITEMS.coinPacks) ? CONFIG.STORE_ITEMS.coinPacks : [];
        const pack = coinPacks.find(p => p.id === productId);
        const itemName = pack ? `${pack.name} (+${(pack.coins || 0).toLocaleString()} Coins)` : 'Coin Pack / Store Item';

        if (typeof PopupManager !== 'undefined' && PopupManager.show) {
            PopupManager.show({
                icon: '📺📱',
                title: 'Android TV Purchase Notice',
                subtitle: 'Complete purchase on your mobile phone',
                details: [
                    { label: 'Item', value: itemName },
                    { label: 'Platform', value: 'Google Play on Phone' },
                    { label: 'Cloud Sync', value: 'Auto-syncs to your TV instantly' }
                ],
                customContent: `
                    <div style="padding: 10px 0; font-size: 13px; color: #cbd5e1; line-height: 1.6; text-align: center;">
                        <div style="margin: 5px auto 15px auto; background: #fff; padding: 10px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=https://blockrush2k.kharitambe.co.za/download" width="130" height="130" alt="QR Code" style="display:block;">
                        </div>
                        <div style="font-size: 14px; font-weight: bold; color: #F7C948; margin-bottom: 16px; letter-spacing: 0.5px;">Scan to download mobile app</div>

                        Direct in-app purchases are not supported via remote control on Android TV.<br><br>
                        <strong>How to buy on your phone:</strong><br>
                        1. Log into your <strong>Block Rush 2K</strong> account on your smartphone.<br>
                        2. Purchase <strong>${itemName}</strong> securely in the mobile app.<br>
                        3. Your coins, stars, and theme unlocks will automatically and instantly sync to this TV!
                    </div>
                `,
                confirmText: 'Got It',
                onConfirm: () => {},
                showCancel: false
            });
        } else {
            alert('Direct in-app purchases are not supported via remote control on Android TV. Please log into the mobile app on your phone to complete your purchase—your items will automatically sync to your TV via cloud save!');
        }
    }

    // Restore Purchases
    static restorePurchases() {
        console.log('🔄 Restore purchases requested');

        if (typeof Android !== 'undefined' && typeof Android.restorePurchases === 'function') {

            Android.restorePurchases();
            return;
        }

        if (typeof Billing !== 'undefined' && typeof Billing.restorePurchases === 'function') {

            Billing.restorePurchases();
            return;
        }

        // Web fallback
        App.showToast('🔄 Checking restored purchases...');
        setTimeout(() => {
            const restored = [];
            if (App.state.adsRemoved) restored.push('remove_ads');
            App.handlePurchasesRestored(restored);
        }, 500);
    }

    // Buy Theme with in-game coins
    static buyTheme(themeId) {
        const cost = (CONFIG && CONFIG.THEME_COSTS && CONFIG.THEME_COSTS[themeId]) ? CONFIG.THEME_COSTS[themeId] : 0;
        if (typeof App !== 'undefined' && App.state) {
            if (App.state.unlockedThemes.includes(themeId)) {
                App.applyTheme(themeId);
                App.saveState();
                App.showToast('🎨 Theme equipped!');
                Store.renderStoreContent();
                return;
            }
            if ((App.state.coins || 0) < cost) {
                App.showToast(`❌ Not enough coins! Need 💰 ${cost.toLocaleString()}`);
                return;
            }
            App.state.coins -= cost;
            App.state.unlockedThemes.push(themeId);
            App.applyTheme(themeId);
            App.saveState();
            App.updateAllCoinDisplays();
        }
        try { SoundManager.coin(); } catch (e) { }
        try { if (typeof Achievements !== 'undefined' && Achievements.check) Achievements.check(); } catch (e) { }
        if (typeof App !== 'undefined') App.showToast(`🎨 Theme unlocked!`);
        Store.renderStoreContent();
    }
}

window.onTvPurchaseRestriction = function(productId) {
    Store.isPurchasing = false;
    Store.showTvPurchaseModal(productId);
};

window.Store = Store;
