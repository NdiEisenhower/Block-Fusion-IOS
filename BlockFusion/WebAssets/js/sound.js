// Sound Manager
class SoundManager {
    static getContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioCtx;
    }

    static play(freq, duration, type = 'sine', vol = 0.08) {
        if (!this.enabled) return;
        try {
            const ctx = this.getContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        } catch (e) { /* ignore */ }
    }

    static vibrate(ms = 40) {
        try {
            if (!this.enabled) return;
            let type = 'light';
            if (ms > 30 && ms <= 50) type = 'medium';
            else if (ms > 50) type = 'heavy';
            this.haptic(type);
        } catch (e) { /* ignore */ }
    }

    static haptic(type = 'medium') {
        try {
            if (typeof iOS !== 'undefined' && typeof iOS.vibrate === 'function') {
                iOS.vibrate(type);
            } else if (typeof Android !== 'undefined' && typeof Android.vibrate === 'function') {
                Android.vibrate(type);
            } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
                const ms = type === 'light' ? 20 : (type === 'heavy' || type === 'success' || type === 'error' ? 60 : 40);
                navigator.vibrate(ms);
            }
        } catch (e) { /* ignore */ }
    }

    static merge() {
        this.mergeTier(1);
    }

    static mergeTier(tier = 1) {
        if (!this.enabled) return;
        if (tier <= 1) {
            this.play(440, 0.12, 'sine', 0.08);
            setTimeout(() => this.play(660, 0.1, 'sine', 0.06), 60);
        } else if (tier === 2) {
            this.play(520, 0.14, 'sine', 0.1);
            setTimeout(() => this.play(780, 0.12, 'sine', 0.08), 70);
            setTimeout(() => this.play(1040, 0.1, 'sine', 0.06), 140);
            this.vibrate(30);
        } else if (tier === 3) {
            this.play(520, 0.18, 'triangle', 0.12);
            this.play(650, 0.18, 'sine', 0.1);
            setTimeout(() => this.play(780, 0.16, 'triangle', 0.1), 80);
            setTimeout(() => this.play(1040, 0.14, 'sine', 0.08), 160);
            this.vibrate(60);
        } else {
            // Tier 4 (Epic)
            this.play(440, 0.25, 'sawtooth', 0.08);
            this.play(660, 0.25, 'triangle', 0.12);
            setTimeout(() => this.play(880, 0.22, 'sine', 0.12), 90);
            setTimeout(() => this.play(1100, 0.2, 'sine', 0.1), 180);
            setTimeout(() => this.play(1320, 0.2, 'triangle', 0.08), 260);
            this.vibrate(80);
        }
    }

    static fireworkExplosion() {
        if (!this.enabled) return;
        this.play(180 + Math.random() * 120, 0.22, 'triangle', 0.07);
        setTimeout(() => this.play(120 + Math.random() * 80, 0.15, 'sawtooth', 0.04), 40);
        this.vibrate(25);
    }

    static rewindPowerup() {
        if (!this.enabled) return;
        this.play(880, 0.12, 'sine', 0.1);
        setTimeout(() => this.play(660, 0.12, 'sine', 0.08), 70);
        setTimeout(() => this.play(440, 0.18, 'sine', 0.08), 140);
        this.vibrate(40);
    }

    static shufflePowerup() {
        if (!this.enabled) return;
        this.play(400, 0.08, 'sine', 0.08);
        setTimeout(() => this.play(600, 0.08, 'sine', 0.08), 60);
        setTimeout(() => this.play(800, 0.08, 'sine', 0.08), 120);
        setTimeout(() => this.play(1000, 0.12, 'sine', 0.1), 180);
        this.vibrate(50);
    }

    static zapPowerup() {
        if (!this.enabled) return;
        this.play(900, 0.15, 'sawtooth', 0.1);
        setTimeout(() => this.play(300, 0.2, 'sawtooth', 0.08), 80);
        this.vibrate(50);
    }

    static swapPowerup() {
        if (!this.enabled) return;
        this.play(500, 0.1, 'sine', 0.08);
        setTimeout(() => this.play(1200, 0.18, 'sine', 0.12), 80);
        this.vibrate(60);
    }

    static click() { 
        this.play(300, 0.06, 'square', 0.04); 
        this.haptic('selection');
    }

    static win() {
        this.play(660, 0.2, 'sine', 0.1);
        setTimeout(() => this.play(880, 0.2, 'sine', 0.1), 150);
        setTimeout(() => this.play(1100, 0.3, 'sine', 0.12), 300);
        this.vibrate();
    }

    static coin() {
        this.play(1200, 0.08, 'sine', 0.06);
        this.play(1600, 0.06, 'sine', 0.04);
    }

    static toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

SoundManager.audioCtx = null;
SoundManager.enabled = true;
