/* A compact, theme-aware Background picker for the Freebie phase.
 * The listbox is mounted under body so Foundry's scrolling panes never clip it.
 * Selecting a Background delegates to the existing creation/draft logic.
 */
const luminance = color => {
    const parts = (color.match(/[\d.]+/g) || []).map(Number);
    return parts.length >= 3 ? (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255 : 0;
};

export function setupBackgroundDropdown(root, onSelect) {
    const combo = root.querySelector('[data-background-combo]');
    if (!combo) return () => {};
    const trigger = combo.querySelector('[data-background-toggle]');
    const template = combo.querySelector('[data-background-options]');
    const options = [...(template?.content.querySelectorAll('[data-background-option]') || [])].map(node => ({
        key: node.dataset.key,
        name: node.textContent.trim(),
        description: node.dataset.description || ''
    }));
    if (!trigger || !options.length) return () => {};

    let popup = null;
    let active = -1;
    const listeners = [];
    const watch = (node, type, fn, opts) => {
        node.addEventListener(type, fn, opts);
        listeners.push(() => node.removeEventListener(type, fn, opts));
    };
    const close = () => {
        popup?.remove();
        popup = null;
        active = -1;
        trigger.setAttribute('aria-expanded', 'false');
        trigger.removeAttribute('aria-controls');
        trigger.removeAttribute('aria-activedescendant');
    };
    const position = () => {
        if (!popup) return;
        if (!combo.isConnected) { close(); return; }
        const rect = trigger.getBoundingClientRect();
        const main = combo.closest('.mc-main');
        if (main) {
            const panel = main.getBoundingClientRect();
            if (rect.bottom <= panel.top || rect.top >= panel.bottom) { close(); return; }
        }
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        const width = Math.min(Math.max(rect.width, 260), Math.max(180, vw - 16));
        const below = vh - rect.bottom - 10;
        const above = rect.top - 10;
        const upward = below < 205 && above > below;
        const room = upward ? above : below;
        const height = Math.max(75, Math.min(310, room - 6));
        popup.style.width = `${width}px`;
        popup.style.maxHeight = `${height}px`;
        popup.style.left = `${Math.min(Math.max(8, rect.left), Math.max(8, vw - width - 8))}px`;
        popup.style.top = upward
            ? `${Math.max(8, rect.top - Math.min(popup.scrollHeight + 2, height) - 4)}px`
            : `${Math.max(8, rect.bottom + 4)}px`;
        const dark = luminance(getComputedStyle(trigger).color) > 0.53;
        popup.style.colorScheme = dark ? 'dark' : 'light';
        popup.style.setProperty('--mc-popup-bg', dark ? '#25242d' : '#ffffff');
        popup.style.setProperty('--mc-popup-fg', dark ? '#f3f1f5' : '#1f2530');
        popup.style.setProperty('--mc-popup-border', dark ? '#666575' : '#a4adbd');
        popup.style.setProperty('--mc-popup-hover', dark ? '#39455e' : '#e4ebf7');
        popup.style.setProperty('--mc-popup-selected', dark ? '#364c69' : '#d9e8fb');
    };
    const choose = (item) => {
        close();
        onSelect(item.key);
    };
    const move = (delta) => {
        if (!popup) return;
        active = (active + delta + options.length) % options.length;
        const buttons = [...popup.querySelectorAll('.mc-concept-option')];
        buttons.forEach((node, index) => node.classList.toggle('is-active', index === active));
        const target = buttons[active];
        if (!target) return;
        trigger.setAttribute('aria-activedescendant', target.id);
        target.scrollIntoView({block: 'nearest'});
    };
    const open = () => {
        if (popup) return;
        popup = document.createElement('div');
        popup.className = 'mc-concept-popup mc-background-popup';
        popup.id = `mc-background-popup-${Math.random().toString(36).slice(2, 10)}`;
        popup.setAttribute('role', 'listbox');
        popup.setAttribute('aria-label', 'Available Backgrounds');
        const windowElement = combo.closest('.window-app, .application');
        const z = parseInt(getComputedStyle(windowElement || root).zIndex, 10);
        popup.style.zIndex = String(Math.max(10000, (Number.isFinite(z) ? z : 0) + 20));
        options.forEach((item, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.role = 'option';
            btn.className = 'mc-concept-option';
            btn.id = `${popup.id}-option-${index}`;
            btn.setAttribute('aria-selected', 'false');
            const name = document.createElement('span');
            name.textContent = item.name;
            const hint = document.createElement('small');
            hint.className = 'mc-background-option-hint';
            hint.textContent = '1 FP / dot';
            btn.append(name, hint);
            if (item.description) btn.title = item.description;
            btn.addEventListener('click', () => choose(item));
            popup.append(btn);
        });
        document.body.append(popup);
        trigger.setAttribute('aria-expanded', 'true');
        trigger.setAttribute('aria-controls', popup.id);
        position();
    };

    watch(trigger, 'click', () => { if (popup) close(); else open(); });
    watch(trigger, 'keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            if (!popup) open();
            move(event.key === 'ArrowDown' ? 1 : -1);
        } else if (event.key === 'Enter' && popup && active >= 0) {
            event.preventDefault();
            event.stopPropagation();
            choose(options[active]);
        } else if (event.key === 'Escape' && popup) {
            event.preventDefault();
            event.stopPropagation();
            close();
        } else if (event.key === 'Tab' && popup) close();
    });
    watch(document, 'pointerdown', event => {
        if (popup && !combo.contains(event.target) && !popup.contains(event.target)) close();
    }, true);
    watch(document, 'scroll', () => { if (popup) position(); }, true);
    watch(window, 'resize', () => { if (popup) position(); });

    return () => { close(); listeners.forEach(unlisten => unlisten()); };
}
