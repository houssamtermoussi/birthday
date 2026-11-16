(() => {
    'use strict';

    const BIRTH = { year: 1981, month: 10, day: 16 }; // 16 novembre 1981 (mois indexés à partir de 0)

    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));
    const rand = (min, max) => min + Math.random() * (max - min);

    /* ---------- Âge et compteur ---------- */

    const numberFormat = new Intl.NumberFormat('fr-FR');

    function ageAt(now) {
        const beforeBirthday = now.getMonth() < BIRTH.month
            || (now.getMonth() === BIRTH.month && now.getDate() < BIRTH.day);
        return now.getFullYear() - BIRTH.year - (beforeBirthday ? 1 : 0);
    }

    function setStat(name, value) {
        const el = $(`[data-stat="${name}"]`);
        if (el) el.textContent = numberFormat.format(value);
    }

    function updateStats() {
        const now = new Date();
        // Différence en jours calendaires, indépendante des changements d'heure.
        const days = Math.round(
            (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
                - Date.UTC(BIRTH.year, BIRTH.month, BIRTH.day)) / 864e5
        );
        const hours = days * 24 + now.getHours();
        const minutes = hours * 60 + now.getMinutes();
        setStat('years', ageAt(now));
        setStat('days', days);
        setStat('hours', hours);
        setStat('minutes', minutes);
        setStat('seconds', minutes * 60 + now.getSeconds());
    }

    const age = ageAt(new Date());
    $$('[data-age]').forEach((el) => { el.textContent = age; });
    const digits = $$('#digits text');
    const ageText = String(age);
    if (digits.length === ageText.length) {
        digits.forEach((el, i) => { el.textContent = ageText[i]; });
    }
    updateStats();
    setInterval(updateStats, 1000);

    /* ---------- Décor du gâteau : coulures dorées et perles ---------- */

    // Chaque étage est un cylindre centré sur x = 200 ; `drips` liste [angle°, longueur, largeur].
    const CAKE_CENTER = 200;
    const TIERS = [
        {
            rx: 140, top: 300, bottom: 385, ry: 14, pearlStep: 7, pearlSize: 3.2, dripBase: 5,
            drips: [6, 13, 8, 17, 9, 14, 20, 10, 16, 8, 15, 9, 6].map((length, i) => [-78 + i * 13, length, 8]),
        },
        { rx: 100, top: 225, bottom: 300, ry: 11, pearlStep: 8, pearlSize: 2.8 },
        {
            rx: 62, top: 160, bottom: 225, ry: 8, pearlStep: 10, pearlSize: 2.6, dripBase: 5,
            drips: [[-72, 12, 6], [-52, 26, 6], [-33, 13, 6], [-14, 33, 6.5], [5, 18, 6],
                [23, 29, 6.5], [42, 11, 6], [58, 23, 6], [75, 10, 6]],
        },
    ];
    const toRadians = (degrees) => degrees * Math.PI / 180;
    const round = (value) => Math.round(value * 10) / 10;

    function dripPath(tier) {
        const left = CAKE_CENTER - tier.rx;
        const right = CAKE_CENTER + tier.rx;
        const steps = Math.floor(tier.rx * 2 / 1.5);
        let d = `M${left} ${tier.top}`;
        for (let i = 0; i <= steps; i += 1) {
            const x = left + (right - left) * i / steps;
            const u = (x - CAKE_CENTER) / tier.rx;
            const edge = tier.top + tier.ry * Math.sqrt(Math.max(0, 1 - u * u));
            let depth = tier.dripBase;
            tier.drips.forEach(([angle, length, dripWidth]) => {
                // Les coulures proches des bords sont plus étroites (perspective du cylindre).
                const cos = Math.cos(toRadians(angle));
                const t = (x - (CAKE_CENTER + tier.rx * Math.sin(toRadians(angle)))) / (dripWidth * Math.max(.4, cos));
                depth = Math.max(depth, tier.dripBase + length * Math.exp(-(t ** 4)));
            });
            d += `L${round(x)} ${round(edge + depth)}`;
        }
        return `${d}L${right} ${tier.top}A${tier.rx} ${tier.ry} 0 0 0 ${left} ${tier.top}Z`;
    }

    function pearlRow(tier) {
        let circles = '';
        for (let angle = -84; angle <= 84; angle += tier.pearlStep) {
            const cos = Math.cos(toRadians(angle));
            const x = CAKE_CENTER + tier.rx * Math.sin(toRadians(angle));
            const y = tier.bottom + tier.ry * cos - 1.5;
            circles += `<circle cx="${round(x)}" cy="${round(y)}" r="${round(tier.pearlSize * (.55 + .45 * cos))}"/>`;
        }
        return circles;
    }

    TIERS.forEach((tier, index) => {
        const drips = $(`[data-drips="${index}"]`);
        const pearls = $(`[data-pearls="${index}"]`);
        if (drips && tier.drips) drips.setAttribute('d', dripPath(tier));
        if (pearls) pearls.innerHTML = pearlRow(tier);
    });

    /* ---------- Musique (boîte à musique synthétisée) ---------- */

    const NOTES = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 };
    const SONG = [
        ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
        ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
        ['G4', .75], ['G4', .25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
        ['F5', .75], ['F5', .25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3],
    ];
    const BEAT = .5;
    const soundButton = $('#sound');
    let audio = null;
    let master = null;
    let playing = false;
    let muted = false;
    let endTimer = 0;

    function setPlaying(state) {
        playing = state;
        soundButton.classList.toggle('is-playing', state);
        soundButton.setAttribute('aria-pressed', String(state));
    }

    function tone(frequency, start, duration) {
        // Fondamentale + deux harmoniques qui s'éteignent vite : timbre de boîte à musique.
        [[1, .5, 1], [2, .16, .6], [4, .05, .35]].forEach(([multiple, gain, decay]) => {
            const osc = audio.createOscillator();
            const env = audio.createGain();
            const end = start + Math.max(1.4, duration + .9) * decay;
            osc.type = 'sine';
            osc.frequency.value = frequency * multiple;
            env.gain.setValueAtTime(0, start);
            env.gain.linearRampToValueAtTime(gain, start + .012);
            env.gain.exponentialRampToValueAtTime(.0001, end);
            osc.connect(env).connect(master);
            osc.start(start);
            osc.stop(end + .05);
        });
    }

    function stopMusic() {
        clearTimeout(endTimer);
        if (master) {
            const old = master;
            old.gain.setTargetAtTime(0, audio.currentTime, .05);
            setTimeout(() => old.disconnect(), 400);
            master = null;
        }
        setPlaying(false);
    }

    function playMusic() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        try {
            audio = audio || new AudioCtx();
            audio.resume();
            stopMusic();
            master = audio.createGain();
            master.gain.value = .45;
            master.connect(audio.destination);
            let time = audio.currentTime + .2;
            SONG.forEach(([note, beats]) => {
                tone(NOTES[note] * 2, time, beats * BEAT);
                time += beats * BEAT;
            });
            setPlaying(true);
            endTimer = setTimeout(() => setPlaying(false), (time - audio.currentTime + 1.5) * 1000);
        } catch (error) {
            setPlaying(false);
        }
    }

    soundButton.addEventListener('click', () => {
        if (playing) {
            muted = true;
            stopMusic();
        } else {
            muted = false;
            playMusic();
        }
    });

    /* ---------- Canvas : poussière d'or et confettis ---------- */

    const ambientCanvas = $('#ambient');
    const confettiCanvas = $('#confetti');
    const ambientCtx = ambientCanvas.getContext('2d');
    const confettiCtx = confettiCanvas.getContext('2d');
    const COLORS = ['#d4af37', '#f6e6a8', '#fff8e1', '#b8892b', '#e9c46a', '#e8c1c5'];
    let width = 0;
    let height = 0;
    let dots = [];
    let pieces = [];
    let lastFrame = 0;
    let frameRequested = false;

    // Position de la souris ramenée entre -1 et 1, lissée à chaque image (sert à la parallaxe).
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const DUST_MARGIN = 8;
    const wrap = (value, span) => ((value % span) + span) % span;

    function makeDots() {
        const count = Math.round(Math.min(90, (width * height) / 15000));
        dots = Array.from({ length: count }, () => {
            // Profondeur : les grains proches sont plus gros et bougent davantage au défilement.
            const depth = rand(.15, 1);
            return {
                depth,
                x: rand(0, width),
                y: rand(0, height),
                r: .4 + depth * 1.7,
                vx: rand(-.07, .07),
                vy: rand(-.3, -.07),
                phase: rand(0, Math.PI * 2),
                speed: rand(.008, .028),
            };
        });
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const widthChanged = window.innerWidth !== width;
        width = window.innerWidth;
        height = window.innerHeight;
        [[ambientCanvas, ambientCtx], [confettiCanvas, confettiCtx]].forEach(([canvas, ctx]) => {
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        });
        if (widthChanged || !dots.length) makeDots();
        parallaxDirty = true;
        drawAmbient(0);
    }

    function drawAmbient(k) {
        ambientCtx.clearRect(0, 0, width, height);
        ambientCtx.fillStyle = '#f3d98b';
        const spanX = width + DUST_MARGIN * 2;
        const spanY = height + DUST_MARGIN * 2;
        const scroll = reduceMotion ? 0 : window.scrollY * .3;
        dots.forEach((dot) => {
            dot.x = wrap(dot.x + dot.vx * k, spanX);
            dot.y = wrap(dot.y + dot.vy * k, spanY);
            dot.phase += dot.speed * k;
            // Parallaxe : chaque grain se décale selon sa profondeur, puis reboucle hors champ.
            const x = wrap(dot.x - pointer.x * dot.depth * 16, spanX) - DUST_MARGIN;
            const y = wrap(dot.y - scroll * dot.depth, spanY) - DUST_MARGIN;
            const alpha = .12 + .58 * (.5 + .5 * Math.sin(dot.phase));
            ambientCtx.globalAlpha = alpha * .16;
            ambientCtx.beginPath();
            ambientCtx.arc(x, y, dot.r * 3.6, 0, Math.PI * 2);
            ambientCtx.fill();
            ambientCtx.globalAlpha = alpha;
            ambientCtx.beginPath();
            ambientCtx.arc(x, y, dot.r, 0, Math.PI * 2);
            ambientCtx.fill();
        });
        ambientCtx.globalAlpha = 1;
    }

    function drawConfetti(k) {
        confettiCtx.clearRect(0, 0, width, height);
        const drag = Math.pow(.97, k);
        pieces = pieces.filter((piece) => piece.life > 0 && piece.y < height + 40);
        pieces.forEach((piece) => {
            piece.vx *= drag;
            piece.vy = piece.vy * drag + .2 * k;
            piece.x += (piece.vx + Math.sin(piece.flip) * .6) * k;
            piece.y += piece.vy * k;
            piece.rotation += piece.spin * k;
            piece.flip += piece.flipSpeed * k;
            piece.life -= piece.decay * k;
            confettiCtx.save();
            confettiCtx.globalAlpha = Math.min(1, piece.life * 5);
            confettiCtx.translate(piece.x, piece.y);
            confettiCtx.rotate(piece.rotation);
            confettiCtx.scale(1, Math.cos(piece.flip));
            confettiCtx.fillStyle = piece.color;
            if (piece.round) {
                confettiCtx.beginPath();
                confettiCtx.arc(0, 0, piece.w / 2, 0, Math.PI * 2);
                confettiCtx.fill();
            } else {
                confettiCtx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
            }
            confettiCtx.restore();
        });
    }

    /* ---------- Parallaxe ---------- */

    // Les éléments de l'accueil se décalent selon le défilement depuis le haut de page ;
    // les autres selon leur distance au centre de l'écran. Vitesse positive = plan éloigné.
    const heroInner = $('.hero__inner');
    const layers = $$('[data-speed], [data-shift]').map((el) => ({
        el,
        speed: parseFloat(el.dataset.speed) || 0,
        shift: parseFloat(el.dataset.shift) || 0,
        minWidth: parseFloat(el.dataset.minWidth) || 0,
        fromTop: Boolean(el.closest('.hero')),
        x: 0,
        y: 0,
    }));
    const orbs = $$('[data-orb]').map((el) => ({ el, speed: parseFloat(el.dataset.orb) }));
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    let lastScroll = -1;
    let parallaxDirty = true;

    function updateParallax(k) {
        const scroll = window.scrollY;
        const ease = 1 - Math.pow(.9, k);
        const gap = Math.abs(pointer.targetX - pointer.x) + Math.abs(pointer.targetY - pointer.y);
        pointer.x += (pointer.targetX - pointer.x) * ease;
        pointer.y += (pointer.targetY - pointer.y) * ease;
        if (scroll === lastScroll && gap < .001 && !parallaxDirty) return;
        lastScroll = scroll;
        parallaxDirty = false;

        // Toutes les lectures de mise en page d'abord, les écritures ensuite.
        const heroScroll = Math.min(scroll, height * 1.2);
        const moves = layers.map((layer) => {
            if (layer.minWidth > width) return { x: 0, y: 0 };
            let y = 0;
            if (layer.fromTop) {
                y = heroScroll * layer.speed;
            } else if (layer.speed) {
                // On retire le décalage déjà appliqué pour retrouver la position d'origine.
                const box = layer.el.getBoundingClientRect();
                const center = box.top - layer.y + box.height / 2;
                y = clamp(height / 2 - center, -height, height) * layer.speed;
            }
            return { x: pointer.x * layer.shift, y: y + pointer.y * layer.shift * .6 };
        });
        layers.forEach((layer, index) => {
            const { x, y } = moves[index];
            if (Math.abs(x - layer.x) < .05 && Math.abs(y - layer.y) < .05) return;
            layer.x = x;
            layer.y = y;
            layer.el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
        });
        heroInner.style.opacity = clamp(1 - scroll / (height * .6), 0, 1).toFixed(3);
        orbs.forEach((orb) => {
            const x = pointer.x * orb.speed * -60;
            orb.el.style.translate = `${x.toFixed(1)}px ${(-scroll * orb.speed).toFixed(1)}px`;
        });
    }

    if (!reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        window.addEventListener('pointermove', (event) => {
            if (event.pointerType !== 'mouse') return;
            pointer.targetX = clamp(event.clientX / width * 2 - 1, -1, 1);
            pointer.targetY = clamp(event.clientY / height * 2 - 1, -1, 1);
        }, { passive: true });
    }

    function frame(now) {
        frameRequested = false;
        const k = lastFrame ? Math.min(3, (now - lastFrame) / 16.67) : 1;
        lastFrame = now;
        if (!reduceMotion) {
            updateParallax(k);
            drawAmbient(k);
        }
        if (pieces.length) drawConfetti(k);
        else confettiCtx.clearRect(0, 0, width, height);
        requestFrame();
    }

    function requestFrame() {
        if (frameRequested || document.hidden) return;
        if (reduceMotion && !pieces.length) return;
        frameRequested = true;
        requestAnimationFrame(frame);
    }

    function addPiece(x, y, vx, vy, decay) {
        pieces.push({
            x, y, vx, vy, decay,
            w: rand(5, 11),
            h: rand(8, 16),
            rotation: rand(0, Math.PI * 2),
            spin: rand(-.15, .15),
            flip: rand(0, Math.PI * 2),
            flipSpeed: rand(.08, .26),
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            round: Math.random() < .2,
            life: 1,
        });
    }

    function burst(x, y, count, angle, spread, power) {
        if (reduceMotion) return;
        for (let i = 0; i < count; i += 1) {
            const direction = angle + rand(-spread, spread) / 2;
            const velocity = power * rand(.4, 1);
            addPiece(x, y, Math.cos(direction) * velocity, Math.sin(direction) * velocity, rand(.003, .006));
        }
        requestFrame();
    }

    function rain(count) {
        if (reduceMotion) return;
        for (let i = 0; i < count; i += 1) {
            addPiece(rand(0, width), rand(-height * .5, -10), rand(-1, 1), rand(1, 5), rand(.0018, .003));
        }
        requestFrame();
    }

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
        lastFrame = 0;
        requestFrame();
    });
    resize();
    requestFrame();

    /* ---------- Ouverture ---------- */

    const gate = $('#gate');
    const openButton = $('#open');

    // Après un rechargement, on repart toujours du haut : l'accueil est la première chose à voir.
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

    function openGate() {
        if (root.classList.contains('is-open')) return;
        window.scrollTo({ top: 0, behavior: 'instant' });
        root.classList.add('is-open');
        setTimeout(() => { gate.hidden = true; }, 1500);
        playMusic();
        const power = Math.max(15, Math.min(27, height / 34));
        burst(0, height, 110, -Math.PI / 3, 1, power);
        burst(width, height, 110, -Math.PI * 2 / 3, 1, power);
        setTimeout(() => rain(70), 500);
    }

    openButton.addEventListener('click', openGate);
    openButton.focus({ preventScroll: true });

    /* ---------- Bougies ---------- */

    const cake = $('#cake');
    const blowButton = $('#blow');
    const wishResult = $('#wishResult');

    function toggleCandles() {
        const blown = cake.classList.toggle('is-blown');
        blowButton.textContent = blown ? 'Rallumer les bougies' : 'Souffler les bougies';
        wishResult.textContent = blown ? 'Que tous tes vœux se réalisent, Maman' : '';
        wishResult.classList.toggle('is-visible', blown);
        if (!blown) return;
        const box = cake.getBoundingClientRect();
        burst(box.left + box.width / 2, box.top + box.height * .3, 150, -Math.PI / 2, Math.PI * 1.5, 17);
        setTimeout(() => rain(130), 350);
        if (!muted && !playing) playMusic();
    }

    blowButton.addEventListener('click', toggleCandles);
    cake.addEventListener('click', toggleCandles);

    /* ---------- Apparition au défilement ---------- */

    const revealed = $$('.reveal');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, { threshold: .15, rootMargin: '0px 0px -6% 0px' });
        revealed.forEach((el) => observer.observe(el));
    } else {
        revealed.forEach((el) => el.classList.add('is-visible'));
    }
})();
