// Daily Challenge System
class DailyChallenge {
    static checkDailyReset() {
        const today = new Date().toDateString();
        const lastDate = App.state.dailyChallengeDate;
        
        if (lastDate !== today) {
            // Reset daily challenge
            App.state.dailyChallengeDone = false;
            App.state.dailyChallengeDate = today;
            App.state.dailyProgress = {
                levels: 0,
                merges: 0,
                coins: 0,
                moves: Infinity
            };
            App.saveState();
            console.log('📅 Daily challenge reset for today');
        }
    }

    static getDailyChallenge() {
        const today = new Date();
        const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
        const challenges = CONFIG.DAILY_CHALLENGES || [];
        const index = dayOfYear % challenges.length;
        return challenges[index] || challenges[0];
    }

    static start() {
        this.checkDailyReset();
        const challenge = this.getDailyChallenge();
        const done = App.state.dailyChallengeDone;
        
        if (done) {
            App.showToast('✅ Daily challenge already completed!');
            Navigation.navigateTo('daily');
            return;
        }

        // Show challenge popup
        if (typeof PopupManager !== 'undefined') {
            PopupManager.showDailyChallenge();
        } else {
            // Fallback to modal
            const modal = document.getElementById('modal-container');
            if (!modal) return;
            
            const prog = App.state.dailyProgress || { levels: 0, merges: 0, coins: 0, moves: Infinity };
            let progressText = '';
            let pct = 0;
            
            switch(challenge.type) {
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
            
            modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('modal-container').innerHTML='';">
                <div class="modal" onclick="event.stopPropagation();">
                    <h2>📅 Daily Challenge</h2>
                    <div style="font-size:40px;margin:8px 0;">${challenge.icon || '🎯'}</div>
                    <p style="font-size:16px;font-weight:600;margin:6px 0;">${challenge.desc || 'Complete today\'s challenge'}</p>
                    <p style="color:var(--gold);font-weight:700;font-size:18px;display:flex;align-items:center;justify-content:center;gap:6px;">Reward: <span class="custom-coin"></span> +${challenge.reward || 100} Coins</p>
                    <div style="background:var(--bg);border-radius:10px;height:8px;overflow:hidden;margin:10px 0;">
                        <div style="width:${pct}%;height:100%;background:var(--accent);border-radius:10px;transition:width 0.3s;"></div>
                    </div>
                    <p style="color:#8899bb;font-size:13px;">${progressText} (${pct}%)</p>
                    <div class="modal-buttons">
                        <button class="btn btn-primary btn-block" onclick="document.getElementById('modal-container').innerHTML='';App.continueGame();">▶ Play Now</button>
                        <button class="btn btn-outline btn-block" onclick="document.getElementById('modal-container').innerHTML='';">Close</button>
                    </div>
                </div>
            </div>`;
        }
        App.updateAllCoinDisplays();
    }
    
    static renderDailyScreen() {
        const list = document.getElementById('daily-list');
        if (!list) return;
        
        this.checkDailyReset();
        const challenge = this.getDailyChallenge();
        const done = App.state.dailyChallengeDone;
        const prog = App.state.dailyProgress || { levels: 0, merges: 0, coins: 0, moves: Infinity };
        const streak = App.state.currentStreak || 0;
        const today = new Date().toDateString();
        
        let progressText = '';
        let pct = 0;
        
        if (!done && challenge) {
            switch(challenge.type) {
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
        
        list.innerHTML = `
            <div style="text-align:center;padding:8px 0;">
                <span style="background:var(--accent);color:#fff;padding:2px 12px;border-radius:20px;font-size:13px;font-weight:700;">🔥 ${streak} Day Streak</span>
                <span style="margin-left:12px;color:#8899bb;font-size:13px;">${today}</span>
            </div>
            <div style="background:var(--surface);border-radius:16px;padding:16px;margin:8px 0;border:2px solid ${done ? 'var(--gold)' : 'var(--surface2)'};">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="font-size:40px;">${done ? '✅' : (challenge?.icon || '📅')}</div>
                    <div style="flex:1;">
                        <div style="font-weight:700;font-size:16px;">${done ? '✅ Completed!' : '📅 Daily Challenge'}</div>
                        <div style="color:#8899bb;font-size:13px;">${done ? 'Great job!' : (challenge?.desc || 'Complete today\'s challenge')}</div>
                        <div style="color:var(--gold);font-weight:600;font-size:14px;">🏆 Reward: ${challenge?.reward || 100} coins</div>
                        <div style="margin-top:6px;background:var(--bg);border-radius:10px;height:8px;overflow:hidden;">
                            <div style="width:${done ? 100 : pct}%;height:100%;background:${done ? 'var(--gold)' : 'var(--accent)'};border-radius:10px;transition:width 0.3s;"></div>
                        </div>
                        <div style="font-size:12px;color:#8899bb;margin-top:4px;">${done ? '✅ Completed!' : progressText + ` (${pct}%)`}</div>
                    </div>
                    <div style="font-size:28px;">${done ? '✅' : '⏳'}</div>
                </div>
            </div>
            <div style="background:var(--surface);border-radius:14px;padding:14px;margin:8px 0;border:1px solid var(--surface2);">
                <div style="font-weight:600;margin-bottom:6px;">📊 Today's Progress</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;color:#8899bb;">
                    <div>Levels: ${prog.levels || 0}</div>
                    <div>Merges: ${prog.merges || 0}</div>
                    <div>Coins earned: ${prog.coins || 0}</div>
                    <div>Best moves: ${prog.moves === Infinity ? '-' : prog.moves}</div>
                </div>
            </div>
            <button class="btn btn-primary btn-block" onclick="App.continueGame()" style="margin-top:8px;">
                ${done ? '▶ Keep Playing' : '🎯 Play to Complete'}
            </button>
            ${done ? `<button class="btn btn-outline btn-block" onclick="App.showToast('Come back tomorrow for a new challenge!')" style="margin-top:6px;">⏰ Next challenge in 24h</button>` : ''}
        `;
        App.updateAllCoinDisplays();
    }

    // Track progress for daily challenge
    static trackProgress(type, value) {
        this.checkDailyReset();
        if (App.state.dailyChallengeDone) return;
        
        const prog = App.state.dailyProgress || { levels: 0, merges: 0, coins: 0, moves: Infinity };
        const challenge = this.getDailyChallenge();
        
        switch(type) {
            case 'level':
                prog.levels = (prog.levels || 0) + 1;
                break;
            case 'merge':
                prog.merges = (prog.merges || 0) + value;
                break;
            case 'coin':
                prog.coins = (prog.coins || 0) + value;
                break;
            case 'moves':
                if (value < prog.moves) prog.moves = value;
                break;
        }
        
        App.state.dailyProgress = prog;
        App.saveState();
        
        // Check if challenge is complete
        this.checkCompletion(challenge);
    }

    static checkCompletion(challenge) {
        if (!challenge) return;
        const prog = App.state.dailyProgress || { levels: 0, merges: 0, coins: 0, moves: Infinity };
        let completed = false;
        
        switch(challenge.type) {
            case 'reach':
                completed = (App.state.highestTileEver || 0) >= challenge.goal;
                break;
            case 'moves':
                completed = prog.moves <= challenge.goal;
                break;
            case 'levels':
                completed = (prog.levels || 0) >= challenge.goal;
                break;
            case 'coins':
                completed = (prog.coins || 0) >= challenge.goal;
                break;
            case 'merge':
                completed = (prog.merges || 0) >= challenge.goal;
                break;
        }
        
        if (completed && !App.state.dailyChallengeDone) {
            App.state.dailyChallengeDone = true;
            App.state.coins = (App.state.coins || 0) + (challenge.reward || 100);
            App.saveState();
            App.updateAllCoinDisplays();
            App.showToast(`🎉 Daily challenge complete! +${challenge.reward || 100} coins!`);
            
            if (typeof Achievements !== 'undefined') {
                Achievements.check();
            }
        }
    }
}

// Make DailyChallenge globally available
window.DailyChallenge = DailyChallenge;