(function initPortfolioChat() {
    'use strict';

    const MAX_CHARS = 500;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const toggleBtn = document.getElementById('chat-toggle');
    const widget = document.getElementById('chat-widget');
    const closeBtn = document.getElementById('chat-close');
    const messagesBox = document.getElementById('chat-messages');
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');
    const submitBtn = document.getElementById('chat-btn');
    const charCountEl = document.getElementById('chat-char-count');
    const quickChips = document.querySelectorAll('.chat-chip');

    if (!toggleBtn || !widget || !closeBtn || !messagesBox || !form || !input || !submitBtn) {
        return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let isSending = false;
    let closeTimer = null;

    function createBotAvatar() {
        const wrap = document.createElement('span');
        wrap.className = 'chat-msg-avatar';
        wrap.setAttribute('aria-hidden', 'true');

        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');

        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute(
            'd',
            'M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z'
        );

        svg.appendChild(path);
        wrap.appendChild(svg);
        return wrap;
    }

    function createTypingIndicator() {
        const container = document.createElement('span');
        container.className = 'chat-typing-dots';
        container.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 3; i += 1) {
            container.appendChild(document.createElement('span'));
        }

        const label = document.createElement('span');
        label.className = 'chat-typing-label';
        label.textContent = 'Procesando…';

        const frag = document.createDocumentFragment();
        frag.appendChild(container);
        frag.appendChild(label);
        return frag;
    }

    function scrollToBottom() {
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    function addMessageRow(text, role, extraClass) {
        const row = document.createElement('div');
        row.className = 'chat-row ' + (role === 'user' ? 'chat-row-user' : 'chat-row-bot');

        if (role !== 'user') {
            row.appendChild(createBotAvatar());
        }

        const bubble = document.createElement('div');
        bubble.className = 'chat-msg ' + (role === 'user' ? 'chat-msg-user' : 'chat-msg-bot');
        if (extraClass) {
            bubble.classList.add(extraClass);
        }

        if (extraClass === 'chat-msg-pending') {
            bubble.appendChild(createTypingIndicator());
        } else {
            bubble.textContent = text; // Proteccion XSS: solo textContent
        }

        row.appendChild(bubble);
        messagesBox.appendChild(row);
        scrollToBottom();
        return bubble;
    }

    function updateInputControls() {
        const len = input.value.length;
        const hasContent = input.value.trim().length > 0;
        submitBtn.disabled = isSending || !hasContent;

        if (charCountEl) {
            if (len >= 380) {
                charCountEl.textContent = len + '/' + MAX_CHARS;
                charCountEl.hidden = false;
                charCountEl.classList.toggle('is-near-limit', len >= 450);
            } else {
                charCountEl.hidden = true;
                charCountEl.textContent = '';
            }
        }
    }

    function setBusyState(busy) {
        isSending = busy;
        input.disabled = busy;
        quickChips.forEach(function toggleChip(chip) {
            chip.disabled = busy;
        });
        updateInputControls();
    }

    function openChat() {
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
        widget.hidden = false;
        toggleBtn.hidden = true;
        toggleBtn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('chat-open-mobile');

        if (reducedMotion.matches) {
            widget.classList.add('is-open');
        } else {
            window.requestAnimationFrame(function animateOpen() {
                widget.classList.add('is-open');
            });
        }

        scrollToBottom();
        input.focus();
    }

    function closeChat() {
        widget.classList.remove('is-open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('chat-open-mobile');

        const finishClose = function hidePanel() {
            widget.hidden = true;
            toggleBtn.hidden = false;
            toggleBtn.focus();
        };

        if (reducedMotion.matches) {
            finishClose();
        } else {
            closeTimer = window.setTimeout(finishClose, 200);
        }
    }

    async function sendMessage(rawText) {
        const text = rawText.trim().slice(0, MAX_CHARS);
        if (!text || isSending) return;

        addMessageRow(text, 'user');
        input.value = '';
        setBusyState(true);

        const pendingBubble = addMessageRow('', 'bot', 'chat-msg-pending');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            let data = null;
            try {
                data = await response.json();
            } catch {
                data = null;
            }

            pendingBubble.classList.remove('chat-msg-pending');
            if (data && typeof data.reply === 'string' && data.reply.trim()) {
                pendingBubble.textContent = data.reply;
                if (!response.ok) {
                    pendingBubble.classList.add('chat-msg-error');
                }
            } else if (data && typeof data.error === 'string' && data.error.trim()) {
                pendingBubble.classList.add('chat-msg-error');
                pendingBubble.textContent = data.error;
            } else {
                pendingBubble.classList.add('chat-msg-error');
                pendingBubble.textContent = 'No se pudo obtener una respuesta en este momento.';
            }
        } catch {
            pendingBubble.classList.remove('chat-msg-pending');
            pendingBubble.classList.add('chat-msg-error');
            pendingBubble.textContent = 'Error de conexión. Intentá nuevamente en unos segundos.';
        } finally {
            setBusyState(false);
            scrollToBottom();
            input.focus();
        }
    }

    toggleBtn.addEventListener('click', openChat);
    closeBtn.addEventListener('click', closeChat);

    form.addEventListener('submit', function onSubmit(event) {
        event.preventDefault();
        sendMessage(input.value);
    });

    input.addEventListener('input', updateInputControls);

    input.addEventListener('keydown', function onInputKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            sendMessage(input.value);
        }
    });

    quickChips.forEach(function bindChip(chip) {
        chip.addEventListener('click', function onChipClick() {
            const prompt = chip.getAttribute('data-prompt') || chip.textContent || '';
            sendMessage(prompt);
        });
    });

    document.addEventListener('keydown', function onDocumentKeyDown(event) {
        if (event.key === 'Escape' && !widget.hidden) {
            closeChat();
        }
    });

    updateInputControls();
})();
