// Open the Personal Items panel (slides in from the right) by scrolling/swiping right,
// and close it again by swiping back. Replaces the old 👜 button.
(function initPersonalItemsSwipe() {
    const SWIPE_MIN = 60;          // px of horizontal finger travel
    const WHEEL_MIN = 90;          // accumulated trackpad deltaX
    const IGNORE = 'input, textarea, select, canvas, .snake-board, .roadmap-track, .roadmap-avatar-shell, .modal';

    const panel = () => document.getElementById('personalItemsTab');
    const isOpen = () => !!(panel() && panel().classList.contains('open'));
    const anyModalOpen = () => Array.from(document.querySelectorAll('.modal'))
        .some((m) => m.style.display === 'block' || m.style.display === 'flex');

    function open() {
        if (!isOpen() && !anyModalOpen() && typeof window.openPersonalItemsTab === 'function') {
            window.openPersonalItemsTab();
        }
    }

    function close() {
        if (isOpen() && typeof window.closePersonalItemsTab === 'function') {
            window.closePersonalItemsTab();
        }
    }

    // ---- Touch (phone) ----
    let start = null;

    document.addEventListener('touchstart', (event) => {
        const touch = event.touches[0];
        if (!touch || event.touches.length > 1 || event.target.closest(IGNORE)) {
            start = null;
            return;
        }
        start = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });

    document.addEventListener('touchend', (event) => {
        if (!start) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        start = null;
        if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;

        if (dx < 0) {
            open();   // finger moves right -> left: scroll to the right
        } else {
            close();  // finger moves left -> right: go back
        }
    }, { passive: true });

    // ---- Trackpad / horizontal wheel (desktop) ----
    let wheelSum = 0;
    let wheelTimer = null;

    document.addEventListener('wheel', (event) => {
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        if (event.target.closest(IGNORE)) return;

        wheelSum += event.deltaX;
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => { wheelSum = 0; }, 200);

        if (wheelSum > WHEEL_MIN) {
            wheelSum = 0;
            open();
        } else if (wheelSum < -WHEEL_MIN) {
            wheelSum = 0;
            close();
        }
    }, { passive: true });
})();
