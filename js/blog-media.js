/* =========================================================
   SECURITY RESEARCH / MEDIA KIT
   Politica de carga: el clip NO viaja hasta que hace falta.
   - Pantalla >= 900px, sin saveData y sin prefers-reduced-motion:
     autoplay mudo en loop al entrar en viewport (50%).
   - Cualquier otro caso: poster + boton play (el usuario decide).
   Sin dependencias. Idempotente si se incluye una sola vez.
   ========================================================= */

(function () {
    'use strict';

    var boxes = document.querySelectorAll('.blog-video');
    if (!boxes.length) {
        return;
    }

    var connection = navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection ||
        {};
    var canAutoplay = window.matchMedia('(min-width: 900px)').matches &&
        connection.saveData !== true &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function ensureSource(video) {
        if (!video.getAttribute('src') && video.dataset.src) {
            video.setAttribute('src', video.dataset.src);
        }
    }

    function start(box, video) {
        ensureSource(video);
        var attempt = video.play();
        if (attempt && typeof attempt.catch === 'function') {
            /* Si el navegador rechaza el autoplay, queda el poster visible. */
            attempt.catch(function () { /* noop */ });
        }
        box.classList.add('is-playing');
    }

    function stop(box, video) {
        video.pause();
        box.classList.remove('is-playing');
    }

    Array.prototype.forEach.call(boxes, function (box) {
        var video = box.querySelector('video');
        if (!video) {
            return;
        }

        var button = box.querySelector('.blog-video-play');
        if (button) {
            button.addEventListener('click', function () {
                start(box, video);
            });
        }

        video.addEventListener('click', function () {
            if (video.paused) {
                start(box, video);
            } else {
                stop(box, video);
            }
        });

        if (!canAutoplay || !('IntersectionObserver' in window)) {
            return;
        }

        new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting && video.paused) {
                    start(box, video);
                } else if (!entry.isIntersecting && !video.paused) {
                    stop(box, video);
                }
            });
        }, { threshold: 0.5 }).observe(box);
    });
})();
