(() => {
  'use strict';

  const STORAGE_KEYS = {
    PROJECTS: 'azz_web2app_projects_v1',
    ACTIVE: 'azz_web2app_active_v1',
    SETTINGS: 'azz_web2app_settings_v1'
  };

  // Default SVG Icon Data URI
  const DEFAULT_LOGO_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#6366f1"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="28" fill="url(#g)"/>
      <path d="M60 28L34 92h13l5.5-14h15L73 92h13L60 28zm-3.5 39L60 57l3.5 10h-7z" fill="#ffffff"/>
    </svg>
  `);

  const VIEW_META = {
    dashboard: { title: 'Dashboard', subtitle: 'Ringkasan proyek konversi Website ke Android WebView' },
    builder: { title: 'Create New App', subtitle: 'Konfigurasi URL, identitas visual, dan fitur Android WebView' },
    projects: { title: 'My Projects', subtitle: 'Kelola, muat, export, atau import proyek aplikasi Anda' },
    build: { title: 'Build APK & Export', subtitle: 'Generate paket source code Android Studio siap kompilasi' },
    settings: { title: 'App Settings', subtitle: 'Pengaturan workspace dan preferensi default SDK' },
    docs: { title: 'Documentation', subtitle: 'Panduan penggunaan dan kompilasi APK di Android Studio' },
    about: { title: 'About', subtitle: 'Informasi platform Azz Web2App' }
  };

  function createDefaultConfig() {
    const prefix = state.settings?.defaultPrefix || 'com.azz';
    return {
      id: 'proj_' + Date.now(),
      updatedAt: new Date().toISOString(),
      url: 'https://example.com',
      appName: 'My Web App',
      packageName: `${prefix}.mywebapp`,
      logoDataUrl: DEFAULT_LOGO_SVG,
      logoSize: 72,
      logoShape: 'rounded',
      logoBg: '#18181b',
      themeColor: '#3b82f6',
      statusBarColor: '#09090b',
      navBarColor: '#09090b',
      splashBg: '#09090b',
      splashText: 'Powered by Azz Web2App',
      orientation: 'portrait',
      externalLinks: 'inapp',
      features: {
        splash: true,
        statusBar: true,
        fullscreen: false,
        javascript: true,
        zoom: false,
        pullRefresh: true,
        loader: true,
        backButton: true,
        offlinePage: true,
        download: true,
        upload: true,
        camera: false
      }
    };
  }

  const state = {
    projects: [],
    settings: {
      defaultPrefix: 'com.azz',
      minSdk: '24',
      autoSave: true
    },
    current: null,
    activeCodeTab: 'manifest',
    generatedFiles: null
  };

  // DOM Cache
  const $ = (id) => document.getElementById(id);

  // Initialization
  function init() {
    loadStorage();
    if (!state.current) {
      state.current = createDefaultConfig();
    }
    bindNavigation();
    bindBuilderEvents();
    bindProjectEvents();
    bindBuildEvents();
    bindSettingsEvents();
    syncFormFromState();
    updateLivePreview();
    renderProjects();
    updateDashboardStats();
    loadWebsiteIntoPreview(state.current.url, false);
    if (window.lucide) window.lucide.createIcons();
  }

  function loadStorage() {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) state.settings = { ...state.settings, ...JSON.parse(savedSettings) };

      const savedProjects = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      if (savedProjects) state.projects = JSON.parse(savedProjects);

      const savedActive = localStorage.getItem(STORAGE_KEYS.ACTIVE);
      if (savedActive) state.current = JSON.parse(savedActive);
    } catch (err) {
      console.error('Gagal memuat LocalStorage:', err);
    }
  }

  function persistActive() {
    try {
      state.current.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(state.current));
      if (state.settings.autoSave) {
        const idx = state.projects.findIndex((p) => p.id === state.current.id);
        if (idx !== -1) {
          state.projects[idx] = JSON.parse(JSON.stringify(state.current));
          localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(state.projects));
          renderProjects();
        }
      }
    } catch (err) {
      showToast('Penyimpanan penuh. Coba gunakan ukuran logo lebih kecil.', 'error');
    }
  }

  function saveProjectsList() {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(state.projects));
      updateDashboardStats();
      renderProjects();
    } catch (err) {
      showToast('Gagal menyimpan proyek ke LocalStorage.', 'error');
    }
  }

  // Navigation
  function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
    const target = $('view-' + viewName);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    if (VIEW_META[viewName]) {
      $('pageTitle').textContent = VIEW_META[viewName].title;
      $('pageSubtitle').textContent = VIEW_META[viewName].subtitle;
    }

    if (viewName === 'build') {
      prepareBuildView();
    }

    closeMobileSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindNavigation() {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    document.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.goto));
    });

    $('openSidebarBtn').addEventListener('click', () => {
      $('sidebar').classList.add('open');
      $('sidebarOverlay').classList.add('open');
    });

    $('closeSidebarBtn').addEventListener('click', closeMobileSidebar);
    $('sidebarOverlay').addEventListener('click', closeMobileSidebar);

    $('quickSaveBtn').addEventListener('click', saveCurrentProjectToList);
    $('quickBuildBtn').addEventListener('click', () => switchView('build'));
  }

  function closeMobileSidebar() {
    $('sidebar').classList.remove('open');
    $('sidebarOverlay').classList.remove('open');
  }

  // Validation Helpers
  function validateUrl(raw) {
    try {
      const parsed = new URL(raw.trim());
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function validatePackageName(pkg) {
    return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(pkg.trim());
  }

  // Builder Form & Live Preview
  function syncFormFromState() {
    const c = state.current;
    $('inputUrl').value = c.url;
    $('inputAppName').value = c.appName;
    $('inputPackageName').value = c.packageName;
    $('inputLogoSize').value = c.logoSize;
    $('logoSizeVal').textContent = c.logoSize;
    $('inputLogoShape').value = c.logoShape;
    $('inputLogoBg').value = c.logoBg;
    $('inputThemeColor').value = c.themeColor;
    $('themeColorHex').textContent = c.themeColor;
    $('inputStatusBarColor').value = c.statusBarColor;
    $('statusBarColorHex').textContent = c.statusBarColor;
    $('inputNavBarColor').value = c.navBarColor;
    $('navBarColorHex').textContent = c.navBarColor;
    $('inputSplashBg').value = c.splashBg;
    $('splashBgHex').textContent = c.splashBg;
    $('inputSplashText').value = c.splashText;
    $('inputOrientation').value = c.orientation;
    $('inputExternalLinks').value = c.externalLinks;

    $('toggleSplash').checked = c.features.splash;
    $('toggleStatusBar').checked = c.features.statusBar;
    $('toggleFullscreen').checked = c.features.fullscreen;
    $('toggleJs').checked = c.features.javascript;
    $('toggleZoom').checked = c.features.zoom;
    $('togglePullRefresh').checked = c.features.pullRefresh;
    $('toggleLoader').checked = c.features.loader;
    $('toggleBackBtn').checked = c.features.backButton;
    $('toggleOfflinePage').checked = c.features.offlinePage;
    $('toggleDownload').checked = c.features.download;
    $('toggleUpload').checked = c.features.upload;
    $('toggleCamera').checked = c.features.camera;

    $('sidebarActiveName').textContent = c.appName || 'Untitled App';
    $('statActiveApp').textContent = c.appName || 'Untitled App';
  }

  function bindBuilderEvents() {
    $('loadWebsiteBtn').addEventListener('click', () => {
      loadWebsiteIntoPreview($('inputUrl').value, true);
    });

    $('inputUrl').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        loadWebsiteIntoPreview($('inputUrl').value, true);
      }
    });

    $('inputAppName').addEventListener('input', (e) => {
      state.current.appName = e.target.value.trim() || 'My Web App';
      $('sidebarActiveName').textContent = state.current.appName;
      $('statActiveApp').textContent = state.current.appName;
      updateLivePreview();
      persistActive();
    });

    $('inputPackageName').addEventListener('input', (e) => {
      const val = e.target.value.trim();
      state.current.packageName = val;
      const fb = $('packageFeedback');
      if (validatePackageName(val)) {
        fb.textContent = 'Package name valid';
        fb.className = 'field-hint success';
      } else {
        fb.textContent = 'Gunakan huruf kecil & titik (contoh: com.azz.myapp)';
        fb.className = 'field-hint error';
      }
      updateLivePreview();
      persistActive();
    });

    // Logo upload with canvas compression so LocalStorage stays lightweight
    $('inputLogoFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Format file harus gambar (PNG, JPG, WEBP, SVG).', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 256;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, size, size);
          const scale = Math.min(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          state.current.logoDataUrl = canvas.toDataURL('image/png');
          updateLivePreview();
          persistActive();
          showToast('Logo aplikasi berhasil diperbarui.', 'success');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    $('resetLogoBtn').addEventListener('click', () => {
      state.current.logoDataUrl = DEFAULT_LOGO_SVG;
      updateLivePreview();
      persistActive();
      showToast('Logo dikembalikan ke default.', 'success');
    });

    $('inputLogoSize').addEventListener('input', (e) => {
      state.current.logoSize = Number(e.target.value);
      $('logoSizeVal').textContent = e.target.value;
      updateLivePreview();
      persistActive();
    });

    $('inputLogoShape').addEventListener('change', (e) => {
      state.current.logoShape = e.target.value;
      updateLivePreview();
      persistActive();
    });

    $('inputLogoBg').addEventListener('input', (e) => {
      state.current.logoBg = e.target.value;
      updateLivePreview();
      persistActive();
    });

    const colorBindings = [
      ['inputThemeColor', 'themeColor', 'themeColorHex'],
      ['inputStatusBarColor', 'statusBarColor', 'statusBarColorHex'],
      ['inputNavBarColor', 'navBarColor', 'navBarColorHex'],
      ['inputSplashBg', 'splashBg', 'splashBgHex']
    ];

    colorBindings.forEach(([inputId, key, hexId]) => {
      $(inputId).addEventListener('input', (e) => {
        state.current[key] = e.target.value;
        $(hexId).textContent = e.target.value;
        updateLivePreview();
        persistActive();
      });
    });

    $('inputSplashText').addEventListener('input', (e) => {
      state.current.splashText = e.target.value;
      updateLivePreview();
      persistActive();
    });

    $('inputOrientation').addEventListener('change', (e) => {
      state.current.orientation = e.target.value;
      updateLivePreview();
      persistActive();
    });

    $('inputExternalLinks').addEventListener('change', (e) => {
      state.current.externalLinks = e.target.value;
      persistActive();
    });

    const featureToggles = [
      ['toggleSplash', 'splash'],
      ['toggleStatusBar', 'statusBar'],
      ['toggleFullscreen', 'fullscreen'],
      ['toggleJs', 'javascript'],
      ['toggleZoom', 'zoom'],
      ['togglePullRefresh', 'pullRefresh'],
      ['toggleLoader', 'loader'],
      ['toggleBackBtn', 'backButton'],
      ['toggleOfflinePage', 'offlinePage'],
      ['toggleDownload', 'download'],
      ['toggleUpload', 'upload'],
      ['toggleCamera', 'camera']
    ];

    featureToggles.forEach(([elId, featKey]) => {
      $(elId).addEventListener('change', (e) => {
        state.current.features[featKey] = e.target.checked;
        updateLivePreview();
        persistActive();
      });
    });

    // Simulator Controls
    $('simSplashBtn').addEventListener('click', triggerSplashSimulation);
    $('simOfflineBtn').addEventListener('click', () => {
      if (!state.current.features.offlinePage) {
        showToast('Aktifkan fitur "Halaman Offline / Error" terlebih dahulu.', 'error');
        return;
      }
      $('simOfflineOverlay').classList.toggle('hidden');
    });
    $('simRetryOfflineBtn').addEventListener('click', () => {
      $('simOfflineOverlay').classList.add('hidden');
      loadWebsiteIntoPreview(state.current.url, true);
    });
    $('simReloadBtn').addEventListener('click', () => {
      loadWebsiteIntoPreview(state.current.url, true);
    });
    $('simBackAction').addEventListener('click', () => {
      if (state.current.features.backButton) {
        showToast('Simulasi tombol Back Android: Kembali ke halaman sebelumnya.', 'success');
      } else {
        showToast('Tombol Back dinonaktifkan pada konfigurasi ini.', 'error');
      }
    });
    $('simHomeAction').addEventListener('click', () => {
      loadWebsiteIntoPreview(state.current.url, false);
    });

    $('saveProjectBtn').addEventListener('click', saveCurrentProjectToList);
    $('goToBuildBtn').addEventListener('click', () => switchView('build'));
  }

  function loadWebsiteIntoPreview(rawUrl, notifyUser) {
    const trimmed = rawUrl.trim();
    const badge = $('urlStatusBadge');
    const feedback = $('urlFeedback');
    const iframe = $('liveWebFrame');
    const notice = $('simIframeNotice');

    if (!validateUrl(trimmed)) {
      badge.textContent = 'URL Tidak Valid';
      badge.className = 'badge badge-error';
      feedback.textContent = 'URL tidak valid. Pastikan diawali https:// atau http://';
      feedback.className = 'field-hint error';
      if (notifyUser) showToast('Format URL tidak valid.', 'error');
      return;
    }

    state.current.url = trimmed;
    persistActive();

    badge.textContent = 'Memuat...';
    badge.className = 'badge badge-info';
    feedback.textContent = 'Menghubungkan ke ' + trimmed;
    feedback.className = 'field-hint';
    notice.classList.add('hidden');
    $('simOfflineOverlay').classList.add('hidden');

    if (state.current.features.loader) {
      const bar = $('simProgressBar');
      bar.style.backgroundColor = state.current.themeColor;
      bar.style.width = '65%';
      setTimeout(() => { bar.style.width = '100%'; }, 400);
      setTimeout(() => { bar.style.width = '0%'; }, 850);
    }

    // Check known domains that block iframes via X-Frame-Options
    const host = new URL(trimmed).hostname.toLowerCase();
    const blockedHosts = ['google.com', 'www.google.com', 'github.com', 'youtube.com', 'www.youtube.com', 'instagram.com', 'facebook.com', 'x.com', 'twitter.com'];
    if (blockedHosts.some((d) => host === d || host.endsWith('.' + d))) {
      iframe.src = 'about:blank';
      $('simIframeUrlText').textContent = trimmed;
      $('simOpenExternalLink').href = trimmed;
      notice.classList.remove('hidden');
      badge.textContent = 'Tervalidasi (X-Frame)';
      badge.className = 'badge badge-success';
      feedback.textContent = 'URL valid. Website siap dijalankan di Android WebView.';
      feedback.className = 'field-hint success';
      return;
    }

    iframe.src = trimmed;
    badge.textContent = 'URL Aktif';
    badge.className = 'badge badge-success';
    feedback.textContent = 'Website berhasil dimuat ke simulator.';
    feedback.className = 'field-hint success';
    if (notifyUser) showToast('Website dimuat ke Live Preview.', 'success');
  }

  function updateLivePreview() {
    const c = state.current;

    // Logo styling
    const stage = $('logoStage');
    const img = $('logoPreviewImg');
    img.src = c.logoDataUrl;
    img.style.width = c.logoSize + '%';
    img.style.height = c.logoSize + '%';
    stage.style.backgroundColor = c.logoBg;
    stage.style.borderRadius = c.logoShape === 'circle' ? '50%' : c.logoShape === 'square' ? '4px' : '22px';

    // Mini header badge
    $('previewMiniIcon').src = c.logoDataUrl;
    $('previewMiniIcon').style.backgroundColor = c.logoBg;
    $('previewAppTitle').textContent = c.appName;
    $('previewPackageText').textContent = c.packageName;

    // Phone orientation
    const frame = $('phoneFrame');
    frame.classList.toggle('landscape', c.orientation === 'landscape');
    frame.classList.toggle('portrait', c.orientation !== 'landscape');

    // Status Bar & Fullscreen
    const statusBar = $('simStatusBar');
    const navBar = $('simNavBar');
    statusBar.style.backgroundColor = c.statusBarColor;
    navBar.style.backgroundColor = c.navBarColor;

    if (c.features.fullscreen) {
      statusBar.classList.add('hidden');
      navBar.classList.add('hidden');
    } else {
      statusBar.classList.toggle('hidden', !c.features.statusBar);
      navBar.classList.remove('hidden');
    }

    // Splash screen elements
    const splashOverlay = $('simSplashOverlay');
    splashOverlay.style.backgroundColor = c.splashBg;
    $('simSplashLogoBox').style.backgroundColor = c.logoBg;
    $('simSplashLogoBox').style.borderRadius = c.logoShape === 'circle' ? '50%' : c.logoShape === 'square' ? '4px' : '20px';
    $('simSplashImg').src = c.logoDataUrl;
    $('simSplashImg').style.width = c.logoSize + '%';
    $('simSplashImg').style.height = c.logoSize + '%';
    $('simSplashAppName').textContent = c.appName;
    $('simSplashSubtext').textContent = c.splashText;
  }

  function triggerSplashSimulation() {
    if (!state.current.features.splash) {
      showToast('Fitur Splash Screen sedang dinonaktifkan.', 'error');
      return;
    }
    const overlay = $('simSplashOverlay');
    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 2000);
  }

  // Project Management
  function saveCurrentProjectToList() {
    if (!validateUrl(state.current.url)) {
      showToast('Perbaiki URL website sebelum menyimpan proyek.', 'error');
      return;
    }
    if (!validatePackageName(state.current.packageName)) {
      showToast('Format Package Name tidak valid (contoh: com.azz.myapp).', 'error');
      return;
    }

    const copy = JSON.parse(JSON.stringify(state.current));
    copy.updatedAt = new Date().toISOString();
    const existingIndex = state.projects.findIndex((p) => p.id === copy.id);

    if (existingIndex !== -1) {
      state.projects[existingIndex] = copy;
      showToast(`Proyek "${copy.appName}" berhasil diperbarui.`, 'success');
    } else {
      state.projects.unshift(copy);
      showToast(`Proyek "${copy.appName}" berhasil disimpan.`, 'success');
    }
    saveProjectsList();
  }

  function bindProjectEvents() {
    $('searchProjectsInput').addEventListener('input', (e) => {
      renderProjects(e.target.value.trim().toLowerCase());
    });

    $('exportActiveConfigBtn').addEventListener('click', () => {
      exportProjectFile(state.current);
    });

    $('importConfigFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (!imported.appName || !imported.url || !imported.packageName) {
            throw new Error('Struktur file konfigurasi tidak dikenali.');
          }
          imported.id = 'proj_' + Date.now();
          imported.updatedAt = new Date().toISOString();
          state.current = imported;
          state.projects.unshift(JSON.parse(JSON.stringify(imported)));
          persistActive();
          saveProjectsList();
          syncFormFromState();
          updateLivePreview();
          loadWebsiteIntoPreview(imported.url, false);
          showToast(`Proyek "${imported.appName}" berhasil diimpor.`, 'success');
        } catch (err) {
          showToast('Gagal mengimpor file konfigurasi: ' + err.message, 'error');
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
  }

  function exportProjectFile(project) {
    const cleanName = project.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'azz-app';
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanName}-config.azzapp`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File konfigurasi proyek berhasil diunduh.', 'success');
  }

  function renderProjects(filter = '') {
    const container = $('projectsListContainer');
    const recentContainer = $('dashboardRecentProjects');
    $('projectCountBadge').textContent = state.projects.length;
    $('statTotalProjects').textContent = state.projects.length;

    const filtered = state.projects.filter(
      (p) => p.appName.toLowerCase().includes(filter) || p.packageName.toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
      const emptyHtml = `
        <div class="empty-state">
          <i data-lucide="folder-open"></i>
          <h4>Belum Ada Proyek Tersimpan</h4>
          <p>Mulai ubah website pertama Anda menjadi aplikasi Android WebView.</p>
          <button type="button" class="btn btn-primary" id="emptyCreateBtn">
            <i data-lucide="plus"></i>
            <span>Create New App</span>
          </button>
        </div>
      `;
      container.innerHTML = emptyHtml;
      recentContainer.innerHTML = emptyHtml;
      document.querySelectorAll('#emptyCreateBtn').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.current = createDefaultConfig();
          syncFormFromState();
          updateLivePreview();
          switchView('builder');
        });
      });
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const buildCardHtml = (proj) => `
      <article class="project-card">
        <div class="project-card-top">
          <img src="${proj.logoDataUrl}" alt="${escapeHtml(proj.appName)}" style="background:${proj.logoBg}" />
          <div class="project-card-info">
            <h4>${escapeHtml(proj.appName)}</h4>
            <p>${escapeHtml(proj.packageName)}</p>
          </div>
        </div>
        <div class="project-card-url">${escapeHtml(proj.url)}</div>
        <div class="project-card-actions">
          <button type="button" class="btn btn-primary btn-xs" data-action="load" data-id="${proj.id}">Edit / Load</button>
          <button type="button" class="btn btn-secondary btn-xs" data-action="build" data-id="${proj.id}">Build</button>
          <button type="button" class="btn btn-ghost btn-xs" data-action="export" data-id="${proj.id}" title="Export">
            <i data-lucide="download"></i>
          </button>
          <button type="button" class="btn btn-danger btn-xs" data-action="delete" data-id="${proj.id}" title="Hapus">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </article>
    `;

    container.innerHTML = filtered.map(buildCardHtml).join('');
    recentContainer.innerHTML = state.projects.slice(0, 3).map(buildCardHtml).join('');

    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const proj = state.projects.find((p) => p.id === id);
        if (!proj) return;

        if (action === 'load' || action === 'build') {
          state.current = JSON.parse(JSON.stringify(proj));
          persistActive();
          syncFormFromState();
          updateLivePreview();
          loadWebsiteIntoPreview(proj.url, false);
          switchView(action === 'build' ? 'build' : 'builder');
          showToast(`Proyek "${proj.appName}" dimuat.`, 'success');
        } else if (action === 'export') {
          exportProjectFile(proj);
        } else if (action === 'delete') {
          openConfirmModal(
            'Hapus Proyek',
            `Apakah Anda yakin ingin menghapus proyek "${proj.appName}" secara permanen?`,
            () => {
              state.projects = state.projects.filter((p) => p.id !== id);
              saveProjectsList();
              showToast('Proyek telah dihapus.', 'success');
            }
          );
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }
  function updateDashboardStats() {
    $('statTotalProjects').textContent = state.projects.length;
    $('statActiveApp').textContent = state.current?.appName || 'My Web App';
  }

  // Build APK & Android WebView Source Code Generator
  function prepareBuildView() {
    const c = state.current;
    $('buildAppLogo').src = c.logoDataUrl;
    $('buildAppLogo').style.backgroundColor = c.logoBg;
    $('buildAppName').textContent = c.appName;
    $('buildPackageName').textContent = c.packageName;
    $('buildAppUrl').textContent = c.url;
    $('buildAppUrl').href = c.url;

    const enabledFeatures = Object.entries(c.features)
      .filter(([, val]) => val)
      .map(([k]) => k.toUpperCase());

    $('buildSummaryChips').innerHTML = [
      `<span class="chip">Orientasi: ${c.orientation}</span>`,
      `<span class="chip">Theme: ${c.themeColor}</span>`,
      ...enabledFeatures.map((f) => `<span class="chip">${f}</span>`)
    ].join('');

    state.generatedFiles = generateAndroidSourceFiles(c);
    renderCodeViewer();
  }

  function generateAndroidSourceFiles(c) {
    const minSdk = state.settings.minSdk || '24';
    const orientationAttr =
      c.orientation === 'landscape'
        ? 'android:screenOrientation="landscape"'
        : c.orientation === 'portrait'
        ? 'android:screenOrientation="portrait"'
        : 'android:screenOrientation="unspecified"';

    const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${c.packageName}">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
${c.features.camera ? '    <uses-permission android:name="android.permission.CAMERA" />\n' : ''}${c.features.download ? '    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />\n' : ''}
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true"
        android:theme="@style/Theme.AppCompat.DayNight.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            ${orientationAttr}
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

    const activity = `package ${c.packageName};

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private static final String TARGET_URL = "${c.url}";
    private WebView webView;
    private ProgressBar progressBar;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // System Bars Configuration
        getWindow().setStatusBarColor(Color.parseColor("${c.statusBarColor}"));
        getWindow().setNavigationBarColor(Color.parseColor("${c.navBarColor}"));
        ${c.features.fullscreen ? 'getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);' : ''}

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(${c.features.javascript});
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setSupportZoom(${c.features.zoom});
        settings.setBuiltInZoomControls(${c.features.zoom});
        settings.setDisplayZoomControls(false);
        settings.setAllowFileAccess(${c.features.upload});
        settings.setMediaPlaybackRequiresUserGesture(false);

        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String targetHost = Uri.parse(TARGET_URL).getHost();
                if ("${c.externalLinks}".equals("browser") && uri.getHost() != null && !uri.getHost().equals(targetHost)) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                return false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (${c.features.offlinePage} && request.isForMainFrame()) {
                    String offlineHtml = "<html><body style='background:${c.splashBg};color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center;'>" +
                            "<h2>Koneksi Terputus</h2><p>Tidak dapat memuat ${c.appName}.</p>" +
                            "<button onclick='location.reload()' style='padding:10px 20px;background:${c.themeColor};border:none;color:#fff;border-radius:8px;'>Coba Lagi</button></body></html>";
                    view.loadDataWithBaseURL(null, offlineHtml, "text/html", "UTF-8", null);
                }
            }
        });

        ${c.features.download ? `webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType(mimetype);
            request.setTitle(URLUtil.guessFileName(url, contentDisposition, mimetype));
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, contentDisposition, mimetype));
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (dm != null) dm.enqueue(request);
            Toast.makeText(getApplicationContext(), "Mengunduh file...", Toast.LENGTH_SHORT).show();
        });` : ''}

        webView.loadUrl(TARGET_URL);
    }

    @Override
    public void onBackPressed() {
        if (${c.features.backButton} && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}`;

    const gradle = `plugins {
    id 'com.android.application'
}

android {
    namespace '${c.packageName}'
    compileSdk 34

    defaultConfig {
        applicationId "${c.packageName}"
        minSdk ${minSdk}
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }

    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
}`;

    const strings = `<resources>
    <string name="app_name">${escapeXml(c.appName)}</string>
    <string name="splash_subtitle">${escapeXml(c.splashText)}</string>
    <string name="target_url">${escapeXml(c.url)}</string>
</resources>`;
    return { manifest, activity, gradle, strings };
  }

  function renderCodeViewer() {
    if (!state.generatedFiles) return;
    $('generatedCodeViewer').textContent = state.generatedFiles[state.activeCodeTab] || '';
  }

  function bindBuildEvents() {
    document.querySelectorAll('.code-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.code-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeCodeTab = tab.dataset.file;
        renderCodeViewer();
      });
    });

    $('copyCodeBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText($('generatedCodeViewer').textContent);
        showToast('Kode berhasil disalin ke clipboard.', 'success');
      } catch {
        showToast('Gagal menyalin kode.', 'error');
      }
    });

    $('startBuildBtn').addEventListener('click', runBuildSequence);
    $('downloadSourceBundleBtn').addEventListener('click', downloadAndroidProjectBundle);
  }

  function runBuildSequence() {
    if (!validateUrl(state.current.url) || !validatePackageName(state.current.packageName)) {
      showToast('Pastikan URL dan Package Name valid sebelum build.', 'error');
      return;
    }

    const btn = $('startBuildBtn');
    const dlBtn = $('downloadSourceBundleBtn');
    const fill = $('buildProgressFill');
    const pct = $('buildPercentText');
    const status = $('buildStatusText');
    const consoleBox = $('buildConsoleLog');

    btn.disabled = true;
    dlBtn.classList.add('hidden');
    consoleBox.innerHTML = '';

    const steps = [
      { p: 20, msg: 'Memvalidasi URL & konfigurasi package...' },
      { p: 45, msg: 'Merakit AndroidManifest.xml & izin perangkat...' },
      { p: 70, msg: 'Mengonfigurasi Chromium WebView & MainActivity.java...' },
      { p: 90, msg: 'Menyiapkan Gradle build script & resource...' },
      { p: 100, msg: 'Build selesai! Paket source Android siap diunduh.' }
    ];

    let idx = 0;
    const timer = setInterval(() => {
      const step = steps[idx];
      fill.style.width = step.p + '%';
      pct.textContent = step.p + '%';
      status.textContent = step.msg;

      const line = document.createElement('div');
      line.textContent = `[${new Date().toLocaleTimeString()}] ${step.msg}`;
      consoleBox.appendChild(line);
      consoleBox.scrollTop = consoleBox.scrollHeight;

      idx++;
      if (idx >= steps.length) {
        clearInterval(timer);
        btn.disabled = false;
        dlBtn.classList.remove('hidden');
        prepareBuildView();
        showToast('Source project Android WebView berhasil dibuat!', 'success');
      }
    }, 450);
  }

  function downloadAndroidProjectBundle() {
    const c = state.current;
    const files = generateAndroidSourceFiles(c);
    const bundleContent = `====================================================================
AZZ WEB2APP - ANDROID STUDIO WEBVIEW PROJECT BUNDLE
App Name     : ${c.appName}
Package Name : ${c.packageName}
Target URL   : ${c.url}
Generated At : ${new Date().toISOString()}
====================================================================

CARA KOMPILASI MENJADI APK:
1. Buka Android Studio -> New Project -> Empty Views Activity (Java).
2. Masukkan Package Name: ${c.packageName}
3. Salin setiap blok file di bawah ini ke lokasi masing-masing.
4. Klik Build -> Build Bundle(s) / APK(s) -> Build APK(s).

--------------------------------------------------------------------
FILE 1: app/src/main/AndroidManifest.xml
--------------------------------------------------------------------
${files.manifest}

--------------------------------------------------------------------
FILE 2: app/src/main/java/${c.packageName.replace(/\./g, '/')}/MainActivity.java
--------------------------------------------------------------------
${files.activity}

--------------------------------------------------------------------
FILE 3: app/build.gradle
--------------------------------------------------------------------
${files.gradle}

--------------------------------------------------------------------
FILE 4: app/src/main/res/values/strings.xml
--------------------------------------------------------------------
${files.strings}
`;

    const slug = c.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'android-webview';
    const blob = new Blob([bundleContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-android-project.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Android Project Bundle berhasil diunduh.', 'success');
  }

  // Workspace Settings
  function bindSettingsEvents() {
    $('settingDefaultPrefix').value = state.settings.defaultPrefix;
    $('settingMinSdk').value = state.settings.minSdk;
    $('settingAutoSave').checked = state.settings.autoSave;

    $('saveWorkspaceSettingsBtn').addEventListener('click', () => {
      state.settings.defaultPrefix = $('settingDefaultPrefix').value.trim() || 'com.azz';
      state.settings.minSdk = $('settingMinSdk').value;
      state.settings.autoSave = $('settingAutoSave').checked;
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
      showToast('Pengaturan workspace berhasil disimpan.', 'success');
    });

    $('clearAllDataBtn').addEventListener('click', () => {
      openConfirmModal(
        'Reset Semua Data Lokal',
        'Semua proyek tersimpan dan pengaturan lokal akan dihapus permanen. Lanjutkan?',
        () => {
          localStorage.removeItem(STORAGE_KEYS.PROJECTS);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE);
          localStorage.removeItem(STORAGE_KEYS.SETTINGS);
          state.projects = [];
          state.current = createDefaultConfig();
          syncFormFromState();
          updateLivePreview();
          renderProjects();
          updateDashboardStats();
          showToast('Seluruh data lokal telah direset.', 'success');
        }
      );
    });
  }
  // UI Utilities (Toast & Modal)
  function showToast(message, type = 'success') {
    const container = $('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  }

  function openConfirmModal(title, message, onConfirm) {
    const modal = $('confirmModal');
    $('modalTitle').textContent = title;
    $('modalMessage').textContent = message;
    modal.classList.remove('hidden');

    const cleanup = () => {
      modal.classList.add('hidden');
      $('modalConfirmBtn').onclick = null;
      $('modalCancelBtn').onclick = null;
    };

    $('modalCancelBtn').onclick = cleanup;
    $('modalConfirmBtn').onclick = () => {
      cleanup();
      onConfirm();
    };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeXml(str) {
    return escapeHtml(str).replace(/'/g, '&apos;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();