/* Theme-aware Specialty combobox for Freebies and Final Review.
 * Uses a popup mounted under <body> to escape ApplicationV2 scroll clipping.
 * Keeps the existing data-path input so the character/draft handlers own all edits.
 */

function lightness(color) {
    const channels = (color.match(/[\d.]+/g) || []).map(Number);
    if (channels.length < 3) return 0;
    return (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) / 255;
}

let popupSerial = 0;

export function setupSpecialtyDropdowns(root) {
    const combos = [...root.querySelectorAll('[data-specialty-combo]')];
    if (!combos.length) return () => {};

    const cleaners = [];
    let current = null;
    let applyingSelection = false;
    function listen(node, type, handler, options) {
        node.addEventListener(type, handler, options);
        cleaners.push(() => node.removeEventListener(type, handler, options));
    }

    function close() {
        if (!current) return;
        const { popup, input, toggle } = current;
        popup.remove();
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-controls');
        input.removeAttribute('aria-activedescendant');
        toggle.setAttribute('aria-expanded', 'false');
        current = null;
    }

    function position() {
        if (!current) return;
        const { combo, popup, input } = current;
        if (!combo.isConnected) { close(); return; }
        const r = combo.getBoundingClientRect();
        const viewWidth = document.documentElement.clientWidth;
        const viewHeight = document.documentElement.clientHeight;
        const panel = combo.closest('.mc-main');
        if (panel) {
            const v = panel.getBoundingClientRect();
            if (r.bottom <= v.top || r.top >= v.bottom) { close(); return; }
        }
        const width = Math.min(Math.max(r.width, 300), Math.max(160, viewWidth - 16));
        const roomBelow = viewHeight - r.bottom - 12;
        const roomAbove = r.top - 12;
        const upward = roomBelow < 195 && roomAbove > roomBelow;
        const room = upward ? roomAbove : roomBelow;
        const height = Math.max(80, Math.min(310, room - 6));
        popup.style.width = `${width}px`;
        popup.style.maxHeight = `${height}px`;
        popup.style.left = `${Math.min(Math.max(8, r.left), Math.max(8, viewWidth - width - 8))}px`;
        popup.style.top = upward
            ? `${Math.max(8, r.top - Math.min(popup.scrollHeight + 2, height) - 4)}px`
            : `${Math.max(8, r.bottom + 4)}px`;
        const dark = lightness(getComputedStyle(input).color) > 0.53;
        popup.style.colorScheme = dark ? 'dark' : 'light';
        popup.style.setProperty('--mc-popup-bg', dark ? '#25242d' : '#ffffff');
        popup.style.setProperty('--mc-popup-fg', dark ? '#f3f1f5' : '#1f2530');
        popup.style.setProperty('--mc-popup-border', dark ? '#666575' : '#a4adbd');
        popup.style.setProperty('--mc-popup-hover', dark ? '#39455e' : '#e4ebf7');
        popup.style.setProperty('--mc-popup-selected', dark ? '#364c69' : '#d9e8fb');
    }

    function select(text) {
        if (!current) return;
        const input = current.input;
        const changed = input.value !== text;
        input.value = text;
        close();
        if (changed) {
            // Keep the live data-path listener, but avoid reopening our popup
            // while sending the synthetic input event.
            applyingSelection = true;
            try {
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            } finally {
                applyingSelection = false;
            }
        }
        if (input.isConnected) input.focus();
    }

    function paint(filter) {
        if (!current) return;
        const { input, popup, suggestions } = current;
        const term = filter ? input.value.trim().toLocaleLowerCase() : '';
        const options = term ? suggestions.filter(item => item.toLocaleLowerCase().includes(term)) : suggestions;
        current.displayed = options;
        current.active = -1;
        current.filtered = filter;
        popup.replaceChildren();
        if (!options.length) {
            const note = document.createElement('div');
            note.className = 'mc-concept-option-empty';
            note.textContent = suggestions.length
                ? 'No suggestions match. You may enter a custom specialty.'
                : 'Type your own specialty.';
            popup.append(note);
        }
        for (let index = 0; index < options.length; index++) {
            const text = options[index];
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'mc-concept-option';
            option.role = 'option';
            option.id = `${popup.id}-option-${index}`;
            option.textContent = text;
            const selected = text.toLocaleLowerCase() === input.value.trim().toLocaleLowerCase();
            option.setAttribute('aria-selected', String(selected));
            if (selected) option.classList.add('is-selected');
            option.addEventListener('pointerdown', e => e.preventDefault());
            option.addEventListener('click', () => select(text));
            popup.append(option);
        }
        if (filter && suggestions.length) {
            const all = document.createElement('button');
            all.type = 'button';
            all.className = 'mc-concept-show-all';
            all.textContent = `Show all ${suggestions.length} suggestions`;
            all.addEventListener('pointerdown', e => e.preventDefault());
            all.addEventListener('click', () => paint(false));
            popup.append(all);
        }
        input.removeAttribute('aria-activedescendant');
        position();
    }

    function open(combo, filter = false) {
        if (current?.combo !== combo) close();
        if (!current) {
            const input = combo.querySelector('[data-specialty-input]');
            const toggle = combo.querySelector('[data-specialty-toggle]');
            const template = combo.querySelector('[data-specialty-options]');
            const suggestions = [...template.content.querySelectorAll('[data-specialty-option]')]
                .map(item => item.textContent.trim()).filter(Boolean);
            const popup = document.createElement('div');
            popup.className = 'mc-concept-popup mc-specialty-popup';
            popup.id = `mc-specialty-popup-${++popupSerial}`;
            popup.setAttribute('role', 'listbox');
            popup.setAttribute('aria-label', 'Specialty suggestions');
            const windowElement = combo.closest('.window-app, .application');
            const z = parseInt(getComputedStyle(windowElement || root).zIndex, 10);
            popup.style.zIndex = String(Math.max(10000, (Number.isFinite(z) ? z : 0) + 20));
            document.body.append(popup);
            current = { combo, input, toggle, popup, suggestions, displayed: [], active: -1, filtered: false };
            input.setAttribute('aria-expanded', 'true');
            input.setAttribute('aria-controls', popup.id);
            toggle.setAttribute('aria-expanded', 'true');
        }
        paint(filter);
    }

    function move(delta) {
        if (!current?.displayed.length) return;
        const buttons = [...current.popup.querySelectorAll('.mc-concept-option')];
        const n = buttons.length;
        current.active = (current.active + delta + n) % n;
        buttons.forEach((button, index) => button.classList.toggle('is-active', index === current.active));
        const target = buttons[current.active];
        current.input.setAttribute('aria-activedescendant', target.id);
        target.scrollIntoView({ block: 'nearest' });
    }

    for (const combo of combos) {
        const input = combo.querySelector('[data-specialty-input]');
        const toggle = combo.querySelector('[data-specialty-toggle]');
        listen(toggle, 'pointerdown', e => e.preventDefault());
        listen(toggle, 'click', () => {
            if (current?.combo === combo) {
                if (current.filtered) paint(false);
                else close();
            } else {
                open(combo, false);
                input.focus();
            }
        });
        listen(input, 'input', () => { if (!applyingSelection) open(combo, true); });
        listen(input, 'keydown', event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                if (current?.combo !== combo) open(combo, false);
                move(event.key === 'ArrowDown' ? 1 : -1);
            } else if (event.key === 'Enter' && current?.combo === combo) {
                if (current.active >= 0) {
                    event.preventDefault();
                    event.stopPropagation();
                    select(current.displayed[current.active]);
                } else close();
            } else if (event.key === 'Escape' && current?.combo === combo) {
                event.preventDefault();
                event.stopPropagation();
                close();
            } else if (event.key === 'Tab' && current?.combo === combo) close();
        });
    }

    listen(document, 'pointerdown', event => {
        if (current && !current.combo.contains(event.target) && !current.popup.contains(event.target)) close();
    }, true);
    listen(document, 'scroll', () => { if (current) position(); }, true);
    listen(window, 'resize', () => { if (current) position(); });

    return () => {
        close();
        for (const remove of cleaners) remove();
    };
}
