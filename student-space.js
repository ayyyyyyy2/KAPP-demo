// Post wall page (Student Space / Teacher Space): newest posts first, composer on top.
// Opened by scrolling/swiping left on the main panel (see personal-items-swipe.js).
// The API route comes from data-endpoint on #studentSpaceTab (default /student-posts).
(function initStudentSpace() {
    const PAGE_SIZE = 15;
    const MAX_TEXT = 1000;
    const MAX_IMAGE_SIDE = 1280;
    const MAX_IMAGE_CHARS = 1.4 * 1024 * 1024;

    let posts = [];
    let hasMore = true;
    let loading = false;
    let loadedOnce = false;
    let pendingImage = '';
    let posting = false;
    let feedVersion = 0; // bumped when switching between spaces, so stale responses are ignored
    const openComments = new Set(); // post ids whose comment section is expanded

    const $ = (id) => document.getElementById(id);
    const endpoint = () => ($('studentSpaceTab') && $('studentSpaceTab').dataset.endpoint) || '/student-posts';

    function viewerEmail() {
        try {
            if (typeof resolveCurrentUserEmail === 'function') return resolveCurrentUserEmail() || '';
        } catch (_) {}
        try { return typeof currentUserEmail === 'string' ? currentUserEmail : ''; } catch (_) { return ''; }
    }

    function viewerAvatar() {
        try { return typeof currentAvatar === 'object' && currentAvatar ? currentAvatar : {}; } catch (_) { return {}; }
    }

    function apiUrl(path, query) {
        if (typeof buildApiUrl === 'function') return buildApiUrl(path, query || {});
        const url = new URL(path, window.location.origin);
        Object.entries(query || {}).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
        return url.toString();
    }

    function timeAgo(value) {
        const date = new Date(value);
        const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
        if (seconds < 60) return 'now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`;
        return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
    }

    const ROLE_SHIRTS = { user: '#4caf50', teacher: '#ff9800', admin: '#1a237e' };
    const ROLE_LABELS = { teacher: 'Teacher', admin: 'Admin' };

    function avatarMarkup(avatar, key, role) {
        if (typeof buildAvatarSVG !== 'function') return '🙂';
        return buildAvatarSVG(avatar || {}, key, { defaultShirt: ROLE_SHIRTS[role] || ROLE_SHIRTS.user });
    }

    function viewerAvatarOptions() {
        try { return typeof AVATAR_OPTIONS === 'object' && AVATAR_OPTIONS ? AVATAR_OPTIONS : {}; } catch (_) { return {}; }
    }

    // ---------- open / close ----------
    function isOpen() {
        return $('studentSpaceTab') && $('studentSpaceTab').classList.contains('open');
    }

    window.openStudentSpace = function openStudentSpace() {
        const tab = $('studentSpaceTab');
        if (!tab || isOpen()) return;
        tab.classList.add('open');
        tab.setAttribute('aria-hidden', 'false');
        $('studentSpaceComposerAvatar').innerHTML = typeof buildAvatarSVG === 'function'
            ? buildAvatarSVG(viewerAvatar(), 'ss-me', viewerAvatarOptions())
            : '🙂';
        if (!loadedOnce) {
            refreshFeed();
        }
    };

    window.closeStudentSpace = function closeStudentSpace() {
        const tab = $('studentSpaceTab');
        if (!tab) return;
        tab.classList.remove('open');
        tab.setAttribute('aria-hidden', 'true');
    };

    window.isStudentSpaceOpen = isOpen;

    // ---------- feed ----------
    function renderPost(post) {
        const article = document.createElement('article');
        article.className = 'ss-post' + (post.is_mine ? ' is-mine' : '');
        article.dataset.postId = post.post_id;

        const avatar = document.createElement('div');
        avatar.className = 'ss-avatar';
        avatar.innerHTML = avatarMarkup(post.author_avatar, `ss-${post.post_id}`, post.author_role);

        const body = document.createElement('div');
        body.className = 'ss-post-body';

        const head = document.createElement('div');
        head.className = 'ss-post-head';
        const name = document.createElement('strong');
        name.className = 'ss-post-name';
        name.textContent = post.author_name || 'Student';
        const time = document.createElement('time');
        time.className = 'ss-post-time';
        time.dateTime = post.createdAt;
        time.title = new Date(post.createdAt).toLocaleString();
        time.textContent = `· ${timeAgo(post.createdAt)}`;
        head.append(name);
        if (ROLE_LABELS[post.author_role]) {
            const role = document.createElement('span');
            role.className = `ss-post-role is-${post.author_role}`;
            role.textContent = ROLE_LABELS[post.author_role];
            head.append(role);
        }
        if (post.is_mine) {
            const you = document.createElement('span');
            you.className = 'ss-post-you';
            you.textContent = 'You';
            head.append(you);
        }
        head.append(time);
        body.append(head);

        if (post.text) {
            const text = document.createElement('p');
            text.className = 'ss-post-text';
            text.textContent = post.text;
            body.append(text);
        }

        if (post.image) {
            const img = document.createElement('img');
            img.className = 'ss-post-image';
            img.src = post.image;
            img.alt = post.text ? `Photo: ${post.text.slice(0, 80)}` : `Photo shared by ${post.author_name || 'a student'}`;
            img.loading = 'lazy';
            body.append(img);
        }

        body.append(renderActions(post), renderComments(post));

        article.append(avatar, body);
        attachDoubleTap(article, post);
        return article;
    }

    // ---------- likes ----------
    function renderActions(post) {
        const bar = document.createElement('div');
        bar.className = 'ss-actions';

        const like = document.createElement('button');
        like.type = 'button';
        like.className = 'ss-action-btn ss-like-btn';
        like.addEventListener('click', () => toggleLike(post));

        const comment = document.createElement('button');
        comment.type = 'button';
        comment.className = 'ss-action-btn ss-comment-btn';
        comment.addEventListener('click', () => toggleComments(post));

        bar.append(like, comment);
        updateActions(bar, post);
        return bar;
    }

    function updateActions(bar, post) {
        const like = bar.querySelector('.ss-like-btn');
        const liked = Boolean(post.liked_by_me);
        like.classList.toggle('is-liked', liked);
        like.setAttribute('aria-pressed', String(liked));
        like.setAttribute('aria-label', liked ? 'Unlike' : 'Like');
        like.innerHTML = `<span class="ss-heart" aria-hidden="true">${liked ? '❤️' : '🤍'}</span><span class="ss-count">${post.like_count || ''}</span>`;

        const comment = bar.querySelector('.ss-comment-btn');
        const count = (post.comments || []).length;
        comment.setAttribute('aria-expanded', String(openComments.has(post.post_id)));
        comment.setAttribute('aria-label', 'Comments');
        comment.innerHTML = `<span aria-hidden="true">💬</span><span class="ss-count">${count || ''}</span>`;
    }

    function findArticle(postId) {
        return document.querySelector(`#studentSpaceFeed .ss-post[data-post-id="${CSS.escape(postId)}"]`);
    }

    function refreshActions(post) {
        const article = findArticle(post.post_id);
        const bar = article && article.querySelector('.ss-actions');
        if (bar) updateActions(bar, post);
    }

    async function toggleLike(post, forceLike = false) {
        const wantLiked = forceLike ? true : !post.liked_by_me;
        if (wantLiked === Boolean(post.liked_by_me)) return;

        // Optimistic update
        post.liked_by_me = wantLiked;
        post.like_count = Math.max(0, (post.like_count || 0) + (wantLiked ? 1 : -1));
        refreshActions(post);
        const heart = findArticle(post.post_id)?.querySelector('.ss-like-btn .ss-heart');
        if (wantLiked && heart && heart.animate) {
            heart.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.45)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
        }

        try {
            const response = await fetch(apiUrl(`${endpoint()}/${encodeURIComponent(post.post_id)}/like`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: viewerEmail(), liked: wantLiked })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            post.liked_by_me = result.liked;
            post.like_count = result.like_count;
        } catch (_) {
            post.liked_by_me = !wantLiked;
            post.like_count = Math.max(0, (post.like_count || 0) + (wantLiked ? -1 : 1));
        }
        refreshActions(post);
    }

    // Double tap (or double click) anywhere on the post = like, with a big heart
    function attachDoubleTap(article, post) {
        let lastTap = 0;
        let lastX = 0;
        let lastY = 0;
        article.addEventListener('pointerup', (event) => {
            if (event.target.closest('button, input, textarea, a, label, .ss-comments')) return;
            const now = Date.now();
            const near = Math.abs(event.clientX - lastX) < 30 && Math.abs(event.clientY - lastY) < 30;
            if (now - lastTap < 320 && near) {
                lastTap = 0;
                showHeartBurst(article, event.clientX, event.clientY);
                toggleLike(post, true);
                return;
            }
            lastTap = now;
            lastX = event.clientX;
            lastY = event.clientY;
        });
    }

    function showHeartBurst(article, x, y) {
        const rect = article.getBoundingClientRect();
        const heart = document.createElement('span');
        heart.className = 'ss-heart-burst';
        heart.textContent = '❤️';
        heart.style.left = `${x - rect.left}px`;
        heart.style.top = `${y - rect.top}px`;
        article.append(heart);
        const animation = heart.animate([
            { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 1, offset: 0.25 },
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.6 },
            { transform: 'translate(-50%, -90%) scale(0.9)', opacity: 0 }
        ], { duration: 800, easing: 'ease-out' });
        animation.onfinish = () => heart.remove();
    }

    // ---------- comments ----------
    function renderComment(comment) {
        const item = document.createElement('div');
        item.className = 'ss-comment' + (comment.is_mine ? ' is-mine' : '');

        const avatar = document.createElement('div');
        avatar.className = 'ss-avatar ss-avatar-sm';
        avatar.innerHTML = avatarMarkup(comment.author_avatar, `ssc-${comment.comment_id}`, comment.author_role);

        const bubble = document.createElement('div');
        bubble.className = 'ss-comment-bubble';
        const head = document.createElement('div');
        head.className = 'ss-comment-head';
        const name = document.createElement('strong');
        name.textContent = comment.author_name || 'User';
        head.append(name);
        if (ROLE_LABELS[comment.author_role]) {
            const role = document.createElement('span');
            role.className = `ss-post-role is-${comment.author_role}`;
            role.textContent = ROLE_LABELS[comment.author_role];
            head.append(role);
        }
        const time = document.createElement('time');
        time.className = 'ss-post-time';
        time.dateTime = comment.createdAt;
        time.textContent = `· ${timeAgo(comment.createdAt)}`;
        head.append(time);
        const text = document.createElement('p');
        text.className = 'ss-comment-text';
        text.textContent = comment.text;
        bubble.append(head, text);

        item.append(avatar, bubble);
        return item;
    }

    function renderComments(post) {
        const section = document.createElement('div');
        section.className = 'ss-comments';
        section.hidden = !openComments.has(post.post_id);

        const list = document.createElement('div');
        list.className = 'ss-comment-list';
        (post.comments || []).forEach((comment) => list.append(renderComment(comment)));

        const form = document.createElement('form');
        form.className = 'ss-comment-form';
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 500;
        input.placeholder = 'Write a comment…';
        input.setAttribute('aria-label', 'Write a comment');
        const send = document.createElement('button');
        send.type = 'submit';
        send.className = 'ss-comment-send';
        send.textContent = 'Send';
        const error = document.createElement('p');
        error.className = 'ss-error';
        error.hidden = true;
        form.append(input, send);
        form.addEventListener('submit', (event) => submitComment(event, post, input, send, error, list));

        section.append(list, form, error);
        return section;
    }

    function toggleComments(post) {
        const article = findArticle(post.post_id);
        if (!article) return;
        const section = article.querySelector('.ss-comments');
        const open = section.hidden;
        section.hidden = !open;
        if (open) {
            openComments.add(post.post_id);
            section.querySelector('input').focus({ preventScroll: true });
        } else {
            openComments.delete(post.post_id);
        }
        refreshActions(post);
    }

    async function submitComment(event, post, input, send, error, list) {
        event.preventDefault();
        const text = input.value.trim();
        if (!text || send.disabled) return;
        send.disabled = true;
        error.hidden = true;
        try {
            const response = await fetch(apiUrl(`${endpoint()}/${encodeURIComponent(post.post_id)}/comments`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: viewerEmail(), text })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || 'Failed to add comment');
            post.comments = (post.comments || []).concat(result.comment);
            const item = renderComment(result.comment);
            list.append(item);
            if (item.animate) item.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 250 });
            input.value = '';
            refreshActions(post);
        } catch (err) {
            error.textContent = err.message || 'Failed to add comment.';
            error.hidden = false;
        } finally {
            send.disabled = false;
        }
    }

    function renderFeed() {
        const list = $('studentSpaceFeed');
        list.innerHTML = '';
        if (!posts.length && !loading) {
            list.innerHTML = '<div class="ss-empty">No posts yet. Be the first to share something! ✨</div>';
        }
        posts.forEach((post) => list.append(renderPost(post)));
        $('studentSpaceMore').textContent = loading ? 'Loading…' : (hasMore && posts.length ? '' : (posts.length ? 'You’re all caught up 🎉' : ''));
    }

    async function loadPosts({ reset = false } = {}) {
        if (loading) return;
        if (!reset && !hasMore) return;
        loading = true;
        if (reset) {
            posts = [];
            hasMore = true;
        }
        renderFeed();
        const version = feedVersion;
        try {
            const query = { limit: PAGE_SIZE, viewer_email: viewerEmail() };
            if (!reset && posts.length) query.before = posts[posts.length - 1].createdAt;
            const response = await fetch(apiUrl(endpoint(), query));
            const result = await response.json();
            if (version !== feedVersion) return;
            if (!result.success) throw new Error(result.message || 'Failed to load posts');
            posts = posts.concat(result.posts || []);
            hasMore = Boolean(result.has_more);
            loadedOnce = true;
        } catch (error) {
            if (version !== feedVersion) return;
            const box = document.createElement('div');
            box.className = 'ss-empty';
            box.textContent = (error && error.message && error.message !== 'Failed to fetch')
                ? error.message
                : 'Couldn’t load posts right now.';
            $('studentSpaceFeed').replaceChildren(box);
            loading = false;
            $('studentSpaceMore').textContent = '';
            return;
        }
        loading = false;
        renderFeed();
    }

    function refreshFeed() {
        return loadPosts({ reset: true });
    }

    window.refreshStudentSpace = refreshFeed;

    // ---------- space switcher (admin: Student Space / Teacher Space) ----------
    function switchSpace(button) {
        const tab = $('studentSpaceTab');
        if (!tab || !button || button.getAttribute('aria-selected') === 'true') return;

        document.querySelectorAll('#studentSpaceSwitch [data-endpoint]').forEach((btn) => {
            btn.setAttribute('aria-selected', String(btn === button));
        });
        tab.dataset.endpoint = button.dataset.endpoint;
        tab.classList.toggle('teacher-space', button.dataset.theme === 'teacher');
        $('studentSpaceTitle').textContent = button.dataset.title || '';
        const subtitle = document.querySelector('#studentSpaceTab .student-space-subtitle');
        if (subtitle) subtitle.textContent = button.dataset.subtitle || '';
        $('studentSpaceText').placeholder = button.dataset.placeholder || 'What’s happening?';
        showError('');

        feedVersion += 1;
        openComments.clear();
        loading = false;
        loadedOnce = false;
        $('studentSpaceScroller').scrollTop = 0;
        refreshFeed();
    }

    // ---------- composer ----------
    function updateComposerState() {
        const text = $('studentSpaceText').value;
        const left = MAX_TEXT - text.length;
        const counter = $('studentSpaceCounter');
        counter.textContent = left <= 100 ? String(left) : '';
        counter.classList.toggle('is-over', left < 0);
        $('studentSpacePostBtn').disabled = posting || left < 0 || (!text.trim() && !pendingImage);
    }

    function autoGrow() {
        const area = $('studentSpaceText');
        area.style.height = 'auto';
        area.style.height = `${Math.min(area.scrollHeight, 220)}px`;
    }

    function showError(message) {
        const el = $('studentSpaceError');
        el.textContent = message || '';
        el.hidden = !message;
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unreadable image')); };
            img.src = url;
        });
    }

    // Resize + compress in the browser so posts stay small in MongoDB
    async function compressImage(file) {
        const img = await loadImage(file);
        const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let quality = 0.85;
        let data = canvas.toDataURL('image/jpeg', quality);
        while (data.length > MAX_IMAGE_CHARS && quality > 0.4) {
            quality -= 0.1;
            data = canvas.toDataURL('image/jpeg', quality);
        }
        if (data.length > MAX_IMAGE_CHARS) throw new Error('Photo is too large');
        return data;
    }

    async function handleFile(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showError('Please choose an image file.');
            return;
        }
        showError('');
        try {
            pendingImage = await compressImage(file);
            $('studentSpacePreviewImg').src = pendingImage;
            $('studentSpacePreview').hidden = false;
        } catch (_) {
            pendingImage = '';
            $('studentSpacePreview').hidden = true;
            showError('This photo can’t be used. Try another one.');
        }
        updateComposerState();
    }

    function removeImage() {
        pendingImage = '';
        $('studentSpacePreview').hidden = true;
        $('studentSpacePreviewImg').removeAttribute('src');
        updateComposerState();
    }

    async function submitPost(event) {
        event.preventDefault();
        if (posting) return;
        const text = $('studentSpaceText').value.trim();
        if (!text && !pendingImage) return;
        const email = viewerEmail();
        if (!email) {
            showError('Please log in again to post.');
            return;
        }

        posting = true;
        showError('');
        const button = $('studentSpacePostBtn');
        button.textContent = 'Posting…';
        updateComposerState();

        try {
            const response = await fetch(apiUrl(endpoint()), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, text, image: pendingImage })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || 'Failed to publish post');

            $('studentSpaceText').value = '';
            autoGrow();
            removeImage();
            posts.unshift(result.post);
            renderFeed();
            const first = $('studentSpaceFeed').firstElementChild;
            if (first && first.animate) {
                first.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
            }
        } catch (error) {
            showError(error.message || 'Failed to publish post.');
        } finally {
            posting = false;
            button.textContent = 'Post';
            updateComposerState();
        }
    }

    function init() {
        const tab = $('studentSpaceTab');
        if (!tab) return;

        $('studentSpaceForm').addEventListener('submit', submitPost);
        $('studentSpaceText').addEventListener('input', () => { autoGrow(); updateComposerState(); });
        $('studentSpaceFile').addEventListener('change', handleFile);
        $('studentSpaceRemoveImage').addEventListener('click', removeImage);
        $('studentSpaceRefresh').addEventListener('click', refreshFeed);
        $('studentSpaceClose').addEventListener('click', window.closeStudentSpace);
        document.querySelectorAll('#studentSpaceSwitch [data-endpoint]').forEach((button) => {
            button.addEventListener('click', () => switchSpace(button));
        });

        // Infinite scroll for older posts
        const scroller = $('studentSpaceScroller');
        scroller.addEventListener('scroll', () => {
            if (scroller.scrollTop + scroller.clientHeight > scroller.scrollHeight - 400) {
                loadPosts();
            }
        }, { passive: true });

        // Keep relative times fresh
        setInterval(() => {
            if (!isOpen()) return;
            document.querySelectorAll('#studentSpaceFeed .ss-post-time').forEach((el) => {
                el.textContent = `· ${timeAgo(el.dateTime)}`;
            });
        }, 60000);

        updateComposerState();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
