// After login: show pending banana offers one by one as a centred liquid-glass popup.
// Uses the page's own claimOffer(offerId, { silent: true }) and currentUserEmail.
(function initOfferPopup() {
    const SEEN_KEY = 'kapp-offer-popup-seen';
    let queue = [];
    let current = null;
    let busy = false;

    const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    function getSeen() {
        try { return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]')); } catch (_) { return new Set(); }
    }

    function markSeen(id) {
        try {
            const seen = getSeen();
            seen.add(String(id));
            sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
        } catch (_) {}
    }

    function ensureMarkup() {
        let overlay = document.getElementById('offerPopup');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'offerPopup';
        overlay.className = 'offer-popup-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'offerPopupTitle');
        overlay.innerHTML = `
            <div class="offer-popup-card">
                <button type="button" class="offer-popup-close" aria-label="Close">&times;</button>
                <div class="offer-popup-eyebrow">🎉 New offer for you</div>
                <div class="offer-popup-points"><span id="offerPopupPoints">0</span> 🍌</div>
                <h2 id="offerPopupTitle" class="offer-popup-title"></h2>
                <p id="offerPopupDescription" class="offer-popup-description"></p>
                <p id="offerPopupFrom" class="offer-popup-from"></p>
                <div class="offer-popup-actions">
                    <button type="button" class="offer-popup-later">Later</button>
                    <button type="button" class="offer-popup-claim">Claim bananas</button>
                </div>
                <p id="offerPopupMore" class="offer-popup-more"></p>
            </div>`;
        document.body.appendChild(overlay);

        overlay.querySelector('.offer-popup-close').addEventListener('click', dismiss);
        overlay.querySelector('.offer-popup-later').addEventListener('click', dismiss);
        overlay.querySelector('.offer-popup-claim').addEventListener('click', claim);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) dismiss();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && overlay.classList.contains('is-open')) dismiss();
        });
        return overlay;
    }

    function render() {
        const overlay = ensureMarkup();
        current = queue.shift() || null;
        if (!current) {
            overlay.classList.remove('is-open');
            return;
        }
        overlay.querySelector('#offerPopupPoints').textContent = Number(current.points_amount || 0);
        overlay.querySelector('#offerPopupTitle').textContent = current.title || 'Banana offer';
        const description = overlay.querySelector('#offerPopupDescription');
        description.textContent = current.description ? `"${current.description}"` : '';
        description.style.display = current.description ? '' : 'none';
        overlay.querySelector('#offerPopupFrom').innerHTML = current.sent_by ? `From <strong>${escape(current.sent_by)}</strong>` : '';
        overlay.querySelector('#offerPopupMore').textContent = queue.length
            ? `+${queue.length} more offer${queue.length > 1 ? 's' : ''} waiting`
            : '';
        const claimButton = overlay.querySelector('.offer-popup-claim');
        claimButton.disabled = false;
        claimButton.textContent = 'Claim bananas';

        overlay.classList.remove('is-open');
        void overlay.offsetWidth; // restart the entrance animation
        overlay.classList.add('is-open');
        claimButton.focus({ preventScroll: true });
    }

    function dismiss() {
        if (busy) return;
        if (current) markSeen(current.offer_id);
        render();
    }

    async function claim() {
        if (busy || !current || typeof window.claimOffer !== 'function') return;
        busy = true;
        const button = document.querySelector('#offerPopup .offer-popup-claim');
        button.disabled = true;
        button.textContent = 'Claiming…';
        const offerId = current.offer_id;
        try {
            const ok = await window.claimOffer(offerId, { silent: true });
            markSeen(offerId);
            if (ok === false) {
                button.disabled = false;
                button.textContent = 'Claim bananas';
                busy = false;
                return;
            }
        } catch (_) {}
        busy = false;
        render();
    }

    async function checkForOffers() {
        let email = '';
        try { email = typeof currentUserEmail === 'string' ? currentUserEmail : ''; } catch (_) {}
        if (!email) return;
        try {
            const response = await fetch(`/get-offers/${encodeURIComponent(email)}`);
            const result = await response.json();
            if (!result || !result.success || !Array.isArray(result.offers)) return;
            const seen = getSeen();
            queue = result.offers.filter((offer) => offer && offer.offer_id && !seen.has(String(offer.offer_id)));
            if (queue.length) render();
        } catch (_) {}
    }

    window.showOfferPopupFor = function showOfferPopupFor(offers) {
        queue = Array.isArray(offers) ? offers.slice() : [];
        render();
    };

    window.addEventListener('load', () => setTimeout(checkForOffers, 600));
})();
