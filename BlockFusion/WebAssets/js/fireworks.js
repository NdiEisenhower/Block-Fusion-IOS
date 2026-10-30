// Canvas Fireworks Engine - ES5 Compatible
function FireworksManager() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.rockets = [];
    this.animId = null;
    this.active = false;
    this.colors = [
        '#ff3366', '#ff9900', '#ffff00', '#33ff66',
        '#00ffff', '#3399ff', '#cc33ff', '#ff00cc',
        '#ffffff', '#ffd700', '#ff5722', '#70a1ff',
        '#00ffcc', '#ff007f', '#a29bfe', '#fd79a8'
    ];
}

FireworksManager.prototype.init = function() {
    if (this.canvas) return;
    this.canvas = document.getElementById('fireworks-canvas');
    if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'fireworks-canvas';
        document.body.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    var self = this;
    window.addEventListener('resize', function() { self.resize(); });
};

FireworksManager.prototype.resize = function() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
};

FireworksManager.prototype.start = function(duration) {
    if (!duration) duration = 3000;
    this.init();
    this.active = true;
    this.particles = [];
    this.rockets = [];
    if (this.canvas) {
        this.canvas.style.display = 'block';
    }

    var self = this;

    // Initial Opening Salvo - 3 rockets
    for (var i = 0; i < 3; i++) {
        (function(idx) {
            setTimeout(function() {
                if (self.active) self.launchRocket(false);
            }, idx * 250);
        })(i);
    }

    // Steady launch interval - 1 rocket every 450ms
    var interval = setInterval(function() {
        if (!self.active) {
            clearInterval(interval);
            return;
        }
        self.launchRocket(false);
    }, 450);

    // Finale Volley around win popup appearance (2.0s mark) - 3 rockets
    setTimeout(function() {
        if (!self.active) return;
        for (var f = 0; f < 3; f++) {
            (function(fIdx) {
                setTimeout(function() {
                    if (self.active) self.launchRocket(true);
                }, fIdx * 200);
            })(f);
        }
    }, 2000);

    // Stop creating new rockets after duration
    setTimeout(function() {
        clearInterval(interval);
        setTimeout(function() {
            if (!self.active) return;
            self.stop();
        }, 1500);
    }, duration);

    if (!this.animId) {
        this.loop();
    }
};

FireworksManager.prototype.stop = function() {
    this.active = false;
    if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
    }
    if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.style.display = 'none';
    }
    this.particles = [];
    this.rockets = [];
};

FireworksManager.prototype.launchRocket = function(isHighBurst) {
    if (!this.canvas) return;
    var w = this.canvas.width;
    var h = this.canvas.height;
    var startX = Math.random() * (w * 0.75) + w * 0.125;
    var targetX = startX + (Math.random() - 0.5) * 120;
    var targetY = isHighBurst
        ? Math.random() * (h * 0.3) + h * 0.1
        : Math.random() * (h * 0.4) + h * 0.15;
    var color = this.colors[Math.floor(Math.random() * this.colors.length)];

    this.rockets.push({
        x: startX,
        y: h,
        targetX: targetX,
        targetY: targetY,
        vx: (targetX - startX) / 22,
        vy: (targetY - h) / 22,
        color: color,
        trail: []
    });

    try {
        if (typeof SoundManager !== 'undefined' && SoundManager.play) {
            SoundManager.play(260 + Math.random() * 220, 0.06, 'sine', 0.02);
        }
    } catch (e) { }
};

FireworksManager.prototype.explode = function(x, y, color) {
    var particleCount = 55 + Math.floor(Math.random() * 25);
    var secondaryColor = this.colors[Math.floor(Math.random() * this.colors.length)];

    // Main sphere burst
    for (var i = 0; i < particleCount; i++) {
        var angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.2;
        var speed = Math.random() * 7 + 2;
        this.particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: Math.random() > 0.35 ? color : secondaryColor,
            alpha: 1,
            decay: Math.random() * 0.022 + 0.012,
            size: Math.random() * 3 + 1.5,
            gravity: 0.11,
            shimmer: Math.random() < 0.2
        });
    }

    // Sparkling glitter ring
    for (var i = 0; i < 16; i++) {
        var angle = (Math.PI * 2 * i) / 16;
        var speed = 4.2;
        this.particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: '#ffffff',
            alpha: 1,
            decay: 0.025,
            size: 2.2,
            gravity: 0.04,
            shimmer: true
        });
    }

    try {
        if (typeof SoundManager !== 'undefined') {
            if (SoundManager.fireworkExplosion) {
                SoundManager.fireworkExplosion();
            } else if (SoundManager.play) {
                SoundManager.play(180 + Math.random() * 120, 0.15, 'triangle', 0.04);
                SoundManager.vibrate(20);
            }
        }
    } catch (e) { }
};

FireworksManager.prototype.loop = function() {
    if (!this.canvas || !this.ctx) return;

    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalCompositeOperation = 'lighter';

    // Update & render rockets
    for (var i = this.rockets.length - 1; i >= 0; i--) {
        var r = this.rockets[i];
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 7) r.trail.shift();

        r.x += r.vx;
        r.y += r.vy;

        // Draw rocket trail
        for (var t = 0; t < r.trail.length; t++) {
            var pt = r.trail[t];
            this.ctx.beginPath();
            this.ctx.arc(pt.x, pt.y, (t + 1) * 0.7, 0, Math.PI * 2);
            this.ctx.fillStyle = r.color;
            this.ctx.globalAlpha = (t + 1) / r.trail.length;
            this.ctx.fill();
        }

        // Draw rocket head
        this.ctx.beginPath();
        this.ctx.arc(r.x, r.y, 3.5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.globalAlpha = 1.0;
        this.ctx.fill();

        // Check target burst
        if (r.vy < 0 && r.y <= r.targetY) {
            this.explode(r.x, r.y, r.color);
            this.rockets.splice(i, 1);
        }
    }

    // Update & render particles
    for (var i = this.particles.length - 1; i >= 0; i--) {
        var p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
            this.particles.splice(i, 1);
            continue;
        }

        var drawAlpha = Math.max(0, p.alpha);
        if (p.shimmer && Math.random() < 0.3) {
            drawAlpha *= 0.4;
        }

        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = drawAlpha;
        this.ctx.fill();
    }

    this.ctx.globalAlpha = 1.0;

    var self = this;
    if (this.active || this.particles.length > 0 || this.rockets.length > 0) {
        this.animId = requestAnimationFrame(function() { self.loop(); });
    } else {
        this.stop();
    }
};

if (typeof window !== 'undefined') {
    window.FireworksManager = new FireworksManager();
} else if (typeof global !== 'undefined') {
    global.FireworksManager = new FireworksManager();
}
