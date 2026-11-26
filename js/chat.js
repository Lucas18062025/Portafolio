(function initPortfolioChat() {
    'use strict';

    const MAX_CHARS = 500;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const toggleBtn = document.getElementById('chat-toggle');
    const widget = document.getElementById('chat-widget');
    const closeBtn = document.getElementById('chat-close');
    const messagesBox = document.getElementById('chat-messages');
    const threadDivider = document.getElementById('chat-thread-divider');
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');
    const submitBtn = document.getElementById('chat-btn');
    const charCountEl = document.getElementById('chat-char-count');
    const discoveryCards = document.querySelectorAll('.chat-card');

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

        const diamond = document.createElementNS(SVG_NS, 'polygon');
        diamond.setAttribute('points', '12 3 21 12 12 21 3 12');

        const core = document.createElementNS(SVG_NS, 'circle');
        core.setAttribute('cx', '12');
        core.setAttribute('cy', '12');
        core.setAttribute('r', '2.4');
        core.setAttribute('class', 'ai-core-node');

        svg.appendChild(diamond);
        svg.appendChild(core);
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
        label.textContent = 'Procesando consulta…';

        const frag = document.createDocumentFragment();
        frag.appendChild(container);
        frag.appendChild(label);
        return frag;
    }

    function scrollToBottom() {
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    function ensureThreadDivider() {
        if (threadDivider && threadDivider.hidden) {
            threadDivider.hidden = false;
        }
    }

    const PORTFOLIO_LINK_RE = /(https:\/\/portafolio\.lucaslean1806\.workers\.dev\/[^\s)]*)/g;

    function renderSafeMessage(container, text) {
        container.textContent = '';
        const parts = String(text).split(PORTFOLIO_LINK_RE);
        for (const part of parts) {
            if (!part) continue;
            if (part.startsWith('https://portafolio.lucaslean1806.workers.dev/')) {
                const cleanUrl = part.replace(/[.,;:!?]+$/, '');
                const trailing = part.slice(cleanUrl.length);
                const a = document.createElement('a');
                a.className = 'chat-link';
                a.href = cleanUrl;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = cleanUrl.replace('https://portafolio.lucaslean1806.workers.dev', '');
                container.appendChild(a);
                if (trailing) {
                    container.appendChild(document.createTextNode(trailing));
                }
            } else {
                container.appendChild(document.createTextNode(part));
            }
        }
    }

    function addMessageRow(text, role, extraClass) {
        ensureThreadDivider();

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
        } else if (role === 'user') {
            bubble.textContent = text; // Proteccion XSS: solo textContent
        } else {
            renderSafeMessage(bubble, text);
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
        discoveryCards.forEach(function toggleCard(card) {
            card.disabled = busy;
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
                renderSafeMessage(pendingBubble, data.reply);
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

    discoveryCards.forEach(function bindCard(card) {
        card.addEventListener('click', function onCardClick() {
            const prompt = card.getAttribute('data-prompt') || '';
            if (prompt) {
                sendMessage(prompt);
            }
        });
    });

    document.addEventListener('keydown', function onDocumentKeyDown(event) {
        if (event.key === 'Escape' && !widget.hidden) {
            closeChat();
        }
    });

    updateInputControls();
})();
