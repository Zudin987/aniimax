// Shared help for settings and results. Text is read when opened so dynamic help stays current.
const HELP_ID = 'context-help';
const escape = value => String(value).replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function infoButton(title, text) {
    return `<button type="button" class="info-button" data-help="${escape(text)}" aria-label="About ${escape(title)}" aria-controls="${HELP_ID}" aria-expanded="false"><span aria-hidden="true">i</span></button>`;
}

export function initContextHelp() {
    const card = document.createElement('div');
    card.id = HELP_ID;
    card.className = 'help-popover';
    card.setAttribute('role', 'tooltip');
    card.hidden = true;
    document.body.append(card);
    let target = null;
    let pinned = false;
    let closeTimer;
    let previousDescription;

    const buttonAt = node => node?.closest?.('.info-button');
    const cancelClose = () => clearTimeout(closeTimer);
    function hide() {
        cancelClose();
        if (target) {
            target.setAttribute('aria-expanded', 'false');
            if (previousDescription === null) target.removeAttribute('aria-describedby');
            else target.setAttribute('aria-describedby', previousDescription);
        }
        target = null;
        pinned = false;
        card.hidden = true;
    }
    function place() {
        if (!target?.isConnected) return hide();
        const box = target.getBoundingClientRect();
        const { width, height } = card.getBoundingClientRect();
        const margin = 12;
        const left = Math.max(margin, Math.min(box.left + box.width / 2 - width / 2,
            window.innerWidth - width - margin));
        const below = box.bottom + 8;
        const top = below + height <= window.innerHeight - margin ? below
            : Math.max(margin, box.top - height - 8);
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
    }
    function show(button) {
        cancelClose();
        if (target !== button) {
            hide();
            target = button;
            previousDescription = button.getAttribute('aria-describedby');
            button.setAttribute('aria-describedby', [previousDescription, HELP_ID].filter(Boolean).join(' '));
        }
        const sources = (button.dataset.helpSource || '').split(/\s+/).filter(Boolean);
        const text = sources.length ? sources.map(id => {
            const source = document.getElementById(id);
            const paragraphs = source?.querySelectorAll('p');
            return paragraphs?.length ? [...paragraphs].map(p => p.textContent.trim()).join('\n\n')
                : source?.textContent.trim() || '';
        }).filter(Boolean).join('\n\n') : button.dataset.help || '';
        const title = document.createElement('strong');
        title.className = 'help-title';
        title.textContent = button.getAttribute('aria-label').replace(/^About /, '');
        const body = document.createElement('div');
        body.className = 'help-text';
        body.textContent = text;
        card.replaceChildren(title, body);
        button.setAttribute('aria-expanded', 'true');
        card.hidden = false;
        place();
    }
    function closeLater() {
        cancelClose();
        if (!pinned && document.activeElement !== target) closeTimer = setTimeout(hide, 150);
    }
    document.addEventListener('pointerover', event => {
        if (card.contains(event.target)) return cancelClose();
        const button = buttonAt(event.target);
        if (button && event.pointerType !== 'touch' && !pinned) show(button);
    });
    document.addEventListener('pointerout', event => {
        if (event.pointerType === 'touch' || !target) return;
        if ((target.contains(event.target) || card.contains(event.target))
            && !target.contains(event.relatedTarget) && !card.contains(event.relatedTarget)) closeLater();
    });
    document.addEventListener('focusin', event => {
        const button = buttonAt(event.target);
        if (button) show(button);
    });
    document.addEventListener('focusout', () => {
        setTimeout(() => {
            if (target && document.activeElement !== target && !card.contains(document.activeElement)) hide();
        }, 0);
    });
    document.addEventListener('click', event => {
        const button = buttonAt(event.target);
        if (button) {
            // Help never toggles a surrounding control or submits a form.
            event.preventDefault();
            event.stopPropagation();
            if (pinned && target === button) hide();
            else { show(button); pinned = true; }
        } else if (!card.contains(event.target)) hide();
    }, true);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && target) {
            hide();
            event.stopPropagation();
            event.preventDefault();
        }
    }, true);
    window.addEventListener('scroll', event => {
        if (!card.contains(event.target)) hide();
    }, { passive: true, capture: true });
    window.addEventListener('resize', () => { if (target) place(); }, { passive: true });
}
