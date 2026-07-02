(function() {
    // ----- config -----
    const API_BASE = 'http://localhost:5000/api/websites';

    // ----- state -----
    let websites = [];
    let sortMode = 'recent'; // recent, alpha-az, alpha-za, fav

    // DOM refs
    const grid = document.getElementById('cardGrid');
    const searchInput = document.getElementById('searchInput');
    const addBtn = document.getElementById('addBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalUrl = document.getElementById('modalUrl');
    const modalCategory = document.getElementById('modalCategory');
    const modalNotes = document.getElementById('modalNotes');
    const modalCancel = document.getElementById('modalCancel');
    const modalSave = document.getElementById('modalSave');
    const themeToggle = document.getElementById('themeToggle');
    const totalSpan = document.getElementById('totalCount');
    const favSpan = document.getElementById('favCount');
    const catSpan = document.getElementById('catCount');

    // ----- API helpers -----
    async function apiGet() {
        const res = await fetch(API_BASE);
        if (!res.ok) throw new Error('Failed to load websites');
        return res.json();
    }

    async function apiCreate(payload) {
        const res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to add website');
        }
        return res.json();
    }

    async function apiUpdate(id, payload) {
        const res = await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to update website');
        return res.json();
    }

    async function apiToggleFav(id) {
        const res = await fetch(`${API_BASE}/${id}/fav`, { method: 'PATCH' });
        if (!res.ok) throw new Error('Failed to toggle favorite');
        return res.json();
    }

    async function apiVisit(id) {
        const res = await fetch(`${API_BASE}/${id}/visit`, { method: 'PATCH' });
        if (!res.ok) throw new Error('Failed to record visit');
        return res.json();
    }

    async function apiDelete(id) {
        const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete website');
        return res.json();
    }

    // favicon helper
    function getFavicon(url) {
        try {
            const u = new URL(url);
            return `${u.origin}/favicon.ico`;
        } catch {
            return '';
        }
    }

    function generateFallback(name) {
        return name ? name.charAt(0).toUpperCase() : '?';
    }

    // ----- load from backend -----
    async function loadFromServer() {
        try {
            websites = await apiGet();
        } catch (e) {
            grid.innerHTML = `<div class="empty-state">
                <i class="fas fa-triangle-exclamation" style="font-size:2.4rem;opacity:0.3;"></i>
                <p style="margin-top:12px;">Couldn't reach the server. Is the backend running?</p>
            </div>`;
            websites = [];
        }
    }

    // ----- render -----
    function render() {
        let filtered = [...websites];
        // search
        const q = searchInput.value.trim().toLowerCase();
        if (q) {
            filtered = filtered.filter(w =>
                w.title.toLowerCase().includes(q) ||
                w.url.toLowerCase().includes(q) ||
                (w.category && w.category.toLowerCase().includes(q))
            );
        }
        // sort
        if (sortMode === 'recent') {
            filtered.sort((a, b) => b.added - a.added);
        } else if (sortMode === 'alpha-az') {
            filtered.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sortMode === 'alpha-za') {
            filtered.sort((a, b) => b.title.localeCompare(a.title));
        } else if (sortMode === 'fav') {
            filtered.sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
        }

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="empty-state"><i class="fas fa-inbox" style="font-size:2.4rem;opacity:0.3;"></i><p style="margin-top:12px;">No websites saved</p></div>`;
        } else {
            grid.innerHTML = filtered.map(w => {
                const favicon = getFavicon(w.url);
                const initial = generateFallback(w.title);
                const favClass = w.fav ? 'active' : '';
                return `
            <div class="website-card" data-id="${w._id}">
              <div class="card-header">
                <div class="card-favicon">
                  ${favicon ? `<img src="${favicon}" alt="favicon" onerror="this.style.display='none';this.parentElement.style.background='#6c5ce7';this.parentElement.innerHTML='${initial}'" />` : `<span style="background:#6c5ce7;width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:12px;">${initial}</span>`}
                </div>
                <span class="card-title">${w.title}</span>
              </div>
              <div class="card-url">${w.url}</div>
              <div class="card-meta">
                <span><i class="fas fa-tag"></i> ${w.category || 'Uncategorized'}</span>
                <span><i class="far fa-calendar-alt"></i> ${new Date(w.added).toLocaleDateString()}</span>
              </div>
              <div class="card-actions">
                <button class="btn btn-open" data-url="${w.url}"><i class="fas fa-external-link-alt"></i> Open</button>
                <button class="btn btn-edit" data-id="${w._id}"><i class="fas fa-edit"></i></button>
                <button class="btn btn-delete" data-id="${w._id}"><i class="fas fa-trash-alt"></i></button>
                <span class="visit-badge"><i class="fas fa-eye"></i> ${w.visits || 0}</span>
                <button class="btn-fav ${favClass}" data-id="${w._id}"><i class="fas fa-star"></i></button>
              </div>
            </div>
          `;
            }).join('');
        }

        // update stats
        totalSpan.textContent = websites.length;
        favSpan.textContent = websites.filter(w => w.fav).length;
        const cats = new Set(websites.map(w => w.category).filter(Boolean));
        catSpan.textContent = cats.size;

        // attach events
        document.querySelectorAll('.btn-open').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const url = btn.dataset.url;
                const id = btn.closest('.website-card')?.dataset.id;
                if (id) {
                    try {
                        const updated = await apiVisit(id);
                        const w = websites.find(x => x._id === id);
                        if (w) w.visits = updated.visits;
                        render();
                    } catch (err) {
                        console.error(err);
                    }
                }
                window.open(url, '_blank');
            });
        });
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const w = websites.find(x => x._id === id);
                if (!w) return;
                // simple edit: prompt (in production use modal)
                const newTitle = prompt('Edit title:', w.title);
                const newCat = prompt('Edit category:', w.category || '');
                const payload = {};
                if (newTitle !== null && newTitle.trim()) payload.title = newTitle.trim();
                if (newCat !== null) payload.category = newCat.trim() || 'Uncategorized';
                if (Object.keys(payload).length === 0) return;
                try {
                    const updated = await apiUpdate(id, payload);
                    Object.assign(w, updated);
                    render();
                } catch (err) {
                    alert(err.message);
                }
            });
        });
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (confirm('Delete this website?')) {
                    try {
                        await apiDelete(id);
                        websites = websites.filter(w => w._id !== id);
                        render();
                    } catch (err) {
                        alert(err.message);
                    }
                }
            });
        });
        document.querySelectorAll('.btn-fav').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                try {
                    const updated = await apiToggleFav(id);
                    const w = websites.find(x => x._id === id);
                    if (w) w.fav = updated.fav;
                    render();
                } catch (err) {
                    alert(err.message);
                }
            });
        });
    }

    // ----- add website via modal -----
    async function addWebsiteFromModal() {
        let url = modalUrl.value.trim();
        if (!url) {
            alert('Please enter a URL');
            return;
        }
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        try {
            new URL(url);
        } catch {
            alert('Invalid URL');
            return;
        }

        const category = modalCategory.value;
        const notes = modalNotes.value.trim();

        try {
            const newEntry = await apiCreate({ title: url, url, category, notes });
            websites.push(newEntry);
            render();
            closeModal();
        } catch (err) {
            alert(err.message);
        }
    }

    function openModal() {
        modalOverlay.classList.add('open');
        modalUrl.value = '';
        modalCategory.value = 'Others';
        modalNotes.value = '';
        modalUrl.focus();
    }

    function closeModal() {
        modalOverlay.classList.remove('open');
    }

    // ----- theme -----
    function toggleTheme() {
        document.body.classList.toggle('dark');
        const icon = themeToggle.querySelector('i');
        if (document.body.classList.contains('dark')) {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }

    // ----- init -----
    async function init() {
        await loadFromServer();
        render();

        // theme preference (kept in localStorage — purely a UI setting, not app data)
        if (localStorage.getItem('webvault_theme') === 'dark') {
            document.body.classList.add('dark');
            themeToggle.querySelector('i').className = 'fas fa-sun';
        }

        addBtn.addEventListener('click', openModal);
        modalCancel.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
        modalSave.addEventListener('click', addWebsiteFromModal);
        modalUrl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') modalSave.click();
        });
        themeToggle.addEventListener('click', () => {
            toggleTheme();
            localStorage.setItem('webvault_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });

        // search debounce
        searchInput.addEventListener('input', render);

        // sort shortcut via keyboard (1-4)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '1') {
                    sortMode = 'recent';
                    render();
                    e.preventDefault();
                }
                if (e.key === '2') {
                    sortMode = 'alpha-az';
                    render();
                    e.preventDefault();
                }
                if (e.key === '3') {
                    sortMode = 'alpha-za';
                    render();
                    e.preventDefault();
                }
                if (e.key === '4') {
                    sortMode = 'fav';
                    render();
                    e.preventDefault();
                }
            }
        });
    }

    init();
})();
