import { recommendedAffinityIds } from './affinity-recommendations.js';
/* A theme-aware, full-size listbox for the Concept fields.
 * Avoid native <datalist>/<select> popups, which Foundry cannot reliably theme
 * and which hide all other suggestions after a value is typed or chosen.
 */

function perceivedLightness(color) {
    const rgba = color.match(/[\d.]+/g)?.map(Number) ?? [];
    if (rgba.length < 3) return 0;
    const [r, g, b] = rgba;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function setupConceptDropdowns(root, { selectSphere, getSphere } = {}) {
    const combos = [...root.querySelectorAll('[data-concept-combo]')];
    if (!combos.length) return () => {};

    let current = null;
    let applyingSuggestion = false;
    let serial = 0;
    const cleanupFns = [];
    const watch = (node, event, handler, options) => {
        node.addEventListener(event, handler, options);
        cleanupFns.push(() => node.removeEventListener(event, handler, options));
    };

    function closeMenu() {
        if (!current) return;
        const { popup, input, toggle } = current;
        popup.remove();
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-controls');
        input.removeAttribute('aria-activedescendant');
        toggle.setAttribute('aria-expanded', 'false');
        current = null;
    }

    function positionMenu() {
        if (!current) return;
        const { combo, popup, input } = current;
        if (!combo.isConnected) { closeMenu(); return; }
        const rect = combo.getBoundingClientRect();
        const viewW = document.documentElement.clientWidth;
        const viewH = document.documentElement.clientHeight;
        const main = combo.closest('.mc-main');
        if (main) {
            const viewport = main.getBoundingClientRect();
            if (rect.bottom < viewport.top || rect.top > viewport.bottom) { closeMenu(); return; }
        }
        const width = Math.min(Math.max(rect.width, 280), Math.max(180, viewW - 16));
        const below = viewH - rect.bottom - 10;
        const above = rect.top - 10;
        const upward = below < 200 && above > below;
        const space = upward ? above : below;
        const maxHeight = Math.max(80, Math.min(330, space - 4));
        const left = Math.min(Math.max(8, rect.left), Math.max(8, viewW - width - 8));
        popup.style.width = `${width}px`;
        popup.style.left = `${left}px`;
        popup.style.maxHeight = `${maxHeight}px`;
        popup.style.top = upward
            ? `${Math.max(8, rect.top - maxHeight - 4)}px`
            : `${Math.max(8, rect.bottom + 4)}px`;

        // Inherit *actual* window colors; the listbox lives in document.body
        // to escape the character panel's overflow and clipping.
        const fg = getComputedStyle(input).color;
        const dark = perceivedLightness(fg) > 0.53;
        popup.style.colorScheme = dark ? 'dark' : 'light';
        popup.style.setProperty('--mc-popup-bg', dark ? '#25242d' : '#ffffff');
        popup.style.setProperty('--mc-popup-fg', dark ? '#f3f1f5' : '#1f2530');
        popup.style.setProperty('--mc-popup-border', dark ? '#666575' : '#a4adbd');
        popup.style.setProperty('--mc-popup-hover', dark ? '#39455e' : '#e4ebf7');
        popup.style.setProperty('--mc-popup-selected', dark ? '#364c69' : '#d9e8fb');
    }

    function renderOptions(filter = false) {
        if (!current) return;
        const { input, popup, choices, strict } = current;
        // Read the CURRENT faction input, including unsaved text, so suggestions
        // immediately reflect edits without rerendering (and losing keyboard focus).
        const faction = root.querySelector('[data-path="identity.sect"]')?.value || '';
        const recommended = strict ? recommendedAffinityIds(faction) : [];
        const recommendedSet = new Set(recommended);
        const ranked = strict && recommended.length
            ? [...choices.filter(c => recommendedSet.has(c.value)).sort((a,b) => recommended.indexOf(a.value)-recommended.indexOf(b.value)),
               ...choices.filter(c => !recommendedSet.has(c.value))]
            : choices;
        const term = filter ? input.value.trim().toLocaleLowerCase() : '';
        const displayed = term
            ? ranked.filter(({label}) => label.toLocaleLowerCase().includes(term))
            : ranked;
        popup.replaceChildren();
        current.displayed = displayed;
        current.filtered = filter;
        current.active = -1;
        if (!displayed.length) {
            const message = document.createElement('div');
            message.className = 'mc-concept-option-empty';
            message.textContent = strict ? 'No matching Spheres. Choose from the list.' : 'No suggestions match. Your custom entry is allowed.';
            popup.append(message);
        }
        let lastGroup = '';
        displayed.forEach((item, index) => {
            if (strict && recommended.length) {
                const group = recommendedSet.has(item.value) ? 'recommended' : 'other';
                if (group !== lastGroup) {
                    const heading = document.createElement('div');
                    heading.className = 'mc-concept-option-heading';
                    heading.textContent = group === 'recommended' ? 'Recommended for ' + faction : 'Other Spheres';
                    heading.setAttribute('role','presentation');
                    popup.append(heading);
                    lastGroup = group;
                }
            }
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'mc-concept-option';
            option.id = `${popup.id}-option-${index}`;
            option.role = 'option';
            const name = document.createElement('span');
            name.textContent = item.label;
            option.append(name);
            if (strict && recommendedSet.has(item.value)) {
                option.classList.add('is-recommended');
                const badge = document.createElement('span');
                badge.className = 'mc-concept-recommendation-badge';
                badge.textContent = 'Recommended';
                option.append(badge);
            }
            const selected = strict
                ? item.value === getSphere?.()
                : item.label.toLocaleLowerCase() === input.value.toLocaleLowerCase();
            option.setAttribute('aria-selected', String(selected));
            if (selected) option.classList.add('is-selected');
            option.addEventListener('pointerdown', e => e.preventDefault());
            option.addEventListener('click', () => choose(item));
            popup.append(option);
        });
        if (filter) {
            const showAll = document.createElement('button');
            showAll.type = 'button';
            showAll.className = 'mc-concept-show-all';
            showAll.textContent = `Show all ${choices.length} options`;
            showAll.addEventListener('pointerdown', e => e.preventDefault());
            showAll.addEventListener('click', () => renderOptions(false));
            popup.append(showAll);
        }
        input.removeAttribute('aria-activedescendant');
        positionMenu();
    }

    function choose(item) {
        if (!current) return;
        const { input, strict } = current;
        input.value = item.value === '' && strict ? '' : item.label;
        closeMenu();
        if (strict) {
            selectSphere?.(item.value);
        } else {
            // Reuse the existing state/draft handlers for editable identity fields.
            applyingSuggestion = true;
            try {
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            } finally {
                applyingSuggestion = false;
            }
            if (input.isConnected) input.focus();
        }
    }

    function setActive(index) {
        if (!current || !current.displayed.length) return;
        const n = current.displayed.length;
        current.active = (index + n) % n;
        const options = [...current.popup.querySelectorAll('.mc-concept-option')];
        options.forEach((option, i) => option.classList.toggle('is-active', i === current.active));
        const target = options[current.active];
        if (!target) return;
        current.input.setAttribute('aria-activedescendant', target.id);
        target.scrollIntoView({ block: 'nearest' });
    }

    function openMenu(combo, filter = false) {
        if (current && current.combo !== combo) closeMenu();
        if (!current) {
            const input = combo.querySelector('[data-concept-input]');
            const toggle = combo.querySelector('[data-concept-toggle]');
            const source = combo.querySelector('[data-concept-options]');
            const choices = [...source.querySelectorAll('[data-concept-option]')].map(el => ({
                value: el.dataset.value ?? '', label: el.textContent.trim()
            }));
            const popup = document.createElement('div');
            popup.className = 'mc-concept-popup';
            popup.id = `mc-concept-popup-${++serial}-${Math.random().toString(36).slice(2, 7)}`;
            popup.setAttribute('role', 'listbox');
            const windowElement = combo.closest('.window-app, .application');
            const z = parseInt(getComputedStyle(windowElement || root).zIndex, 10);
            popup.style.zIndex = String(Math.max(10000, (Number.isFinite(z) ? z : 0) + 20));
            document.body.append(popup);
            current = { combo, input, toggle, popup, choices, strict: combo.dataset.conceptStrict === 'sphere', active: -1, displayed: [] };
            input.setAttribute('aria-expanded', 'true');
            input.setAttribute('aria-controls', popup.id);
            toggle.setAttribute('aria-expanded', 'true');
        }
        renderOptions(filter);
    }

    for (const combo of combos) {
        const input = combo.querySelector('[data-concept-input]');
        const toggle = combo.querySelector('[data-concept-toggle]');
        // Keep focus on the input: blurring a changed Affiliation can
        // otherwise trigger a Foundry rerender before the chevron click.
        watch(toggle, 'pointerdown', event => event.preventDefault());
        watch(toggle, 'click', () => {
            if (current?.combo === combo) {
                // A filtered list should expand to all suggestions on chevron;
                // the next click can close the full list normally.
                if (current.filtered) renderOptions(false);
                else closeMenu();
            } else { openMenu(combo, false); input.focus(); }
        });
        watch(input, 'input', () => {
            if (applyingSuggestion) return;
            // Sphere searches are transient: its stored ID changes only on selection.
            openMenu(combo, true);
        });
        watch(input, 'keydown', event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                if (current?.combo !== combo) openMenu(combo, false);
                setActive((current?.active ?? -1) + (event.key === 'ArrowDown' ? 1 : -1));
            } else if (event.key === 'Enter' && current?.combo === combo) {
                if (current.active >= 0) {
                    event.preventDefault();
                    choose(current.displayed[current.active]);
                } else closeMenu();
            } else if (event.key === 'Escape' && current?.combo === combo) {
                event.preventDefault();
                event.stopPropagation();
                closeMenu();
            } else if (event.key === 'Tab' && current?.combo === combo) closeMenu();
        });
        if (combo.dataset.conceptStrict === 'sphere') {
            watch(input, 'blur', () => {
                // Searching is not a valid Sphere selection by itself.
                // Revert to the actual stored rating if the user moves away.
                queueMicrotask(() => {
                    if (!input.isConnected) return;
                    const chosen = [...combo.querySelectorAll('[data-concept-option]')]
                        .find(opt => opt.dataset.value === getSphere?.());
                    input.value = chosen?.dataset.value ? chosen.textContent.trim() : '';
                });
            });
        }
    }

    watch(document, 'pointerdown', event => {
        if (current && !current.combo.contains(event.target) && !current.popup.contains(event.target)) closeMenu();
    }, true);
    watch(document, 'scroll', () => { if (current) positionMenu(); }, true);
    watch(window, 'resize', () => { if (current) positionMenu(); });

    return () => {
        closeMenu();
        for (const remove of cleanupFns) remove();
    };
}
