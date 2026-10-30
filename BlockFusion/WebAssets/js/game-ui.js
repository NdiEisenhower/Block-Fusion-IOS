// Game UI Renderer
class GameUI {
    static renderBoard(game) {
        const layer = document.getElementById('tiles-layer');
        const gridBg = document.getElementById('grid-bg');
        if (!layer || !game) return;

        const boardWrapper = document.querySelector('.board-wrapper');

        // Render grid cells if empty
        if (gridBg && gridBg.children.length === 0) {
            let cells = '';
            for (let i = 0; i < 16; i++) {
                cells += '<div class="grid-cell"></div>';
            }
            gridBg.innerHTML = cells;
        }

        // Ensure grid cells exist and measure actual rendered DOM geometry
        const gridCells = gridBg ? gridBg.children : [];
        let tileSize = 70;
        let gapSize = 8;

        if (gridCells.length > 0 && gridCells[0].offsetWidth > 0) {
            tileSize = gridCells[0].offsetWidth;
            if (gridCells.length > 1) {
                const cell0Rect = gridCells[0].getBoundingClientRect();
                const cell1Rect = gridCells[1].getBoundingClientRect();
                const measuredGap = cell1Rect.left - cell0Rect.right;
                if (measuredGap > 0) gapSize = measuredGap;
            }
        } else {
            const style = getComputedStyle(boardWrapper || document.documentElement);
            const rawTile = style.getPropertyValue('--tile-size').trim();
            const parsedTile = parseFloat(rawTile);
            if (!isNaN(parsedTile) && parsedTile > 0) tileSize = parsedTile;
            const rawGap = style.getPropertyValue('--gap-size').trim();
            const parsedGap = parseFloat(rawGap);
            if (!isNaN(parsedGap) && parsedGap > 0) gapSize = parsedGap;

            // If cells haven't completed layout paint yet, re-render on next animation frame
            if (gridCells.length === 16 && gridCells[0].offsetWidth === 0) {
                requestAnimationFrame(() => {
                    if (game && !game.gameOver) GameUI.renderBoard(game);
                });
            }
        }

        const board = game.getBoardData();
        let html = '';
        let hasTiles = false;
        let maxTierThisMove = 0;

        // Calculate tile positions using exact cell offsets
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (board[r][c] > 0) {
                    hasTiles = true;
                    const val = board[r][c];
                    const cellIndex = r * 4 + c;
                    const targetCell = gridCells[cellIndex];
                    const hasCellLayout = targetCell && targetCell.offsetWidth > 0;

                    const x = hasCellLayout ? targetCell.offsetLeft : c * (tileSize + gapSize);
                    const y = hasCellLayout ? targetCell.offsetTop : r * (tileSize + gapSize);
                    const w = hasCellLayout ? targetCell.offsetWidth : tileSize;
                    const h = hasCellLayout ? targetCell.offsetHeight : tileSize;

                    const isGoal = val >= game.goal;
                    const label = GameUI.getTileLabel(val);

                    const key = `${r}-${c}`;
                    const isMerged = game.mergedThisMove && game.mergedThisMove.has(key);
                    const isSpawned = game.lastSpawnedPos && game.lastSpawnedPos.r === r && game.lastSpawnedPos.c === c;

                    let animClass = '';
                    let floatHtml = '';
                    let tier = 1;

                    if (isMerged) {
                        const ratio = val / (game.goal || 64);
                        if (val > 2048 || ratio > 1.0) {
                            tier = 4;
                        } else if (val >= 512 || ratio >= 0.5) {
                            tier = 3;
                        } else if (val >= 32 || ratio >= 0.2) {
                            tier = 2;
                        } else {
                            tier = 1;
                        }

                        if (tier > maxTierThisMove) {
                            maxTierThisMove = tier;
                        }

                        animClass = `merge-anim merge-tier-${tier}`;
                        const icon = tier === 4 ? ' ⚡👑' : tier === 3 ? ' 🔥' : '';
                        floatHtml = `<div class="float-score-pop tier-${tier}">+${val}${icon}</div>`;
                    } else if (isSpawned) {
                        animClass = 'spawn-pop';
                    }

                    html += `
                    <div class="tile ${isGoal ? 'goal-tile' : ''} ${animClass}"
                         data-value="${val}"
                         style="left: ${x}px; top: ${y}px; width: ${w}px; height: ${h}px; position: absolute;"
                         data-r="${r}" data-c="${c}">
                        ${label}
                        ${floatHtml}
                    </div>
                `;
                }
            }
        }

        layer.innerHTML = html;

        // Trigger tier sound & board shake
        if (maxTierThisMove > 0) {
            try {
                if (typeof SoundManager !== 'undefined' && SoundManager.mergeTier) {
                    SoundManager.mergeTier(maxTierThisMove);
                }
            } catch (e) { }

            if (maxTierThisMove >= 3 && boardWrapper) {
                boardWrapper.classList.remove('shake-mild', 'shake-heavy');
                void boardWrapper.offsetWidth; // trigger reflow
                boardWrapper.classList.add(maxTierThisMove === 4 ? 'shake-heavy' : 'shake-mild');
                setTimeout(() => {
                    if (boardWrapper) boardWrapper.classList.remove('shake-mild', 'shake-heavy');
                }, 500);
            }
        }

        // If no tiles were rendered, spawn initial tiles
        if (!hasTiles && game) {
            game.spawnTile();
            game.spawnTile();
            setTimeout(() => this.renderBoard(game), 10);
        }
    }

    static getTileLabel(value) {
        const theme = (typeof App !== 'undefined' && App.state) ? App.state.activeTheme : 'numbers';
        let labels = CONFIG.THEME_LABELS[theme] || CONFIG.THEME_LABELS['numbers'];
        const index = Math.log2(value) - 1;

        if (theme === 'southafrica' && typeof App !== 'undefined' && App.getCountryInfo) {
            const countryInfo = App.getCountryInfo();
            labels = [...labels];
            labels[4] = countryInfo.flag;
        }

        if (index < 0 || index >= labels.length || !labels[index]) {
            return value.toString();
        }
        return labels[index];
    }

    static updateGameUI(game) {
        if (!game || typeof App === 'undefined' || !App.state) return;

        const movesEl = document.getElementById('game-moves');
        const coinsEl = document.getElementById('game-coins');
        const goalBadge = document.getElementById('goal-badge');
        const bestEl = document.getElementById('game-best');
        const levelInfoEl = document.getElementById('game-level-info');

        if (movesEl) movesEl.textContent = game.moves;
        if (coinsEl) {
            coinsEl.textContent = App.state.coins.toLocaleString();
        }
        if (goalBadge) {
            goalBadge.textContent = GameUI.getTileLabel(game.goal);
        }

        if (levelInfoEl) {
            const worldObj = CONFIG.WORLDS[game.worldId];
            const worldName = (worldObj && worldObj.name) ? worldObj.name : 'Unknown';
            levelInfoEl.textContent = '🌍 ' + worldName + ' • Level ' + game.levelNum;
        }

        const key = `${game.worldId}-${game.levelNum}`;
        const stars = (App.state.stars && App.state.stars[key]) ? App.state.stars[key] : 0;
        if (bestEl) bestEl.textContent = stars > 0 ? '⭐'.repeat(stars) : '-';

        GameUI.updatePowerUpButtons();
    }

    static updatePowerUpButtons() {
        if (typeof App === 'undefined' || !App.state) return;

        const btnUndo = document.getElementById('btn-undo');
        const btnShuffle = document.getElementById('btn-shuffle');
        const btnRemove = document.getElementById('btn-remove');
        const btnExtra = document.getElementById('btn-extramove');

        if (btnUndo) btnUndo.style.opacity = App.state.coins >= CONFIG.POWERUP_COSTS.undo ? '1' : '0.5';
        if (btnShuffle) btnShuffle.style.opacity = App.state.coins >= CONFIG.POWERUP_COSTS.shuffle ? '1' : '0.5';
        if (btnRemove) btnRemove.style.opacity = App.state.coins >= CONFIG.POWERUP_COSTS.removeTile ? '1' : '0.5';

        if (btnExtra) {
            const adsReady = (typeof AdService !== 'undefined' && typeof AdService.isRewardedAdAvailable === 'function')
                ? AdService.isRewardedAdAvailable()
                : false;
            btnExtra.style.display = adsReady ? 'flex' : 'none';
        }
    }

    static showWinModal(game, stars, reward) {
        const modal = document.getElementById('modal-container');
        if (!modal) return;

        const worldObj = CONFIG.WORLDS[game.worldId];
        const worldName = (worldObj && worldObj.name) ? worldObj.name : 'Unknown';
        const showAdReward = (typeof AdService !== 'undefined' && typeof AdService.isRewardedAdAvailable === 'function')
            ? AdService.isRewardedAdAvailable()
            : false;

        modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal">
                <h2>${I18N.t('level_complete', 'LEVEL COMPLETE! 🎉')}</h2>
                <p style="color:#8899bb;font-size:13px;">${worldName} • Level ${game.levelNum}</p>
                <div class="big-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
                <p class="reward-text"><span class="custom-coin"></span> +${reward} Coins</p>
                <p style="color:#8899bb;font-size:13px;">${I18N.t('moves', 'Moves')}: ${game.moves} / Target: ${game.targetMoves}</p>
                <div class="modal-buttons">
                    ${showAdReward ? `<button class="btn btn-primary btn-block" onclick="GameUI.doubleReward(${reward})">${I18N.t('double_reward', '🌟 Double Reward (Watch Ad)')}</button>` : ''}
                    <button class="btn btn-gold btn-block" id="btn-next-level" onclick="GameUI.nextLevel()">${I18N.t('next_level', 'Next Level ▶')}</button>
                    <button class="btn btn-outline btn-block" onclick="GameUI.goToLevelSelect()">${I18N.t('world_levels', 'Levels')}</button>
                </div>
            </div>
        </div>`;

        setTimeout(() => {
            if (!window.isTv) return;
            const nextBtn = document.getElementById('btn-next-level');
            if (nextBtn) {
                nextBtn.focus();
            } else {
                const firstBtn = modal.querySelector('button');
                if (firstBtn) firstBtn.focus();
            }
        }, 100);
    }

    static showLossModal(game) {
        const modal = document.getElementById('modal-container');
        if (!modal) return;

        const worldObj = CONFIG.WORLDS[game.worldId];
        const worldName = (worldObj && worldObj.name) ? worldObj.name : 'Unknown';
        const showAdHelp = (typeof AdService !== 'undefined' && typeof AdService.isRewardedAdAvailable === 'function')
            ? AdService.isRewardedAdAvailable()
            : false;

        modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal">
                <h2>${I18N.t('game_over', 'GAME OVER! 💔')}</h2>
                <p style="color:#8899bb;">${worldName} • Level ${game.levelNum}</p>
                <p style="color:#8899bb;">${I18N.t('goal', 'GOAL')}: ${GameUI.getTileLabel(game.goal)}</p>
                <p style="color:#8899bb;font-size:13px;">${I18N.t('moves', 'Moves')}: ${game.moves}</p>
                <div class="modal-buttons">
                    ${showAdHelp ? `<button class="btn btn-primary btn-block" onclick="GameUI.watchAdAndContinue()">${I18N.t('watch_ad_help', 'Watch an Ad for Extra Tiles 📺')}</button>` : ''}
                    <button class="btn btn-gold btn-block" id="btn-retry-level" onclick="GameUI.retryLevel()">${I18N.t('retry', '🔄 Retry')}</button>
                    <button class="btn btn-outline btn-block" onclick="GameUI.goToLevelSelect()">${I18N.t('home', '🏠 Home')}</button>
                </div>
            </div>
        </div>`;

        setTimeout(() => {
            if (!window.isTv) return;
            const retryBtn = document.getElementById('btn-retry-level');
            if (retryBtn) {
                retryBtn.focus();
            } else {
                const firstBtn = modal.querySelector('button');
                if (firstBtn) firstBtn.focus();
            }
        }, 100);
    }

    static closeModal() {
        const modal = document.getElementById('modal-container');
        if (modal) modal.innerHTML = '';
    }

    static doubleReward(reward) {
        const doubledAmount = reward * 2;

        GameUI.closeModal();

        if (typeof App !== 'undefined') {
            App.showToast('📺 Loading ad...');
        }

        if (typeof AdService !== 'undefined' && AdService.isAdEnabled()) {
            AdService.showRewardedAd((success) => {
                if (success) {
                    if (typeof App !== 'undefined' && App.state) {
                        App.state.coins = (App.state.coins || 0) + doubledAmount;
                        App.state.totalAdsWatched = (App.state.totalAdsWatched || 0) + 1;
                        App.saveState();
                        App.updateAllCoinDisplays();
                        try { SoundManager.coin(); } catch (e) { }
                        App.showToast(`💰 Double reward! +${doubledAmount} coins`);
                    }

                    setTimeout(() => {
                        GameUI.nextLevel();
                    }, 600);
                } else {
                    if (typeof App !== 'undefined') {
                        App.showToast('❌ Ad failed, try again');
                    }
                    if (App.currentGame) {
                        const game = App.currentGame;
                        GameUI.showWinModal(game, game.getStars(), reward);
                    }
                }
            });
        } else {
            if (typeof App !== 'undefined' && App.state) {
                App.state.coins = (App.state.coins || 0) + doubledAmount;
                App.saveState();
                App.updateAllCoinDisplays();
                App.showToast(`💰 Reward doubled! +${doubledAmount} coins`);
            }

            setTimeout(() => {
                GameUI.nextLevel();
            }, 500);
        }
    }

    static nextLevel() {
        GameUI.closeModal();
        if (typeof App !== 'undefined' && App.nextLevelAfterWin) {
            App.nextLevelAfterWin();
        }
    }

    static goToLevelSelect() {
        GameUI.closeModal();
        if (typeof Navigation !== 'undefined') {
            Navigation.navigateTo('level-select');
            Navigation.renderLevelSelect();
        }
        try { AdService.showBannerAd(); } catch (e) { }
    }

    static watchAdAndContinue() {
        GameUI.closeModal();
        if (typeof App !== 'undefined' && App.watchAdExtraMove) {
            App.watchAdExtraMove();
        }
    }

    static retryLevel() {
        GameUI.closeModal();
        if (typeof App !== 'undefined' && App.retryLevel) {
            App.retryLevel();
        }
    }

    static highlightWinTile(game) {
        const tiles = document.querySelectorAll('.tile');
        tiles.forEach(tile => {
            const val = parseInt(tile.getAttribute('data-value'));
            if (val >= game.goal) {
                tile.classList.add('win-tile');
                setTimeout(() => tile.classList.remove('win-tile'), 3500);
            }
        });
    }

    static animateUndo() {
        const boardWrapper = document.querySelector('.board-wrapper');
        if (boardWrapper) {
            boardWrapper.classList.remove('rewind-active');
            void boardWrapper.offsetWidth; // trigger reflow
            boardWrapper.classList.add('rewind-active');
            setTimeout(() => {
                if (boardWrapper) boardWrapper.classList.remove('rewind-active');
            }, 600);
        }
        try {
            if (typeof SoundManager !== 'undefined' && SoundManager.rewindPowerup) {
                SoundManager.rewindPowerup();
            }
        } catch (e) { }
    }

    static animateShuffle() {
        const boardWrapper = document.querySelector('.board-wrapper');
        if (boardWrapper) {
            boardWrapper.classList.remove('shuffle-active');
            void boardWrapper.offsetWidth; // trigger reflow
            boardWrapper.classList.add('shuffle-active');
            setTimeout(() => {
                if (boardWrapper) boardWrapper.classList.remove('shuffle-active');
            }, 600);
        }

        const tiles = document.querySelectorAll('.tile');
        tiles.forEach(tile => {
            tile.classList.remove('shuffle-tile-anim');
            void tile.offsetWidth;
            tile.classList.add('shuffle-tile-anim');
            setTimeout(() => tile.classList.remove('shuffle-tile-anim'), 600);
        });

        try {
            if (typeof SoundManager !== 'undefined' && SoundManager.shufflePowerup) {
                SoundManager.shufflePowerup();
            }
        } catch (e) { }
    }

    static animateRemoveTile(minPos, callback) {
        if (!minPos) {
            if (callback) callback();
            return;
        }

        const tiles = document.querySelectorAll('.tile');
        let targetTile = null;

        tiles.forEach(tile => {
            const r = parseInt(tile.getAttribute('data-r'));
            const c = parseInt(tile.getAttribute('data-c'));
            if (r === minPos.r && c === minPos.c) {
                targetTile = tile;
            }
        });

        try {
            if (typeof SoundManager !== 'undefined' && SoundManager.zapPowerup) {
                SoundManager.zapPowerup();
            }
        } catch (e) { }

        if (targetTile) {
            targetTile.classList.add('disintegrate-anim');
            setTimeout(() => {
                if (callback) callback();
            }, 450);
        } else {
            if (callback) callback();
        }
    }

    static animateSwap(r1, c1, r2, c2, callback) {
        const tiles = document.querySelectorAll('.tile');
        let tile1 = null, tile2 = null;

        tiles.forEach(tile => {
            const r = parseInt(tile.getAttribute('data-r'));
            const c = parseInt(tile.getAttribute('data-c'));
            if (r === r1 && c === c1) tile1 = tile;
            if (r === r2 && c === c2) tile2 = tile;
        });

        try {
            if (typeof SoundManager !== 'undefined' && SoundManager.swapPowerup) {
                SoundManager.swapPowerup();
            }
        } catch (e) { }

        if (tile1) tile1.classList.add('swap-teleport-anim');
        if (tile2) tile2.classList.add('swap-teleport-anim');

        setTimeout(() => {
            if (callback) callback();
        }, 500);
    }
}
