(function initPortfolioChat() {
    'use strict';

    const toggleBtn = document.getElementById('chat-toggle');
    const widget = document.getElementById('chat-widget');
    const closeBtn = document.getElementById('chat-close');
    const messagesBox = document.getElementById('chat-messages');
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');
    const submitBtn = document.getElementById('chat-btn');
    const quickChips = document.querySelectorAll('.chat-chip');

    if (!toggleBtn || !widget || !closeBtn || !messagesBox || !form || !input || !submitBtn) {
        return;
    }

    let welcomed = false;
    let isSending = false;

    function addMessage(text, role, extraClass) {
        const div = document.createElement('div');
        div.className = 'chat-msg ' + (role === 'user' ? 'chat-msg-user' : 'chat-msg-bot');
        if (extraClass) {
            div.classList.add(extraClass);
        }
        div.textContent = text; // Evita inyeccion XSS
        messagesBox.appendChild(div);
        messagesBox.scrollTop = messagesBox.scrollHeight;
        return div;
    }

    function openChat() {
        widget.hidden = false;
        toggleBtn.hidden = true;
        toggleBtn.setAttribute('aria-expanded', 'true');

        if (!welcomed) {
            welcomed = true;
            addMessage(
                '¡Hola! Soy el asistente de Lucas Villagra. Consultame sobre proyectos, certificaciones, CV o contacto.',
                'bot'
            );
        }

        input.focus();
    }

    function closeChat() {
        widget.hidden = true;
        toggleBtn.hidden = false;
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.focus();
    }

    async function sendMessage(rawText) {
        const text = rawText.trim();
        if (!text || isSending) return;

        isSending = true;
        submitBtn.disabled = true;
        addMessage(text, 'user');
        input.value = '';

        const pendingEl = addMessage('Pensando…', 'bot', 'chat-msg-pending');

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

            pendingEl.classList.remove('chat-msg-pending');
            if (data && typeof data.reply === 'string' && data.reply.trim()) {
                pendingEl.textContent = data.reply;
            } else if (data && typeof data.error === 'string' && data.error.trim()) {
                pendingEl.textContent = data.error;
            } else {
                pendingEl.textContent = 'No se pudo obtener una respuesta en este momento.';
            }
        } catch {
            pendingEl.classList.remove('chat-msg-pending');
            pendingEl.textContent = 'Error de conexión. Intentá nuevamente en unos segundos.';
        } finally {
            messagesBox.scrollTop = messagesBox.scrollHeight;
            isSending = false;
            submitBtn.disabled = false;
            input.focus();
        }
    }

    toggleBtn.addEventListener('click', openChat);
    closeBtn.addEventListener('click', closeChat);

    form.addEventListener('submit', function onSubmit(event) {
        event.preventDefault();
        sendMessage(input.value);
    });

    quickChips.forEach(function bindChip(chip) {
        chip.addEventListener('click', function onChipClick() {
            const prompt = chip.getAttribute('data-prompt') || chip.textContent || '';
            sendMessage(prompt);
        });
    });

    document.addEventListener('keydown', function onKeyDown(event) {
        if (event.key === 'Escape' && !widget.hidden) {
            closeChat();
        }
    });
})();
