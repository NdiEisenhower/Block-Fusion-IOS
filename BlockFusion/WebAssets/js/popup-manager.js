// Popup Manager - Enhanced dialog system
class PopupManager {
    static show(options) {
        const overlay = document.getElementById('popup-overlay');
        const content = document.getElementById('popup-content');

        if (!overlay || !content) return;

        if (overlay.classList.contains('active')) {
            console.warn('Popup already active, closing existing...');
            this.close('cancel');
            setTimeout(() => {
                this._showInternal(options);
            }, 300);
            return;
        }

        return this._showInternal(options);
    }

    static _showInternal(options) {
        const overlay = document.getElementById('popup-overlay');
        const content = document.getElementById('popup-content');

        if (!overlay || !content) return;

        const {
            title = '',
            subtitle = '',
            icon = 'ℹ️',
            body = '',
            details = null,
            progress = null,
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            showCancel = true,
            showConfirm = true,
            showClose = true,
            showBack = false,
            onBack = null,
            confirmType = 'primary',
            onConfirm = null,
            onCancel = null,
            checkbox = null,
            actions = null,
            customContent = null
        } = options;

        let actionsHtml = '';

        if (actions) {
            actionsHtml = actions.map(action => `
                <button class="btn ${action.class || 'btn-primary'} btn-block" 
                        onclick="PopupManager.close('${action.id || 'custom'}')">
                    ${action.icon || ''} ${action.text}
                </button>
            `).join('');
        } else {
            if (showConfirm && showCancel) {
                actionsHtml = `
                    <div class="popup-actions-row">
                        <button class="btn btn-secondary-outline" onclick="PopupManager.close('cancel')">
                            ${cancelText}
                        </button>
                        <button class="btn ${confirmType === 'danger' ? 'btn-danger' : confirmType === 'gold' ? 'btn-gold' : 'btn-primary'}" 
                                onclick="PopupManager.close('confirm')">
                            ${confirmText}
                        </button>
                    </div>
                `;
            } else if (showConfirm) {
                actionsHtml = `
                    <button class="btn ${confirmType === 'danger' ? 'btn-danger' : confirmType === 'gold' ? 'btn-gold' : 'btn-primary'} btn-block" 
                            onclick="PopupManager.close('confirm')">
                        ${confirmText}
                    </button>
                `;
            } else if (showCancel) {
                actionsHtml = `
                    <button class="btn btn-secondary-outline btn-block" onclick="PopupManager.close('cancel')">
                        ${cancelText}
                    </button>
                `;
            }
        }

        let detailsHtml = '';
        if (details && details.length > 0) {
            detailsHtml = `
                <div class="popup-details">
                    ${details.map(d => `
                        <div class="detail-row">
                            <span class="detail-label">${d.label}</span>
                            <span class="detail-value">${d.value}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        let progressHtml = '';
        if (progress) {
            const pct = Math.min(100, Math.max(0, progress.percent || 0));
            const type = progress.type || 'warning';
            progressHtml = `
                <div class="popup-progress">
                    <div class="popup-progress-bar">
                        <div class="popup-progress-fill ${type}" style="width:${pct}%;"></div>
                    </div>
                    <div class="popup-progress-label">
                        <span>${progress.label || ''}</span>
                        <span>${pct}%</span>
                    </div>
                </div>
            `;
        }

        let checkboxHtml = '';
        if (checkbox) {
            checkboxHtml = `
                <div class="popup-checkbox" onclick="PopupManager.toggleCheckbox(event)">
                    <input type="checkbox" id="popup-checkbox" ${checkbox.checked ? 'checked' : ''}>
                    <label for="popup-checkbox">${checkbox.label}</label>
                </div>
            `;
        }

        let customHtml = '';
        if (customContent) {
            customHtml = customContent;
        }

        content.innerHTML = `
            ${showBack ? `<button class="popup-back-btn login-back-btn" onclick="PopupManager.handleBack()" title="Back" aria-label="Back">←</button>` : ''}
            ${showClose ? `<button class="popup-close-btn login-close-btn" onclick="PopupManager.close('cancel')" title="Close" aria-label="Close">✕</button>` : ''}
            <div class="popup-header">
                <span class="popup-icon">${icon}</span>
                <h2 class="popup-title">${title}</h2>
                ${subtitle ? `<p class="popup-subtitle">${subtitle}</p>` : ''}
            </div>
            <div class="popup-body">
                ${body ? `<p>${body}</p>` : ''}
                ${customHtml}
                ${detailsHtml}
                ${progressHtml}
                ${checkboxHtml}
                <div class="popup-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;

        content._onBack = onBack || null;
        content._onConfirm = onConfirm || null;
        content._onCancel = onCancel || null;
        content._checkboxChecked = checkbox?.checked || false;
        content._dismissible = (options.dismissible !== undefined) ? options.dismissible : (showClose || showCancel);

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            if (!window.isTv) return;
            const actionsContainer = content.querySelector('.popup-actions');
            if (actionsContainer) {
                const primaryBtn = actionsContainer.querySelector('.btn-primary, .btn-danger, .btn-gold');
                if (primaryBtn) {
                    primaryBtn.focus();
                } else {
                    const firstBtn = actionsContainer.querySelector('button');
                    if (firstBtn) firstBtn.focus();
                }
            }
        }, 100);

        return new Promise((resolve) => {
            content._resolve = resolve;
        });
    }

    static handleBack() {
        const content = document.getElementById('popup-content');
        if (content && content._onBack) {
            const cb = content._onBack;
            content._onBack = null;
            cb();
        } else {
            this.close('cancel');
        }
    }

    static close(action) {
        const overlay = document.getElementById('popup-overlay');
        const content = document.getElementById('popup-content');

        if (!overlay) return;

        overlay.classList.remove('active');
        document.body.style.overflow = '';

        if (this._tutorialMouseUpHandler) {
            window.removeEventListener('mouseup', this._tutorialMouseUpHandler);
            this._tutorialMouseUpHandler = null;
        }
        if (this._tutorialKeyDownHandler) {
            document.removeEventListener('keydown', this._tutorialKeyDownHandler);
            this._tutorialKeyDownHandler = null;
        }
        this._tutorialAnimating = false;
        clearTimeout(this._tutorialTimeout);

        const checkbox = document.getElementById('popup-checkbox');
        const checked = checkbox ? checkbox.checked : false;

        const onConfirm = content ? content._onConfirm : null;
        const onCancel = content ? content._onCancel : null;
        if (content) {
            content._onConfirm = null;
            content._onCancel = null;
            content._onBack = null;
        }

        if (content && content._resolve) {
            content._resolve({ action, checked });
        }

        if (action === 'confirm' && onConfirm) {
            onConfirm(checked);
        } else if (action === 'cancel' && onCancel) {
            onCancel();
        }

        setTimeout(() => {
            if (content) content.innerHTML = '';
        }, 300);
    }

    static toggleCheckbox(e) {
        e.stopPropagation();
        const checkbox = document.getElementById('popup-checkbox');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
        }
    }

    static handleAndroidBack() {
        const overlay = document.getElementById('popup-overlay');
        const loginScreen = document.getElementById('screen-login-prompt');
        if (overlay && overlay.classList.contains('active')) {
            this.handleBack();
            return true;
        }
        if (loginScreen && loginScreen.classList.contains('active')) {
            if (typeof App !== 'undefined' && App.closeLogin) {
                App.closeLogin();
                return true;
            }
        }
        return false;
    }

    static confirmAppExit() {
        return this.show({
            icon: '👋',
            title: 'Exit App?',
            subtitle: 'Block Rush 2K',
            body: 'Are you sure you want to exit the game?',
            confirmText: 'Yes, Exit',
            cancelText: 'Stay',
            confirmType: 'danger',
            onConfirm: () => {
                if (typeof Android !== 'undefined' && typeof Android.exitApp === 'function') {
                    Android.exitApp();
                } else if (typeof window.close === 'function') {
                    window.close();
                }
            }
        });
    }

    static confirmExit() {
        if (this.handleAndroidBack()) return Promise.resolve({ action: 'cancel' });

        const activeScreen = document.querySelector('.screen.active')?.id;

        // If on Home Screen -> Ask if user wants to Exit App
        if (activeScreen === 'screen-home' || !activeScreen) {
            return this.confirmAppExit();
        }

        // If on Game Screen
        if (activeScreen === 'screen-game') {
            if (typeof App === 'undefined' || !App.currentGame) {
                if (typeof Navigation !== 'undefined') Navigation.navigateTo('home');
                return Promise.resolve({ action: 'confirm' });
            }

            if (App.currentGame.gameOver || App.currentGame.gameWon) {
                if (typeof App !== 'undefined' && App.quitGame) {
                    App.quitGame();
                }
                return Promise.resolve({ action: 'confirm' });
            }

            const coinCount = App.state?.coins || 0;
            const levelNum = App.state?.currentLevel || 1;
            const movesUsed = App.currentGame?.moves || 0;

            return this.show({
                icon: '🚪',
                title: 'Exit Level?',
                subtitle: 'Are you sure you want to leave?',
                body: 'Your progress in this level will be lost.',
                details: [
                    { label: 'Current Level', value: `Level ${levelNum}` },
                    { label: 'Moves Used', value: `${movesUsed}` },
                    { label: 'Coins', value: `<span class="coin-label"><span class="custom-coin"></span> ${coinCount.toLocaleString()}</span>` }
                ],
                confirmText: 'Yes, Exit Level',
                cancelText: 'Keep Playing',
                confirmType: 'danger',
                onConfirm: () => {
                    if (typeof App !== 'undefined' && App.quitGame) {
                        App.quitGame();
                    }
                    if (typeof App !== 'undefined' && App.showToast) {
                        App.showToast('👋 Exited level');
                    }
                },
                onCancel: () => {
                    if (typeof App !== 'undefined' && App.showToast) {
                        App.showToast('▶️ Resuming game...');
                    }
                }
            });
        }

        // If on Level Select screen -> go back to World Select
        if (activeScreen === 'screen-level-select') {
            if (typeof Navigation !== 'undefined') Navigation.navigateTo('world-select');
            return Promise.resolve({ action: 'navigate' });
        }

        // Any other screen (world-select, store, settings, leaderboard, referral, daily, achievements) -> go back to Home
        if (typeof Navigation !== 'undefined') {
            Navigation.navigateTo('home');
        }
        return Promise.resolve({ action: 'navigate' });
    }

    static confirmReset() {
        if (typeof App === 'undefined') {
            return this.show({
                icon: '⚠️',
                title: 'Error',
                body: 'App not initialized',
                confirmText: 'OK',
                showCancel: false
            });
        }

        const totalStars = Object.values(App.state.stars || {}).reduce((a, b) => a + (b || 0), 0);
        const levelsCompleted = Object.values(App.state.stars || {}).filter(s => s > 0).length;
        const coinCount = App.state.coins || 0;

        return this.show({
            icon: '🗑️',
            title: 'Reset All Progress?',
            subtitle: 'This action cannot be undone!',
            body: 'All your coins, stars, levels, and unlocks will be permanently deleted.',
            details: [
                { label: 'Coins', value: `<span class="coin-label"><span class="custom-coin"></span> ${coinCount.toLocaleString()}</span>` },
                { label: 'Total Stars', value: `${totalStars} ⭐` },
                { label: 'Levels Completed', value: `${levelsCompleted}` },
                { label: 'Themes Unlocked', value: `${App.state.unlockedThemes?.length || 1}` }
            ],
            checkbox: {
                label: 'I understand this is permanent and cannot be undone',
                checked: false
            },
            confirmText: 'Yes, Delete Everything',
            cancelText: 'Cancel',
            confirmType: 'danger',
            onConfirm: (confirmed) => {
                if (confirmed && typeof App !== 'undefined' && App.resetAllProgress) {
                    App.resetAllProgress();
                } else if (!confirmed && typeof App !== 'undefined' && App.showToast) {
                    App.showToast('⚠️ Please confirm to reset');
                    return false;
                }
            }
        });
    }

    static showLevelInfo() {
        if (typeof App === 'undefined' || !App.currentGame) {
            return this.show({
                icon: 'ℹ️',
                title: 'No Active Game',
                body: 'Start a game first to see level info',
                confirmText: 'OK',
                showCancel: false
            });
        }

        const game = App.currentGame;
        const worldName = CONFIG.WORLDS[game.worldId]?.name || 'Unknown';
        const key = `${game.worldId}-${game.levelNum}`;
        const stars = App.state.stars?.[key] || 0;
        const coinCount = App.state.coins || 0;

        return this.show({
            icon: '📖',
            title: `${worldName} • Level ${game.levelNum}`,
            subtitle: 'Level Information',
            details: [
                { label: '🎯 Goal', value: GameUI.getTileLabel(game.goal) },
                { label: '🎯 Target Moves', value: `${game.targetMoves}` },
                { label: '💰 Reward', value: `<span class="coin-label"><span class="custom-coin"></span> ${game.reward}</span>` },
                { label: '⭐ Best Stars', value: stars > 0 ? '⭐'.repeat(stars) : '—' },
                { label: 'Your Coins', value: `<span class="coin-label"><span class="custom-coin"></span> ${coinCount.toLocaleString()}</span>` }
            ],
            confirmText: 'Got it!',
            showCancel: false,
            confirmType: 'primary'
        });
    }

    static showThemeMergeGuide() {
        const theme = (typeof App !== 'undefined' && App.state) ? App.state.activeTheme : 'numbers';
        const themeNames = {
            numbers: '🔢 Classic Numbers',
            fruit: '🍎 Fruit Theme',
            animals: '🐾 Animals Theme',
            space: '🚀 Space Theme',
            southafrica: '🇿🇦 Country / South Africa',
            theme_neon: '⚡ Neon Theme',
            theme_wood: '🪵 Wood Theme'
        };
        const activeThemeName = themeNames[theme] || 'Classic Numbers';
        const labels = CONFIG.THEME_LABELS[theme] || CONFIG.THEME_LABELS['numbers'];
        const values = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768];

        let tableHtml = `<div style="max-height: 280px; overflow-y: auto; margin-top: 10px; padding-right: 4px;">
            <p style="text-align: center; font-weight: bold; margin-bottom: 10px; color: #4af;">Current Theme: ${activeThemeName}</p>
            <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 14px;">
                <thead>
                    <tr style="border-bottom: 2px solid rgba(255,255,255,0.2); color: #8899bb;">
                        <th style="padding: 6px;">Tile Value</th>
                        <th style="padding: 6px;">Merge Icon / Label</th>
                    </tr>
                </thead>
                <tbody>`;

        for (let i = 0; i < values.length; i++) {
            const val = values[i];
            const label = labels[i] || val.toString();
            const isGoal = App && App.currentGame && val === App.currentGame.goal;
            const rowStyle = isGoal ? 'background: rgba(74, 175, 80, 0.25); font-weight: bold; border-left: 3px solid #4af;' : 'border-bottom: 1px solid rgba(255,255,255,0.05);';
            tableHtml += `<tr style="${rowStyle}">
                <td style="padding: 8px;">${val} ${isGoal ? '🎯 (Goal)' : ''}</td>
                <td style="padding: 8px; font-size: 18px;">${label}</td>
            </tr>`;
        }

        tableHtml += `</tbody></table></div>`;

        return this.show({
            icon: '🎯',
            title: 'Theme Merge Guide',
            subtitle: 'How tiles merge in this theme',
            body: tableHtml,
            confirmText: 'Got it!',
            showCancel: false,
            confirmType: 'primary'
        });
    }

    // ===== INTERACTIVE TUTORIAL ===== 
    static _getTutorialSteps() {
        return [
            {
                instruction: 'Swipe or tap <b>LEFT / RIGHT</b> to combine identical tiles!',
                directionPrompt: '👈 Swipe or Tap Left / Right 👉',
                allowedDirections: ['left', 'right'],
                tiles: [
                    { r: 1, c: 1, val: 2 },
                    { r: 1, c: 2, val: 2 }
                ],
                successMsg: '🎉 Great job! 2 + 2 = 4!',
                executeSwipe: (dir) => {
                    if (dir === 'left') {
                        return {
                            slideAnims: [{ from: [1, 2], to: [1, 1] }],
                            finalTiles: [{ r: 1, c: 1, val: 4, merged: true }]
                        };
                    } else {
                        return {
                            slideAnims: [{ from: [1, 1], to: [1, 2] }],
                            finalTiles: [{ r: 1, c: 2, val: 4, merged: true }]
                        };
                    }
                }
            },
            {
                instruction: 'Swipe or tap <b>UP / DOWN</b> to combine tiles vertically!',
                directionPrompt: '👆 Swipe or Tap Up / Down 👇',
                allowedDirections: ['up', 'down'],
                tiles: [
                    { r: 1, c: 1, val: 4 },
                    { r: 2, c: 1, val: 4 }
                ],
                successMsg: '🚀 Awesome! 4 + 4 = 8!',
                executeSwipe: (dir) => {
                    if (dir === 'up') {
                        return {
                            slideAnims: [{ from: [2, 1], to: [1, 1] }],
                            finalTiles: [{ r: 1, c: 1, val: 8, merged: true }]
                        };
                    } else {
                        return {
                            slideAnims: [{ from: [1, 1], to: [2, 1] }],
                            finalTiles: [{ r: 2, c: 1, val: 8, merged: true }]
                        };
                    }
                }
            },
            {
                instruction: 'Tiles slide all the way across empty cells to merge across gaps!',
                directionPrompt: '👈 Slide & Merge 👉',
                allowedDirections: ['left', 'right'],
                tiles: [
                    { r: 1, c: 0, val: 8 },
                    { r: 1, c: 2, val: 8 }
                ],
                successMsg: '🌟 Perfect! Slides work across any distance!',
                executeSwipe: (dir) => {
                    if (dir === 'left') {
                        return {
                            slideAnims: [{ from: [1, 2], to: [1, 0] }],
                            finalTiles: [{ r: 1, c: 0, val: 16, merged: true }]
                        };
                    } else {
                        return {
                            slideAnims: [{ from: [1, 0], to: [1, 2] }],
                            finalTiles: [{ r: 1, c: 2, val: 16, merged: true }]
                        };
                    }
                }
            },
            {
                instruction: 'Different numbers won\'t combine. Try moving <b>LEFT</b> to see!',
                directionPrompt: '⚠️ Non-matching Tiles',
                allowedDirections: ['left', 'right', 'up', 'down'],
                tiles: [
                    { r: 1, c: 1, val: 2 },
                    { r: 1, c: 2, val: 4 }
                ],
                successMsg: '💡 Notice they slide together but stay separate!',
                executeSwipe: (dir) => {
                    if (dir === 'left') {
                        return {
                            slideAnims: [
                                { from: [1, 1], to: [1, 0] },
                                { from: [1, 2], to: [1, 1] }
                            ],
                            finalTiles: [
                                { r: 1, c: 0, val: 2 },
                                { r: 1, c: 1, val: 4 }
                            ]
                        };
                    } else if (dir === 'right') {
                        return {
                            slideAnims: [
                                { from: [1, 2], to: [1, 3] },
                                { from: [1, 1], to: [1, 2] }
                            ],
                            finalTiles: [
                                { r: 1, c: 2, val: 2 },
                                { r: 1, c: 3, val: 4 }
                            ]
                        };
                    } else if (dir === 'up') {
                        return {
                            slideAnims: [
                                { from: [1, 1], to: [0, 1] },
                                { from: [1, 2], to: [0, 2] }
                            ],
                            finalTiles: [
                                { r: 0, c: 1, val: 2 },
                                { r: 0, c: 2, val: 4 }
                            ]
                        };
                    } else {
                        return {
                            slideAnims: [
                                { from: [1, 1], to: [3, 1] },
                                { from: [1, 2], to: [3, 2] }
                            ],
                            finalTiles: [
                                { r: 3, c: 1, val: 2 },
                                { r: 3, c: 2, val: 4 }
                            ]
                        };
                    }
                },
                isLastStep: true
            }
        ];
    }

    static showTutorialPopup() {
        const steps = this._getTutorialSteps();
        const totalSteps = steps.length;

        this._tutorialStep = 0;
        this._tutorialTotalSteps = totalSteps;
        this._tutorialMaxStepReached = 0;
        this._tutorialStepCompleted = false;
        clearTimeout(this._tutorialAutoNextTimer);

        const customContent = this._getTutorialStepHtml(0);

        const popupPromise = this.show({
            icon: '📖',
            title: 'How to Play - Interactive',
            subtitle: 'Learn by doing!',
            showConfirm: false,
            showCancel: true,
            cancelText: 'Skip Tutorial',
            customContent: customContent,
            onCancel: () => {
                clearTimeout(this._tutorialAutoNextTimer);
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast('🎮 Tutorial skipped!');
                }
            }
        });

        setTimeout(() => {
            const popupEl = document.getElementById('popup-content');
            if (popupEl) popupEl.classList.add('popup-tutorial');
            this._renderTutorialTiles(steps[0].tiles, true);
            this.setupTutorialSwipe();
        }, 50);

        return popupPromise;
    }

    static tutorialNext() {
        clearTimeout(this._tutorialTimeout);
        clearTimeout(this._tutorialAutoNextTimer);
        const step = this._tutorialStep || 0;
        const steps = this._getTutorialSteps();
        const total = steps.length;

        if (step >= total - 1) {
            PopupManager.close('confirm');
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('🎉 Tutorial complete! Good luck!');
            }
            return;
        }

        this._tutorialStep = step + 1;
        this._updateTutorialContent();
    }

    static tutorialPrev() {
        clearTimeout(this._tutorialTimeout);
        clearTimeout(this._tutorialAutoNextTimer);
        const step = this._tutorialStep || 0;
        if (step <= 0) return;

        this._tutorialStep = step - 1;
        this._updateTutorialContent();
    }

    static _updateTutorialContent() {
        clearTimeout(this._tutorialAutoNextTimer);
        this._tutorialStepCompleted = false;

        const content = document.getElementById('popup-content');
        if (!content) return;

        const step = this._tutorialStep || 0;
        const steps = this._getTutorialSteps();

        const stepContainer = content.querySelector('.tutorial-step');
        if (stepContainer) {
            stepContainer.outerHTML = this._getTutorialStepHtml(step);
        }

        this._renderTutorialTiles(steps[step].tiles, true);

        if (this._tutorialMouseUpHandler) {
            window.removeEventListener('mouseup', this._tutorialMouseUpHandler);
            this._tutorialMouseUpHandler = null;
        }
        if (this._tutorialKeyDownHandler) {
            document.removeEventListener('keydown', this._tutorialKeyDownHandler);
            this._tutorialKeyDownHandler = null;
        }

        this._tutorialAnimating = false;

        this.setupTutorialSwipe();
    }

    static _getTutorialStepHtml(stepIndex) {
        const steps = this._getTutorialSteps();
        const step = steps[stepIndex] || steps[0];
        const total = steps.length;

        let cellsHtml = '';
        for (let i = 0; i < 16; i++) {
            cellsHtml += '<div class="grid-cell"></div>';
        }

        let dotsHtml = '';
        for (let i = 0; i < total; i++) {
            const cls = i === stepIndex ? 'active' : (i < stepIndex ? 'completed' : '');
            dotsHtml += `<div class="tutorial-dot ${cls}"></div>`;
        }

        const stepText = `Step ${stepIndex + 1} of ${total}`;
        const isNextDisabled = stepIndex >= (this._tutorialMaxStepReached || 0);

        let dirButtonsHtml = '';
        if (step.allowedDirections.includes('left') && step.allowedDirections.includes('right') && step.allowedDirections.length === 2) {
            dirButtonsHtml = `
                <div class="tutorial-dir-container" id="tutorial-dir-container">
                    <button class="btn btn-sm btn-secondary tutorial-dir-btn" onclick="PopupManager.handleTutorialMove('left')">👈 Swipe Left</button>
                    <button class="btn btn-sm btn-secondary tutorial-dir-btn" onclick="PopupManager.handleTutorialMove('right')">Swipe Right 👉</button>
                </div>
            `;
        } else if (step.allowedDirections.includes('up') && step.allowedDirections.includes('down') && step.allowedDirections.length === 2) {
            dirButtonsHtml = `
                <div class="tutorial-dir-container" id="tutorial-dir-container">
                    <button class="btn btn-sm btn-secondary tutorial-dir-btn" onclick="PopupManager.handleTutorialMove('up')">👆 Swipe Up</button>
                    <button class="btn btn-sm btn-secondary tutorial-dir-btn" onclick="PopupManager.handleTutorialMove('down')">Swipe Down 👇</button>
                </div>
            `;
        } else if (step.allowedDirections.length > 0) {
            dirButtonsHtml = `
                <div class="tutorial-dir-container" id="tutorial-dir-container">
                    <button class="btn btn-sm btn-secondary tutorial-dir-btn" onclick="PopupManager.handleTutorialMove('left')">👈 Left</button>
                    <button class="btn btn-sm btn-secondary tutorial-dir-btn" onclick="PopupManager.handleTutorialMove('right')">Right 👉</button>
                    <button class="btn btn-sm btn-secondary tutorial-dir-btn" onclick="PopupManager.handleTutorialMove('up')">👆 Up</button>
                    <button class="btn btn-sm btn-secondary tutorial-dir-btn" onclick="PopupManager.handleTutorialMove('down')">Down 👇</button>
                </div>
            `;
        }

        const isVert = step.allowedDirections.includes('up') || step.allowedDirections.includes('down');
        const gestureGuideHtml = `
            <div class="tutorial-gesture-guide" id="tutorial-gesture-guide">
                <div class="tutorial-hand-icon ${isVert ? 'vertical' : ''}">👆</div>
            </div>
        `;

        return `
            <div class="tutorial-step" id="tutorial-step">
                <div class="board-container" style="padding: 4px 0; display: flex; justify-content: center;">
                    <div class="board-wrapper" id="tutorial-board-wrapper" style="display: inline-block; position: relative;">
                        <div class="grid-bg" style="display: grid; grid-template-columns: repeat(4, 46px); grid-template-rows: repeat(4, 46px); gap: 6px;">
                            ${cellsHtml}
                        </div>
                        <div class="tiles-layer" id="tutorial-tiles-layer" style="position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; pointer-events: none;">
                            <!-- Tiles will be rendered dynamically -->
                        </div>
                        ${gestureGuideHtml}
                    </div>
                </div>
                <div class="tutorial-step-indicator">${dotsHtml}</div>
                <div class="tutorial-instruction" id="tutorial-instruction">
                    <span>${step.instruction}</span>
                </div>
                ${dirButtonsHtml}
                <div id="tutorial-next-prompt-container" style="text-align:center; min-height: 22px; margin-top: 4px;">
                    <p style="color:#8899bb;font-size:11px;margin:0;font-weight:600;" id="tutorial-prompt-text">
                        ${step.directionPrompt} • ${stepText}
                    </p>
                </div>
                <div class="tutorial-actions" style="display:flex;gap:8px;margin-top:10px;">
                    ${stepIndex > 0 ? `<button class="btn btn-sm btn-outline" onclick="PopupManager.tutorialPrev()">← Back</button>` : ''}
                    <button class="btn btn-sm ${isNextDisabled ? 'btn-primary' : 'btn-gold pulse-glow'} btn-tutorial-next"
                            onclick="PopupManager.tutorialNext()" style="flex:1;" ${isNextDisabled ? 'disabled' : ''}>
                        ${stepIndex === total - 1 && !isNextDisabled ? '✅ Start Playing!' : 'Next →'}
                    </button>
                </div>
            </div>
        `;
    }

    static _renderTutorialTiles(tiles, noTransition = true) {
        const layer = document.getElementById('tutorial-tiles-layer');
        if (!layer) return;

        const tileSize = 46;
        const gapSize = 6;

        let html = '';
        tiles.forEach(tile => {
            const isHighlight = tile.highlight;
            const label = typeof GameUI !== 'undefined' ? GameUI.getTileLabel(tile.val) : tile.val.toString();
            const classes = `tile ${isHighlight ? 'tutorial-highlight' : ''}`;
            const transitionStyle = noTransition ? 'transition: none !important;' : '';
            const x = tile.c * (tileSize + gapSize);
            const y = tile.r * (tileSize + gapSize);
            html += `
                <div class="${classes}" 
                     data-value="${tile.val}"
                     style="${transitionStyle} transform: translate(${x}px, ${y}px); width:${tileSize}px; height:${tileSize}px; top:0; left:0; position:absolute;"
                     data-r="${tile.r}" data-c="${tile.c}">
                    ${label}
                </div>
            `;
        });
        layer.innerHTML = html;
    }

    static setupTutorialSwipe() {
        const board = document.getElementById('tutorial-board-wrapper');
        if (!board) return;

        let startX, startY, isSwiping = false;

        board.addEventListener('touchstart', (e) => {
            if (this._tutorialAnimating) return;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            isSwiping = true;
        }, { passive: true });

        board.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            e.preventDefault();
        }, { passive: false });

        board.addEventListener('touchend', (e) => {
            if (!isSwiping || this._tutorialAnimating) {
                isSwiping = false;
                return;
            }

            const touch = e.changedTouches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;

            if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
                isSwiping = false;
                return;
            }

            let direction;
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? 'right' : 'left';
            } else {
                direction = dy > 0 ? 'down' : 'up';
            }

            this.handleTutorialMove(direction);
            isSwiping = false;
        }, { passive: true });

        board.addEventListener('mousedown', (e) => {
            if (this._tutorialAnimating) return;
            startX = e.clientX;
            startY = e.clientY;
            isSwiping = true;
            e.preventDefault();
        });

        const onMouseUp = (e) => {
            if (!isSwiping) return;
            isSwiping = false;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
                return;
            }

            let direction;
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? 'right' : 'left';
            } else {
                direction = dy > 0 ? 'down' : 'up';
            }

            this.handleTutorialMove(direction);
        };
        window.addEventListener('mouseup', onMouseUp);
        this._tutorialMouseUpHandler = onMouseUp;

        const onKeyDown = (e) => {
            if (this._tutorialAnimating) return;
            const keyMap = {
                'ArrowUp': 'up',
                'ArrowDown': 'down',
                'ArrowLeft': 'left',
                'ArrowRight': 'right'
            };
            if (keyMap[e.key]) {
                e.preventDefault();
                this.handleTutorialMove(keyMap[e.key]);
            }
        };
        document.addEventListener('keydown', onKeyDown);
        this._tutorialKeyDownHandler = onKeyDown;
    }

    static handleTutorialMove(direction) {
        const steps = this._getTutorialSteps();
        const stepIndex = this._tutorialStep || 0;
        const currentStep = steps[stepIndex];
        if (!currentStep) return;

        // If step is ALREADY completed, guide user directly to Next step
        if (this._tutorialStepCompleted) {
            clearTimeout(this._tutorialAutoNextTimer);
            const container = document.getElementById('popup-content');
            if (container) {
                const nextBtn = container.querySelector('.btn-tutorial-next') || container.querySelector('.btn-tutorial-finish');
                if (nextBtn) {
                    nextBtn.classList.remove('pulse-glow');
                    void nextBtn.offsetWidth;
                    nextBtn.classList.add('pulse-glow');
                }
            }
            this.tutorialNext();
            return;
        }

        if (currentStep.allowedDirections.includes(direction)) {
            this._tutorialAnimating = true;

            const result = currentStep.executeSwipe(direction, currentStep.tiles);
            const container = document.getElementById('popup-content');
            const layer = document.getElementById('tutorial-tiles-layer');
            if (!layer) {
                this._tutorialAnimating = false;
                return;
            }

            // Hide gesture guide overlay
            const gestureGuide = document.getElementById('tutorial-gesture-guide');
            if (gestureGuide) gestureGuide.style.display = 'none';

            // Hide direction buttons
            const dirContainer = document.getElementById('tutorial-dir-container');
            if (dirContainer) dirContainer.style.display = 'none';

            const tileSize = 46;
            const gapSize = 6;

            // 1. Animate sliding tiles
            if (result.slideAnims && result.slideAnims.length > 0) {
                result.slideAnims.forEach(anim => {
                    const [fr, fc] = anim.from;
                    const [tr, tc] = anim.to;
                    const tileEl = container.querySelector(`.tile[data-r="${fr}"][data-c="${fc}"]`);
                    if (tileEl) {
                        const x = tc * (tileSize + gapSize);
                        const y = tr * (tileSize + gapSize);
                        tileEl.style.transition = 'transform 0.15s ease-in-out';
                        tileEl.style.transform = `translate(${x}px, ${y}px)`;
                        tileEl.setAttribute('data-r', tr);
                        tileEl.setAttribute('data-c', tc);
                    }
                });
            }

            try { SoundManager.click(); } catch (e) { }

            // 2. Wait for sliding to finish
            setTimeout(() => {
                // Clean deterministic tiles ONLY - no random spawning during tutorial!
                const finalTiles = result.finalTiles;

                // Render with pixel positioning
                this._renderTutorialTiles(finalTiles, false);

                // 3. Trigger merge pop effect
                const mergedTile = finalTiles.find(t => t.merged);
                if (mergedTile) {
                    const mergedEl = layer.querySelector(
                        `.tile[data-r="${mergedTile.r}"][data-c="${mergedTile.c}"]`
                    );

                    if (mergedEl) {
                        const currentTransform = mergedEl.style.transform;
                        mergedEl.animate([
                            { transform: `${currentTransform} scale(1)` },
                            { transform: `${currentTransform} scale(1.25)` },
                            { transform: `${currentTransform} scale(1)` }
                        ], {
                            duration: 180,
                            easing: 'ease-out'
                        });
                    }
                }

                // Mark step completed!
                this._tutorialStepCompleted = true;
                this._tutorialMaxStepReached = Math.max(
                    this._tutorialMaxStepReached || 0,
                    stepIndex + 1
                );

                // Display clear step completed message
                const instructionEl = document.getElementById('tutorial-instruction');
                if (instructionEl) {
                    instructionEl.classList.add('tutorial-success-box');
                    instructionEl.innerHTML = `
                        <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                            <span style="color:#4E9F3D; font-weight:bold; font-size:14px;">${currentStep.successMsg}</span>
                            <span style="color:#FFD700; font-weight:bold; font-size:12px; animation: pulse 1.2s infinite;">👇 Tap "Next Step" to continue! 👇</span>
                        </div>
                    `;
                }

                const promptText = document.getElementById('tutorial-prompt-text');
                if (promptText) {
                    promptText.innerHTML = `✅ Step ${stepIndex + 1} Completed!`;
                    promptText.style.color = '#4E9F3D';
                }

                // Enable and highlight the Next button
                const nextBtn = container.querySelector('.btn-tutorial-next');
                if (nextBtn) {
                    nextBtn.disabled = false;
                    nextBtn.classList.remove('btn-primary');
                    nextBtn.classList.add('btn-gold', 'pulse-glow');
                    nextBtn.innerHTML = currentStep.isLastStep ? '✅ Start Playing!' : 'Next Step →';
                    if (window.isTv) nextBtn.focus();
                }

                if (currentStep.isLastStep) {
                    const actionContainer = container.querySelector('.tutorial-actions');
                    if (actionContainer) {
                        actionContainer.innerHTML = `
                            <button class="btn btn-sm btn-outline" onclick="PopupManager.tutorialPrev()">← Back</button>
                            <button class="btn btn-gold btn-tutorial-finish pulse-glow" style="flex:1;"
                                    onclick="PopupManager.close('confirm')">
                                ✅ Start Playing!
                            </button>
                        `;
                        const finishBtn = container.querySelector('.btn-tutorial-finish');
                        if (finishBtn && window.isTv) finishBtn.focus();
                    }
                } else {
                    // Auto-advance seamlessly after 1.8 seconds if user doesn't press Next
                    clearTimeout(this._tutorialAutoNextTimer);
                    this._tutorialAutoNextTimer = setTimeout(() => {
                        if (this._tutorialStep === stepIndex && this._tutorialStepCompleted) {
                            this.tutorialNext();
                        }
                    }, 1800);
                }

                this._tutorialAnimating = false;

            }, 150);
        } else {
            // Invalid direction – shake the board
            const wrapper = document.getElementById('tutorial-board-wrapper');
            if (wrapper) {
                wrapper.classList.remove('board-shake');
                void wrapper.offsetWidth;
                wrapper.classList.add('board-shake');
                setTimeout(() => wrapper.classList.remove('board-shake'), 300);
            }
            try { SoundManager.invalid(); } catch (e) { }
        }
    }

    static showDailyChallenge() {
        if (typeof DailyChallenge === 'undefined') {
            return this.show({
                icon: '📅',
                title: 'Daily Challenge',
                body: 'Coming soon!',
                confirmText: 'OK',
                showCancel: false
            });
        }

        const challenge = DailyChallenge.getDailyChallenge();
        const done = App.state.dailyChallengeDone;
        const prog = App.state.dailyProgress || { levels: 0, merges: 0, coins: 0, moves: Infinity };
        const coinCount = App.state.coins || 0;

        let progressText = '';
        let pct = 0;
        if (!done && challenge) {
            switch (challenge.type) {
                case 'reach':
                    progressText = `Highest tile: ${App.state.highestTileEver || 0} / ${challenge.goal}`;
                    pct = Math.min(100, Math.floor(((App.state.highestTileEver || 0) / challenge.goal) * 100));
                    break;
                case 'moves':
                    const bestMoves = prog.moves === Infinity ? 0 : prog.moves;
                    progressText = `Best moves: ${bestMoves} / ${challenge.goal}`;
                    pct = Math.min(100, Math.floor((bestMoves / challenge.goal) * 100));
                    break;
                case 'levels':
                    progressText = `Levels today: ${prog.levels || 0} / ${challenge.goal}`;
                    pct = Math.min(100, Math.floor(((prog.levels || 0) / challenge.goal) * 100));
                    break;
                case 'coins':
                    progressText = `Coins today: ${prog.coins || 0} / ${challenge.goal}`;
                    pct = Math.min(100, Math.floor(((prog.coins || 0) / challenge.goal) * 100));
                    break;
                case 'merge':
                    progressText = `Merges: ${prog.merges || 0} / ${challenge.goal}`;
                    pct = Math.min(100, Math.floor(((prog.merges || 0) / challenge.goal) * 100));
                    break;
            }
        }

        return this.show({
            icon: done ? '✅' : '📅',
            title: done ? 'Daily Challenge Complete!' : 'Daily Challenge',
            subtitle: done ? 'You earned the reward!' : 'Complete today\'s challenge for rewards',
            body: done ? '🎉 Great job! Come back tomorrow for a new challenge.' : (challenge?.desc || 'Merge tiles to complete the daily challenge!'),
            details: done ? [
                { label: 'Reward', value: `<span class="coin-label"><span class="custom-coin"></span> ${challenge?.reward || 0}</span>` },
                { label: 'Streak', value: `${App.state.currentStreak || 0} days 🔥` },
                { label: 'Total Coins', value: `<span class="coin-label"><span class="custom-coin"></span> ${coinCount.toLocaleString()}</span>` }
            ] : [
                { label: 'Goal', value: challenge?.desc || 'Complete challenge' },
                { label: 'Reward', value: `<span class="coin-label"><span class="custom-coin"></span> ${challenge?.reward || 0}</span>` }
            ],
            progress: done ? null : {
                percent: pct,
                label: progressText,
                type: pct >= 80 ? 'success' : 'warning'
            },
            confirmText: done ? '▶ Continue' : '🎯 Play Now',
            cancelText: 'Close',
            showCancel: true,
            confirmType: 'gold',
            onConfirm: () => {
                if (done) {
                    Navigation.navigateTo('home');
                } else {
                    App.continueGame();
                }
            }
        });
    }

    static showReviewPrompt() {
        this.show({
            icon: '🌟',
            title: 'Enjoying Block Rush 2K?',
            subtitle: 'We value your support!',
            customContent: `
                <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:12px;margin:8px 0 16px;text-align:center;">
                    <div style="font-size:24px;letter-spacing:4px;margin-bottom:4px;">⭐⭐⭐⭐⭐</div>
                    <div style="font-size:13px;color:var(--text-secondary,#94a3b8);line-height:1.4;">
                        Your ratings and feedback motivate our team to bring you new themes, challenges, and updates!
                    </div>
                </div>
            `,
            confirmText: '⭐ Rate Now (5 Stars)',
            cancelText: 'Maybe Later',
            confirmType: 'gold',
            showConfirm: true,
            showCancel: true,
            onConfirm: () => {
                App.state.hasRated = true;
                App.saveState();
                if (typeof Android !== 'undefined' && Android.openStoreReview) {
                    Android.openStoreReview();
                } else {
                    window.open('https://play.google.com/store/apps/details?id=com.eisen.blockrush2k', '_blank');
                }
            }
        });
    }

    // Helper: Close popup and return result
    static closeAndReturn(action) {
        this.close(action);
        return { action };
    }
}

// Auto-initialize popup overlay click handler
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('popup-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                const content = document.getElementById('popup-content');
                if (content && content._dismissible === false) {
                    return; // Unskippable system modal (Maintenance or Force Update)
                }
                PopupManager.close('cancel');
            }
        });
    }
});

window.PopupManager = PopupManager;