// Bananas jump into the points counter when points go up.
// Usage: animatePointsChange(newPoints) instead of setting #pointCount directly.
(function initBananaBurst() {
    let lastValue = null;
    let lastPointer = null;
    let runId = 0;

    // Remember where the user last tapped, so bananas fly out from the claim button
    document.addEventListener('pointerdown', (event) => {
        lastPointer = { x: event.clientX, y: event.clientY, t: Date.now() };
    }, { passive: true, capture: true });

    const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function getOrigin() {
        if (lastPointer && Date.now() - lastPointer.t < 15000) {
            return { x: lastPointer.x, y: lastPointer.y };
        }
        return { x: window.innerWidth / 2, y: window.innerHeight * 0.6 };
    }

    function getTarget() {
        const box = document.querySelector('.points-display');
        if (!box) return { x: window.innerWidth - 60, y: 40 };
        const rect = box.getBoundingClientRect();
        return { x: rect.left + rect.width * 0.18, y: rect.top + rect.height / 2 };
    }

    function bumpCounter() {
        const box = document.querySelector('.points-display');
        if (!box || !box.animate) return;
        box.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.12)' },
            { transform: 'scale(1)' }
        ], { duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    }

    function showGainLabel(gain) {
        const box = document.querySelector('.points-display');
        if (!box) return;
        const rect = box.getBoundingClientRect();
        const label = document.createElement('div');
        label.className = 'banana-gain-label';
        label.textContent = `+${gain} 🍌`;
        label.style.left = `${rect.left + rect.width / 2}px`;
        label.style.top = `${rect.bottom + 6}px`;
        document.body.appendChild(label);
        label.animate([
            { opacity: 0, transform: 'translate(-50%, -6px) scale(.8)' },
            { opacity: 1, transform: 'translate(-50%, 4px) scale(1.05)', offset: 0.2 },
            { opacity: 1, transform: 'translate(-50%, 6px) scale(1)', offset: 0.75 },
            { opacity: 0, transform: 'translate(-50%, 14px) scale(.95)' }
        ], { duration: 1400, easing: 'ease-out' }).onfinish = () => label.remove();
    }

    function flyBananas(count, onArrive, onDone) {
        const origin = getOrigin();
        const target = getTarget();
        let arrived = 0;

        for (let i = 0; i < count; i++) {
            const banana = document.createElement('span');
            banana.className = 'flying-banana';
            banana.textContent = '🍌';
            document.body.appendChild(banana);

            // Burst outwards first, then arc up into the counter
            const angle = Math.random() * Math.PI * 2;
            const spread = 50 + Math.random() * 60;
            const burstX = origin.x + Math.cos(angle) * spread;
            const burstY = origin.y + Math.sin(angle) * spread * 0.7 - 30;
            const peakX = (burstX + target.x) / 2 + (Math.random() - 0.5) * 80;
            const peakY = Math.min(burstY, target.y) - 70 - Math.random() * 60;
            const spin = (Math.random() > 0.5 ? 1 : -1) * (300 + Math.random() * 240);
            const at = (x, y, s, r) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s}) rotate(${r}deg)`;

            const animation = banana.animate([
                { transform: at(origin.x, origin.y, 0.2, 0), opacity: 0 },
                { transform: at(burstX, burstY, 1.25, spin * 0.25), opacity: 1, offset: 0.22 },
                { transform: at(peakX, peakY, 1.05, spin * 0.65), opacity: 1, offset: 0.6 },
                { transform: at(target.x, target.y, 0.45, spin), opacity: 0.9 }
            ], {
                duration: 900 + Math.random() * 200,
                delay: i * 70,
                easing: 'cubic-bezier(.45,.05,.55,.95)',
                fill: 'both'
            });

            animation.onfinish = () => {
                banana.remove();
                arrived += 1;
                bumpCounter();
                onArrive(arrived, count);
                if (arrived === count) onDone();
            };
        }
    }

    window.animatePointsChange = function animatePointsChange(newPoints) {
        const el = document.getElementById('pointCount');
        if (!el) return;

        const next = Number(newPoints);
        const prev = lastValue !== null ? lastValue : Number(String(el.textContent).replace(/[^\d.-]/g, ''));
        lastValue = Number.isFinite(next) ? next : lastValue;
        const myRun = ++runId;

        if (!Number.isFinite(next) || !Number.isFinite(prev) || next <= prev || reduceMotion() || !document.body.animate) {
            el.textContent = newPoints;
            return;
        }

        const gain = next - prev;
        const count = Math.max(4, Math.min(12, Math.ceil(gain / 10)));
        showGainLabel(gain);

        flyBananas(count, (arrived, total) => {
            if (myRun !== runId) return;
            el.textContent = Math.round(prev + (gain * arrived) / total);
        }, () => {
            if (myRun === runId) el.textContent = next;
        });
    };
})();
