/* ═══════════════════════════════════════════════════════════════════════════
   RODAMIENTOS CARRILLO — app.js
   · Motor de scroll suave (Lenis) + escenas ligadas al scroll (sin dependencias extra)
   · Escenas 3D con Three.js (rodamiento y rueda industrial procedurales)
   · Loader, navegación, formulario → WhatsApp, FAQ, microinteracciones
   Si Lenis o Three.js no cargan, la página sigue funcionando con scroll nativo y sin 3D.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* ─────────────────────────────────────────────────────────────────────
       CONFIGURACIÓN — edita estos valores antes de publicar
       ───────────────────────────────────────────────────────────────────── */
    var CONFIG = {
        // Número de WhatsApp con código de país, solo dígitos. Ej. México: '5215512345678'
        // Vacío = los botones abren WhatsApp con el mensaje listo para elegir contacto.
        whatsapp: '',
        phoneDisplay: '',   // Ej. '+52 55 1234 5678'  (se muestra en la sección Contacto)
        address: '',        // Ej. 'Calle, Colonia, Ciudad'
        hours: '',          // Ej. 'Lun–Vie 9:00–18:00 · Sáb 9:00–14:00'
        catalogUrl: ''      // Vacío = usa el enlace del catálogo que viene en el HTML (del QR)
    };

    /* ─────────────────────────────────────────────────────────────────────
       UTILIDADES
       ───────────────────────────────────────────────────────────────────── */
    var root = document.documentElement;
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
    var clamp = function (v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.min(b, Math.max(a, v)); };
    var lerp = function (a, b, t) { return a + (b - a) * t; };
    var range = function (p, a, b) { return clamp((p - a) / (b - a)); };
    var smooth = function (a, b, x) { var t = range(x, a, b); return t * t * (3 - 2 * t); };
    var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
    var easeInOut = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var easeOutBack = function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var debounce = function (fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; };
    var safe = function (name, fn) { try { fn(); } catch (e) { if (window.console) console.warn('[Carrillo] "' + name + '" no pudo iniciar:', e); } };

    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('pointermove', function (e) {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    root.classList.add('js-ready');

    /* ─────────────────────────────────────────────────────────────────────
       MOTOR DE SCROLL
       Un único bucle rAF: Lenis (si existe) + escenas "scrub" con progreso 0→1
       ───────────────────────────────────────────────────────────────────── */
    var Scroll = {
        y: 0, vy: 0, vh: window.innerHeight, vw: window.innerWidth, docH: 1,
        lenis: null, frameFns: [], scrubs: [], measureFns: [], stopped: false,

        init: function () {
            var self = this;
            if (window.Lenis && !reduceMotion) {
                try { this.lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.92, smoothWheel: true }); }
                catch (e) { this.lenis = null; }
            }
            this.y = window.scrollY;
            window.addEventListener('resize', debounce(function () { self.measure(); }, 160));
            if (window.ResizeObserver) new ResizeObserver(debounce(function () { self.measure(); }, 220)).observe(document.body);
            var loop = function (t) {
                if (self.lenis) self.lenis.raf(t);
                var y = self.lenis ? self.lenis.scroll : window.scrollY;
                self.vy = y - self.y; self.y = y;
                var i, s, p, total, start;
                for (i = 0; i < self.scrubs.length; i++) {
                    s = self.scrubs[i];
                    if (s.mode === 'pin') { total = s.h - self.vh; start = s.top; }
                    else if (s.mode === 'exit') { total = s.h; start = s.top; }
                    else { total = s.h + self.vh; start = s.top - self.vh; }
                    p = total > 0 ? clamp((y - start) / total) : 0;
                    if (p !== s.last) { s.last = p; s.fn(p, s); }
                }
                for (i = 0; i < self.frameFns.length; i++) self.frameFns[i](t, y, self.vy);
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        },
        onFrame: function (fn) { this.frameFns.push(fn); },
        scrub: function (el, fn, mode) {
            var s = { el: el, fn: fn, mode: mode || 'pin', top: 0, h: 0, last: -1 };
            this._m(s); this.scrubs.push(s); return s;
        },
        _m: function (s) { var r = s.el.getBoundingClientRect(); s.top = r.top + window.scrollY; s.h = r.height; },
        measure: function () {
            var self = this;
            this.vh = window.innerHeight; this.vw = window.innerWidth;
            this.docH = Math.max(1, document.documentElement.scrollHeight);
            this.scrubs.forEach(function (s) { self._m(s); s.last = -1; });
            this.measureFns.forEach(function (f) { f(); });
        },
        onMeasure: function (fn) { this.measureFns.push(fn); },
        stop: function () { this.stopped = true; if (this.lenis) this.lenis.stop(); },
        start: function () { this.stopped = false; if (this.lenis) this.lenis.start(); },
        to: function (y) {
            if (this.lenis) this.lenis.scrollTo(y, { duration: 1.9, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
            else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
    };

    /* ─────────────────────────────────────────────────────────────────────
       LOADER — progreso simulado que espera fuentes + recursos
       ───────────────────────────────────────────────────────────────────── */
    function runLoader(onDone) {
        var loader = $('#loader'), pctEl = $('#loader-pct'), bar = $('#loader-bar');
        if (!loader) { root.classList.remove('is-loading'); root.classList.add('is-ready'); onDone(); return; }
        var t0 = performance.now(), MIN = reduceMotion ? 350 : 2700;
        var loaded = document.readyState === 'complete', fontsOk = false, shown = 0, finished = false;
        window.addEventListener('load', function () { loaded = true; }, { once: true });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fontsOk = true; }); else fontsOk = true;
        setTimeout(function () { loaded = true; fontsOk = true; }, 7500);   // seguro: nunca se queda atorado

        function finish() {
            if (finished) return; finished = true;
            pctEl.textContent = '100'; bar.style.setProperty('--p', 1);
            setTimeout(function () {
                loader.classList.add('is-done');
                root.classList.remove('is-loading');
                Scroll.start();
                setTimeout(function () { root.classList.add('is-ready'); onDone(); }, 420);
                setTimeout(function () { loader.classList.add('is-gone'); loader.setAttribute('aria-hidden', 'true'); }, 1500);
            }, 260);
        }
        Scroll.stop();
        (function step(now) {
            var t = now - t0, ready = loaded && fontsOk;
            var target = easeOut(clamp(t / MIN)) * 100;
            if (!ready) target = Math.min(target, 92);
            shown += (target - shown) * 0.1;
            if (ready && t > MIN && shown > 99.2) { finish(); return; }
            pctEl.textContent = String(Math.round(shown)).padStart(3, '0');
            bar.style.setProperty('--p', (shown / 100).toFixed(4));
            requestAnimationFrame(step);
        })(t0);
    }

    /* ─────────────────────────────────────────────────────────────────────
       WHATSAPP · ENLACES · CONTACTO
       ───────────────────────────────────────────────────────────────────── */
    function waUrl(msg) {
        var num = (CONFIG.whatsapp || '').replace(/\D/g, '');
        return 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg);
    }
    function initLinks() {
        $$('[data-wa]').forEach(function (a) { a.href = waUrl(a.getAttribute('data-wa')); });
        if (CONFIG.catalogUrl) $$('[data-catalog]').forEach(function (a) { a.href = CONFIG.catalogUrl; });
        var show = function (key, text, link) {
            var li = $('[data-contact="' + key + '"]'); if (!li || !text) return;
            li.hidden = false; var t = $('[data-' + key + '-text]', li); if (t) t.textContent = text;
            var a = $('[data-' + key + '-link]', li); if (a && link) a.href = link;
        };
        show('phone', CONFIG.phoneDisplay, CONFIG.whatsapp ? 'https://wa.me/' + CONFIG.whatsapp.replace(/\D/g, '') : null);
        show('address', CONFIG.address);
        show('hours', CONFIG.hours);
        var y = $('[data-year]'); if (y) y.textContent = new Date().getFullYear();
    }

    /* ─────────────────────────────────────────────────────────────────────
       FORMULARIO → WHATSAPP
       ───────────────────────────────────────────────────────────────────── */
    function initForm() {
        var form = $('#wa-form'); if (!form) return;
        var status = $('[data-form-status]', form);
        var setErr = function (name, msg) {
            var el = $('[data-err="' + name + '"]', form); if (!el) return;
            el.textContent = msg; var f = el.closest('.field'); if (f) f.classList.toggle('has-err', !!msg);
        };
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var d = new FormData(form), g = function (k) { return String(d.get(k) || '').trim(); };
            var name = g('name'), interest = g('interest'), ok = true, first = null;
            if (name.length < 2) { setErr('name', 'Escribe tu nombre para saber con quién hablamos.'); ok = false; first = first || $('#f-name'); } else setErr('name', '');
            if (!interest) { setErr('interest', 'Elige una opción para orientarte mejor.'); ok = false; first = first || $('.pick input', form); } else setErr('interest', '');
            if (!ok) { status.textContent = ''; if (first) first.focus(); return; }
            var lines = ['Hola, soy ' + name + '. Quiero mi cotización.', 'Me interesa: ' + interest + '.'];
            if (g('ref')) lines.push('Referencia / medidas: ' + g('ref') + '.');
            if (g('qty')) lines.push('Cantidad aprox.: ' + g('qty') + '.');
            if (g('msg')) lines.push('Detalles: ' + g('msg'));
            lines.push('Quedo atento a tu respuesta, gracias.');
            var w = window.open(waUrl(lines.join('\n')), '_blank');
            if (w) { try { w.opener = null; } catch (er) { /* noop */ } } else { window.location.href = waUrl(lines.join('\n')); }
            status.textContent = 'Listo: se abrió WhatsApp con tu solicitud. Solo presiona enviar.';
        });
        form.addEventListener('input', function (e) { if (e.target && e.target.name) setErr(e.target.name, ''); });
    }

    /* ─────────────────────────────────────────────────────────────────────
       FAQ — acordeón con altura animada
       ───────────────────────────────────────────────────────────────────── */
    function initFaq() {
        var items = $$('.qa');
        var ease = 'cubic-bezier(.22,1,.36,1)';
        var toggle = function (d, open) {
            var body = $('.qa__body', d); if (!body) return;
            if (d._a) d._a.cancel();
            if (open) {
                d.open = true;
                var h = body.scrollHeight;
                d._a = body.animate([{ height: '0px' }, { height: h + 'px' }], { duration: 520, easing: ease });
                d._a.onfinish = d._a.oncancel = function () { d._a = null; };
            } else {
                var h2 = body.offsetHeight;
                d._a = body.animate([{ height: h2 + 'px' }, { height: '0px' }], { duration: 400, easing: ease });
                d._a.onfinish = function () { d.open = false; d._a = null; };
            }
        };
        items.forEach(function (d) {
            $('summary', d).addEventListener('click', function (e) {
                e.preventDefault();
                if (!d.open) { items.forEach(function (o) { if (o !== d && o.open) toggle(o, false); }); toggle(d, true); }
                else toggle(d, false);
            });
        });
    }

    /* ─────────────────────────────────────────────────────────────────────
       REVEAL + SPLIT DE TEXTO
       ───────────────────────────────────────────────────────────────────── */
    function splitWords(el, cls) {
        var idx = 0;
        (function walk(node) {
            Array.prototype.slice.call(node.childNodes).forEach(function (n) {
                if (n.nodeType === 3) {
                    var frag = document.createDocumentFragment();
                    n.textContent.split(/(\s+)/).forEach(function (tok) {
                        if (!tok) return;
                        if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
                        if (cls === 'mw') {
                            var m = document.createElement('span'); m.className = 'mw'; m.textContent = tok; m.style.setProperty('--on', 0); frag.appendChild(m);
                        } else {
                            var w = document.createElement('span'); w.className = 'w';
                            var wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = tok; wi.style.setProperty('--wi', idx++);
                            w.appendChild(wi); frag.appendChild(w);
                        }
                    });
                    n.parentNode.replaceChild(frag, n);
                } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
            });
        })(el);
    }
    function initReveal() {
        $$('[data-split]').forEach(function (el) { splitWords(el); });
        var targets = $$('[data-reveal], [data-split]');
        if (!('IntersectionObserver' in window)) { targets.forEach(function (el) { el.classList.add('is-in'); }); return; }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
        }, { rootMargin: '0px 0px -9% 0px', threshold: 0.12 });
        targets.forEach(function (el) { io.observe(el); });
    }

    /* ─────────────────────────────────────────────────────────────────────
       NAVEGACIÓN · MENÚ · RAIL · PROGRESO · BOTÓN FLOTANTE
       ───────────────────────────────────────────────────────────────────── */
    function initNav() {
        var nav = $('#nav'), burger = $('#burger'), menu = $('#menu'), open = false;
        var setMenu = function (v) {
            open = v;
            burger.setAttribute('aria-expanded', String(v));
            burger.setAttribute('aria-label', v ? 'Cerrar menú' : 'Abrir menú');
            root.classList.toggle('menu-open', v);
            if (v) {
                menu.hidden = false; nav.classList.remove('is-hidden');
                void menu.offsetWidth; menu.classList.add('is-open');
                Scroll.stop();
            } else {
                menu.classList.remove('is-open'); Scroll.start();
                setTimeout(function () { if (!open) menu.hidden = true; }, 950);
            }
        };
        burger.addEventListener('click', function () { setMenu(!open); });
        $$('[data-menu-link]').forEach(function (a, i) { a.style.setProperty('--i', i); a.addEventListener('click', function () { setMenu(false); }); });
        $('.menu__foot .btn') && $('.menu__foot .btn').addEventListener('click', function () { setMenu(false); });
        window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) setMenu(false); });

        var progress = $('#progress'), wa = $('#wa-float'), tipDone = false;
        Scroll.onFrame(function (t, y, vy) {
            nav.classList.toggle('is-scrolled', y > 24);
            if (!open) {
                if (y > 280 && vy > 3) nav.classList.add('is-hidden');
                else if (vy < -3 || y < 280) nav.classList.remove('is-hidden');
            }
            progress.style.transform = 'scaleX(' + clamp(y / Math.max(1, Scroll.docH - Scroll.vh)).toFixed(4) + ')';
            if (wa) {
                var vis = y > Scroll.vh * 0.55 && root.classList.contains('is-ready');
                wa.classList.toggle('is-visible', vis);
                if (vis && !tipDone) { tipDone = true; setTimeout(function () { wa.classList.add('show-tip'); setTimeout(function () { wa.classList.remove('show-tip'); }, 5200); }, 1400); }
            }
        });

        // Enlaces ancla con scroll suave
        document.addEventListener('click', function (e) {
            var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
            var id = a.getAttribute('href'); if (!id || id.length < 2) return;
            var target = document.getElementById(id.slice(1)); if (!target) return;
            e.preventDefault();
            var y = target.getBoundingClientRect().top + window.scrollY;
            var step = a.getAttribute('data-goto-step');
            if (step !== null && target.hasAttribute('data-showcase')) {
                var sc = Scroll.scrubs.filter(function (s) { return s.el === target; })[0];
                if (sc) y = sc.top + (Number(step) * 0.25 + 0.1) * (sc.h - Scroll.vh);
            }
            Scroll.to(y);
        });
        var top = $('[data-top]'); if (top) top.addEventListener('click', function (e) { e.preventDefault(); Scroll.to(0); });

        // Rail de secciones (escritorio)
        var rail = $$('[data-rail]');
        if (rail.length && 'IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (en) {
                    if (!en.isIntersecting) return;
                    rail.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('data-rail') === en.target.id); });
                });
            }, { rootMargin: '-50% 0px -50% 0px' });
            $$('[data-section]').forEach(function (s) { io.observe(s); });
        }
    }

    /* ─────────────────────────────────────────────────────────────────────
       MICROINTERACCIONES: cursor, botones magnéticos, spotlight, marquee
       ───────────────────────────────────────────────────────────────────── */
    function initPointerFX() {
        if (!finePointer) return;
        var cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring');
        var x = 0, y = 0, rx = 0, ry = 0;
        window.addEventListener('pointermove', function (e) { x = e.clientX; y = e.clientY; root.classList.add('has-cursor'); }, { passive: true });
        document.addEventListener('mouseleave', function () { root.classList.remove('has-cursor'); });
        document.addEventListener('mouseover', function (e) {
            var hot = e.target.closest && e.target.closest('a, button, summary, label, input, textarea, [data-magnetic]');
            cur.classList.toggle('is-hover', !!hot);
        });
        Scroll.onFrame(function () {
            rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
            dot.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
            ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
        });
        $$('[data-magnetic]').forEach(function (el) {
            el.addEventListener('pointermove', function (ev) {
                var r = el.getBoundingClientRect();
                var dx = (ev.clientX - r.left - r.width / 2) / r.width, dy = (ev.clientY - r.top - r.height / 2) / r.height;
                el.style.transform = 'translate(' + (dx * 14).toFixed(1) + 'px,' + (dy * 12).toFixed(1) + 'px)';
            });
            el.addEventListener('pointerleave', function () { el.style.transform = ''; });
        });
    }
    function initSpotlight() {
        $$('[data-spot]').forEach(function (card) {
            card.addEventListener('pointermove', function (e) {
                var r = card.getBoundingClientRect();
                card.style.setProperty('--mx', (e.clientX - r.left) + 'px'); card.style.setProperty('--my', (e.clientY - r.top) + 'px');
            });
        });
    }
    function initMarquee() {
        var track = $('.marquee__track'); if (!track || reduceMotion || !track.getAnimations) return;
        var rate = 1;
        Scroll.onFrame(function (t, y, vy) {
            var anim = track.getAnimations()[0]; if (!anim) return;
            var target = (vy >= 0 ? 1 : -1) * (1 + Math.min(Math.abs(vy) * 0.18, 9));
            if (Math.abs(vy) < 0.05) target = rate > 0 ? 1 : -1;
            rate += (target - rate) * 0.07;
            try { anim.playbackRate = rate; } catch (e) { /* noop */ }
        });
    }

    /* ─────────────────────────────────────────────────────────────────────
       HERO — layout del dial/HUD, rotador de palabras, parallax de salida
       ───────────────────────────────────────────────────────────────────── */
    var Hero = { geom: { W: 1, H: 1, cx: 0, cy: 0, D: 1 }, p: 0 };

    function initHero() {
        var hero = $('#inicio'); if (!hero) return;
        var inner = $('[data-hero-inner]'), dial = $('[data-hero-dial]');

        var layout = function () {
            var W = hero.clientWidth, vh = Scroll.vh, D, cx, cy;
            if (W >= 960) {
                hero.style.removeProperty('--hero-pad');
                var H = hero.offsetHeight;
                D = Math.min(W * 0.47, vh * 0.9, 820); cx = W * 0.715; cy = H * 0.5 + 18;
            } else {
                D = clamp(Math.min(W * 0.88, vh * 0.37), 220, 520);
                cy = 80 + D / 2; cx = W / 2;
                hero.style.setProperty('--hero-pad', (cy + D / 2 + 10) + 'px');
            }
            hero.style.setProperty('--cx', cx + 'px'); hero.style.setProperty('--cy', cy + 'px'); hero.style.setProperty('--D', D + 'px');
            Hero.geom = { W: W, H: hero.offsetHeight, cx: cx, cy: cy, D: D };
        };
        Hero.layout = layout;
        layout(); Scroll.onMeasure(layout);

        // índice de entrada escalonada
        $$('[data-hero-in]', hero).forEach(function (el, i) { el.style.setProperty('--i', i); });

        // palabras rotativas
        var rot = $('[data-rotator]', hero);
        if (rot && !reduceMotion) {
            var words = ['industria', 'bodega', 'taller', 'planta', 'maquinaria', 'negocio'], i = 0;
            setInterval(function () {
                if (document.hidden || !root.classList.contains('is-ready') || Scroll.y > Scroll.vh) return;
                var cur = rot.lastElementChild;
                var next = document.createElement('span');
                next.className = 'rot__cur is-pre'; next.textContent = words[++i % words.length]; next.setAttribute('aria-hidden', 'true');
                rot.appendChild(next);
                void next.offsetWidth;   // fuerza el estilo inicial para que la transición corra
                cur.classList.add('is-out'); next.classList.remove('is-pre');
                setTimeout(function () { if (cur.parentNode) cur.parentNode.removeChild(cur); }, 1100);
            }, 2800);
        }

        // telemetría decorativa
        var rpm = $('#hud-rpm');
        if (rpm && !reduceMotion) setInterval(function () {
            if (document.hidden || Scroll.y > Scroll.vh) return;
            var v = 3300 + Math.round(Math.random() * 640); rpm.textContent = String(v).replace(/(\d)(\d{3})$/, '$1 $2');
        }, 900);

        // parallax / salida
        Scroll.scrub(hero, function (p) {
            Hero.p = p;
            inner.style.transform = 'translate3d(0,' + (p * 80).toFixed(1) + 'px,0)';
            inner.style.opacity = String(1 - range(p, 0.12, 0.62));
            dial.style.scale = String(1 + p * 0.22);
            hero.style.setProperty('--fade', String(1 - range(p, 0.2, 0.85)));
        }, 'exit');
    }

    /* ─────────────────────────────────────────────────────────────────────
       MANIFIESTO — las palabras se iluminan con el scroll
       ───────────────────────────────────────────────────────────────────── */
    function initManifesto() {
        var el = $('[data-words]'); if (!el) return;
        splitWords(el, 'mw');
        var words = $$('.mw', el), n = words.length;
        Scroll.scrub(el, function (p) {
            var k = range(p, 0.22, 0.62) * (n + 5);
            for (var i = 0; i < n; i++) words[i].style.setProperty('--on', clamp(k - i).toFixed(3));
        }, 'view');
    }

    /* ─────────────────────────────────────────────────────────────────────
       ESCENARIO — el panel chevron crece hasta cubrir toda la pantalla
       ───────────────────────────────────────────────────────────────────── */
    function initStage() {
        var sec = $('[data-stage]'); if (!sec) return;
        var frame = $('[data-stage-frame]', sec), art = $('[data-stage-art]', sec), hint = $('[data-stage-hint]', sec);
        var w1 = $('[data-stage-w1]', sec), w2 = $('[data-stage-w2]', sec), content = $('[data-stage-content]', sec);

        Scroll.scrub(sec, function (p) {
            var W = Scroll.vw, H = Scroll.vh;
            var e = easeInOut(range(p, 0.03, 0.56));
            var w0 = Math.min(W * (W < 720 ? 0.74 : 0.5), 560), h0 = Math.min(H * (W < 720 ? 0.44 : 0.52), 470);
            var cy0 = H * 0.5 - 6;
            var L = lerp((W - w0) / 2, 0, e), R = lerp((W + w0) / 2, W, e);
            var T = lerp(cy0 - h0 / 2, 0, e), B = lerp(cy0 + h0 / 2, H, e);
            var k = lerp(Math.min(w0 * 0.2, 74), 0, clamp(e * 1.5));
            var mid = (T + B) / 2;
            frame.style.clipPath = 'polygon(' + L + 'px ' + T + 'px,' + R + 'px ' + T + 'px,' + (R - k) + 'px ' + mid + 'px,' + R + 'px ' + B + 'px,' + L + 'px ' + B + 'px)';
            art.style.transform = 'scale(' + lerp(1.28, 1, e).toFixed(4) + ') rotate(' + (p * -24).toFixed(2) + 'deg)';
            if (hint) hint.style.opacity = String(1 - range(p, 0, 0.1));
            var cc = range(p, 0.5, 0.78);
            content.style.setProperty('--c', cc.toFixed(3));
            content.inert = cc < 0.4;
            w1.style.transform = 'translate3d(' + lerp(10, -22, p).toFixed(2) + 'vw,0,0)';
            w2.style.transform = 'translate3d(' + lerp(-26, 8, p).toFixed(2) + 'vw,0,0)';
        }, 'pin');
    }

    /* ─────────────────────────────────────────────────────────────────────
       PRODUCTOS — paneles + etiquetas; la escena 3D se engancha desde Three
       ───────────────────────────────────────────────────────────────────── */
    var Showcase = { p: 0, step: -1, sec: null, api: null };

    function initShowcase() {
        var sec = $('[data-showcase]'); if (!sec) return;
        Showcase.sec = sec;
        var panels = $$('.panel', sec), dots = $$('.showcase__dots li', sec), tag = $('[data-showcase-tag]', sec);
        var tags = ['Rodamiento de bolas', 'Vista explosionada', 'Rueda industrial', 'Vista explosionada'];
        Scroll.scrub(sec, function (p) {
            Showcase.p = p;
            var step = p < 0.25 ? 0 : p < 0.5 ? 1 : p < 0.75 ? 2 : 3;
            if (step !== Showcase.step) {
                Showcase.step = step;
                panels.forEach(function (el, i) { el.classList.toggle('is-active', i === step); el.inert = i !== step; });
                dots.forEach(function (el, i) { el.classList.toggle('is-on', i === step); });
                if (tag) tag.textContent = tags[step];
            }
        }, 'pin');
    }

    /* ─────────────────────────────────────────────────────────────────────
       MEDIDAS — plano técnico que se dibuja con el scroll
       ───────────────────────────────────────────────────────────────────── */
    function initBlueprint() {
        var sec = $('[data-blueprint]'); if (!sec) return;
        var draws = $$('[data-draw]', sec).map(function (el) { var r = el.getAttribute('data-draw').split(',').map(Number); el.style.strokeDasharray = '1'; el.style.strokeDashoffset = '1'; return { el: el, a: r[0], b: r[1] }; });
        var fades = $$('[data-fade]', sec).map(function (el) { var r = el.getAttribute('data-fade').split(',').map(Number); el.style.opacity = '0'; return { el: el, a: r[0], b: r[1] }; });
        var dims = $$('[data-dim]', sec).map(function (el) {
            var starts = $$('[data-draw]', el).map(function (n) { return Number(n.getAttribute('data-draw').split(',')[0]); });
            el.style.opacity = '0';
            return { el: el, n: Number(el.getAttribute('data-dim')), a: Math.min.apply(null, starts) };
        });
        var steps = $$('[data-bp-step]', sec), cta = $('[data-bp-cta]', sec), cap = $('[data-bp-caption]', sec);
        var vals = [
            { el: $('[data-bp-val="d"]', sec), to: 25, a: 0.34, b: 0.46, label: 'd' },
            { el: $('[data-bp-val="D"]', sec), to: 52, a: 0.56, b: 0.68, label: 'D' },
            { el: $('[data-bp-val="B"]', sec), to: 15, a: 0.76, b: 0.88, label: 'B' }
        ];
        Scroll.scrub(sec, function (p) {
            draws.forEach(function (d) { d.el.style.strokeDashoffset = String(1 - easeOut(range(p, d.a, d.b))); });
            fades.forEach(function (f) { f.el.style.opacity = String(range(p, f.a, f.b)); });
            dims.forEach(function (d) { d.el.style.opacity = String(range(p, d.a, d.a + 0.03)); });
            vals.forEach(function (v) { if (v.el) v.el.textContent = v.label + ' ' + Math.round(v.to * easeOut(range(p, v.a, v.b))) + ' mm'; });
            var active = p < 0.26 ? 0 : p < 0.48 ? 1 : p < 0.7 ? 2 : p < 0.9 ? 3 : 0;
            dims.forEach(function (d) { d.el.classList.toggle('is-active', d.n === active); });
            steps.forEach(function (s, i) { s.classList.toggle('is-active', i + 1 === active); });
            if (cta) { cta.classList.toggle('is-on', p > 0.86); cta.inert = p <= 0.86; }
            if (cap) cap.classList.toggle('is-on', p > 0.88);
        }, 'pin');
    }

    /* ─────────────────────────────────────────────────────────────────────
       PROCESO — una esfera rueda por la línea de tiempo
       ───────────────────────────────────────────────────────────────────── */
    function initProcess() {
        var sec = $('[data-process]'); if (!sec) return;
        var wrap = $('.process__wrap', sec), steps = $$('[data-step]', sec), gear = $('[data-process-gear]', sec);
        Scroll.onFrame(function () {
            var r = wrap.getBoundingClientRect();
            if (r.bottom < -200 || r.top > Scroll.vh + 200) return;
            var q = clamp((Scroll.vh * 0.72 - r.top) / (r.height + Scroll.vh * 0.1));
            wrap.style.setProperty('--p', q.toFixed(4));
            steps.forEach(function (s, i) { s.classList.toggle('is-on', q >= i / 3 - 0.04); });
        });
        Scroll.scrub(sec, function (p) { gear.style.setProperty('--rot', (p * 260).toFixed(2)); }, 'view');
    }

    /* ─────────────────────────────────────────────────────────────────────
       FOOTER — la palabra gigante se "llena" con el scroll
       ───────────────────────────────────────────────────────────────────── */
    function initFooter() {
        var big = $('[data-footer-big]'); if (!big) return;
        var span = $('span', big);
        Scroll.scrub(big, function (p) { span.style.setProperty('--f', (range(p, 0.2, 0.62) * 100).toFixed(1) + '%'); }, 'view');
    }

    /* ─────────────────────────────────────────────────────────────────────
       THREE.JS — rodamiento y rueda industrial procedurales
       Escena 1: hero (rota sola + partículas + parallax del puntero)
       Escena 2: productos (ligada al scroll: ensamblado → explosionado → rueda)
       ───────────────────────────────────────────────────────────────────── */
    function initThree() {
        var T = window.THREE;
        if (!T) { root.classList.add('no-webgl'); return; }
        var heroCanvas = $('#hero-canvas'), showCanvas = $('#showcase-canvas');
        var isMobile = window.innerWidth < 960;
        var TAU = Math.PI * 2;

        /* ── helpers de geometría ── */
        // Redondea las esquinas de un polígono cerrado [[x,y],...] con radios (número o arreglo)
        function fillet(pts, rad, steps) {
            steps = steps || 6;
            var out = [], n = pts.length, i, s;
            for (i = 0; i < n; i++) {
                var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
                var r = Array.isArray(rad) ? (rad[i] || 0) : rad;
                if (!r) { out.push(new T.Vector2(p1[0], p1[1])); continue; }
                var v1 = [p0[0] - p1[0], p0[1] - p1[1]], v2 = [p2[0] - p1[0], p2[1] - p1[1]];
                var l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]);
                var u1 = [v1[0] / l1, v1[1] / l1], u2 = [v2[0] / l2, v2[1] / l2];
                var ang = Math.acos(clamp(u1[0] * u2[0] + u1[1] * u2[1], -1, 1));
                var d = Math.min(r / Math.tan(ang / 2), l1 * 0.5, l2 * 0.5), rr = d * Math.tan(ang / 2);
                var a = [p1[0] + u1[0] * d, p1[1] + u1[1] * d], b = [p1[0] + u2[0] * d, p1[1] + u2[1] * d];
                var bis = [u1[0] + u2[0], u1[1] + u2[1]], bl = Math.hypot(bis[0], bis[1]), cd = rr / Math.sin(ang / 2);
                var c = [p1[0] + bis[0] / bl * cd, p1[1] + bis[1] / bl * cd];
                var a0 = Math.atan2(a[1] - c[1], a[0] - c[0]), a1 = Math.atan2(b[1] - c[1], b[0] - c[0]), da = a1 - a0;
                while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
                for (s = 0; s <= steps; s++) { var t = a0 + da * s / steps; out.push(new T.Vector2(c[0] + Math.cos(t) * rr, c[1] + Math.sin(t) * rr)); }
            }
            return out;
        }
        function radialTex(inner, outer) {
            var c = document.createElement('canvas'); c.width = c.height = 128;
            var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
            gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
            var tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; return tex;
        }

        /* ── renderer / entorno / luces / materiales ── */
        function makeRenderer(canvas) {
            var r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
            r.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75));
            r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.12;
            r.outputColorSpace = T.SRGBColorSpace; r.setClearColor(0x000000, 0);
            canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); root.classList.add('no-webgl'); });
            return r;
        }
        // "Estudio" fotográfico: paneles emisivos convertidos a mapa de entorno PMREM para reflejos metálicos
        function makeEnv(renderer) {
            var s = new T.Scene(); s.background = new T.Color(0x07182e);
            var panel = function (w, h, color, k, pos) {
                var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(k), side: T.DoubleSide }));
                m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); s.add(m);
            };
            panel(16, 5, 0xffffff, 5.5, [0, 9, 5]);
            panel(6, 14, 0x9cc8ff, 3.2, [-10, 1, 3]);
            panel(5, 14, 0xffffff, 3.8, [10, 2, 4]);
            panel(18, 4, 0xff5060, 0.5, [0, -8, -3]);
            panel(12, 8, 0xdfeaff, 1.6, [0, 1, 11]);
            panel(10, 4, 0x4da3ff, 2.4, [0, 2, -10]);
            var pm = new T.PMREMGenerator(renderer), rt = pm.fromScene(s, 0.03); pm.dispose();
            return rt.texture;
        }
        function addLights(scene) {
            var key = new T.DirectionalLight(0xffffff, 2.1); key.position.set(3, 5, 6); scene.add(key);
            var rim = new T.DirectionalLight(0x4da3ff, 2.4); rim.position.set(-5, 2, -4); scene.add(rim);
            var warm = new T.DirectionalLight(0xff4a58, 1.0); warm.position.set(4, -4, -2); scene.add(warm);
            scene.add(new T.AmbientLight(0x6d8fb8, 0.3));
        }
        function makeMats(env) {
            var std = function (o) { o.envMap = env; return new T.MeshStandardMaterial(o); };
            return {
                steel: std({ color: 0xd3deea, metalness: 1, roughness: 0.24, envMapIntensity: 1.15, side: T.DoubleSide }),
                steelDark: std({ color: 0x9db2c9, metalness: 1, roughness: 0.34, envMapIntensity: 1.0, side: T.DoubleSide }),
                ball: std({ color: 0xf1f6fc, metalness: 1, roughness: 0.1, envMapIntensity: 1.3 }),
                cage: std({ color: 0x6f8fb6, metalness: 0.95, roughness: 0.38, envMapIntensity: 1.0 }),
                core: std({ color: 0xa8bbca, metalness: 0.45, roughness: 0.42, envMapIntensity: 0.9, side: T.DoubleSide }),
                tread: new T.MeshPhysicalMaterial({ color: 0xd4212f, roughness: 0.5, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4, envMap: env, envMapIntensity: 0.5 })
            };
        }

        /* ── RODAMIENTO rígido de bolas (proporciones reales de un 6205: 25 × 52 × 15 mm) ── */
        var BR = { h: 0.288, rb: 0.481, ris: 0.673, rp: 0.74, bR: 0.153, rg: 0.16, ros: 0.856, ro: 1.0 };
        function buildBearing(M) {
            var rootG = new T.Group(), spin = new T.Group(); rootG.add(spin);
            var outer = new T.Group(), inner = new T.Group(), balls = new T.Group(), cage = new T.Group();
            spin.add(outer, inner, balls, cage);
            var i, N = 18;

            // anillo exterior
            (function () {
                var th = Math.acos((BR.ros - BR.rp) / BR.rg), P = [], R = [];
                var push = function (x, y, r) { P.push([x, y]); R.push(r || 0); };
                push(BR.ro, -BR.h, 0.035); push(BR.ro, BR.h, 0.035); push(BR.ros, BR.h, 0.014);
                for (i = 0; i <= N; i++) { var t = th - 2 * th * (i / N); push(BR.rp + BR.rg * Math.cos(t), BR.rg * Math.sin(t)); }
                push(BR.ros, -BR.h, 0.014);
                outer.add(new T.Mesh(new T.LatheGeometry(fillet(P, R), 160), M.steel));
            })();
            // anillo interior
            (function () {
                var th = Math.acos((BR.rp - BR.ris) / BR.rg), P = [], R = [];
                var push = function (x, y, r) { P.push([x, y]); R.push(r || 0); };
                push(BR.ris, -BR.h, 0.014);
                for (i = 0; i <= N; i++) { var t = -th + 2 * th * (i / N); push(BR.rp - BR.rg * Math.cos(t), BR.rg * Math.sin(t)); }
                push(BR.ris, BR.h, 0.014); push(BR.rb, BR.h, 0.03); push(BR.rb, -BR.h, 0.03);
                inner.add(new T.Mesh(new T.LatheGeometry(fillet(P, R), 160), M.steel));
            })();
            // esferas y jaula
            var COUNT = 9, ballGeo = new T.SphereGeometry(BR.bR, 40, 28);
            var ringGeo = new T.TorusGeometry(BR.rp, 0.017, 12, 120); ringGeo.rotateX(Math.PI / 2);
            var post = new T.CylinderGeometry(0.026, 0.026, 0.19, 12);
            var r1 = new T.Mesh(ringGeo, M.cage), r2 = new T.Mesh(ringGeo, M.cage); r1.position.y = 0.085; r2.position.y = -0.085; cage.add(r1, r2);
            for (i = 0; i < COUNT; i++) {
                var a = i / COUNT * TAU, b = new T.Mesh(ballGeo, M.ball);
                b.position.set(Math.cos(a) * BR.rp, 0, Math.sin(a) * BR.rp); balls.add(b);
                var pst = new T.Mesh(post, M.cage), a2 = a + Math.PI / COUNT;
                pst.position.set(Math.cos(a2) * BR.rp, 0, Math.sin(a2) * BR.rp); cage.add(pst);
            }
            // anclas (para las etiquetas HTML) — viven fuera del grupo que gira
            var anchors = {};
            ['b-outer', 'b-balls', 'b-cage', 'b-inner'].forEach(function (k) { anchors[k] = new T.Object3D(); rootG.add(anchors[k]); });
            var pol = function (r, deg) { var a = deg * Math.PI / 180; return [Math.cos(a) * r, Math.sin(a) * r]; };
            function setExplode(e) {
                var yo = 1.3 * e, yb = 0.55 * e, yc = -0.2 * e, yi = -1.1 * e;
                outer.position.y = yo; balls.position.y = yb; cage.position.y = yc; inner.position.y = yi;
                var q;
                q = pol(BR.ro * 0.98, 38); anchors['b-outer'].position.set(q[0], yo + BR.h, q[1]);
                q = pol(BR.rp, 150); anchors['b-balls'].position.set(q[0], yb + BR.bR, q[1]);
                q = pol(BR.rp, 55); anchors['b-cage'].position.set(q[0], yc - 0.09, q[1]);
                q = pol((BR.rb + BR.ris) / 2, 168); anchors['b-inner'].position.set(q[0], yi + BR.h, q[1]);
            }
            setExplode(0);
            return { root: rootG, spin: spin, anchors: anchors, setExplode: setExplode };
        }

        /* ── RUEDA INDUSTRIAL giratoria con banda de poliuretano ── */
        function buildCaster(M) {
            var rootG = new T.Group(), swivel = new T.Group(), wheel = new T.Group();
            rootG.add(swivel); swivel.add(wheel);
            var i, anchors = {};
            var mk = function (g, m) { return new T.Mesh(g, m); };

            // banda de poliuretano
            var tread = new T.Group();
            var treadMesh = mk(new T.LatheGeometry(fillet([[1.0, -0.26], [1.0, 0.26], [0.62, 0.26], [0.62, -0.26]], [0.13, 0.13, 0.03, 0.03], 8), 120), M.tread);
            treadMesh.rotation.z = Math.PI / 2; tread.add(treadMesh); wheel.add(tread);

            // núcleo con 5 ventanas
            var core = new T.Group();
            var hs = new T.Shape(); hs.absarc(0, 0, 0.64, 0, TAU, false);
            for (i = 0; i < 5; i++) { var a = i / 5 * TAU + 0.3, hp = new T.Path(); hp.absarc(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.13, 0, TAU, true); hs.holes.push(hp); }
            var bore = new T.Path(); bore.absarc(0, 0, 0.17, 0, TAU, true); hs.holes.push(bore);
            var cg = new T.ExtrudeGeometry(hs, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 3, curveSegments: 56 });
            cg.translate(0, 0, -0.2); cg.rotateY(Math.PI / 2);
            core.add(mk(cg, M.core));
            var sleeveG = new T.CylinderGeometry(0.2, 0.2, 0.6, 36); sleeveG.rotateZ(Math.PI / 2);
            core.add(mk(sleeveG, M.steel)); wheel.add(core);

            // horquilla (dos placas + puente)
            var plateShape = new T.Shape(fillet([[-0.4, 1.5], [0.4, 1.5], [0.23, 0.18], [0.21, -0.1], [-0.21, -0.1], [-0.23, 0.18]], [0.06, 0.06, 0.12, 0.2, 0.2, 0.12], 6));
            var h1 = new T.Path(); h1.absarc(0, 0, 0.09, 0, TAU, true); plateShape.holes.push(h1);
            var h2 = new T.Path(); h2.absarc(0, 0.82, 0.16, 0, TAU, true); plateShape.holes.push(h2);
            var plateGeo = new T.ExtrudeGeometry(plateShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 });
            plateGeo.translate(0, 0, -0.035); plateGeo.rotateY(Math.PI / 2);
            var plateL = mk(plateGeo, M.steelDark), plateR = mk(plateGeo, M.steelDark);
            plateL.position.x = -0.36; plateR.position.x = 0.36; swivel.add(plateL, plateR);
            var bridge = mk(new T.BoxGeometry(0.86, 0.09, 0.78), M.steelDark); bridge.position.y = 1.545; swivel.add(bridge);
            var ringG = new T.Group();
            var raceG = mk(new T.CylinderGeometry(0.27, 0.27, 0.1, 48), M.steel); raceG.position.y = 1.6;
            var torusG = new T.TorusGeometry(0.3, 0.05, 16, 72); torusG.rotateX(Math.PI / 2);
            var torus = mk(torusG, M.steel); torus.position.y = 1.67; ringG.add(raceG, torus); swivel.add(ringG);

            // eje con tuercas
            var shaft = mk(new T.CylinderGeometry(0.075, 0.075, 1.16, 24), M.steel), axle = new T.Group();
            shaft.rotation.z = Math.PI / 2; axle.add(shaft); swivel.add(axle);
            var nutG = new T.CylinderGeometry(0.14, 0.14, 0.11, 6); nutG.rotateZ(Math.PI / 2);
            var nutL = mk(nutG, M.steel), nutR = mk(nutG, M.steel); nutL.position.x = -0.64; nutR.position.x = 0.64; swivel.add(nutL, nutR);

            // placa de montaje superior (fija, no gira)
            var ms = new T.Shape(fillet([[-0.8, -0.6], [0.8, -0.6], [0.8, 0.6], [-0.8, 0.6]], 0.14, 8));
            [[-0.58, -0.4], [0.58, -0.4], [0.58, 0.4], [-0.58, 0.4]].forEach(function (p) { var h = new T.Path(); h.absarc(p[0], p[1], 0.07, 0, TAU, true); ms.holes.push(h); });
            var mg = new T.ExtrudeGeometry(ms, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 20 });
            mg.translate(0, 0, -0.035); mg.rotateX(Math.PI / 2);
            var mount = new T.Group(); mount.add(mk(mg, M.steel));
            var boltG = new T.CylinderGeometry(0.1, 0.1, 0.05, 6);
            [[-0.58, -0.4], [0.58, -0.4], [0.58, 0.4], [-0.58, 0.4]].forEach(function (p) { var b = mk(boltG, M.steelDark); b.position.set(p[0], 0.06, p[1]); mount.add(b); });
            mount.position.y = 1.8; rootG.add(mount);

            // anclas
            anchors['c-plate'] = new T.Object3D(); anchors['c-plate'].position.set(0.7, 0.05, 0.45); mount.add(anchors['c-plate']);
            anchors['c-fork'] = new T.Object3D(); anchors['c-fork'].position.set(0, 1.1, 0.12); plateR.add(anchors['c-fork']);
            anchors['c-axle'] = new T.Object3D(); anchors['c-axle'].position.set(0.07, 0, 0); nutR.add(anchors['c-axle']);
            anchors['c-tread'] = new T.Object3D(); swivel.add(anchors['c-tread']);

            function setExplode(e) {
                mount.position.y = 1.8 + 1.45 * e; ringG.position.y = 0.75 * e; bridge.position.y = 1.545 + 0.3 * e;
                plateL.position.x = -0.36 - 1.4 * e; plateR.position.x = 0.36 + 1.4 * e;
                nutL.position.x = -0.64 - 1.4 * e; nutR.position.x = 0.64 + 1.4 * e; shaft.scale.y = 1 + 2.4 * e;
                core.position.x = 0.9 * e; tread.position.x = -0.2 * e;
                anchors['c-tread'].position.set(-0.2 * e, -0.64, 0.78);
            }
            setExplode(0);
            return { root: rootG, swivel: swivel, wheel: wheel, anchors: anchors, setExplode: setExplode };
        }

        var scenes = [];
        function safeScene(name, fn) { try { scenes.push(fn()); } catch (e) { if (window.console) console.warn('[Carrillo] escena 3D "' + name + '" falló:', e); } }

        /* ════════════════ ESCENA HERO ════════════════ */
        function createHero() {
            var canvas = heroCanvas, host = canvas.parentNode;
            var renderer = makeRenderer(canvas), scene = new T.Scene();
            var DIST = 8, FOV = 32, cam = new T.PerspectiveCamera(FOV, 1, 0.1, 100); cam.position.set(0, 0, DIST);
            var env = makeEnv(renderer); scene.environment = env; addLights(scene);
            var M = makeMats(env), rig = new T.Group(); scene.add(rig);

            // rodamiento (eje hacia la cámara) y rueda
            var bearing = buildBearing(M), bTilt = new T.Group(), bOrient = new T.Group();
            bOrient.rotation.x = Math.PI / 2; bOrient.add(bearing.root); bTilt.add(bOrient); rig.add(bTilt);
            var caster = buildCaster(M), cTilt = new T.Group(), cHold = new T.Group();
            cHold.position.y = -0.42; cHold.add(caster.root); cTilt.add(cHold); rig.add(cTilt);

            // resplandor
            var glow = new T.Sprite(new T.SpriteMaterial({ map: radialTex('rgba(60,140,230,.9)', 'rgba(60,140,230,0)'), transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
            glow.scale.setScalar(5.6); glow.position.z = -1.4; bTilt.add(glow);

            // anillos orbitales + satélites
            var orbits = [];
            [[1.28, 0.9, 0.2, 0.5], [1.46, -0.5, 0.7, -0.35], [1.66, 0.25, -0.5, 0.22]].forEach(function (o, k) {
                var pts = []; for (var i = 0; i <= 160; i++) { var a = i / 160 * TAU; pts.push(new T.Vector3(Math.cos(a) * o[0], 0, Math.sin(a) * o[0])); }
                var line = new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({ color: 0x7db4f0, transparent: true, opacity: 0.5, dashSize: 0.05, gapSize: 0.07 }));
                line.computeLineDistances();
                var pivot = new T.Group(); pivot.rotation.set(o[1], 0, o[2]); pivot.add(line);
                var sat = new T.Mesh(new T.SphereGeometry(0.042, 16, 12), new T.MeshBasicMaterial({ color: k === 1 ? 0xff5a67 : 0xbfe0ff }));
                var halo = new T.Sprite(new T.SpriteMaterial({ map: radialTex(k === 1 ? 'rgba(255,90,103,.95)' : 'rgba(150,200,255,.95)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
                halo.scale.setScalar(0.34); sat.add(halo);
                var carrier = new T.Group(); carrier.add(sat); sat.position.x = o[0]; pivot.add(carrier);
                orbits.push({ pivot: pivot, carrier: carrier, speed: o[3] }); bTilt.add(pivot);
            });

            // partículas
            var PC = isMobile ? 360 : 820, pos = new Float32Array(PC * 3), col = new Float32Array(PC * 3), c = new T.Color(), j;
            for (j = 0; j < PC; j++) {
                pos[j * 3] = (Math.random() - 0.5) * 15; pos[j * 3 + 1] = (Math.random() - 0.5) * 8.4; pos[j * 3 + 2] = -6 + Math.random() * 8.5;
                c.setHex(Math.random() < 0.1 ? 0xff5a67 : Math.random() < 0.5 ? 0x7db4f0 : 0xdcecff); col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b;
            }
            var pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3)); pg.setAttribute('color', new T.BufferAttribute(col, 3));
            var particles = new T.Points(pg, new T.PointsMaterial({ size: 0.07, map: radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending }));
            scene.add(particles);

            var W = 1, H = 1, tReady = 0, upp = 1;
            function resize() {
                W = host.clientWidth; H = host.clientHeight;
                renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix();
                upp = (2 * DIST * Math.tan(FOV * Math.PI / 360)) / H;
                var g = Hero.geom, big = g.D;
                bTilt.position.set((g.cx - W / 2) * upp, -(g.cy - H / 2) * upp, 0); bTilt.userData.s = big * 0.3 * upp;
                var mob = W < 960, ox = mob ? 0.34 : -0.37, oy = mob ? 0.36 : -0.3;
                cTilt.position.set((g.cx + g.D * ox - W / 2) * upp, -(g.cy + g.D * oy - H / 2) * upp, 1.2); cTilt.userData.s = big * 0.1 * upp;
                particles.scale.x = clamp(W / H / 1.7, 0.4, 1.3);
            }
            return {
                host: host, resize: resize, renderer: renderer,
                render: function (t, dt) {
                    if (reduceMotion) { t = 0; dt = 0; }       // sin animación autónoma si el usuario lo pidió
                    if (!tReady && root.classList.contains('is-ready')) tReady = t || 1;
                    var k = tReady ? easeOutBack(clamp((t - tReady) / 1700)) : 0, kk = tReady ? easeOut(clamp((t - tReady) / 2200)) : 0;
                    if (reduceMotion && tReady) { k = 1; kk = 1; }
                    var p = Hero.p, fade = 1 - range(p, 0.2, 0.9);
                    var s = (bTilt.userData.s || 1) * (0.25 + 0.75 * k) * (1 - p * 0.18);
                    bTilt.scale.setScalar(s);
                    bearing.spin.rotation.y -= dt * 0.0008;
                    bTilt.rotation.x = -0.34 + pointer.y * 0.2 + Math.sin(t * 0.00042) * 0.05;
                    bTilt.rotation.y = 0.42 + pointer.x * 0.32 + p * 1.7 + (1 - kk) * 5.2;
                    orbits.forEach(function (o) { o.carrier.rotation.y += dt * 0.001 * o.speed * 2; });

                    var cs = (cTilt.userData.s || 1) * (0.2 + 0.8 * k);
                    cTilt.scale.setScalar(cs);
                    caster.swivel.rotation.y = Math.sin(t * 0.00055) * 0.9 + 0.6;
                    caster.wheel.rotation.x -= dt * 0.0016;
                    cTilt.rotation.x = 0.12 + pointer.y * 0.1; cTilt.rotation.y = -0.45 + pointer.x * 0.25;
                    cTilt.position.y += Math.sin(t * 0.0007) * 0.0012;

                    particles.rotation.y = t * 0.00004 + pointer.x * 0.08; particles.position.y = Math.sin(t * 0.00025) * 0.15 + p * 0.8;
                    particles.material.opacity = 0.85 * fade;
                    renderer.render(scene, cam);
                }
            };
        }

        /* ════════════════ ESCENA PRODUCTOS (ligada al scroll) ════════════════ */
        function createShowcase() {
            var canvas = showCanvas, host = canvas.parentNode;
            var renderer = makeRenderer(canvas), scene = new T.Scene();
            var DIST = 9, FOV = 30, cam = new T.PerspectiveCamera(FOV, 1, 0.1, 100); cam.position.set(0, 0, DIST);
            var env = makeEnv(renderer); scene.environment = env; addLights(scene);
            var M = makeMats(env);

            var bearing = buildBearing(M), bTilt = new T.Group(), bOrient = new T.Group();
            bOrient.add(bearing.root); bTilt.add(bOrient); scene.add(bTilt);
            var caster = buildCaster(M), cTilt = new T.Group(), cHold = new T.Group();
            cHold.position.y = -0.42; cHold.add(caster.root); cTilt.add(cHold); scene.add(cTilt);

            var labels = $$('.anchor', host.parentNode), byKey = {};
            labels.forEach(function (el) { byKey[el.getAttribute('data-anchor')] = el; });
            var all = {}, k; for (k in bearing.anchors) all[k] = bearing.anchors[k]; for (k in caster.anchors) all[k] = caster.anchors[k];

            var W = 1, H = 1, upp = 1, sb = 1, sc = 1, v3 = new T.Vector3(), eb = 0, ec = 0, state = { p: 0 };
            function resize() {
                W = host.clientWidth; H = host.clientHeight;
                renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix();
                upp = (2 * DIST * Math.tan(FOV * Math.PI / 360)) / H;
                sb = Math.min(0.31 * Math.min(W, H), 0.29 * H) * upp;
                sc = Math.min(0.26 * H, 0.2 * W) * upp;
            }
            function place(key, vis) {
                var el = byKey[key]; if (!el) return;
                if (vis < 0.02) { el.style.opacity = '0'; return; }
                all[key].getWorldPosition(v3); v3.project(cam);
                var x = (v3.x * 0.5 + 0.5) * W, y = (-v3.y * 0.5 + 0.5) * H;
                el.classList.toggle('anchor--left', x > W * 0.56);
                el.style.opacity = String(clamp((vis - 0.35) * 2.2));
                el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-4px,-50%)';
            }
            return {
                host: host, resize: resize, renderer: renderer,
                render: function (t) {
                    var p = Showcase.p;
                    state.p += (p - state.p) * ((window.__carrillo || {}).instant ? 1 : 0.09);   // amortigua el movimiento: sensación "slow motion"
                    var q = state.p;
                    var bVis = smooth(0.0, 0.07, q) * (1 - smooth(0.46, 0.55, q)), cVis = smooth(0.5, 0.6, q);
                    var tb = smooth(0.2, 0.33, q) * (1 - smooth(0.41, 0.5, q)), tc = smooth(0.76, 0.9, q);
                    var kx = (window.__carrillo || {}).instant ? 1 : 0.1; eb += (tb - eb) * kx; ec += (tc - ec) * kx;

                    bTilt.visible = bVis > 0.002; cTilt.visible = cVis > 0.002;
                    bearing.setExplode(eb); caster.setExplode(ec);

                    // rodamiento: de frente (ensamblado) a vista explosionada en eje vertical
                    bOrient.rotation.x = lerp(1.2, 0.42, easeInOut(eb));
                    bTilt.rotation.y = 0.45 + q * 9.5 + pointer.x * 0.15;
                    bTilt.rotation.x = -0.08 + pointer.y * 0.08;
                    bTilt.scale.setScalar(sb * (0.3 + 0.7 * easeOut(bVis)) * lerp(1, 0.86, eb));
                    bTilt.position.set(0, (0.1 - 0.05 * eb) * sb, 0);
                    bearing.spin.rotation.y = -(q * 14 + t * 0.0002) * (1 - 0.7 * eb);

                    // rueda: entra girando, hace swivel de 360° y se explosiona
                    cTilt.rotation.y = -0.55 + range(q, 0.56, 0.78) * TAU * 0.5 + pointer.x * 0.15;
                    cTilt.rotation.x = 0.1 + 0.18 * ec + pointer.y * 0.06;
                    caster.swivel.rotation.y = range(q, 0.56, 0.8) * TAU * 1.0;
                    caster.wheel.rotation.x = -q * 22;
                    cTilt.scale.setScalar(sc * (0.3 + 0.7 * easeOut(cVis)) * lerp(1, 0.8, ec));
                    cTilt.position.set(0, -0.58 * ec * sc, 0);

                    place('b-outer', bTilt.visible ? eb : 0); place('b-balls', bTilt.visible ? eb : 0);
                    place('b-cage', bTilt.visible ? eb : 0); place('b-inner', bTilt.visible ? eb : 0);
                    place('c-plate', cTilt.visible ? ec : 0); place('c-fork', cTilt.visible ? ec : 0);
                    place('c-tread', cTilt.visible ? ec : 0); place('c-axle', cTilt.visible ? ec : 0);
                    renderer.render(scene, cam);
                }
            };
        }

        safeScene('hero', createHero);
        safeScene('showcase', createShowcase);
        if (!scenes.length) { root.classList.add('no-webgl'); return; }

        /* ── bucle de render: solo se dibuja lo que está en pantalla ── */
        var visible = new Map();
        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (entries) { entries.forEach(function (en) { visible.set(en.target, en.isIntersecting); }); }, { rootMargin: '120px' });
            scenes.forEach(function (s) { io.observe(s.host); visible.set(s.host, true); });
        }
        var doResize = function () { scenes.forEach(function (s) { s.resize(); }); };
        doResize(); Scroll.onMeasure(doResize);
        // Calidad adaptativa: si el equipo no sostiene ~30 fps, baja la resolución del render
        var TEST = window.__carrillo || {};
        var Q = { max: Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75), ema: 16, down: 0, up: 0 }; Q.cur = Q.max;
        var applyQ = function () { scenes.forEach(function (s) { s.renderer.setPixelRatio(Q.cur); s.resize(); }); };
        var last = performance.now();
        Scroll.onFrame(function (t) {
            var raw = t - last, dt = Math.min(64, raw); last = t;
            if (!TEST.noAdapt && raw > 0) {
                Q.ema = Q.ema * 0.85 + Math.min(raw, 1500) * 0.15;
                if (Q.ema > 38 && Q.cur > 0.6 && t - Q.down > 700) { Q.cur = Math.max(0.6, Q.cur - 0.2); Q.down = t; applyQ(); }
                else if (Q.ema < 19 && Q.cur < Q.max && t - Q.up > 2500 && t - Q.down > 4000) { Q.cur = Math.min(Q.max, Q.cur + 0.1); Q.up = t; applyQ(); }
            }
            pointer.x += (pointer.tx - pointer.x) * 0.06; pointer.y += (pointer.ty - pointer.y) * 0.06;
            scenes.forEach(function (s) { if (visible.get(s.host) !== false) s.render(t, dt); });
        });
        Showcase.api = true;
    }

    /* ─────────────────────────────────────────────────────────────────────
       ARRANQUE
       ───────────────────────────────────────────────────────────────────── */
    function boot() {
        safe('scroll', function () { Scroll.init(); });
        safe('links', initLinks);
        safe('reveal', initReveal);
        safe('hero', initHero);
        safe('manifesto', initManifesto);
        safe('stage', initStage);
        safe('showcase', initShowcase);
        safe('blueprint', initBlueprint);
        safe('process', initProcess);
        safe('footer', initFooter);
        safe('nav', initNav);
        safe('pointer', initPointerFX);
        safe('spotlight', initSpotlight);
        safe('marquee', initMarquee);
        safe('faq', initFaq);
        safe('form', initForm);
        safe('three', initThree);
        Scroll.measure();
        runLoader(function () { Scroll.measure(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
