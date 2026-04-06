/**
 * ============================================================
 * MOTOSHOP — script.js
 * Lógica principal: cliente (index.html) + admin (admin.html)
 * Vanilla JS + Firebase SDK Compat v10
 * Imagens: URL externa (sem Firebase Storage)
 * ============================================================
 */

'use strict';

const WHATSAPP_NUMBER = '5500000000000'; // ← Substitua pelo número real
const YEAR_MIN  = 2000;
const YEAR_MAX  = 2026;
const PRICE_MAX = 200000;
const PAGE_SIZE = 12;

const PLACEHOLDER_IMG = 'data:image/svg+xml;base64,' + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260">' +
  '<rect width="400" height="260" fill="#18181C"/>' +
  '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ' +
  'font-family="sans-serif" font-size="14" fill="#5A5A68">Sem foto</text></svg>'
);

// ── Utilitários ──────────────────────────────────────────────

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

function formatKm(km) {
  return new Intl.NumberFormat('pt-BR').format(km) + ' km';
}

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

function checkFirebaseConfig() {
  if (!window.FIREBASE_CONFIGURED) {
    const warning = document.getElementById('firebase-warning');
    if (warning) { warning.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    return false;
  }
  return true;
}

function initFirebase() {
  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  return { db: firebase.firestore(), auth: firebase.auth() };
}

// ════════════════════════════════════════════════════════════
// PÁGINA DO CLIENTE (index.html)
// ════════════════════════════════════════════════════════════

function initClientPage() {
  if (!checkFirebaseConfig()) return;
  const { db } = initFirebase();

  const state = { allMotos: [], filtered: [], page: 1, priceMin: 0, priceMax: PRICE_MAX };

  const grid          = document.getElementById('motos-grid');
  const countDisplay  = document.getElementById('count-display');
  const loadMoreWrap  = document.getElementById('load-more-wrap');
  const btnLoadMore   = document.getElementById('btn-load-more');
  const loadMoreCount = document.getElementById('load-more-count');
  const filterStore   = document.getElementById('filter-store');
  const filterBrand   = document.getElementById('filter-brand');
  const filterYearMin = document.getElementById('filter-year-min');
  const filterYearMax = document.getElementById('filter-year-max');
  const sortSelect    = document.getElementById('sort-select');
  const btnClear      = document.getElementById('btn-clear-filters');
  const sliderMin     = document.getElementById('price-min');
  const sliderMax     = document.getElementById('price-max');
  const labelMin      = document.getElementById('price-min-label');
  const labelMax      = document.getElementById('price-max-label');
  const sliderFill    = document.getElementById('slider-fill');
  const storePills    = document.querySelectorAll('.store-pill');

  function populateYearSelects() {
    [filterYearMin, filterYearMax].forEach((sel, i) => {
      sel.innerHTML = `<option value="">${i === 0 ? 'De' : 'Até'}</option>`;
      for (let y = YEAR_MAX; y >= YEAR_MIN; y--) sel.innerHTML += `<option value="${y}">${y}</option>`;
    });
  }

  function updateSlider() {
    let min = parseInt(sliderMin.value), max = parseInt(sliderMax.value);
    if (min > max - 1000) { sliderMin.value = max - 1000; min = max - 1000; }
    state.priceMin = min; state.priceMax = max;
    labelMin.textContent = formatCurrency(min);
    labelMax.textContent = formatCurrency(max);
    const pMin = (min / PRICE_MAX) * 100, pMax = (max / PRICE_MAX) * 100;
    sliderFill.style.left = pMin + '%'; sliderFill.style.width = (pMax - pMin) + '%';
  }

  sliderMin.addEventListener('input', () => { updateSlider(); applyFilters(); });
  sliderMax.addEventListener('input', () => { updateSlider(); applyFilters(); });

  function applyFilters() {
    const store   = filterStore.value;
    const brand   = filterBrand.value;
    const yearMin = filterYearMin.value ? parseInt(filterYearMin.value) : YEAR_MIN;
    const yearMax = filterYearMax.value ? parseInt(filterYearMax.value) : YEAR_MAX;
    const sort    = sortSelect.value;

    state.filtered = state.allMotos.filter(m => {
      if (store && m.loja  !== store) return false;
      if (brand && m.marca !== brand) return false;
      if (m.ano < yearMin || m.ano > yearMax) return false;
      if (m.preco < state.priceMin || m.preco > state.priceMax) return false;
      return true;
    });

    state.filtered.sort((a, b) => {
      switch (sort) {
        case 'preco-asc':  return a.preco - b.preco;
        case 'preco-desc': return b.preco - a.preco;
        case 'ano-desc':   return b.ano - a.ano;
        case 'ano-asc':    return a.ano - b.ano;
        case 'km-asc':     return a.km - b.km;
        default: return (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0);
      }
    });
    state.page = 1;
    renderGrid();
  }

  function renderGrid() {
    const total = state.filtered.length, end = state.page * PAGE_SIZE;
    countDisplay.textContent = total;
    grid.innerHTML = '';

    if (total === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h3>Nenhuma moto encontrada</h3><p>Tente ajustar os filtros.</p></div>`;
      loadMoreWrap.style.display = 'none';
      return;
    }

    state.filtered.slice(0, end).forEach(moto => grid.appendChild(buildCard(moto)));

    if (end < total) {
      loadMoreWrap.style.display = 'block';
      loadMoreCount.textContent  = `Mostrando ${Math.min(end, total)} de ${total} motos`;
      btnLoadMore.textContent    = `Ver Mais ${Math.min(total - end, PAGE_SIZE)} Motos`;
    } else {
      loadMoreWrap.style.display = 'none';
    }
  }

  function buildCard(moto) {
    const article = document.createElement('article');
    article.className = 'moto-card';
    article.setAttribute('role', 'listitem');

    const isZeroKm = moto.km === 0;
    const kmHTML = isZeroKm
      ? `<span class="badge badge-zero">Zero KM</span>`
      : `<div class="card-info-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>${formatKm(moto.km)}</div>`;

    const waMsg = encodeURIComponent(
      `Olá! Tenho interesse nesta moto: ${moto.nome} - ${moto.ano} - ${formatCurrency(moto.preco)}. ` +
      (moto.fotoUrl ? `Veja a foto: ${moto.fotoUrl}. ` : '') + `Vi no site de vocês!`
    );

    article.innerHTML = `
      <div class="card-img-wrap">
        <img src="${moto.fotoUrl || PLACEHOLDER_IMG}" alt="Foto da moto ${moto.nome}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'"/>
        <span class="card-store-badge">${moto.loja}</span>
        <div class="card-km-badge">${isZeroKm ? kmHTML : ''}</div>
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="card-brand">${moto.marca}</span>
          <span class="card-year">${moto.ano}</span>
        </div>
        <h3 class="card-name">${moto.nome}</h3>
        <div class="card-info">${!isZeroKm ? kmHTML : ''}${moto.cilindrada ? `<div class="card-info-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>${moto.cilindrada}cc</div>` : ''}${moto.cor ? `<div class="card-info-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>${moto.cor}</div>` : ''}</div>
        <div class="card-footer">
          <div class="card-price"><small>Preço</small>${formatCurrency(moto.preco)}</div>
          <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${waMsg}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp" aria-label="WhatsApp sobre ${moto.nome}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
        </div>
      </div>`;
    return article;
  }

  function showSkeletons(count = 8) {
    grid.innerHTML = '';
    for (let i = 0; i < count; i++) {
      grid.innerHTML += `
        <div class="skeleton-card" aria-hidden="true">
          <div class="skeleton-img"><div class="skeleton"></div></div>
          <div class="skeleton-body">
            <div class="skeleton skeleton-line" style="width:40%"></div>
            <div class="skeleton skeleton-line" style="width:75%;height:20px"></div>
            <div class="skeleton skeleton-line" style="width:55%"></div>
            <div class="skeleton skeleton-line" style="width:60%;height:28px;margin-top:6px"></div>
          </div>
        </div>`;
    }
  }

  async function loadMotos() {
    showSkeletons();
    try {
      const snapshot = await db.collection('motos').orderBy('criadoEm', 'desc').get();
      state.allMotos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      applyFilters();
    } catch (err) {
      console.error('Erro ao carregar motos:', err);
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><h3>Erro ao carregar motos</h3><p>Verifique a configuração do Firebase.</p></div>`;
    }
  }

  function clearFilters() {
    filterStore.value = ''; filterBrand.value = ''; filterYearMin.value = ''; filterYearMax.value = '';
    sliderMin.value = 0; sliderMax.value = PRICE_MAX; updateSlider();
    sortSelect.value = 'recente';
    storePills.forEach(p => p.classList.remove('active'));
    storePills[0]?.classList.add('active');
    applyFilters();
  }

  filterStore.addEventListener('change', applyFilters);
  filterBrand.addEventListener('change', applyFilters);
  filterYearMin.addEventListener('change', applyFilters);
  filterYearMax.addEventListener('change', applyFilters);
  sortSelect.addEventListener('change', applyFilters);
  btnClear.addEventListener('click', clearFilters);

  btnLoadMore.addEventListener('click', () => {
    state.page++;
    renderGrid();
    const cards = grid.querySelectorAll('.moto-card');
    cards[(state.page - 1) * PAGE_SIZE]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  storePills.forEach(pill => {
    pill.addEventListener('click', () => {
      storePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      filterStore.value = pill.dataset.store || '';
      applyFilters();
    });
  });

  populateYearSelects();
  updateSlider();
  loadMotos();
}

// ════════════════════════════════════════════════════════════
// PÁGINA ADMIN (admin.html)
// ════════════════════════════════════════════════════════════

function initAdminPage() {
  if (!checkFirebaseConfig()) { window.location.href = 'index.html'; return; }
  const { db, auth } = initFirebase();

  const loginScreen   = document.getElementById('login-screen');
  const adminPanel    = document.getElementById('admin-panel');
  const loginForm     = document.getElementById('login-form');
  const loginError    = document.getElementById('login-error');
  const btnLogin      = document.getElementById('btn-login');
  const btnLogout     = document.getElementById('btn-logout');
  const adminEmail    = document.getElementById('admin-user-email');
  const motoForm      = document.getElementById('moto-form');
  const formTitle     = document.getElementById('form-title');
  const btnSave       = document.getElementById('btn-save');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const editIdInput   = document.getElementById('edit-id');
  const tbody         = document.getElementById('motos-tbody');
  const totalBadge    = document.getElementById('total-badge');
  const adminSearch   = document.getElementById('admin-search');
  const confirmModal  = document.getElementById('confirm-modal');
  const modalCancel   = document.getElementById('modal-cancel');
  const modalConfirm  = document.getElementById('modal-confirm');
  const photoPreview  = document.getElementById('photo-preview');
  const photoUrlInput = document.getElementById('f-photo-url');

  let allMotos = [], pendingDeleteId = null, unsubscribeMotos = null;

  // Preview ao digitar URL
  photoUrlInput?.addEventListener('input', () => {
    const url = photoUrlInput.value.trim();
    if (photoPreview) {
      photoPreview.src = url || '';
      photoPreview.style.display = url ? 'block' : 'none';
      photoPreview.onerror = () => { photoPreview.style.display = 'none'; };
    }
  });

  auth.onAuthStateChanged(user => {
    if (user) {
      loginScreen.style.display = 'none';
      adminPanel.style.display  = 'block';
      adminEmail.textContent    = user.email;
      loadMotosAdmin();
    } else {
      loginScreen.style.display = 'flex';
      adminPanel.style.display  = 'none';
    }
  });

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-password').value;
    if (!email || !pass) { showLoginError('Preencha e-mail e senha.'); return; }
    setLoginLoading(true);
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      loginError.style.display = 'none';
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-email':  'E-mail inválido.',
        'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
      };
      showLoginError(msgs[err.code] || 'Erro ao fazer login.');
    } finally { setLoginLoading(false); }
  });

  function showLoginError(msg) { loginError.textContent = msg; loginError.style.display = 'block'; }
  function setLoginLoading(l) { btnLogin.disabled = l; btnLogin.textContent = l ? 'Entrando...' : 'Entrar'; }

  btnLogout.addEventListener('click', () => {
    if (unsubscribeMotos) { unsubscribeMotos(); unsubscribeMotos = null; }
    auth.signOut();
  });

  function loadMotosAdmin() {
    if (unsubscribeMotos) unsubscribeMotos();
    unsubscribeMotos = db.collection('motos').orderBy('criadoEm', 'desc').onSnapshot(snap => {
      allMotos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderTable(allMotos);
    }, err => { console.error(err); showToast('Erro ao carregar motos', 'error'); });
  }

  function renderTable(motos) {
    totalBadge.textContent = `(${motos.length})`;
    if (!motos.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><div class="icon">🏍️</div><p>Nenhuma moto cadastrada.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = motos.map(m => `
      <tr data-id="${m.id}">
        <td><img class="table-thumb" src="${m.fotoUrl || PLACEHOLDER_IMG}" alt="${m.nome}" onerror="this.src='${PLACEHOLDER_IMG}'"/></td>
        <td><div class="table-name">${m.nome}</div></td>
        <td>${m.marca}</td><td>${m.ano}</td>
        <td>${formatCurrency(m.preco)}</td>
        <td>${m.km === 0 ? '<span class="badge badge-zero">Zero KM</span>' : formatKm(m.km)}</td>
        <td><span class="table-store-tag">${m.loja}</span></td>
        <td><div class="table-actions">
          <button class="btn-edit" data-id="${m.id}">Editar</button>
          <button class="btn-delete" data-id="${m.id}">Excluir</button>
        </div></td>
      </tr>`).join('');
    tbody.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => startEdit(b.dataset.id)));
    tbody.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', () => openDeleteModal(b.dataset.id)));
  }

  adminSearch.addEventListener('input', () => {
    const q = adminSearch.value.toLowerCase().trim();
    renderTable(q ? allMotos.filter(m =>
      m.nome?.toLowerCase().includes(q) || m.marca?.toLowerCase().includes(q) ||
      m.loja?.toLowerCase().includes(q) || String(m.ano).includes(q)
    ) : allMotos);
  });

  motoForm.addEventListener('submit', async e => {
    e.preventDefault();
    const id    = editIdInput.value;
    const name  = document.getElementById('f-name').value.trim();
    const brand = document.getElementById('f-brand').value;
    const store = document.getElementById('f-store').value;
    const year  = parseInt(document.getElementById('f-year').value);
    const km    = parseInt(document.getElementById('f-km').value);
    const price = parseFloat(document.getElementById('f-price').value);
    const url   = photoUrlInput?.value.trim() || '';

    if (!name || !brand || !store || !year || isNaN(km) || isNaN(price)) {
      showToast('Preencha todos os campos obrigatórios.', 'error'); return;
    }
    setSaveLoading(true);
    try {
      const cc    = parseInt(document.getElementById('f-cc').value) || null;
      const color = document.getElementById('f-color').value.trim() || null;
      const data  = { nome: name, marca: brand, loja: store, ano: year, km, preco: price, fotoUrl: url, cilindrada: cc, cor: color };
      if (id) {
        await db.collection('motos').doc(id).update(data);
        showToast('Moto atualizada!', 'success');
      } else {
        data.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('motos').add(data);
        showToast('Moto cadastrada!', 'success');
      }
      resetForm();
    } catch (err) { console.error(err); showToast('Erro ao salvar.', 'error'); }
    finally { setSaveLoading(false); }
  });

  function startEdit(id) {
    const m = allMotos.find(x => x.id === id); if (!m) return;

    // Reseta form primeiro para limpar estado anterior
    motoForm.reset();

    // Preenche campos de texto/number diretamente
    editIdInput.value = id;
    document.getElementById('f-name').value  = m.nome  || '';
    document.getElementById('f-year').value  = m.ano   || '';
    document.getElementById('f-km').value    = m.km    ?? 0;
    document.getElementById('f-price').value = m.preco      || '';
    document.getElementById('f-cc').value    = m.cilindrada || '';
    document.getElementById('f-color').value = m.cor        || '';
    if (photoUrlInput) photoUrlInput.value   = m.fotoUrl    || '';

    // Selects precisam de um tick para atualizar após reset()
    setTimeout(() => {
      const brandSel = document.getElementById('f-brand');
      const storeSel = document.getElementById('f-store');
      brandSel.value = m.marca || '';
      storeSel.value = m.loja  || '';
      // Força disparo de change para navegadores que cacheia o valor
      brandSel.dispatchEvent(new Event('change'));
      storeSel.dispatchEvent(new Event('change'));
    }, 0);

    // Preview da foto
    if (photoPreview && m.fotoUrl) {
      photoPreview.src = m.fotoUrl;
      photoPreview.style.display = 'block';
    } else if (photoPreview) {
      photoPreview.style.display = 'none';
    }

    formTitle.textContent = 'Editar Moto';
    btnSave.textContent   = 'Salvar Alterações';
    btnCancelEdit.style.display = 'inline-flex';
    document.querySelector('.form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  btnCancelEdit.addEventListener('click', resetForm);

  function resetForm() {
    motoForm.reset(); editIdInput.value = '';
    formTitle.textContent = 'Nova Moto'; btnSave.textContent = 'Cadastrar Moto';
    btnCancelEdit.style.display = 'none';
    if (photoPreview) { photoPreview.src = ''; photoPreview.style.display = 'none'; }
  }

  function setSaveLoading(l) {
    btnSave.disabled = l;
    btnSave.textContent = l ? (editIdInput.value ? 'Salvando...' : 'Cadastrando...') : (editIdInput.value ? 'Salvar Alterações' : 'Cadastrar Moto');
  }

  function openDeleteModal(id) { pendingDeleteId = id; confirmModal.style.display = 'flex'; }

  modalCancel.addEventListener('click', () => { confirmModal.style.display = 'none'; pendingDeleteId = null; });
  confirmModal.addEventListener('click', e => { if (e.target === confirmModal) { confirmModal.style.display = 'none'; pendingDeleteId = null; } });

  modalConfirm.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    confirmModal.style.display = 'none'; pendingDeleteId = null;
    try {
      await db.collection('motos').doc(id).delete();
      showToast('Moto excluída.', 'success');
      if (editIdInput.value === id) resetForm();
    } catch (err) { console.error(err); showToast('Erro ao excluir.', 'error'); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && confirmModal.style.display === 'flex') { confirmModal.style.display = 'none'; pendingDeleteId = null; }
  });
}
