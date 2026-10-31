// Leaderboard System with Smart View
class Leaderboard {
    static isUserLoggedIn() {
        return (typeof FirebaseService !== 'undefined' && !!FirebaseService.currentUser) ||
               (typeof App !== 'undefined' && App.state && !!App.state.isLoggedIn);
    }

    static renderLoggedOutState() {
        const list = document.getElementById('leaderboard-list');
        const paginationInfo = document.getElementById('pagination-info');
        const btnFindMe = document.getElementById('btn-find-me');
        const toggleBtn = document.getElementById('btn-toggle-view');

        // Hide pagination controls
        document.querySelectorAll('#btn-first-page, #btn-prev-page, #btn-next-page, #btn-last-page, #page-indicator').forEach(el => {
            if (el) el.style.display = 'none';
        });
        if (paginationInfo) paginationInfo.textContent = '';
        if (btnFindMe) btnFindMe.style.display = 'none';
        if (toggleBtn) toggleBtn.style.display = 'none';

        if (!list) return;

        list.innerHTML = `
            <div style="text-align: center; padding: 42px 20px; background: rgba(15, 23, 42, 0.75); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 16px; margin: 16px 0; box-shadow: 0 12px 36px rgba(0,0,0,0.4);">
                <div style="font-size: 54px; margin-bottom: 12px; filter: drop-shadow(0 4px 16px rgba(245, 158, 11, 0.5));">🔐</div>
                <h3 style="color: #fff; font-size: 20px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.3px;">Leaderboard Locked</h3>
                <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; max-width: 320px; margin: 0 auto 20px auto;">
                    Sign in to view global player rankings, track your personal standing, and climb the competitive world ladder!
                </p>
                <button class="btn btn-gold btn-block" style="max-width: 250px; margin: 0 auto; padding: 13px 20px; font-weight: 800; font-size: 14px; border-radius: 12px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);" onclick="App.showLoginPrompt()">
                    🔑 Sign In to View Rankings
                </button>
                <div style="margin-top: 16px; font-size: 11px; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span>✨ Free Account</span> &bull; <span>☁️ Cloud Sync</span>
                </div>
            </div>
        `;
    }

    static currentTimeframe = 'overall';
    static currentCountry = '';
    static currentPage = 1;
    static pageSize = 20;
    static totalPages = 1;
    static totalCount = 0;
    static allCountries = [];
    static isLoading = false;
    static userRank = null;
    static userPage = null;
    static userEntry = null;
    static viewMode = 'smart'; // 'smart' or 'paginated'
    static _prevStars = 0;

    static setTimeframe(timeframe) {
        this.currentTimeframe = timeframe;
        this.currentPage = 1;
        this.totalPages = 1;
        this.userRank = null;
        this.userPage = null;
        this.userEntry = null;

        // Update tab styles
        document.querySelectorAll('[data-timeframe]').forEach(btn => {
            btn.className = 'btn btn-sm ' + (btn.dataset.timeframe === timeframe ? 'btn-primary' : 'btn-secondary');
        });

        // Reset country filter when changing timeframe
        const countrySelect = document.getElementById('leaderboard-country-filter');
        if (countrySelect) {
            countrySelect.value = '';
            this.currentCountry = '';
        }

        // Reload countries for new timeframe
        this.loadCountries();
        this.render();
    }

    static async applyCountryFilter(country) {
        this.currentCountry = country;
        this.currentPage = 1;
        this.userRank = null;
        this.userPage = null;
        this.userEntry = null;
        await this.render();
    }

    static async setPageSize(size) {
        this.pageSize = size;
        this.currentPage = 1;
        this.userRank = null;
        this.userPage = null;
        this.userEntry = null;
        await this.render();
    }

    static async goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        await this.render();
    }

    static async nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            await this.render();
        }
    }

    static async prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            await this.render();
        }
    }

    static async loadCountries() {
        if (typeof FirebaseService !== 'undefined' && FirebaseService.initialized) {
            try {
                this.allCountries = await FirebaseService.getCountriesPaginated(this.currentTimeframe);
                this.populateCountryFilter();
            } catch (e) {
                console.warn('Failed to load countries:', e);
            }
        }
    }

    static populateCountryFilter() {
        const select = document.getElementById('leaderboard-country-filter');
        if (!select) return;

        // Clear existing options except first
        while (select.options.length > 1) {
            select.remove(1);
        }

        this.allCountries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = `${this.getCountryFlag(country)} ${country}`;
            select.appendChild(option);
        });
    }

    static getCountryFlag(country) {
        const flags = {
            'USA': '🇺🇸',
            'Canada': '🇨🇦',
            'UK': '🇬🇧',
            'France': '🇫🇷',
            'Germany': '🇩🇪',
            'Italy': '🇮🇹',
            'Spain': '🇪🇸',
            'Australia': '🇦🇺',
            'Japan': '🇯🇵',
            'South Korea': '🇰🇷',
            'India': '🇮🇳',
            'Brazil': '🇧🇷',
            'Mexico': '🇲🇽',
            'South Africa': '🇿🇦',
            'Nigeria': '🇳🇬',
            'Kenya': '🇰🇪',
            'Egypt': '🇪🇬',
            'China': '🇨🇳',
            'Russia': '🇷🇺',
            'Argentina': '🇦🇷',
            'Unknown': '🌍'
        };
        return flags[country] || '🌍';
    }

    // Get user's rank and position info
    static async getUserRank() {
        if (!FirebaseService || !FirebaseService.currentUser) {
            this.userRank = null;
            this.userPage = null;
            this.userEntry = null;
            return;
        }

        try {
            const result = await FirebaseService.getLeaderboardPaginated(
                this.currentTimeframe,
                1,
                1000,
                this.currentCountry || null
            );

            const entries = result.entries;
            const userUid = FirebaseService.currentUser.uid;

            // Find user's rank
            const userIndex = entries.findIndex(e => e.uid === userUid);
            this.userRank = userIndex !== -1 ? userIndex + 1 : null;
            this.userEntry = userIndex !== -1 ? entries[userIndex] : null;
            this.totalCount = result.totalCount;

            // Calculate which page the user is on
            if (this.userRank) {
                this.userPage = Math.ceil(this.userRank / this.pageSize);
            } else {
                this.userPage = null;
            }

            console.log(`👤 User rank: ${this.userRank}, Page: ${this.userPage}`);

        } catch (e) {
            console.warn('Failed to get user rank:', e);
            this.userRank = null;
            this.userPage = null;
            this.userEntry = null;
        }
    }

    // Smart render - shows top 10 + user's position with neighbors
    // Smart render - shows top 10 + user's position with neighbors
    static async renderSmart() {
        if (!this.isUserLoggedIn()) {
            this.renderLoggedOutState();
            return;
        }

        if (this.isLoading) return;
        this.isLoading = true;

        const list = document.getElementById('leaderboard-list');
        const paginationInfo = document.getElementById('pagination-info');
        const btnFindMe = document.getElementById('btn-find-me');
        const toggleBtn = document.getElementById('btn-toggle-view');

        if (!list) {
            this.isLoading = false;
            return;
        }

        list.innerHTML = '<p style="color:#8899bb;">Loading...</p>';

        // Hide pagination controls in smart mode
        document.querySelectorAll('#btn-first-page, #btn-prev-page, #btn-next-page, #btn-last-page, #page-indicator').forEach(el => {
            if (el) el.style.display = 'none';
        });

        // Update toggle button
        if (toggleBtn) {
            toggleBtn.textContent = '🎯 Smart View';
            toggleBtn.className = 'btn btn-sm btn-primary';
        }

        // Get timeframe label
        const labels = {
            overall: 'Overall',
            daily: 'Today',
            weekly: 'This Week',
            monthly: 'This Month'
        };
        const label = labels[this.currentTimeframe] || 'Overall';

        // Update title
        const titleEl = document.querySelector('#leaderboard-content p');
        if (titleEl) {
            const countryText = this.currentCountry ? ` in ${this.currentCountry}` : '';
            titleEl.innerHTML = `🏆 Top Players ${countryText} (${label})`;
        }

        if (typeof FirebaseService !== 'undefined' && FirebaseService.initialized) {
            try {
                // Get user's rank if not known
                if (this.userRank === null) {
                    await this.getUserRank();
                }

                // Get top 10 players (excluding the user if they're in top 10)
                const topLimit = 10;
                const topResult = await FirebaseService.getLeaderboardPaginated(
                    this.currentTimeframe,
                    1,
                    topLimit + 1, // Get one extra to check if user is in top 10
                    this.currentCountry || null
                );

                let topEntries = topResult.entries;
                this.totalCount = topResult.totalCount;

                // If user is in the top 10, we need to handle it differently
                let userInTop10 = false;
                let userTopIndex = -1;

                if (FirebaseService.currentUser) {
                    const userUid = FirebaseService.currentUser.uid;
                    userTopIndex = topEntries.findIndex(e => e.uid === userUid);
                    if (userTopIndex !== -1 && userTopIndex < 10) {
                        userInTop10 = true;
                    }
                }

                // If user is in top 10, we only show top 10 (no duplicate)
                if (userInTop10) {
                    // Just show top 10, user is already in it
                    topEntries = topEntries.slice(0, 10);
                } else {
                    // User is not in top 10, show top 10
                    topEntries = topEntries.slice(0, 10);
                }

                // Show "My Position" button
                if (btnFindMe) {
                    if (FirebaseService.currentUser && this.userRank) {
                        btnFindMe.style.display = 'inline-block';
                        btnFindMe.textContent = `📍 #${this.userRank}`;
                        btnFindMe.className = 'btn btn-sm btn-primary';
                    } else if (FirebaseService.currentUser) {
                        btnFindMe.style.display = 'inline-block';
                        btnFindMe.textContent = '📍 Find Me';
                        btnFindMe.className = 'btn btn-sm btn-secondary';
                    } else {
                        btnFindMe.style.display = 'none';
                    }
                }

                // Build the smart view
                let html = '';
                this._prevStars = 0;

                // 1. Top 10 players (only if user is NOT in top 10, or show all)
                if (topEntries.length > 0) {
                    html += `<div style="margin-bottom: 4px;">`;
                    html += topEntries.map((e, i) => {
                        const rank = i + 1;
                        const isUser = FirebaseService.currentUser && e.uid === FirebaseService.currentUser.uid;
                        return this.renderLeaderboardEntry(e, rank, isUser);
                    }).join('');
                    html += `</div>`;
                }

                // 2. Divider with "..." - ONLY if user is NOT in top 10
                const showDivider = this.userRank && this.userRank > 10 && !userInTop10;
                if (showDivider) {
                    const remainingAbove = this.userRank - 10;
                    html += `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 6px 16px; margin: 2px 0;">
                        <div style="flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--bg-elevated), transparent);"></div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="color: var(--text-muted); font-size: 11px; font-weight: 600; letter-spacing: 1px;">
                                ⋮ ${remainingAbove} more players
                            </span>
                        </div>
                        <div style="flex: 1; height: 1px; background: linear-gradient(90deg, var(--bg-elevated), transparent);"></div>
                    </div>
                `;
                }

                // 3. User's position with neighbors - ONLY if user is NOT in top 10
                if (this.userRank && this.userEntry && FirebaseService.currentUser && !userInTop10) {
                    const startRank = Math.max(1, this.userRank - 4);
                    const endRank = Math.min(this.totalCount, this.userRank + 4);

                    // Get the range of entries around the user
                    const rangeResult = await FirebaseService.getLeaderboardPaginated(
                        this.currentTimeframe,
                        1,
                        endRank,
                        this.currentCountry || null
                    );

                    const rangeEntries = rangeResult.entries;

                    // Filter to get entries around the user
                    const userIndex = rangeEntries.findIndex(e => e.uid === FirebaseService.currentUser.uid);
                    const startIdx = Math.max(0, userIndex - 4);
                    const endIdx = Math.min(rangeEntries.length - 1, userIndex + 4);

                    const surroundingEntries = rangeEntries.slice(startIdx, endIdx + 1);

                    // Calculate climb info
                    const climbInfo = this.getClimbInfo(rangeEntries, userIndex);

                    // Add climb indicator
                    if (climbInfo) {
                        html += `
                        <div style="background: rgba(247, 201, 72, 0.08); border: 1px solid rgba(247, 201, 72, 0.2); border-radius: 8px; padding: 6px 12px; margin: 4px 0 6px 0; text-align: center;">
                            <span style="color: var(--text-muted); font-size: 12px;">
                                ${climbInfo}
                            </span>
                        </div>
                    `;
                    }

                    // Render surrounding entries
                    html += `<div style="border: 2px solid rgba(247, 201, 72, 0.15); border-radius: 12px; padding: 4px; background: rgba(247, 201, 72, 0.03);">`;
                    this._prevStars = 0;
                    html += surroundingEntries.map((e, i) => {
                        const rank = startRank + startIdx + i;
                        const isUser = e.uid === FirebaseService.currentUser.uid;
                        return this.renderLeaderboardEntry(e, rank, isUser);
                    }).join('');
                    html += `</div>`;
                } else if (userInTop10) {
                    // User is in top 10, show a message
                    html += `
                    <div style="text-align: center; padding: 8px; margin: 4px 0;">
                        <span style="color: var(--text-muted); font-size: 12px;">
                            👑 You're in the Top 10! Keep it up!
                        </span>
                    </div>
                `;
                } else if (!this.userRank && FirebaseService.currentUser) {
                    // User not on leaderboard yet
                    html += `
                    <div style="text-align: center; padding: 20px; background: var(--bg-surface); border-radius: 12px; border: 2px dashed var(--bg-elevated); margin: 8px 0;">
                        <div style="font-size: 36px; margin-bottom: 8px;">🎮</div>
                        <div style="color: var(--text-primary); font-weight: 600; font-size: 15px;">You're not on this leaderboard yet</div>
                        <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">Play more levels to climb the ranks!</div>
                        <button class="btn btn-sm btn-primary" style="margin-top: 8px;" onclick="App.saveToLeaderboard()">☁️ Save My Progress</button>
                    </div>
                `;
                } else if (!FirebaseService.currentUser) {
                    // User not logged in
                    html += `
                    <div style="text-align: center; padding: 16px; background: var(--bg-surface); border-radius: 12px; border: 1px solid var(--bg-card); margin: 8px 0;">
                        <div style="font-size: 30px; margin-bottom: 6px;">🔐</div>
                        <div style="color: var(--text-primary); font-weight: 600; font-size: 14px;">Sign in to see your position</div>
                        <button class="btn btn-sm btn-primary" style="margin-top: 6px;" onclick="App.showLoginPrompt()">Sign In</button>
                    </div>
                `;
                }

                if (paginationInfo) {
                    paginationInfo.textContent = '';
                }

                list.innerHTML = html;

            } catch (e) {
                console.error('Leaderboard render error:', e);
                list.innerHTML = '<p style="color:#8899bb;">Failed to load leaderboard</p>';
                this.showLocalOnly();
            }
        } else {
            this.showLocalOnly();
        }

        this.isLoading = false;
    }

    // Render a single leaderboard entry
    static renderLeaderboardEntry(e, rank, isUser) {
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '⭐';
        const countryFlag = this.getCountryFlag(e.country);
        const photoURL = e.photoURL || null;

        let displayName;
        if (isUser) {
            displayName = e.name + ' <span style="color:#f7c948;font-weight:700;">(You)</span>';
        } else {
            displayName = this.maskSurname(e.name);
        }

        let avatarHtml;
        if (photoURL && (photoURL.startsWith('http') || photoURL.startsWith('data:image'))) {
            avatarHtml = `
            <div style="width:32px;height:32px;border-radius:50%;flex-shrink:0;overflow:hidden;border:2px solid ${isUser ? '#f7c948' : 'var(--bg-elevated)'};background:var(--bg-card);display:flex;align-items:center;justify-content:center;">
                <img src="${photoURL}" 
                     alt="${e.name || 'Player'}" 
                     style="width:100%;height:100%;object-fit:cover;display:block;"
                     onerror="this.parentElement.innerHTML='<span style=\\'font-size:14px;\\'>👤</span>';this.parentElement.style.background='var(--bg-card)';">
            </div>
        `;
        } else {
            avatarHtml = `
            <div style="width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--bg-card);border:2px solid ${isUser ? '#f7c948' : 'var(--bg-elevated)'};">
                <span style="font-size:14px;">👤</span>
            </div>
        `;
        }

        // Calculate points to next rank
        const pointsToNext = rank > 1 ? this._prevStars - e.stars : 0;
        this._prevStars = e.stars;

        // More compact styling
        const isUserStyle = isUser ? 'border-color:#f7c948;background:rgba(247,201,72,0.12);box-shadow:0 0 15px rgba(247,201,72,0.1);' : '';
        const padding = isUser ? '10px 14px' : '8px 12px';
        const margin = isUser ? '6px 0' : '3px 0';
        const fontSize = isUser ? '16px' : '14px';
        const rankSize = isUser ? '18px' : '15px';
        const starSize = isUser ? '16px' : '14px';

        return `
    <div class="store-item" style="${isUserStyle}display:flex;align-items:center;gap:8px;padding:${padding};margin:${margin};border-radius:10px;border:2px solid ${isUser ? '#f7c948' : 'var(--bg-card)'};background:${isUser ? 'rgba(247,201,72,0.08)' : 'var(--bg-surface)'};transition:all 0.2s ease;min-height:${isUser ? '56px' : '48px'};">
        <span style="font-weight:800;font-size:${rankSize};width:36px;flex-shrink:0;color:${isUser ? '#f7c948' : 'var(--text-primary)'};text-align:center;font-variant-numeric:tabular-nums;font-family:-apple-system,system-ui,sans-serif;">#${rank}</span>
        <span style="font-size:18px;width:24px;text-align:center;flex-shrink:0;">${medal}</span>
        ${avatarHtml}
        <div class="item-info" style="flex:1;min-width:0;padding:0 6px;display:flex;flex-direction:column;justify-content:center;gap:2px;">
            <div class="item-name" style="font-weight:${isUser ? '800' : '600'};font-size:${fontSize};color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;font-family:-apple-system,system-ui,sans-serif;letter-spacing:0.3px;">
                ${displayName}
            </div>
            <div class="item-desc" style="font-size:11px;color:var(--text-muted);line-height:1.2;display:flex;align-items:center;gap:5px;">
                <span>Level ${e.levels || 1}</span>
                <span>&bull;</span>
                <span>${countryFlag} ${(e.country || 'Global')}</span>
            </div>
        </div>
        <span style="font-weight:800;color:#f7c948;flex-shrink:0;font-size:${starSize};text-align:right;font-variant-numeric:tabular-nums;min-width:60px;">
            ${(e.stars || 0).toLocaleString()} ⭐
            ${isUser ? '<span style="display:block;font-size:9px;color:var(--text-muted);font-weight:600;">You</span>' : ''}
        </span>
    </div>`;
    }

    // Get climb information
    static getClimbInfo(entries, userIndex) {
        if (userIndex <= 0) return null;

        const user = entries[userIndex];
        const above = entries[userIndex - 1];

        if (!above) return null;

        const pointsDiff = above.stars - user.stars;
        const rankDiff = userIndex; // How many ranks to climb

        if (pointsDiff <= 0) return null;

        let message = '';
        if (rankDiff === 1) {
            message = `🚀 Only <strong>${pointsDiff}</strong> points to reach #${rankDiff}!`;
        } else if (rankDiff <= 3) {
            message = `📈 <strong>${pointsDiff}</strong> points to climb <strong>${rankDiff}</strong> rank${rankDiff > 1 ? 's' : ''}!`;
        } else {
            message = `🎯 <strong>${pointsDiff}</strong> points needed to reach #${rankDiff}`;
        }

        return message;
    }

    // Toggle between smart and paginated view
    static async toggleView() {
        this.viewMode = this.viewMode === 'smart' ? 'paginated' : 'smart';
        if (this.viewMode === 'smart') {
            // Reset user rank to force refresh
            this.userRank = null;
            this.userPage = null;
            this.userEntry = null;
            await this.getUserRank();
            await this.renderSmart();
        } else {
            this.currentPage = 1;
            await this.render();
        }

        // Update button text
        const toggleBtn = document.getElementById('btn-toggle-view');
        if (toggleBtn) {
            if (this.viewMode === 'smart') {
                toggleBtn.textContent = '🎯 Smart View';
                toggleBtn.className = 'btn btn-sm btn-primary';
            } else {
                toggleBtn.textContent = '📄 Paginated View';
                toggleBtn.className = 'btn btn-sm btn-secondary';
            }
        }
    }

    // Main render method - delegates to smart or paginated
    static async render() {
        if (this.viewMode === 'smart') {
            await this.renderSmart();
        } else {
            await this.renderPaginated();
        }
    }

    // Paginated render (original leaderboard)
    static async renderPaginated() {
        if (!this.isUserLoggedIn()) {
            this.renderLoggedOutState();
            return;
        }

        if (this.isLoading) return;
        this.isLoading = true;

        const list = document.getElementById('leaderboard-list');
        const paginationInfo = document.getElementById('pagination-info');
        const pageIndicator = document.getElementById('page-indicator');
        const btnFirst = document.getElementById('btn-first-page');
        const btnPrev = document.getElementById('btn-prev-page');
        const btnNext = document.getElementById('btn-next-page');
        const btnLast = document.getElementById('btn-last-page');
        const btnFindMe = document.getElementById('btn-find-me');
        const toggleBtn = document.getElementById('btn-toggle-view');

        if (!list) {
            this.isLoading = false;
            return;
        }

        list.innerHTML = '<p style="color:#8899bb;">Loading...</p>';

        // Show pagination controls
        if (btnFirst) btnFirst.style.display = 'inline-block';
        if (btnPrev) btnPrev.style.display = 'inline-block';
        if (btnNext) btnNext.style.display = 'inline-block';
        if (btnLast) btnLast.style.display = 'inline-block';
        if (pageIndicator) pageIndicator.style.display = 'inline-block';

        // Update toggle button
        if (toggleBtn) {
            toggleBtn.textContent = '📄 Paginated View';
            toggleBtn.className = 'btn btn-sm btn-secondary';
        }

        // Get timeframe label
        const labels = {
            overall: 'Overall',
            daily: 'Today',
            weekly: 'This Week',
            monthly: 'This Month'
        };
        const label = labels[this.currentTimeframe] || 'Overall';

        // Update title
        const titleEl = document.querySelector('#leaderboard-content p');
        if (titleEl) {
            const countryText = this.currentCountry ? ` in ${this.currentCountry}` : '';
            titleEl.innerHTML = `🏆 Top Players ${countryText} (${label})`;
        }

        if (typeof FirebaseService !== 'undefined' && FirebaseService.initialized) {
            try {
                // Get paginated entries with filters
                const result = await FirebaseService.getLeaderboardPaginated(
                    this.currentTimeframe,
                    this.currentPage,
                    this.pageSize,
                    this.currentCountry || null
                );

                this.totalCount = result.totalCount;
                this.totalPages = result.totalPages;

                if (paginationInfo) {
                    paginationInfo.textContent = '';
                }

                // Update pagination controls
                if (btnFirst) btnFirst.style.display = this.totalPages > 1 ? 'inline-block' : 'none';
                if (btnPrev) btnPrev.style.display = this.currentPage > 1 ? 'inline-block' : 'none';
                if (btnNext) btnNext.style.display = this.currentPage < this.totalPages ? 'inline-block' : 'none';
                if (btnLast) btnLast.style.display = this.totalPages > 1 ? 'inline-block' : 'none';

                // Show "Find Me" button if user is logged in
                if (btnFindMe && FirebaseService.currentUser) {
                    btnFindMe.style.display = 'inline-block';
                    if (this.userRank) {
                        btnFindMe.textContent = `📍 #${this.userRank}`;
                    } else {
                        btnFindMe.textContent = '📍 Find Me';
                    }
                } else if (btnFindMe) {
                    btnFindMe.style.display = 'none';
                }

                if (pageIndicator) {
                    if (this.totalPages > 1) {
                        pageIndicator.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
                        pageIndicator.style.display = 'inline-block';
                    } else {
                        pageIndicator.style.display = 'none';
                    }
                }

                const entries = result.entries;

                if (entries.length === 0) {
                    list.innerHTML = `
                        <div style="padding:20px;text-align:center;">
                            <p style="color:#8899bb;font-size:16px;">No entries yet for ${label.toLowerCase()} leaderboard.</p>
                            <p style="color:#8899bb;font-size:14px;margin-top:8px;">
                                ${!FirebaseService.currentUser ? '🔐 Sign in to compete!' : '🎮 Play more levels to appear here!'}
                            </p>
                            ${FirebaseService.currentUser ? `
                                <div style="margin-top:12px;">
                                    <button class="btn btn-sm btn-primary" onclick="App.saveToLeaderboard()">☁️ Save My Progress</button>
                                </div>
                            ` : `
                                <button class="btn btn-sm btn-primary" style="margin-top:12px;" onclick="App.showLoginPrompt()">Sign In</button>
                            `}
                        </div>
                    `;
                    this.isLoading = false;
                    return;
                }

                this._prevStars = 0;
                list.innerHTML = entries.map((e, i) => {
                    const isCurrentUser = e.isCurrentUser;
                    const rank = result.startIndex + i;
                    return this.renderLeaderboardEntry(e, rank, isCurrentUser);
                }).join('');

            } catch (e) {
                console.error('Leaderboard render error:', e);
                list.innerHTML = '<p style="color:#8899bb;">Failed to load leaderboard</p>';
                this.showLocalOnly();
            }
        } else {
            this.showLocalOnly();
        }

        this.isLoading = false;
    }

    // Show position jump dialog
    static async showPositionJump() {
        if (!FirebaseService || !FirebaseService.currentUser) {
            App.showToast('👤 Please sign in first');
            return;
        }

        if (this.userRank === null) {
            await this.getUserRank();
        }

        if (!this.userRank) {
            App.showToast('👤 You\'re not on this leaderboard yet. Play more levels!');
            return;
        }

        // Calculate position percentage
        const percentage = Math.round((this.userRank / this.totalCount) * 100);
        const isTop = this.userRank <= 10;
        const isTop10Percent = percentage <= 10;

        let rankEmoji = '📍';
        let rankMessage = `You are ranked #${this.userRank}`;
        if (isTop) {
            rankEmoji = '👑';
            rankMessage = `🏆 You're in the TOP 10!`;
        } else if (isTop10Percent) {
            rankEmoji = '🌟';
            rankMessage = `🌟 You're in the top 10%!`;
        }

        PopupManager.show({
            icon: rankEmoji,
            title: 'Your Position',
            subtitle: rankMessage,
            showConfirm: false,
            showCancel: true,
            cancelText: 'Close',
            customContent: `
                <div style="padding: 8px 0; text-align: center;">
                    <!-- Position Display -->
                    <div style="font-size: 48px; font-weight: 800; margin: 10px 0; background: linear-gradient(135deg, #f7c948, #e94560); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                        #${this.userRank}
                    </div>
                    <div style="color: var(--text-muted); font-size: 14px; margin-bottom: 16px;">
                        ${this.userEntry ? `${this.userEntry.levels || 0} levels • ${this.userEntry.stars || 0} ⭐` : ''}
                        ${this.totalCount ? `• Out of ${this.totalCount} players` : ''}
                    </div>
                    
                    <!-- Position Bar -->
                    <div style="background: var(--bg-card); border-radius: 12px; padding: 16px; margin: 12px 0;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
                            <span>🏆 Top 1</span>
                            <span>📊 Top 50%</span>
                            <span>📉 Bottom</span>
                        </div>
                        <div style="width: 100%; height: 10px; background: var(--bg-elevated); border-radius: 6px; overflow: hidden; position: relative;">
                            <div style="width: ${(this.userRank / this.totalCount) * 100}%; height: 100%; background: linear-gradient(90deg, #f7c948, #e94560); border-radius: 6px; transition: width 0.6s ease;"></div>
                            <div style="position: absolute; top: -4px; left: ${(this.userRank / this.totalCount) * 100}%; transform: translateX(-50%); transition: left 0.6s ease;">
                                <div style="width: 18px; height: 18px; background: #f7c948; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 20px rgba(247, 201, 72, 0.6);"></div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 6px;">
                            <span>👈 You are here</span>
                            <span style="font-weight: 600; color: #f7c948;">${percentage}%</span>
                        </div>
                    </div>
                    
                    <!-- Quick Actions -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
                        <button class="btn btn-sm btn-primary" onclick="Leaderboard.goToMyRank(); PopupManager.close('cancel');" style="padding: 10px;">
                            🎯 Go to My Rank
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="Leaderboard.jumpToPositionPrompt(); PopupManager.close('cancel');" style="padding: 10px;">
                            🔢 Jump to Position
                        </button>
                    </div>
                    
                    <!-- Nearby Players -->
                    <div style="margin-top: 12px; padding: 12px; background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--bg-card);">
                        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">📍 Players near you:</div>
                        <div style="display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; font-size: 13px;">
                            ${this.userRank > 2 ? `<span style="color: var(--text-muted);">#${this.userRank - 2}</span>` : ''}
                            ${this.userRank > 1 ? `<span style="color: var(--text-muted);">#${this.userRank - 1}</span>` : ''}
                            <span style="color: #f7c948; font-weight: 700; background: rgba(247, 201, 72, 0.15); padding: 2px 10px; border-radius: 12px;">#${this.userRank} ← You</span>
                            ${this.userRank < this.totalCount ? `<span style="color: var(--text-muted);">#${this.userRank + 1}</span>` : ''}
                            ${this.userRank < this.totalCount - 1 ? `<span style="color: var(--text-muted);">#${this.userRank + 2}</span>` : ''}
                        </div>
                    </div>
                </div>
            `
        });
    }

    // Jump to position prompt
    static async jumpToPositionPrompt() {
        PopupManager.show({
            icon: '🔢',
            title: 'Jump to Position',
            subtitle: `Enter a rank between 1 and ${this.totalCount}`,
            showConfirm: false,
            showCancel: true,
            cancelText: 'Cancel',
            customContent: `
                <div style="padding: 8px 0;">
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="number" id="jump-position-input" 
                                   min="1" max="${this.totalCount}" 
                                   placeholder="Enter rank (1-${this.totalCount})"
                                   style="flex: 1; padding: 12px; border-radius: 10px; border: 2px solid var(--bg-card); background: var(--bg-surface); color: var(--text-primary); font-size: 16px; box-sizing: border-box;">
                            <button class="btn btn-primary" onclick="Leaderboard.jumpToPosition()" style="padding: 12px 20px;">
                                Go
                            </button>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
                            ${[1, 10, 50, 100, 500].map(num => `
                                <button class="btn btn-sm btn-outline" onclick="document.getElementById('jump-position-input').value = '${num}'; Leaderboard.jumpToPosition();" 
                                        style="font-size: 11px; padding: 6px;">
                                    #${num}
                                </button>
                            `).join('')}
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); text-align: center;">
                            Quick jump: Top 1 • Top 10 • Top 50 • Top 100 • Top 500
                        </div>
                    </div>
                </div>
            `
        });
    }

    // Execute jump to position
    static async jumpToPosition() {
        const input = document.getElementById('jump-position-input');
        if (!input) return;

        let position = parseInt(input.value);
        if (isNaN(position) || position < 1 || position > this.totalCount) {
            App.showToast(`❌ Please enter a number between 1 and ${this.totalCount}`);
            return;
        }

        // Calculate which page this position is on
        const page = Math.ceil(position / this.pageSize);
        this.currentPage = page;

        // Close popup
        PopupManager.close('cancel');

        // Render the page
        await this.render();

        // Highlight the entry at this position
        setTimeout(() => {
            this.highlightPosition(position);
        }, 300);

        App.showToast(`📍 Jumped to position #${position}`);
    }

    // Highlight a specific position
    static highlightPosition(position) {
        const items = document.querySelectorAll('.store-item');
        const targetIndex = position - ((this.currentPage - 1) * this.pageSize) - 1;

        if (items[targetIndex]) {
            items[targetIndex].style.animation = 'glowPulse 1s ease-in-out 3';
            items[targetIndex].style.boxShadow = '0 0 30px rgba(247, 201, 72, 0.6)';
            items[targetIndex].style.borderColor = '#f7c948';

            items[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Go to the page containing the user
    static async goToMyRank() {
        if (!this.userPage) {
            await this.getUserRank();
        }

        if (this.userPage && this.userPage !== this.currentPage) {
            this.currentPage = this.userPage;
            await this.render();

            setTimeout(() => {
                this.highlightUserEntry();
            }, 300);

            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast(`👤 Found you at #${this.userRank}!`);
            }
        } else if (this.userRank) {
            // If already on the right page, just highlight
            this.highlightUserEntry();
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast(`👤 You're currently #${this.userRank} on this leaderboard`);
            }
        } else {
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('👤 You\'re not on this leaderboard yet. Play more levels!');
            }
        }
    }

    // Highlight the user's entry
    static highlightUserEntry() {
        const entries = document.querySelectorAll('.store-item');
        entries.forEach(el => {
            el.style.removeProperty('animation');
            el.style.removeProperty('box-shadow');

            if (el.style.borderColor === '#f7c948' || el.querySelector('.item-name span')) {
                el.style.animation = 'glowPulse 1s ease-in-out 3';
                el.style.boxShadow = '0 0 30px rgba(247, 201, 72, 0.5)';
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    // Combined refresh method - saves current user data AND refreshes the view
    static async refreshLeaderboard() {
        // Show loading state
        const list = document.getElementById('leaderboard-list');
        if (list) {
            list.innerHTML = '<p style="color:#8899bb;">Refreshing...</p>';
        }

        // If user is logged in, save their current data first
        if (typeof FirebaseService !== 'undefined' && FirebaseService.currentUser) {
            try {
                await FirebaseService.saveLeaderboardEntry({
                    displayName: App.state.playerName || 'Player',
                    totalStarsEarned: App.state.totalStarsEarned || 0,
                    levelsCompleted: App.state.levelsCompleted || 0,
                    photoURL: App.state.photoURL || null
                });
                console.log('✅ Leaderboard entry saved during refresh');
            } catch (e) {
                console.warn('Failed to save leaderboard entry during refresh:', e);
            }
        }

        // Reset user rank and reload
        this.userRank = null;
        this.userPage = null;
        this.userEntry = null;
        this.currentPage = 1;

        if (this.viewMode === 'smart') {
            await this.getUserRank();
            await this.renderSmart();
        } else {
            await this.renderPaginated();
        }

        // Show toast notification
        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('🔄 Leaderboard refreshed!');
        }
    }

    // Keep forceRefresh as an alias for backward compatibility
    static async forceRefresh() {
        return this.refreshLeaderboard();
    }

    // Show local only view (when not signed in)
    static showLocalOnly() {
        const list = document.getElementById('leaderboard-list');
        const paginationInfo = document.getElementById('pagination-info');
        const btnFirst = document.getElementById('btn-first-page');
        const btnPrev = document.getElementById('btn-prev-page');
        const btnNext = document.getElementById('btn-next-page');
        const btnLast = document.getElementById('btn-last-page');
        const pageIndicator = document.getElementById('page-indicator');
        const btnFindMe = document.getElementById('btn-find-me');
        const toggleBtn = document.getElementById('btn-toggle-view');

        if (!list) return;

        // Hide pagination controls
        if (btnFirst) btnFirst.style.display = 'none';
        if (btnPrev) btnPrev.style.display = 'none';
        if (btnNext) btnNext.style.display = 'none';
        if (btnLast) btnLast.style.display = 'none';
        if (pageIndicator) pageIndicator.style.display = 'none';
        if (paginationInfo) paginationInfo.textContent = '';
        if (btnFindMe) btnFindMe.style.display = 'none';

        // Update toggle button
        if (toggleBtn) {
            toggleBtn.textContent = '🎯 Smart View';
            toggleBtn.className = 'btn btn-sm btn-primary';
        }

        const levelsCompleted = Object.values(App.state.stars || {}).filter(s => s > 0).length;
        const totalStars = Object.values(App.state.stars || {}).reduce((a, b) => a + (b || 0), 0);

        let photoURL = null;
        if (FirebaseService && FirebaseService.currentUser) {
            photoURL = FirebaseService.currentUser.photoURL;
        }
        if (!photoURL && App.state) {
            photoURL = App.state.photoURL;
        }

        const displayName = App.state.playerName || 'Guest';
        const country = App.state.country || 'Unknown';
        const countryFlag = this.getCountryFlag(country);

        let avatarHtml;
        if (photoURL && (photoURL.startsWith('http') || photoURL.startsWith('data:image'))) {
            avatarHtml = `
                <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;overflow:hidden;border:2px solid #f7c948;background:var(--bg-card);display:flex;align-items:center;justify-content:center;">
                    <img src="${photoURL}" 
                         alt="${displayName}" 
                         style="width:100%;height:100%;object-fit:cover;display:block;"
                         onerror="this.parentElement.innerHTML='<span style=\\'font-size:16px;\\'>👤</span>';this.parentElement.style.background='var(--bg-card)';">
                </div>
            `;
        } else {
            avatarHtml = `
                <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--bg-card);border:2px solid #f7c948;">
                    <span style="font-size:16px;">👤</span>
                </div>
            `;
        }

        list.innerHTML = `
            <p style="color:#8899bb;margin:10px 0;">Sign in to view global leaderboard</p>
            <div class="store-item" style="border-color:#f7c948;background:rgba(247,201,72,0.1);display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;">
                <span style="font-weight:700;font-size:18px;width:30px;flex-shrink:0;text-align:center;">—</span>
                <span style="font-size:24px;flex-shrink:0;">⭐</span>
                ${avatarHtml}
                <div class="item-info" style="flex:1;min-width:0;padding:0 4px;">
                    <div class="item-name" style="font-weight:700;font-size:14px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${displayName} (Local Only)
                    </div>
                    <div class="item-desc" style="font-size:12px;color:var(--text-muted);">
                        ${levelsCompleted} levels • ${countryFlag} ${country}
                    </div>
                </div>
                <span style="font-weight:700;color:#f7c948;flex-shrink:0;font-size:16px;">${totalStars} ⭐</span>
            </div>
            <button class="btn btn-sm btn-primary" style="margin-top:12px;width:100%;" onclick="App.showLoginPrompt()">Sign In to Compete</button>
        `;
    }

    // Mask surname for privacy - elegant and strictly aligned
    static maskSurname(name) {
        if (!name || name === 'Player' || name === 'Guest' || name === 'Guest Player') {
            return 'Player ••••';
        }

        if (name.includes('@')) {
            const localPart = name.split('@')[0];
            const p = localPart.slice(0, 2);
            return `${p}•••• ••••`;
        }

        const parts = name.trim().split(/\s+/);

        if (parts.length === 1) {
            const single = parts[0];
            if (single.length <= 2) return single + ' ••••';
            return single.slice(0, 2) + '•••• ••••';
        }

        const first = parts[0];
        const firstMasked = first.length <= 2 ? first : (first.slice(0, 2) + '••');
        const last = parts[parts.length - 1];
        const lastMasked = last.slice(0, 1) + '•••';

        return `${firstMasked} ${lastMasked}`;
    }

    // Set view (global/friends)
    static setView(view) {
        if (view === 'friends') {
            App.showToast('👥 Friends leaderboard coming soon!');
        } else {
            // Reset to global
            this.currentCountry = '';
            const select = document.getElementById('leaderboard-country-filter');
            if (select) select.value = '';
            this.render();
        }
    }
}

// Make Leaderboard globally available
window.Leaderboard = Leaderboard;