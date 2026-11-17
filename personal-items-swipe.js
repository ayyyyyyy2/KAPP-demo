// Horizontal navigation from the main panel:
//  - scroll/swipe right  -> Personal Items (slides in from the right)
//  - scroll/swipe left   -> Student Space (slides in from the left, student dashboard only)
// The opposite gesture closes whichever page is open.
(function initPersonalItemsSwipe() {
    const SWIPE_MIN = 60;          // px of horizontal finger travel
    const WHEEL_MIN = 90;          // accumulated trackpad deltaX
    const IGNORE = 'input, textarea, select, canvas, .snake-board, .roadmap-track, .roadmap-avatar-shell, .modal';

    const panel = () => document.getElementById('personalItemsTab');
    const isOpen = () => !!(panel() && panel().classList.contains('open'));
    const anyModalOpen = () => Array.from(document.querySelectorAll('.modal'))
        .some((m) => m.style.display === 'block' || m.style.display === 'flex');

    const spaceOpen = () => typeof window.isStudentSpaceOpen === 'function' && window.isStudentSpaceOpen();

    // Content moves left (finger right -> left, trackpad scroll right)
    function goRight() {
        if (spaceOpen()) {
            window.closeStudentSpace();
            return;
        }
        if (!isOpen() && !anyModalOpen() && typeof window.openPersonalItemsTab === 'function') {
            window.openPersonalItemsTab();
        }
    }

    // Content moves right (finger left -> right, trackpad scroll left)
    function goLeft() {
        if (isOpen()) {
            if (typeof window.closePersonalItemsTab === 'function') window.closePersonalItemsTab();
            return;
        }
        if (!spaceOpen() && !anyModalOpen() && typeof window.openStudentSpace === 'function') {
            window.openStudentSpace();
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
            goRight(); // finger moves right -> left
        } else {
            goLeft();  // finger moves left -> right
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
            goRight();
        } else if (wheelSum < -WHEEL_MIN) {
            wheelSum = 0;
            goLeft();
        }
    }, { passive: true });
})();
