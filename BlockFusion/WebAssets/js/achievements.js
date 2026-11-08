// Achievements System
class Achievements {
    static init() {
        // Initialize achievements in state if not exists
        if (!App.state.achievements) {
            App.state.achievements = {};
        }
        App.saveState();
        console.log('🏆 Achievements initialized');
    }

    static checkAll(game) {
        this.check();
    }

    static check() {
        if (!App.state.achievements) {
            App.state.achievements = {};
        }
        
        let newUnlocks = [];
        CONFIG.ACHIEVEMENTS.forEach(a => {
            if (!App.state.achievements[a.id] && a.check(App.state)) {
                App.state.achievements[a.id] = true;
                newUnlocks.push(a);
            }
        });
        
        if (newUnlocks.length > 0) {
            App.saveState();
            newUnlocks.forEach(a => {
                App.showToast(`🏆 Achievement: ${a.name}! +100 coins`);
                App.state.coins += 100;
            });
            App.saveState();
            App.updateAllCoinDisplays();
        }
    }

    static render() {
        const list = document.getElementById('achievements-list');
        if (!list) return;
        
        if (!App.state.achievements) {
            App.state.achievements = {};
        }
        
        list.innerHTML = CONFIG.ACHIEVEMENTS.map(a => {
            const unlocked = App.state.achievements[a.id] || false;
            return `
            <div class="store-item" style="opacity:${unlocked ? '1' : '0.5'};">
                <div class="item-icon">${unlocked ? a.icon : '🔒'}</div>
                <div class="item-info">
                    <div class="item-name">${a.name}</div>
                    <div class="item-desc">${a.desc}</div>
                </div>
                <span>${unlocked ? '✅' : '—'}</span>
            </div>`;
        }).join('');
    }
}

// Make Achievements globally available
window.Achievements = Achievements;