// Navigation Manager
class Navigation {
    static async navigateTo(screenId) {
        try { SoundManager.click(); } catch (e) { }

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById('screen-' + screenId);
        if (target) {
            target.classList.add('active');
        } else {
            console.warn('Screen not found:', screenId);
            const homeScreen = document.getElementById('screen-home');
            if (homeScreen) homeScreen.classList.add('active');
        }

        if (screenId !== 'game' && typeof App !== 'undefined' && App.removeWorldTheme) {
            App.removeWorldTheme();
        }

        App.updateAllCoinDisplays();

        if (screenId === 'login-prompt' || screenId === 'login') return;

        switch (screenId) {
            case 'home':
                App.updatePlayerDisplay();
                App.updateOfflineIndicator();
                App.updateLoginButtonVisibility();
                // Completely remove download elements on app side
                document.querySelectorAll('a[href*="download"], button[onclick*="download"], .store-web-notice').forEach(el => el.remove());
                break;
            case 'world-select':
                this.renderWorldSelect();
                break;
            case 'level-select':
                this.renderLevelSelect();
                break;
            case 'daily':
                if (typeof DailyChallenge !== 'undefined') DailyChallenge.renderDailyScreen();
                break;
            case 'achievements':
                if (typeof Achievements !== 'undefined') Achievements.render();
                break;
            case 'leaderboard':
                if (typeof Leaderboard !== 'undefined') {
                    Leaderboard.viewMode = 'smart';
                    Leaderboard.loadCountries();
                    await Leaderboard.getUserRank();
                    // Update toggle button
                    const toggleBtn = document.getElementById('btn-toggle-view');
                    if (toggleBtn) {
                        toggleBtn.textContent = '🎯 Smart View';
                    }
                    Leaderboard.renderSmart();
                }
                break;
            case 'settings':
                this.renderSettings();
                break;
            case 'feedback':
                this.renderFeedback();
                break;
            case 'referral':
                this.renderReferralScreen();
                break;
            case 'store':
                if (typeof Store !== 'undefined') Store.renderStoreContent();
                break;
            case 'game':
                try { AdService.showBannerAd(); } catch (e) { }
                break;
        }
        window.scrollTo(0, 0);

        // Auto-focus the first focusable element on the new screen for TV users
        setTimeout(() => {
            if (!window.isTv) return;
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen) {
                if (activeScreen.id === 'screen-home') {
                    const continueBtn = activeScreen.querySelector('button[onclick*="continueGame"], .home-menu .btn-primary');
                    if (continueBtn) {
                        continueBtn.focus();
                        return;
                    }
                }

                // Find a primary button if one exists
                let elementToFocus = activeScreen.querySelector('.btn-primary, .btn-gold, .btn-secondary');
                // If not, find the first button or focusable item
                if (!elementToFocus) {
                    elementToFocus = activeScreen.querySelector('[tabindex="0"], button, .card, .world-card, .level-btn');
                }
                if (elementToFocus) {
                    elementToFocus.focus();
                }
            }
        }, 100);
    }

    static renderWorldSelect() {
        const container = document.getElementById('world-list');
        if (!container) return;

        let totalStars = 0;
        Object.values(App.state.stars).forEach(s => totalStars += (s || 0));
        App.state.totalStarsEarned = totalStars;

        container.innerHTML = CONFIG.WORLDS.map(w => {
            const locked = totalStars < w.unlockStars;
            const worldStars = this.getWorldStars(w.id);
            const progress = this.getWorldProgress(w.id);
            return `
            <div class="world-card ${locked ? 'locked' : ''} ${App.state.currentWorld === w.id ? 'active-world' : ''}"
                 onclick="${locked ? '' : `Navigation.selectWorld(${w.id})`}">
                <div class="world-icon">${w.icon}</div>
                <div class="world-info">
                    <div class="world-name">${w.name}</div>
                    <div class="world-progress">${progress.completed}/25 Levels • ${worldStars} ⭐</div>
                    ${locked ? `<div style="color:#e94560;font-size:12px;">🔒 ${w.unlockStars} stars needed</div>` : ''}
                </div>
                <div class="stars-display">${locked ? '🔒' : '⭐'.repeat(Math.min(3, Math.floor(worldStars / 8)))}</div>
            </div>`;
        }).join('');
        App.updateAllCoinDisplays();
    }

    static getWorldStars(worldId) {
        let s = 0;
        for (let lv = 1; lv <= 25; lv++) {
            s += (App.state.stars[`${worldId}-${lv}`] || 0);
        }
        return s;
    }

    static getWorldProgress(worldId) {
        let completed = 0;
        for (let lv = 1; lv <= 25; lv++) {
            if ((App.state.stars[`${worldId}-${lv}`] || 0) > 0) completed++;
        }
        return { completed, total: 25 };
    }

    static selectWorld(worldId) {
        App.state.currentWorld = worldId;
        this.navigateTo('level-select');
        this.renderLevelSelect();
    }

    static renderLevelSelect() {
        const world = CONFIG.WORLDS[App.state.currentWorld];
        document.getElementById('level-select-title').textContent = world.name + ' Levels';
        const grid = document.getElementById('level-grid');
        if (!grid) return;

        let html = '';
        for (let lv = 1; lv <= 25; lv++) {
            const key = `${App.state.currentWorld}-${lv}`;
            const stars = App.state.stars[key] || 0;
            const locked = lv > 1 && !App.state.stars[`${App.state.currentWorld}-${lv - 1}`] && stars === 0;
            const completed = stars > 0;
            const isCurrent = App.state.currentLevel === lv;

            html += `
            <div class="level-btn ${locked ? 'locked' : ''} ${completed ? 'completed' : ''} ${isCurrent ? 'current' : ''}"
                 onclick="${locked ? '' : `App.startLevel(${lv})`}">
                <span>${lv}</span>
                ${stars > 0 ? `<div class="stars-mini">${'⭐'.repeat(stars)}</div>` : ''}
            </div>`;
        }
        grid.innerHTML = html;
        App.updateAllCoinDisplays();
    }

    static getThemePickerListHtml() {
        const countryInfo = (typeof App !== 'undefined' && App.getCountryInfo) ? App.getCountryInfo() : { name: 'South Africa', flag: '🇿🇦' };
        const woodSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="vertical-align:middle;display:block;"><path d="M12 3C6.5 3 2 5.2 2 8v8c0 2.8 4.5 5 10 5s10-2.2 10-5V8c0-2.8-4.5-5-10-5z" fill="#8B4513"/><ellipse cx="12" cy="8" rx="8" ry="3" fill="#D2691E" stroke="#A0522D" stroke-width="1.5"/><ellipse cx="12" cy="8" rx="5" ry="1.8" fill="#CD853F" stroke="#8B4513" stroke-width="1.2"/><circle cx="12" cy="8" r="1.5" fill="#8B4513"/></svg>`;

        const themes = [
            { id: 'numbers', nameRaw: 'Classic Numbers', preview: '🔢', bgGradient: 'linear-gradient(135deg, #0f172a, #1e1b4b)' },
            { id: 'fruit', nameRaw: 'Fruit Theme', preview: '🍎', bgGradient: 'linear-gradient(135deg, #052e16, #14532d)' },
            { id: 'animals', nameRaw: 'Animals Theme', preview: '🐾', bgGradient: 'linear-gradient(135deg, #2e1005, #4a1d0d)' },
            { id: 'space', nameRaw: 'Space Theme', preview: '🚀', bgGradient: 'linear-gradient(135deg, #030712, #2e1065)' },
            { id: 'southafrica', nameRaw: `${countryInfo.name} Theme`, preview: countryInfo.flag, bgGradient: 'linear-gradient(135deg, #062c19, #2a1f0a)' },
            { id: 'theme_neon', nameRaw: 'Neon Theme', preview: '⚡', bgGradient: 'linear-gradient(135deg, #0d001a, #2d004d)' },
            { id: 'theme_wood', nameRaw: 'Wood Theme', preview: woodSvg, bgGradient: 'linear-gradient(135deg, #1c0d02, #2d1808)' },
        ];

        const activeThemeId = (App.state && App.state.activeTheme) ? App.state.activeTheme : 'numbers';
        const unlockedThemes = (App.state && App.state.unlockedThemes) ? App.state.unlockedThemes : ['numbers'];

        return themes.map(t => {
            const owned = unlockedThemes.includes(t.id) || t.id === 'numbers';
            const isActive = activeThemeId === t.id;
            const cost = (typeof CONFIG !== 'undefined' && CONFIG.THEME_COSTS && CONFIG.THEME_COSTS[t.id]) ? CONFIG.THEME_COSTS[t.id] : (t.id === 'numbers' ? 0 : 2500);

            let actionBtn = '';
            if (isActive) {
                actionBtn = `
                    <button class="btn btn-sm btn-outline" disabled
                            style="min-width:80px;height:34px;font-size:11px;font-weight:800;border-radius:10px;border-color:#22c55e;color:#22c55e;opacity:1;cursor:default;">
                        ACTIVE ✓
                    </button>
                `;
            } else if (owned) {
                actionBtn = `
                    <button class="btn btn-sm btn-primary" onclick="Navigation.selectThemeFromPicker('${t.id}')"
                            style="min-width:80px;height:34px;font-size:11px;font-weight:800;border-radius:10px;background:#3B82F6;border:none;">
                        EQUIP
                    </button>
                `;
            } else {
                actionBtn = `
                    <button class="btn btn-sm btn-gold" onclick="Navigation.selectThemeFromPicker('${t.id}')"
                            style="min-width:80px;height:34px;font-size:11px;font-weight:900;border-radius:10px;background:linear-gradient(135deg, #FFD700 0%, #F59E0B 100%);color:#0f172a;border:none;">
                        UNLOCK
                    </button>
                `;
            }

            return `
            <div class="theme-picker-item ${isActive ? 'active' : ''}">
                <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                    <div style="width:38px;height:38px;padding:5px;background:${t.bgGradient};border:1.5px solid ${isActive ? '#22c55e' : 'rgba(255,255,255,0.2)'};border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,0.3);box-sizing:border-box;">
                        ${t.preview}
                    </div>
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;">
                        <div style="font-weight:800;color:#fff;font-size:13px;white-space:normal;word-break:break-word;line-height:1.25;">
                            ${t.nameRaw}
                        </div>
                        <div style="font-size:11px;font-weight:700;color:${isActive ? '#22c55e' : owned ? '#94a3b8' : 'var(--gold,#f59e0b)'};display:flex;align-items:center;gap:4px;white-space:normal;word-break:break-word;line-height:1.2;">
                            ${isActive ? 'Equipped ✅' : owned ? 'Unlocked 🔓' : '💰 ' + cost.toLocaleString() + ' coins'}
                        </div>
                    </div>
                </div>
                ${actionBtn}
            </div>
            `;
        }).join('');
    }

    static showThemePickerModal() {
        if (typeof PopupManager === 'undefined') return;

        const listHtml = `
            <div id="theme-picker-list" class="theme-picker-list">
                ${Navigation.getThemePickerListHtml()}
            </div>
            <button class="btn btn-secondary-outline btn-block" onclick="PopupManager.close('cancel'); Navigation.navigateTo('store');" style="margin-top:10px;font-size:12px;height:38px;border-radius:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:6px;">
                <span>🛒</span> View Themes in Store
            </button>
        `;

        PopupManager.show({
            title: 'Select Theme',
            subtitle: 'Choose a style for your blocks and board',
            icon: '🎨',
            showConfirm: false,
            showCancel: true,
            cancelText: 'Close',
            customContent: listHtml
        });
    }

    static showLanguagePickerModal() {
        if (typeof I18N === 'undefined') return;
        const availableLangs = I18N.getAvailableLanguages();
        const currentCode = I18N.currentLang;

        const listHtml = `
            <div style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto;padding-right:2px;margin-top:6px;">
                ${availableLangs.map(lang => {
                    const isSelected = lang.code === currentCode;
                    return `
                    <div onclick="I18N.setLanguage('${lang.code}'); if (typeof PopupManager !== 'undefined') PopupManager.close('cancel');" 
                         style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:12px;background:${isSelected ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(30,41,59,0.8))' : 'rgba(255,255,255,0.05)'};border:1.5px solid ${isSelected ? 'var(--gold,#f59e0b)' : 'rgba(255,255,255,0.08)'};cursor:pointer;transition:all 0.2s;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <span style="font-size:24px;">${lang.flag || '🌐'}</span>
                            <div style="text-align:left;">
                                <div style="font-weight:700;color:#fff;font-size:14px;">${lang.name}</div>
                                <div style="font-size:11px;color:#94a3b8;">${lang.code.toUpperCase()}</div>
                            </div>
                        </div>
                        ${isSelected ? '<span style="color:var(--gold,#f59e0b);font-weight:800;font-size:13px;">✓ Active</span>' : '<span style="color:#64748b;font-size:12px;">Select</span>'}
                    </div>
                    `;
                }).join('')}
            </div>
        `;

        if (typeof PopupManager !== 'undefined') {
            PopupManager.show({
                title: 'Select Language',
                subtitle: 'Choose your preferred game language',
                icon: '🌐',
                showConfirm: false,
                showCancel: true,
                cancelText: 'Close',
                customContent: listHtml
            });
        }
    }

    static selectThemeFromPicker(themeId) {
        if (typeof Store !== 'undefined' && Store.buyTheme) {
            Store.buyTheme(themeId);
        } else if (typeof App !== 'undefined' && App.applyTheme) {
            App.applyTheme(themeId);
            App.saveState();
        }
        const listEl = document.getElementById('theme-picker-list');
        if (listEl) {
            listEl.innerHTML = Navigation.getThemePickerListHtml();
        }
        Navigation.renderSettings();
    }

    static onSettingsThemeChange(themeId) {
        if (!themeId) return;
        Navigation.selectThemeFromPicker(themeId);
    }

    static renderSettings() {
        const container = document.getElementById('settings-content');
        if (!container) return;

        const countryInfo = (typeof App !== 'undefined' && App.getCountryInfo) ? App.getCountryInfo() : { name: 'South Africa', flag: '🇿🇦' };

        const woodSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="vertical-align:middle;display:block;"><path d="M12 3C6.5 3 2 5.2 2 8v8c0 2.8 4.5 5 10 5s10-2.2 10-5V8c0-2.8-4.5-5-10-5z" fill="#8B4513"/><ellipse cx="12" cy="8" rx="8" ry="3" fill="#D2691E" stroke="#A0522D" stroke-width="1.5"/><ellipse cx="12" cy="8" rx="5" ry="1.8" fill="#CD853F" stroke="#8B4513" stroke-width="1.2"/><circle cx="12" cy="8" r="1.5" fill="#8B4513"/></svg>`;

        const themes = [
            { id: 'numbers', name: 'Classic Numbers', nameRaw: 'Classic Numbers', icon: '🔢', preview: '🔢', bgGradient: 'linear-gradient(135deg, #0f172a, #1e1b4b)' },
            { id: 'fruit', name: 'Fruit Theme', nameRaw: 'Fruit Theme', icon: '🍎', preview: '🍎', bgGradient: 'linear-gradient(135deg, #052e16, #14532d)' },
            { id: 'animals', name: 'Animals Theme', nameRaw: 'Animals Theme', icon: '🐾', preview: '🐾', bgGradient: 'linear-gradient(135deg, #2e1005, #4a1d0d)' },
            { id: 'space', name: 'Space Theme', nameRaw: 'Space Theme', icon: '🚀', preview: '🚀', bgGradient: 'linear-gradient(135deg, #030712, #2e1065)' },
            { id: 'southafrica', name: `${countryInfo.name} Theme`, nameRaw: `${countryInfo.name} Theme`, icon: countryInfo.flag, preview: countryInfo.flag, bgGradient: 'linear-gradient(135deg, #062c19, #2a1f0a)' },
            { id: 'theme_neon', name: 'Neon Theme', nameRaw: 'Neon Theme', icon: '⚡', preview: '⚡', bgGradient: 'linear-gradient(135deg, #0d001a, #2d004d)' },
            { id: 'theme_wood', name: 'Wood Theme', nameRaw: 'Wood Theme', icon: woodSvg, preview: woodSvg, bgGradient: 'linear-gradient(135deg, #1c0d02, #2d1808)' },
        ];

        const activeThemeId = (App.state && App.state.activeTheme) ? App.state.activeTheme : 'numbers';
        const currentTheme = themes.find(t => t.id === activeThemeId) || themes[0];

        const photoURL = App.state.photoURL || null;
        const displayName = App.state.playerName || 'Player';
        const email = App.state.email || 'No email';
        const offlineInfo = App.getOfflineInfo();

        let html = `
        <h3 style="margin:10px 0 4px;color:var(--gold,#f59e0b);">🎨 Active Theme</h3>
        <div class="store-item" onclick="Navigation.showThemePickerModal()" style="cursor:pointer;">
            <div class="item-icon" style="background:${currentTheme.bgGradient};border:1.5px solid rgba(255,255,255,0.25);">
                ${currentTheme.preview}
            </div>
            <div class="item-info">
                <div class="item-name">${currentTheme.nameRaw}</div>
                <div class="item-desc">Tap to change themes</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); Navigation.showThemePickerModal();">
                <span>🎨</span> Change
            </button>
        </div>
        
        <h3 style="margin:10px 0 4px;color:var(--gold);">🔊 Sound</h3>
        <div class="store-item">
            <div class="item-icon">🔊</div>
            <div class="item-info">
                <div class="item-name">Sound Effects</div>
                <div class="item-desc">Toggle game sounds</div>
            </div>
            <button class="btn btn-sm ${App.state.soundOn ? 'btn-primary' : 'btn-outline'}" 
                onclick="Navigation.toggleSound()">
                ${App.state.soundOn ? 'On' : 'Off'}
            </button>
        </div>

        <h3 style="margin:10px 0 4px;color:var(--gold);">🌐 Language / Luambo / Ulimi</h3>
        <div class="store-item" onclick="Navigation.showLanguagePickerModal()" style="cursor:pointer;">
            <div class="item-icon" style="font-size:24px;">
                ${(typeof I18N !== 'undefined' && I18N.languages && I18N.languages.find(l => l.code === I18N.currentLang)) ? (I18N.languages.find(l => l.code === I18N.currentLang).flag || '🌐') : '🌐'}
            </div>
            <div class="item-info">
                <div class="item-name">${(typeof I18N !== 'undefined' && I18N.languages && I18N.languages.find(l => l.code === I18N.currentLang)) ? I18N.languages.find(l => l.code === I18N.currentLang).name : 'English'} (${((typeof I18N !== 'undefined') ? I18N.currentLang : 'en').toUpperCase()})</div>
                <div class="item-desc">Tap to change language</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); Navigation.showLanguagePickerModal();">
                <span>🌐</span> Change
            </button>
        </div>
        
        <h3 style="margin:10px 0 4px;color:var(--gold);">📖 Tutorial</h3>
        <div class="store-item">
            <div class="item-icon">📖</div>
            <div class="item-info">
                <div class="item-name">How to Play</div>
                <div class="item-desc">View the tutorial again</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="App.showTutorial()">View</button>
        </div>
        
        <h3 style="margin:10px 0 4px;color:var(--gold);">📅 Daily Challenge</h3>
        <div class="store-item">
            <div class="item-icon">📅</div>
            <div class="item-info">
                <div class="item-name">Daily Challenge Status</div>
                <div class="item-desc">${App.state.dailyChallengeDone ? '✅ Completed today!' : '⏳ Not completed yet'}</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="Navigation.navigateTo('daily')">View</button>
        </div>
        
        <h3 style="margin:10px 0 4px;color:var(--gold);">💳 Purchases</h3>
        <div class="store-item">
            <div class="item-icon">🔄</div>
            <div class="item-info">
                <div class="item-name">Restore Purchases</div>
                <div class="item-desc">Restore themes and ad removal</div>
            </div>
            <button class="btn btn-sm btn-outline" onclick="Store.restorePurchases()">Restore</button>
        </div>
        
        <h3 style="margin:10px 0 4px;color:var(--gold);">☁️ Cloud Save</h3>
        <div class="store-item">
            <div class="item-icon">☁️</div>
            <div class="item-info">
                <div class="item-name">Sync Progress</div>
                <div class="item-desc" id="cloud-status">${typeof FirebaseService !== 'undefined' && FirebaseService.initialized ? 'Connected' : 'Offline'}</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="App.syncCloudData()">Sync Now</button>
        </div>
        
        ${(typeof CONFIG !== 'undefined' && CONFIG.OFFLINE && CONFIG.OFFLINE.ENABLED) ? `
        <h3 style="margin:10px 0 4px;color:var(--gold);">📱 Offline Mode</h3>
        <div class="store-item">
            <div class="item-icon">📱</div>
            <div class="item-info">
                <div class="item-name">Offline Status</div>
                <div class="item-desc">
                    ${App.state.isLoggedIn ?
                '✅ Signed in - Unlimited play' :
                `${offlineInfo.remaining} of ${offlineInfo.maxLevels} offline moves remaining`}
                </div>
            </div>
            <span style="font-size:20px;">
                ${App.state.isLoggedIn ? '✅' : (offlineInfo.remaining > 0 ? '🎮' : '⚠️')}
            </span>
        </div>
        ` : ''}

        <h3 style="margin:10px 0 4px;color:var(--gold);">☁️ Leaderboard</h3>
        <div class="store-item">
            <div class="item-icon">☁️</div>
            <div class="item-info">
                <div class="item-name">Save to Leaderboard</div>
                <div class="item-desc">Update position on leaderboard</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="App.saveToLeaderboard()">Save</button>
        </div>

        <h3 style="margin:10px 0 4px;color:var(--gold);">💬 Feedback & Support</h3>
        <div class="store-item" onclick="Navigation.navigateTo('feedback')" style="cursor:pointer;">
            <div class="item-icon">⭐</div>
            <div class="item-info">
                <div class="item-name">Send Feedback & Review</div>
                <div class="item-desc">Share comments and rate our app</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); Navigation.navigateTo('feedback');">
                <span>💬</span> Feedback
            </button>
        </div>`;

        // Account section
        if (App.state.isLoggedIn) {
            html += `
        <h3 style="margin:12px 0 4px;color:var(--gold);">👤 Account</h3>
        <div class="store-item" style="padding:12px 14px;">
            <div class="profile-picture-container" style="position:relative;width:48px;height:48px;flex-shrink:0;">
                ${photoURL ?
                    `<img src="${photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;border:2px solid var(--accent-primary);" alt="Profile">` :
                    `<div style="width:100%;height:100%;border-radius:50%;background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:22px;border:2px solid var(--bg-elevated);">👤</div>`
                }
                <button onclick="Navigation.updateProfilePicture()" style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:var(--accent-primary);border:2px solid var(--bg-primary);color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">📷</button>
            </div>
            <div class="item-info" style="flex:1;min-width:0;">
                <div class="item-name" style="font-size:15px;word-break:break-word;">${displayName}</div>
                <div class="item-desc" style="word-break:break-word;">${email}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:1px;">
                    ${App.state.loginProvider === 'google' ? '🔵 Google Account' :
                    App.state.loginProvider === 'anonymous' ? '👤 Anonymous' :
                        '✉️ Email Account'}
                </div>
            </div>
            <button class="btn btn-sm btn-outline" style="color:#e94560;border-color:#e94560;flex-shrink:0;" onclick="App.signOut()">Sign Out</button>
        </div>`;
        } else {
            html += `
        <h3 style="margin:10px 0 4px;color:var(--gold);">👤 Account</h3>
        <div class="store-item">
            <div class="item-icon">👤</div>
            <div class="item-info">
                <div class="item-name">${App.state.userId ? 'Playing Anonymously' : (typeof CONFIG !== 'undefined' && CONFIG.OFFLINE && CONFIG.OFFLINE.ENABLED ? 'Playing Offline' : 'Playing as Guest')}</div>
                <div class="item-desc">Sign in to save progress and compete</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="App.showLoginPrompt()">Sign In</button>
        </div>`;
        }

        // Data & Privacy section
        html += `
        <h3 style="margin:10px 0 4px;color:var(--text-secondary);">🔐 Data & Privacy</h3>
        
        <div class="store-item">
            <div class="item-icon">📜</div>
            <div class="item-info">
                <div class="item-name">Privacy Policy</div>
                <div class="item-desc">Learn how we handle your data</div>
            </div>
            <a href="privacy.html" target="_blank" class="btn btn-sm btn-secondary" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">View</a>
        </div>

        <div class="store-item">
            <div class="item-icon">📥</div>
            <div class="item-info">
                <div class="item-name">Export Your Data</div>
                <div class="item-desc">Download game data as JSON</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="App.requestDataExport()">Export</button>
        </div>

        <div class="store-item">
            <div class="item-icon">🗑️</div>
            <div class="item-info">
                <div class="item-name">Request Data Deletion</div>
                <div class="item-desc">Delete associated game data</div>
            </div>
            <a href="delete-data.html" target="_blank" class="btn btn-sm btn-danger" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;background:rgba(233,69,96,0.18);border:1px solid rgba(233,69,96,0.4);color:#FF8BA7;">Request</a>
        </div>`;

        // Device & Platform Info Footer
        const detectedPlat = (typeof FirebaseService !== 'undefined' && FirebaseService.getDetectedPlatform) ? FirebaseService.getDetectedPlatform() : 'web';
        const isIos = detectedPlat === 'ios';

        html += `
        <h3 style="margin:12px 0 4px;color:#e94560;">⚠️ Danger Zone</h3>
        <button class="btn btn-outline btn-block" style="color:#e94560;border-color:#e94560;margin-bottom:16px;"
            onclick="App.resetAllProgress()">🗑️ Reset All Progress</button>

        <div style="text-align:center;padding:12px 0 24px;border-top:1px solid rgba(255,255,255,0.06);margin-top:10px;">
            <div style="font-size:12px;font-weight:700;color:${isIos ? '#38bdf8' : '#94a3b8'};display:inline-flex;align-items:center;gap:5px;">
                ${isIos ? '🍎 Block Rush 2K for Apple iOS' : '🎮 Block Rush 2K'}
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:3px;font-family:'JetBrains Mono',monospace;">
                Version 1.0.0 (Build 1) &bull; Platform: ${isIos ? 'iOS Native (App Store)' : detectedPlat.toUpperCase()}
            </div>
        </div>`;

        container.innerHTML = html;

        // Update cloud status
        const cloudStatus = document.getElementById('cloud-status');
        if (cloudStatus) {
            if (typeof FirebaseService !== 'undefined' && FirebaseService.initialized) {
                cloudStatus.textContent = App.state.isLoggedIn ? 'Connected & Synced' : 'Connected (Sign in to sync)';
            } else {
                cloudStatus.textContent = 'Offline Mode';
            }
        }
    }

    static updateProfilePicture() {
        if (!App.state.isLoggedIn) {
            App.showToast('⚠️ Please sign in first');
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                App.showToast('❌ Please select an image file');
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                App.showToast('❌ Image must be under 2MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                const dataUrl = event.target.result;

                App.showToast('📤 Uploading profile picture...');

                try {
                    if (typeof FirebaseService !== 'undefined' && FirebaseService.initialized) {
                        const result = await FirebaseService.uploadProfilePicture(dataUrl);
                        if (result.success) {
                            App.state.photoURL = result.url;
                            App.saveState();
                            App.updatePlayerDisplay();
                            Navigation.renderSettings();
                            App.showToast('✅ Profile picture updated!');
                        } else {
                            App.showToast('❌ Upload failed: ' + result.error);
                        }
                    } else {
                        App.state.photoURL = dataUrl;
                        App.saveState();
                        App.updatePlayerDisplay();
                        Navigation.renderSettings();
                        App.showToast('✅ Profile picture saved locally');
                    }
                } catch (err) {
                    App.showToast('❌ Upload failed');
                    console.error(err);
                }
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    static setActiveTheme(themeId) {
        if (!App.state.unlockedThemes.includes(themeId)) {
            App.showToast('🔒 Theme not unlocked! Buy it in the Store.');
            this.renderSettings();
            return;
        }
        App.applyTheme(themeId);
        App.saveState();
        this.renderSettings();
        App.showToast('🎨 Theme changed!');
    }

    static toggleSound() {
        App.state.soundOn = !App.state.soundOn;
        if (typeof SoundManager !== 'undefined') {
            SoundManager.enabled = App.state.soundOn;
        }
        App.saveState();
        this.renderSettings();
        if (App.state.soundOn) {
            try { SoundManager.click(); } catch (e) { }
        }
    }

    // ===== REFERRAL SYSTEM UI =====

    static async renderReferralScreen() {
        const container = document.getElementById('referral-content');
        if (!container) return;

        App.updateAllCoinDisplays();

        let refCode = App.state.referralCode || '';
        if (typeof FirebaseService !== 'undefined') {
            refCode = await FirebaseService.getOrCreateReferralCode();
            await FirebaseService.syncReferrals();
        }

        const count = App.state.referralsCount || 0;
        const claimed = App.state.claimedMilestones || {};

        const shareUrl = `https://blockrush2k.kharitambe.co.za/?ref=${refCode}`;

        const milestones = [
            { target: 1, reward: 300, adFreeDays: 0, label: '💰 +300 Coins', icon: '👤' },
            { target: 5, reward: 1500, adFreeDays: 3, label: '💰 +1,500 Coins & 3 Days Ad-Free', icon: '👥' },
            { target: 8, reward: 3000, adFreeDays: 7, label: '💰 +3,000 Coins & 7 Days Ad-Free (1 Week!)', icon: '🌟' },
            { target: 15, reward: 10000, adFreeDays: 30, label: '💰 +10,000 Coins & 30 Days Ad-Free (1 Month!)', icon: '👑' },
        ];

        let html = `
            <div style="text-align:center;padding:18px 14px;margin-bottom:14px;background:linear-gradient(135deg, rgba(247,201,72,0.15) 0%, rgba(233,84,58,0.15) 100%);border-radius:18px;border:1.5px solid var(--gold);box-shadow:0 4px 18px rgba(247,201,72,0.2);">
                <span style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Your Referral Code</span>
                <div style="font-size:28px;font-weight:900;color:var(--gold);margin:8px 0;letter-spacing:2px;user-select:all;">
                    ${refCode}
                </div>
                <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;">
                    <button class="btn btn-sm btn-gold" onclick="Navigation.shareReferralCode('${refCode}', '${shareUrl}')" style="font-weight:800;padding:8px 16px;border-radius:12px;">
                        📤 Share Code
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="Navigation.copyReferralLink('${refCode}', '${shareUrl}')" style="font-weight:700;padding:8px 14px;border-radius:12px;">
                        📋 Copy Link
                    </button>
                </div>
            </div>

            <!-- Redeem Referral Code Box -->
            <div style="padding:16px;margin-bottom:18px;background:var(--bg-surface);border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
                <div style="font-weight:800;color:#fff;font-size:14px;margin-bottom:4px;">
                    🎁 Redeem a Friend's Code
                </div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:10px;">
                    Enter a code from a friend to instantly claim <strong>+500 Bonus Coins</strong>!
                </div>
                ${App.state.referredBy ? `
                    <div style="padding:10px;background:rgba(74,203,196,0.15);border:1px solid #4ecdc4;border-radius:10px;color:#4ecdc4;font-size:12px;font-weight:700;text-align:center;">
                        ✅ Redeemed Code: ${App.state.referredBy} (+500 Coins Claimed!)
                    </div>
                ` : `
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="input-referral-code" placeholder="Enter Code (e.g. BR2K-ABC12)"
                            style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid var(--bg-card);background:var(--bg-elevated);color:#fff;font-size:13px;text-transform:uppercase;" />
                        <button class="btn btn-sm btn-primary" onclick="Navigation.submitReferralCode()" style="font-weight:800;padding:0 16px;border-radius:10px;">
                            Redeem
                        </button>
                    </div>
                `}
            </div>

            <!-- Referral Progress & Milestones -->
            <h3 style="margin:16px 0 10px;color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;gap:6px;">
                🏆 Friend Milestones (${count} Friends Referred)
            </h3>
        `;

        milestones.forEach(m => {
            const isReached = count >= m.target;
            const isClaimed = claimed[m.target];

            html += `
            <div class="store-item" style="display:flex;align-items:center;justify-content:space-between;padding:14px 12px;margin-bottom:10px;background:${isReached ? 'linear-gradient(135deg, rgba(78,205,196,0.1) 0%, rgba(30,41,59,0.95) 100%)' : 'var(--bg-surface)'};border-radius:16px;border:1px solid rgba(255,255,255,0.05);gap:8px;">
                <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                    <div style="width:40px;height:40px;background:${isReached ? 'rgba(78,205,196,0.2)' : 'rgba(255,255,255,0.05)'};border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">
                        ${m.icon}
                    </div>
                    <div class="item-info" style="min-width:0;flex:1;">
                        <div class="item-name" style="font-weight:800;color:#fff;font-size:14px;margin-bottom:2px;">
                            ${m.target} ${m.target === 1 ? 'Friend' : 'Friends'}
                        </div>
                        <div class="item-desc" style="color:${isReached ? '#4ecdc4' : 'var(--gold)'};font-size:11px;font-weight:700;">
                            ${m.label}
                        </div>
                    </div>
                </div>
                <button class="btn btn-sm ${isClaimed ? 'btn-outline' : (isReached ? 'btn-gold' : 'btn-secondary')}"
                    ${(isClaimed || !isReached) ? 'disabled' : `onclick="Navigation.claimReferralReward(${m.target}, ${m.reward}, ${m.adFreeDays})"`}
                    style="min-width:80px;height:36px;font-weight:800;border-radius:10px;font-size:11px;flex-shrink:0;${isClaimed ? 'border-color:#4ecdc4;color:#4ecdc4;' : ''}">
                    ${isClaimed ? 'CLAIMED' : (isReached ? 'CLAIM 🎉' : `${count}/${m.target}`)}
                </button>
            </div>`;
        });

        container.innerHTML = html;
    }

    static shareReferralCode(code, shareUrl) {
        if (typeof Android !== 'undefined' && typeof Android.shareReferralCode === 'function') {
            Android.shareReferralCode(code, shareUrl);
            return;
        }

        const shareData = {
            title: 'Block Rush 2K',
            text: `🎮 Join me on Block Rush 2K! Use my referral code ${code} to get 500 BONUS COINS!`,
            url: shareUrl
        };

        if (navigator.share) {
            navigator.share(shareData).catch(() => { });
        } else {
            this.copyReferralLink(code, shareUrl);
        }
    }

    static copyReferralLink(code, shareUrl) {
        const text = `🎮 Join me on Block Rush 2K! Use my referral code ${code} to get 500 BONUS COINS! Play here: ${shareUrl}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                App.showToast('📋 Link copied to clipboard!');
            }).catch(() => {
                App.showToast(`Code: ${code}`);
            });
        } else {
            App.showToast(`Code: ${code}`);
        }
    }

    static async submitReferralCode() {
        const input = document.getElementById('input-referral-code');
        const code = input ? input.value : '';

        if (typeof FirebaseService === 'undefined') {
            App.showToast('⚠️ Please sign in to redeem codes!');
            return;
        }

        App.showToast('⏳ Redeeming code...');
        const result = await FirebaseService.redeemReferralCode(code);
        App.showToast(result.message);

        if (result.success) {
            this.renderReferralScreen();
        }
    }

    static async claimReferralReward(target, coins, adFreeDays) {
        if (typeof FirebaseService === 'undefined') {
            App.showToast('⚠️ Please sign in to claim!');
            return;
        }

        App.showToast('⏳ Claiming reward...');
        const result = await FirebaseService.claimReferralMilestone(target, coins, adFreeDays);
        App.showToast(result.message);

        if (result.success) {
            this.renderReferralScreen();
        }
    }

    static renderFeedback() {
        const container = document.getElementById('feedback-content');
        if (!container) return;

        window._currentFeedbackRating = 5;

        container.innerHTML = `
            <div style="max-width:500px;margin:0 auto;text-align:center;padding:10px 0;">
                <div style="font-size:42px;margin-bottom:8px;">💬</div>
                <h2 style="font-size:20px;color:var(--gold,#f59e0b);margin-bottom:6px;">We Value Your Feedback!</h2>
                <p style="color:var(--text-secondary,#8899bb);font-size:14px;margin-bottom:20px;">
                    How is your experience with Block Rush 2K? Let us know what you love or how we can improve.
                </p>

                <div style="background:var(--bg-card,#16213e);border:1px solid var(--bg-elevated,#1f4068);border-radius:12px;padding:20px;text-align:left;">
                    <label style="display:block;font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text-primary,#fff);">Your Rating</label>
                    <div id="feedback-stars-container" style="display:flex;gap:10px;justify-content:center;margin-bottom:18px;font-size:32px;cursor:pointer;">
                        <span class="feedback-star" onclick="Navigation.setFeedbackRating(1)">⭐</span>
                        <span class="feedback-star" onclick="Navigation.setFeedbackRating(2)">⭐</span>
                        <span class="feedback-star" onclick="Navigation.setFeedbackRating(3)">⭐</span>
                        <span class="feedback-star" onclick="Navigation.setFeedbackRating(4)">⭐</span>
                        <span class="feedback-star" onclick="Navigation.setFeedbackRating(5)">⭐</span>
                    </div>

                    <label style="display:block;font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text-primary,#fff);">Your Comments / Suggestions</label>
                    <textarea id="feedback-text-input" placeholder="Type your feedback, feature request, or bug report here..." rows="5" style="width:100%;background:var(--bg-primary,#0f172a);border:1px solid var(--bg-elevated,#1f4068);color:#fff;border-radius:8px;padding:12px;font-size:14px;resize:vertical;font-family:inherit;box-sizing:border-box;outline:none;"></textarea>

                    <button class="btn btn-primary btn-block" style="margin-top:16px;padding:12px;font-size:16px;" onclick="Navigation.submitUserFeedback()">
                        🚀 Submit Feedback & Review
                    </button>
                </div>

                <div style="margin-top:20px;">
                    <button class="btn btn-outline" style="border-color:var(--gold,#f59e0b);color:var(--gold,#f59e0b);" onclick="if(typeof Android !== 'undefined' && Android.openStoreReview){Android.openStoreReview();}else{window.open('https://play.google.com/store/apps/details?id=com.eisen.blockrush2k','_blank');}">
                        ⭐ Rate on App Store / Google Play
                    </button>
                </div>
            </div>
        `;
        Navigation.setFeedbackRating(5);
    }

    static setFeedbackRating(rating) {
        window._currentFeedbackRating = rating;
        const container = document.getElementById('feedback-content');
        if (!container) return;
        const starEls = container.querySelectorAll('.feedback-star');
        starEls.forEach((el, index) => {
            if (index < rating) {
                el.textContent = '⭐';
                el.style.opacity = '1';
            } else {
                el.textContent = '☆';
                el.style.opacity = '0.4';
            }
        });
    }

    static async submitUserFeedback() {
        const rating = window._currentFeedbackRating || 5;
        const textArea = document.getElementById('feedback-text-input');
        const feedbackText = textArea ? textArea.value.trim() : '';

        if (!feedbackText) {
            App.showToast('⚠️ Please enter some feedback before submitting.');
            return;
        }

        try {
            App.showToast('📤 Submitting feedback...');
            if (typeof FirebaseService !== 'undefined' && FirebaseService.submitFeedback) {
                await FirebaseService.submitFeedback(rating, feedbackText);
            } else {
                console.log('Feedback submitted:', { rating, feedbackText });
            }
            App.showToast('✅ Thank you! Feedback saved successfully.');

            App.state.hasRated = true;
            App.saveState();

            // If rating is 4 or 5 stars, invite them to review on store with rich styled popup
            if (rating >= 4) {
                setTimeout(() => {
                    if (typeof PopupManager !== 'undefined') {
                        PopupManager.show({
                            icon: '🌟',
                            title: 'Support Block Rush 2K',
                            subtitle: 'Thank you for your rating!',
                            customContent: `
                                <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:12px;margin:8px 0 16px;text-align:center;">
                                    <div style="font-size:24px;letter-spacing:4px;margin-bottom:4px;">⭐⭐⭐⭐⭐</div>
                                    <div style="font-size:13px;color:var(--text-secondary,#94a3b8);line-height:1.4;">
                                        Would you take a moment to leave a review on the official app store? It helps independent games like ours tremendously!
                                    </div>
                                </div>
                            `,
                            confirmText: '⭐ Rate on App Store',
                            cancelText: 'Maybe Later',
                            confirmType: 'gold',
                            showConfirm: true,
                            showCancel: true,
                            onConfirm: () => {
                                if (typeof Android !== 'undefined' && Android.openStoreReview) {
                                    Android.openStoreReview();
                                } else {
                                    window.open('https://play.google.com/store/apps/details?id=com.eisen.blockrush2k', '_blank');
                                }
                            }
                        });
                    }
                }, 500);
            }

            Navigation.navigateTo('settings');
        } catch (e) {
            console.error('Failed to submit feedback:', e);
            App.showToast('❌ Failed to save feedback. Please check connection.');
        }
    }
}

window.Navigation = Navigation;