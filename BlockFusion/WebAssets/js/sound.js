// Sound Manager with iOS Web Audio resume unlock & native Taptic Engine bridge
class SoundManager {
    static getContext() {
        if (!this.audioCtx) {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (AudioCtxClass) {
                this.audioCtx = new AudioCtxClass();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        return this.audioCtx;
    }

    static unlockAudioContext() {
        try {
            const ctx = SoundManager.getContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
        } catch (e) { /* ignore */ }
    }

    static playNative(sound) {
        if (!this.enabled && sound !== 'toggle_off') return;
        try {
            if (typeof window !== 'undefined' && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.soundBridge) {
                window.webkit.messageHandlers.soundBridge.postMessage({ action: 'play', sound: sound });
            }
        } catch(e) {}
    }

    static play(freq, duration, type = 'sine', vol = 0.14) {
        if (!this.enabled) return;
        try {
            const ctx = this.getContext();
            if (!ctx) return;
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
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

    static vibrate(ms = 40, type = 'medium') {
        try {
            // 1. Native iOS WKWebView messageHandler
            if (typeof window !== 'undefined' && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.hapticBridge) {
                window.webkit.messageHandlers.hapticBridge.postMessage({ action: 'vibrate', type: type });
                return;
            }
            // 2. NativeBridge object fallback
            if (typeof NativeBridge !== 'undefined' && NativeBridge.haptics && typeof NativeBridge.haptics.vibrate === 'function') {
                NativeBridge.haptics.vibrate(type);
                return;
            }
            // 3. Android Webview bridge
            if (typeof Android !== 'undefined' && typeof Android.vibrate === 'function') {
                Android.vibrate();
                return;
            }
            // 4. Standard W3C Vibration API (Android Chrome / other browsers)
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
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
            this.play(440, 0.12, 'sine', 0.14);
            setTimeout(() => this.play(660, 0.1, 'sine', 0.12), 60);
            this.playNative('merge');
            this.vibrate(20, 'light');
        } else if (tier === 2) {
            this.play(520, 0.14, 'sine', 0.16);
            setTimeout(() => this.play(780, 0.12, 'sine', 0.14), 70);
            setTimeout(() => this.play(1040, 0.1, 'sine', 0.1), 140);
            this.playNative('mergeTier2');
            this.vibrate(30, 'medium');
        } else if (tier === 3) {
            this.play(520, 0.18, 'triangle', 0.18);
            this.play(650, 0.18, 'sine', 0.15);
            setTimeout(() => this.play(780, 0.16, 'triangle', 0.14), 80);
            setTimeout(() => this.play(1040, 0.14, 'sine', 0.12), 160);
            this.playNative('mergeTier3');
            this.vibrate(50, 'heavy');
        } else {
            // Tier 4 (Epic)
            this.play(440, 0.25, 'sawtooth', 0.14);
            this.play(660, 0.25, 'triangle', 0.18);
            setTimeout(() => this.play(880, 0.22, 'sine', 0.16), 90);
            setTimeout(() => this.play(1100, 0.2, 'sine', 0.14), 180);
            setTimeout(() => this.play(1320, 0.2, 'triangle', 0.12), 260);
            this.playNative('mergeTier4');
            this.vibrate(70, 'heavy');
        }
    }

    static fireworkExplosion() {
        if (!this.enabled) return;
        this.playNative('pop');
        this.play(180 + Math.random() * 120, 0.22, 'triangle', 0.12);
        setTimeout(() => this.play(120 + Math.random() * 80, 0.15, 'sawtooth', 0.08), 40);
        this.vibrate(25, 'light');
    }

    static rewindPowerup() {
        if (!this.enabled) return;
        this.playNative('powerup');
        this.play(880, 0.12, 'sine', 0.15);
        setTimeout(() => this.play(660, 0.12, 'sine', 0.12), 70);
        setTimeout(() => this.play(440, 0.18, 'sine', 0.12), 140);
        this.vibrate(40, 'medium');
    }

    static shufflePowerup() {
        if (!this.enabled) return;
        this.playNative('powerup');
        this.play(400, 0.08, 'sine', 0.12);
        setTimeout(() => this.play(600, 0.08, 'sine', 0.12), 60);
        setTimeout(() => this.play(800, 0.08, 'sine', 0.12), 120);
        setTimeout(() => this.play(1000, 0.12, 'sine', 0.15), 180);
        this.vibrate(50, 'medium');
    }

    static zapPowerup() {
        if (!this.enabled) return;
        this.playNative('powerup');
        this.play(900, 0.15, 'sawtooth', 0.15);
        setTimeout(() => this.play(300, 0.2, 'sawtooth', 0.12), 80);
        this.vibrate(50, 'medium');
    }

    static swapPowerup() {
        if (!this.enabled) return;
        this.playNative('powerup');
        this.play(500, 0.1, 'sine', 0.12);
        setTimeout(() => this.play(1200, 0.18, 'sine', 0.16), 80);
        this.vibrate(60, 'medium');
    }

    static click() {
        this.playNative('click');
        this.play(360, 0.08, 'sine', 0.12);
        this.vibrate(15, 'selection');
    }

    static win() {
        this.playNative('win');
        this.play(660, 0.2, 'sine', 0.16);
        setTimeout(() => this.play(880, 0.2, 'sine', 0.16), 150);
        setTimeout(() => this.play(1100, 0.3, 'sine', 0.18), 300);
        this.vibrate(60, 'success');
    }

    static coin() {
        this.playNative('coin');
        this.play(1200, 0.08, 'sine', 0.14);
        setTimeout(() => this.play(1600, 0.08, 'sine', 0.12), 40);
        this.vibrate(15, 'light');
    }

    static toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

SoundManager.audioCtx = null;
SoundManager.enabled = true;

// Proactively unlock Web Audio on any touch/click event on iOS WebKit
if (typeof window !== 'undefined') {
    const unlockHandler = () => {
        SoundManager.unlockAudioContext();
    };
    ['touchstart', 'touchend', 'click', 'keydown'].forEach(evt => {
        window.addEventListener(evt, unlockHandler, { passive: true });
    });
}
