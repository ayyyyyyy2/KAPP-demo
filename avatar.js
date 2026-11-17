// Shared comic-style SVG avatar used by the student, teacher and admin dashboards.
// buildAvatarSVG(avatar, prefix, { defaultShirt }) returns SVG markup.
// The eyes/face follow the cursor (or finger) on every .avatar-svg on the page.

function shadeAvatarColor(hex, percent) {
    let value = String(hex || '').replace('#', '');
    if (value.length === 3) value = value.split('').map((c) => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(value)) value = '4caf50';
    const num = parseInt(value, 16);
    const mix = (channel) => {
        const target = percent < 0 ? 0 : 255;
        return Math.round(channel + (target - channel) * Math.abs(percent) / 100);
    };
    const r = mix(num >> 16), g = mix((num >> 8) & 255), b = mix(num & 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function buildAvatarSVG(avatar, prefix, options) {
    const opts = options || {};
    const safeColor = (c, fallback) => /^#[0-9a-fA-F]{3,6}$/.test(String(c || '')) ? c : fallback;
    const defaultShirt = opts.defaultShirt || '#4caf50';
    const shirt = !avatar || avatar.shirt === 'default' ? defaultShirt : safeColor(avatar.shirt, defaultShirt);
    const hair = safeColor(avatar && avatar.hairColor, '#3e2723');
    const hairStyle = (avatar && avatar.hairStyle) || 'none';
    const hat = (avatar && avatar.hat) || 'none';
    const ink = '#1f1410';
    const line = `stroke="${ink}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"`;
    const shirtShade = shadeAvatarColor(shirt, -22);
    const skin = '#ffd2b3';
    const skinShade = '#f2ae8a';

    const hairBack = hairStyle === 'long'
        ? `<path d="M26 56 Q22 22 60 19 Q98 22 94 56 L97 106 Q88 112 80 106 L80 72 L40 72 L40 106 Q32 112 23 106 Z" fill="${hair}" ${line}/>`
        : '';

    const hairFront = {
        short: `<path d="M27 56 Q24 18 60 17 Q96 18 93 56 Q88 42 78 39 Q68 47 56 40 Q46 46 38 40 Q30 45 27 56 Z" fill="${hair}" ${line}/>`,
        long: `<path d="M27 60 Q23 18 60 17 Q97 18 93 60 Q88 42 74 38 Q64 46 52 39 Q40 40 34 48 Q30 52 27 60 Z" fill="${hair}" ${line}/>`,
        spiky: `<path d="M27 56 L21 36 L33 39 L30 21 L44 30 L48 11 L58 26 L68 10 L73 28 L88 19 L86 38 L99 35 L93 56 Q88 43 78 40 Q68 47 58 41 Q47 47 38 40 Q30 45 27 56 Z" fill="${hair}" ${line}/>`
    }[hairStyle] || '';
    const hairShine = hairStyle !== 'none'
        ? `<path d="M42 26 Q50 22 58 23" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>`
        : '';

    const backpackBack = hat === 'backpack'
        ? `<rect x="25" y="88" width="70" height="44" rx="14" fill="#a1887f" ${line}/>`
        : '';
    const backpackFront = hat === 'backpack'
        ? `<path d="M44 95 Q38 112 40 130" stroke="${ink}" stroke-width="8" fill="none" stroke-linecap="round"/>
           <path d="M44 95 Q38 112 40 130" stroke="#795548" stroke-width="4" fill="none" stroke-linecap="round"/>
           <path d="M76 95 Q82 112 80 130" stroke="${ink}" stroke-width="8" fill="none" stroke-linecap="round"/>
           <path d="M76 95 Q82 112 80 130" stroke="#795548" stroke-width="4" fill="none" stroke-linecap="round"/>`
        : '';

    // Glasses sit on the face, so they move together with the eyes
    const glasses = hat === 'glasses'
        ? `<circle cx="49" cy="58" r="9" fill="#fff" fill-opacity=".25" stroke="${ink}" stroke-width="3"/>
           <circle cx="71" cy="58" r="9" fill="#fff" fill-opacity=".25" stroke="${ink}" stroke-width="3"/>
           <path d="M58 57 Q60 55 62 57" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`
        : '';

    const headwear = {
        cap: `<path d="M60 46 Q92 40 110 51 Q96 58 68 54 Z" fill="#283593" ${line}/>
              <path d="M25 51 Q26 13 60 13 Q94 13 95 51 Q60 43 25 51 Z" fill="#3949ab" ${line}/>
              <circle cx="60" cy="13" r="3.5" fill="#3949ab" ${line}/>
              <path d="M40 22 Q48 18 56 18" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/>`,
        headphones: `<path d="M24 58 Q23 11 60 11 Q97 11 96 58" stroke="${ink}" stroke-width="10" fill="none" stroke-linecap="round"/>
                     <path d="M24 58 Q23 11 60 11 Q97 11 96 58" stroke="#ff7043" stroke-width="4" fill="none" stroke-linecap="round"/>
                     <rect x="15" y="46" width="17" height="26" rx="8" fill="#ff7043" ${line}/>
                     <rect x="88" y="46" width="17" height="26" rx="8" fill="#ff7043" ${line}/>`,
        graduation: `<path d="M34 30 L34 42 Q60 50 86 42 L86 30 Z" fill="#263238" ${line}/>
                     <path d="M60 12 L104 26 L60 40 L16 26 Z" fill="#37474f" ${line}/>
                     <path d="M60 26 L94 30 L94 48" stroke="#ffca28" stroke-width="2.6" fill="none" stroke-linecap="round"/>
                     <circle cx="94" cy="50" r="3.5" fill="#ffca28" stroke="${ink}" stroke-width="2"/>`,
        crown: `<path d="M32 34 L30 10 L44 22 L52 4 L60 20 L68 4 L76 22 L90 10 L88 34 Q60 28 32 34 Z" fill="#ffca28" ${line}/>
                <circle cx="52" cy="4" r="3" fill="#ffca28" ${line}/>
                <circle cx="68" cy="4" r="3" fill="#ffca28" ${line}/>
                <circle cx="60" cy="27" r="3.4" fill="#e53935" stroke="${ink}" stroke-width="2"/>
                <circle cx="44" cy="29" r="2.6" fill="#1e88e5" stroke="${ink}" stroke-width="2"/>
                <circle cx="76" cy="29" r="2.6" fill="#1e88e5" stroke="${ink}" stroke-width="2"/>`,
        tophat: `<path d="M38 34 L40 2 Q60 -2 80 2 L82 34 Z" fill="#263238" ${line}/>
                 <path d="M39.5 24 L80.5 24 L81 31 L39 31 Z" fill="#c62828"/>
                 <path d="M24 36 Q60 26 96 36 Q60 44 24 36 Z" fill="#263238" ${line}/>
                 <path d="M46 8 L46 20" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/>`
    }[hat] || '';

    return `
    <svg class="avatar-svg avatar-comic" viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Avatar" data-avatar-id="${prefix}">
        <ellipse cx="60" cy="136" rx="32" ry="4" fill="${ink}" opacity=".15"/>
        ${backpackBack}
        ${hairBack}

        <!-- body -->
        <path d="M29 134 Q27 103 42 95 Q60 87 78 95 Q93 103 91 134 Z" fill="${shirt}" ${line}/>
        <path d="M33 132 Q32 110 40 101 Q37 116 42 132 Z" fill="${shirtShade}"/>
        <path d="M45 95 Q60 107 75 95" fill="none" ${line}/>
        ${backpackFront}

        <!-- neck -->
        <path d="M53 84 L53 96 Q60 100 67 96 L67 84 Z" fill="${skinShade}" ${line}/>

        <!-- ears + head -->
        <ellipse cx="29" cy="59" rx="6" ry="7.5" fill="${skin}" ${line}/>
        <ellipse cx="91" cy="59" rx="6" ry="7.5" fill="${skin}" ${line}/>
        <ellipse cx="60" cy="54" rx="31" ry="32" fill="${skin}" ${line}/>
        <path d="M78 30 Q93 46 88 70 Q84 80 74 84 Q86 70 84 52 Q83 40 78 30 Z" fill="${skinShade}" opacity=".7"/>

        <!-- face: simple comic (follows the cursor) -->
        <g class="avatar-face">
            <g class="avatar-pupils">
                <g class="avatar-eyes">
                    <ellipse cx="49" cy="58" rx="3.6" ry="5" fill="${ink}"/>
                    <ellipse cx="71" cy="58" rx="3.6" ry="5" fill="${ink}"/>
                </g>
            </g>
            <path d="M51 70 Q60 78 69 70" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/>
            ${glasses}
        </g>

        ${hairFront}
        ${hairShine}
        ${headwear}
    </svg>`;
}

// Eyes follow the cursor / finger
(function initAvatarLook() {
    let pointer = null;
    let frameRequested = false;

    function applyLook() {
        frameRequested = false;
        document.querySelectorAll('.avatar-svg').forEach((svg) => {
            const face = svg.querySelector('.avatar-face');
            const pupils = svg.querySelector('.avatar-pupils');
            if (!face || !pupils) return;

            let nx = 0;
            let ny = 0;
            if (pointer) {
                const rect = svg.getBoundingClientRect();
                // Eyes sit at ~41% of the avatar height
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height * 0.41;
                const dx = pointer.x - cx;
                const dy = pointer.y - cy;
                const dist = Math.hypot(dx, dy) || 1;
                const strength = Math.min(dist / 160, 1);
                nx = (dx / dist) * strength;
                ny = (dy / dist) * strength;
            }
            face.style.transform = `translate(${(nx * 3).toFixed(2)}px, ${(ny * 2.5).toFixed(2)}px)`;
            pupils.style.transform = `translate(${(nx * 2.5).toFixed(2)}px, ${(ny * 2).toFixed(2)}px)`;
        });
    }

    function requestLook() {
        if (!frameRequested) {
            frameRequested = true;
            requestAnimationFrame(applyLook);
        }
    }

    document.addEventListener('pointermove', (event) => {
        pointer = { x: event.clientX, y: event.clientY };
        requestLook();
    }, { passive: true });

    document.addEventListener('touchmove', (event) => {
        const touch = event.touches && event.touches[0];
        if (touch) {
            pointer = { x: touch.clientX, y: touch.clientY };
            requestLook();
        }
    }, { passive: true });

    document.documentElement.addEventListener('pointerleave', () => {
        pointer = null;
        requestLook();
    });

    window.addEventListener('scroll', requestLook, { passive: true });
})();
