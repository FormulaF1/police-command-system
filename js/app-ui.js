const AUTH_SESSION_KEY = 'police_command_auth_user';

const ROLE_LABELS = {
  officer: 'ร้อยเวรปฏิบัติการ',
  investigator: 'ชุดสืบสวน / สายตรวจ',
  commander: 'ผู้บังคับบัญชา (ดูรายงาน)'
};

const AppUI = {
  categoryChart: null,
  hourlyChart: null,
  currentUser: null,
  eventsBound: false,

  async init() {
    this.bindAuthEvents();

    // ตรวจสอบว่ามีสถานะล็อกอินค้างอยู่ใน Session นี้หรือไม่
    const saved = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (saved) {
      try {
        await this.enterApp(JSON.parse(saved));
        return;
      } catch (e) {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
      }
    }
    this.showLoginOverlay();
  },

  // --- AUTH & ROLE MANAGEMENT ---
  bindAuthEvents() {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value.trim();
      const errBox = document.getElementById('login-error');
      const btn = document.getElementById('btn-login-submit');

      errBox.classList.add('hidden');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบสิทธิ์...';

      try {
        const user = await ApiService.login(username, password);
        sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
        await this.enterApp(user);
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบ';
      }
    });

    const handleLogout = () => {
      if (confirm('ต้องการออกจากระบบใช่หรือไม่?')) {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        this.currentUser = null;
        document.getElementById('login-password').value = '';
        this.showLoginOverlay();
      }
    };

    document.getElementById('btn-logout').addEventListener('click', handleLogout);
    const mobileLogout = document.getElementById('btn-logout-mobile');
    if (mobileLogout) mobileLogout.addEventListener('click', handleLogout);
  },

  showLoginOverlay() {
    document.getElementById('login-overlay').classList.remove('hidden');
  },

  async enterApp(user) {
    this.currentUser = user;
    document.getElementById('login-overlay').classList.add('hidden');

    // แสดงชื่อและตำแหน่งมุมล่างซ้าย
    document.getElementById('officer-name').textContent = user.fullname;
    document.getElementById('officer-role-text').textContent =
      `${ROLE_LABELS[user.role] || user.role} (ออนไลน์)`;

    // จัดการสิทธิ์ตาม Role (ผู้บังคับบัญชาซ่อนเมนูบันทึกเหตุใหม่)
    const isCommander = user.role === 'commander';
    document.querySelectorAll('.nav-btn[data-view="entry"]').forEach((el) => {
      el.style.display = isCommander ? 'none' : '';
    });
    const topbarEntryBtn = document.getElementById('btn-topbar-entry');
    if (topbarEntryBtn) topbarEntryBtn.style.display = isCommander ? 'none' : '';

    if (!this.eventsBound) {
      this.bindNavigation();
      this.bindFormEvents();
      this.bindFilterEvents();

      document.getElementById('btn-reset-demo').addEventListener('click', () => {
        if (confirm('ต้องการรีเซ็ตข้อมูลกลับเป็นชุดตัวอย่างเริ่มต้นใช่หรือไม่?')) {
          StorageService.resetDemo();
          this.renderDashboard();
          this.renderRegistry();
          this.refreshTacticalMap();
        }
      });
      this.eventsBound = true;
    }

    await ApiService.fetchCases();
    this.switchView('dashboard');
    this.prepareNewForm();
  },

  bindNavigation() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.switchView(btn.dataset.view));
    });
  },

  switchView(viewName) {
    // ป้องกันผู้บังคับบัญชากดเข้าหน้าบันทึกเหตุ
    if (viewName === 'entry' && this.currentUser?.role === 'commander') {
      return;
    }

    document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    const titles = {
      dashboard: ['แดชบอร์ดสถิติและภาพรวมคดี', 'ระบบวิเคราะห์ข้อมูลคดี จุดเสี่ยง และหลักฐานกล้องวงจรปิด'],
      entry: ['บันทึกเหตุรับแจ้งใหม่', 'กรอกข้อมูลคดี ปักหมุดพิกัด ผู้ก่อเหตุ และจุดกล้อง CCTV'],
      map: ['แผนที่ยุทธการจุดเกิดเหตุ & CCTV', 'วิเคราะห์พื้นที่เสี่ยงและไล่เส้นทางกล้องวงจรปิด'],
      registry: ['ทะเบียนคดีและแฟ้มประวัติ', 'ค้นหา คัดกรอง และอัปเดตสถานะการสืบสวน']
    };

    document.getElementById('page-title').textContent = titles[viewName][0];
    document.getElementById('page-subtitle').textContent = titles[viewName][1];

    if (viewName === 'dashboard') this.renderDashboard();
    if (viewName === 'entry') {
      MapService.initPickerMap();
      MapService.invalidatePicker();
    }
    if (viewName === 'map') this.refreshTacticalMap();
    if (viewName === 'registry') this.renderRegistry();
  },

  // --- DASHBOARD ---
  renderDashboard() {
    const cases = StorageService.getCases();
    const activeCount = cases.filter((c) => c.status !== 'closed').length;
    const closedCount = cases.filter((c) => c.status === 'closed').length;
    const cctvCount = cases.reduce((sum, c) => sum + (c.cctvs ? c.cctvs.length : 0), 0);

    document.getElementById('kpi-total').textContent = cases.length;
    document.getElementById('kpi-active').textContent = activeCount;
    document.getElementById('kpi-closed').textContent = closedCount;
    document.getElementById('kpi-cctv').textContent = cctvCount;

    this.renderCharts(cases);
    this.renderRecentTable(cases.slice(0, 5));
  },

  renderCharts(cases) {
    const catKeys = Object.keys(CATEGORIES);
    const catCounts = catKeys.map((k) => cases.filter((c) => c.category === k).length);

    if (this.categoryChart) this.categoryChart.destroy();
    this.categoryChart = new Chart(document.getElementById('chart-category'), {
      type: 'doughnut',
      data: {
        labels: catKeys.map((k) => CATEGORIES[k].label),
        datasets: [{
          data: catCounts,
          backgroundColor: catKeys.map((k) => CATEGORIES[k].color),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#cbd5e1', font: { family: 'Prompt' } } }
        }
      }
    });

    const buckets = ['00-04 น.', '04-08 น.', '08-12 น.', '12-16 น.', '16-20 น.', '20-24 น.'];
    const bucketCounts = [0, 0, 0, 0, 0, 0];
    cases.forEach((c) => {
      const hr = new Date(c.datetime).getHours();
      if (!isNaN(hr)) bucketCounts[Math.floor(hr / 4)]++;
    });

    if (this.hourlyChart) this.hourlyChart.destroy();
    this.hourlyChart = new Chart(document.getElementById('chart-hourly'), {
      type: 'line',
      data: {
        labels: buckets,
        datasets: [{
          label: 'จำนวนเหตุรับแจ้ง',
          data: bucketCounts,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.18)',
          fill: true,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
          y: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  },

  renderRecentTable(recentCases) {
    const tbody = document.getElementById('recent-cases-body');
    tbody.innerHTML = recentCases.map((c) => {
      const cat = CATEGORIES[c.category] || { label: c.category };
      const st = STATUSES[c.status] || { label: c.status, badge: 'badge-blue' };
      return `
        <tr>
          <td><strong>${c.id}</strong></td>
          <td>${this.formatDateTime(c.datetime)}</td>
          <td>${cat.label}</td>
          <td>${c.locationName}</td>
          <td><span class="badge badge-gold">${c.cctvs?.length || 0} จุด</span></td>
          <td><span class="badge ${st.badge}">${st.label}</span></td>
          <td><button class="btn-secondary-sm" onclick="AppUI.openCaseModal('${c.id}')">ดูแฟ้ม</button></td>
        </tr>
      `;
    }).join('');
  },

  // --- ENTRY FORM ---
  prepareNewForm() {
    document.getElementById('case-id').value = StorageService.generateCaseId();
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('case-datetime').value = now.toISOString().slice(0, 16);

    // ใส่ชื่อเจ้าหน้าที่ที่ล็อกอินลงช่องผู้บันทึกอัตโนมัติ
    if (this.currentUser) {
      document.getElementById('case-officer').value = this.currentUser.fullname;
    }

    document.getElementById('suspects-container').innerHTML = '';
    document.getElementById('cctv-container').innerHTML = '';
    this.addSuspectRow();
    this.addCctvRow();
  },

  bindFormEvents() {
    document.getElementById('btn-add-suspect').addEventListener('click', () => this.addSuspectRow());
    document.getElementById('btn-add-cctv').addEventListener('click', () => this.addCctvRow());

    document.getElementById('btn-get-gps').addEventListener('click', () => {
      if (!navigator.geolocation) return alert('เบราว์เซอร์ไม่รองรับ GPS');
      navigator.geolocation.getCurrentPosition(
        (pos) => MapService.setPickerLocation(pos.coords.latitude, pos.coords.longitude),
        () => alert('ไม่สามารถดึงพิกัด GPS ได้ กรุณาคลิกปักหมุดบนแผนที่แทน')
      );
    });

    document.getElementById('incident-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });
  },

  addSuspectRow() {
    const container = document.getElementById('suspects-container');
    const idx = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'dynamic-item suspect-row';
    div.innerHTML = `
      <div class="dynamic-item-header">
        <span>ผู้ก่อเหตุ / ผู้ต้องสงสัย #${idx}</span>
        <button type="button" class="btn-danger-sm" onclick="this.closest('.dynamic-item').remove()">ลบ</button>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>ชื่อ-สกุล / ฉายา</label><input type="text" class="s-name" placeholder="ไม่ทราบชื่อ / ระบุฉายา" /></div>
        <div class="form-group"><label>รูปพรรณสัณฐาน</label><input type="text" class="s-desc" placeholder="เสื้อผ้า ส่วนสูง ตำหนิ" /></div>
        <div class="form-group"><label>ยานพาหนะ / ทะเบียน</label><input type="text" class="s-vehicle" placeholder="รุ่น สี ทะเบียนรถ" /></div>
        <div class="form-group">
          <label>รูปถ่าย (ถ้ามี)</label>
          <input type="file" accept="image/*" class="s-photo-input" />
          <img class="thumb-preview s-photo-preview" />
        </div>
      </div>
    `;
    this.bindImagePreview(div.querySelector('.s-photo-input'), div.querySelector('.s-photo-preview'));
    container.appendChild(div);
  },

  addCctvRow() {
    const container = document.getElementById('cctv-container');
    const idx = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'dynamic-item cctv-row';
    div.innerHTML = `
      <div class="dynamic-item-header">
        <span>จุดกล้อง CCTV / หลักฐาน #${idx}</span>
        <button type="button" class="btn-danger-sm" onclick="this.closest('.dynamic-item').remove()">ลบ</button>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>ตำแหน่ง / แหล่งที่มาของกล้อง</label><input type="text" class="c-source" placeholder="เช่น กล้องเทศบาลเสาที่ 5, ร้านสะดวกซื้อ" /></div>
        <div class="form-group"><label>ผู้ครอบครอง / เบอร์ติดต่อ</label><input type="text" class="c-contact" placeholder="ชื่อผู้ดูแลและเบอร์โทร" /></div>
        <div class="form-group"><label>ช่วงเวลาในคลิป</label><input type="text" class="c-time" placeholder="เช่น 22:10 - 22:25 น." /></div>
        <div class="form-group">
          <label>ภาพแคปหน้าจอกล้อง / หลักฐาน</label>
          <input type="file" accept="image/*" class="c-photo-input" />
          <img class="thumb-preview c-photo-preview" />
        </div>
      </div>
    `;
    this.bindImagePreview(div.querySelector('.c-photo-input'), div.querySelector('.c-photo-preview'));
    container.appendChild(div);
  },

  bindImagePreview(inputEl, imgEl) {
    inputEl.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxW = 480;
          const scale = Math.min(1, maxW / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          imgEl.src = compressed;
          imgEl.style.display = 'block';
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  async handleFormSubmit() {
    const lat = parseFloat(document.getElementById('case-lat').value);
    const lng = parseFloat(document.getElementById('case-lng').value);

    const suspects = Array.from(document.querySelectorAll('.suspect-row'))
      .map((row) => ({
        name: row.querySelector('.s-name').value.trim(),
        description: row.querySelector('.s-desc').value.trim(),
        vehicle: row.querySelector('.s-vehicle').value.trim(),
        photo: row.querySelector('.s-photo-preview').src || ''
      }))
      .filter((s) => s.name || s.description || s.vehicle || s.photo);

    const cctvs = Array.from(document.querySelectorAll('.cctv-row'))
      .map((row, idx) => ({
        source: row.querySelector('.c-source').value.trim(),
        contact: row.querySelector('.c-contact').value.trim(),
        timeRange: row.querySelector('.c-time').value.trim(),
        lat: lat + (idx + 1) * 0.0004,
        lng: lng + (idx + 1) * 0.0004,
        photo: row.querySelector('.c-photo-preview').src || ''
      }))
      .filter((c) => c.source || c.contact || c.photo);

    const newCase = {
      id: document.getElementById('case-id').value,
      datetime: document.getElementById('case-datetime').value,
      category: document.getElementById('case-category').value,
      status: document.getElementById('case-status').value,
      officer: document.getElementById('case-officer').value.trim(),
      locationName: document.getElementById('case-location-name').value.trim(),
      lat,
      lng,
      description: document.getElementById('case-desc').value.trim(),
      suspects,
      cctvs
    };

    const sendLine = document.getElementById('send-line-notify').checked;
    const submitBtn = document.querySelector('#incident-form button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกลง Google Sheets...';

    try {
      const savedCase = await ApiService.addCase(newCase);

      document.getElementById('incident-form').reset();
      this.prepareNewForm();
      this.renderDashboard();
      this.renderRegistry();

      if (sendLine) {
        this.showLineFlexPreview(savedCase);
      } else {
        alert(`บันทึกคดี ${savedCase.id} เรียบร้อยแล้ว`);
        this.switchView('registry');
      }
    } catch (err) {
      alert('บันทึกไม่สำเร็จ: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูลคดี';
    }
  },

  // --- TACTICAL MAP & FILTERS ---
  bindFilterEvents() {
    ['map-filter-category', 'toggle-incidents', 'toggle-cctv'].forEach((id) => {
      document.getElementById(id).addEventListener('change', () => this.refreshTacticalMap());
    });

    ['search-cases', 'filter-category', 'filter-status'].forEach((id) => {
      document.getElementById(id).addEventListener('input', () => this.renderRegistry());
    });
  },

  refreshTacticalMap() {
    const cases = StorageService.getCases();
    const cat = document.getElementById('map-filter-category').value;
    const showInc = document.getElementById('toggle-incidents').checked;
    const showCctv = document.getElementById('toggle-cctv').checked;
    MapService.renderTacticalMarkers(cases, cat, showInc, showCctv);
  },

  // --- REGISTRY ---
  renderRegistry() {
    const query = document.getElementById('search-cases').value.toLowerCase();
    const catFilter = document.getElementById('filter-category').value;
    const statusFilter = document.getElementById('filter-status').value;

    const filtered = StorageService.getCases().filter((c) => {
      const matchCat = catFilter === 'all' || c.category === catFilter;
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const text = `${c.id} ${c.locationName} ${c.description} ${JSON.stringify(c.suspects)}`.toLowerCase();
      return matchCat && matchStatus && text.includes(query);
    });

    const container = document.getElementById('cases-list');
    if (filtered.length === 0) {
      container.innerHTML = `<div class="glass-card">ไม่พบข้อมูลคดีที่ตรงตามเงื่อนไข</div>`;
      return;
    }

    container.innerHTML = filtered.map((c) => {
      const cat = CATEGORIES[c.category] || { label: c.category };
      const st = STATUSES[c.status] || { label: c.status, badge: 'badge-blue' };
      return `
        <div class="glass-card case-card" onclick="AppUI.openCaseModal('${c.id}')">
          <div class="case-card-top">
            <span class="badge badge-blue">${c.id}</span>
            <span class="badge ${st.badge}">${st.label}</span>
          </div>
          <h4>${cat.label}</h4>
          <div class="case-meta">
            <span><i class="fa-solid fa-location-dot"></i> ${c.locationName}</span>
            <span><i class="fa-solid fa-clock"></i> ${this.formatDateTime(c.datetime)}</span>
            <span><i class="fa-solid fa-user-secret"></i> ผู้ก่อเหตุ ${c.suspects?.length || 0} ราย | 🎥 CCTV ${c.cctvs?.length || 0} จุด</span>
          </div>
        </div>
      `;
    }).join('');
  },

  // --- MODALS ---
  openCaseModal(caseId) {
    const c = StorageService.getCases().find((item) => item.id === caseId);
    if (!c) return;

    const cat = CATEGORIES[c.category] || { label: c.category };
    document.getElementById('modal-case-id').textContent = `เลขคดี ${c.id}`;
    document.getElementById('modal-case-title').textContent = `${cat.label} — ${c.locationName}`;

    const suspectsHtml = (c.suspects && c.suspects.length)
      ? c.suspects.map((s, i) => `
          <div style="margin-bottom:8px;">
            <strong>#${i + 1} ${s.name || 'ไม่ทราบชื่อ'}</strong><br/>
            <small>รูปพรรณ: ${s.description || '-'} | ยานพาหนะ: ${s.vehicle || '-'}</small>
            ${s.photo ? `<br/><img src="${s.photo}" class="evidence-img" />` : ''}
          </div>
        `).join('')
      : '<small>ยังไม่มีข้อมูลผู้ก่อเหตุ</small>';

    const cctvHtml = (c.cctvs && c.cctvs.length)
      ? c.cctvs.map((cam, i) => `
          <div style="margin-bottom:8px;">
            <strong>🎥 #${i + 1} ${cam.source}</strong><br/>
            <small>ช่วงเวลา: ${cam.timeRange || '-'} | ติดต่อ: ${cam.contact || '-'}</small>
            ${cam.photo ? `<br/><img src="${cam.photo}" class="evidence-img" />` : ''}
          </div>
        `).join('')
      : '<small>ยังไม่มีข้อมูลกล้องวงจรปิด</small>';

    const statusControl = this.currentUser?.role === 'commander'
      ? `<span class="badge ${STATUSES[c.status]?.badge || 'badge-blue'}">${STATUSES[c.status]?.label || c.status}</span>`
      : `<select id="modal-status-select" onchange="AppUI.changeCaseStatus('${c.id}', this.value)">
          <option value="open" ${c.status === 'open' ? 'selected' : ''}>รับแจ้งเหตุใหม่</option>
          <option value="investigating" ${c.status === 'investigating' ? 'selected' : ''}>กำลังสืบสวน</option>
          <option value="closed" ${c.status === 'closed' ? 'selected' : ''}>ปิดคดีแล้ว</option>
        </select>`;

    document.getElementById('modal-case-body').innerHTML = `
      <div class="detail-block">
        <h4>ข้อมูลเหตุการณ์และการปรับสถานะ</h4>
        <p style="margin-bottom:10px;font-size:0.9rem;">${c.description}</p>
        <div class="case-meta">
          <span>วัน-เวลาเกิดเหตุ: ${this.formatDateTime(c.datetime)}</span>
          <span>ร้อยเวรเจ้าของคดี: ${c.officer}</span>
          <span>พิกัด GPS: ${c.lat}, ${c.lng}</span>
        </div>
        <div style="margin-top:12px;display:flex;align-items:center;gap:10px;">
          <label style="font-size:0.84rem;">สถานะคดี:</label>
          ${statusControl}
        </div>
      </div>
      <div class="detail-block">
        <h4>ผู้ก่อเหตุ / ผู้ต้องสงสัย (${c.suspects?.length || 0})</h4>
        ${suspectsHtml}
      </div>
      <div class="detail-block">
        <h4>จุดกล้องวงจรปิด & หลักฐาน (${c.cctvs?.length || 0})</h4>
        ${cctvHtml}
      </div>
      <div style="margin-top:16px;">
        <button type="button" class="btn-primary btn-lg"
          style="width:100%; justify-content:center; background:linear-gradient(135deg,#06c755,#059669);"
          onclick="AppUI.copyCaseForLine('${c.id}', this)">
          <i class="fa-brands fa-line"></i> คัดลอกข้อความแจ้งกลุ่ม LINE
        </button>
      </div>
    `;

    document.getElementById('case-modal').classList.remove('hidden');
  },

  async changeCaseStatus(caseId, newStatus) {
    try {
      await ApiService.updateStatus(caseId, newStatus);
      this.renderDashboard();
      this.renderRegistry();
      this.refreshTacticalMap();
    } catch (err) {
      alert('อัปเดตสถานะไม่สำเร็จ: ' + err.message);
    }
  },
  async copyCaseForLine(caseId, btnEl) {
    const c = StorageService.getCases().find((item) => item.id === caseId);
    if (!c) return;

    const cat = CATEGORIES[c.category]?.label || c.category;
    const st = STATUSES[c.status]?.label || c.status;
    const mapLink = (c.lat && c.lng)
      ? `https://www.google.com/maps?q=${c.lat},${c.lng}`
      : '-';

    const text = [
      `🚨 แจ้งเหตุรับแจ้งใหม่ (POLICE INTEL)`,
      `━━━━━━━━━━━━━━━━━━`,
      `📌 เลขคดี: ${c.id}`,
      `📂 ประเภท: ${cat}`,
      `🕒 วัน-เวลา: ${this.formatDateTime(c.datetime)}`,
      `📍 สถานที่: ${c.locationName}`,
      `🗺️ พิกัดแผนที่: ${mapLink}`,
      `📝 พฤติการณ์: ${c.description}`,
      `👤 ผู้ก่อเหตุ: ${c.suspects?.length || 0} ราย`,
      `🎥 กล้อง CCTV: ${c.cctvs?.length || 0} จุด`,
      `👮 ร้อยเวร/ผู้บันทึก: ${c.officer}`,
      `📊 สถานะ: ${st}`,
      `━━━━━━━━━━━━━━━━━━`,
      `*(ดูภาพหลักฐานและรายละเอียดเต็มในระบบเว็บแอพ)*`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      if (btnEl) {
        const originalHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="fa-solid fa-check"></i> คัดลอกแล้ว! นำไปวางใน LINE ได้เลย';
        setTimeout(() => { btnEl.innerHTML = originalHtml; }, 2200);
      } else {
        alert('คัดลอกข้อความเรียบร้อยแล้ว นำไปวางในกลุ่ม LINE ได้เลยครับ');
      }
    } catch (err) {
      // กรณีเบราว์เซอร์บล็อก Clipboard API ให้ใช้วิธีสำรอง
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('คัดลอกข้อความเรียบร้อยแล้ว นำไปวางในกลุ่ม LINE ได้เลยครับ');
    }
  },

  showLineFlexPreview(c) {
    const cat = CATEGORIES[c.category] || { label: c.category };
    document.getElementById('line-flex-preview').innerHTML = `
      <div class="flex-bubble">
        <div class="flex-header">
          <small>🚨 แจ้งเหตุรับแจ้งใหม่ (POLICE INTEL)</small>
          <div style="font-weight:600;margin-top:2px;">คดี ${c.id} • ${cat.label}</div>
        </div>
        <div class="flex-body">
          <div><strong>สถานที่:</strong> ${c.locationName}</div>
          <div><strong>เวลาเกิดเหตุ:</strong> ${this.formatDateTime(c.datetime)}</div>
          <div><strong>ร้อยเวร:</strong> ${c.officer}</div>
          <div><strong>ข้อมูลเบื้องต้น:</strong> ผู้ก่อเหตุ ${c.suspects.length} ราย / กล้อง CCTV ${c.cctvs.length} จุด</div>
          <div style="font-size:0.74rem;color:#64748b;margin-top:4px;">* ไม่ส่งภาพผู้ต้องสงสัยลงกลุ่มเพื่อความปลอดภัยทางคดี</div>
        </div>
        <div class="flex-footer" style="display:flex; flex-direction:column; gap:8px;">
          <button type="button" class="flex-btn" style="border:none; cursor:pointer;"
            onclick="AppUI.copyCaseForLine('${c.id}', this)">
            <i class="fa-regular fa-copy"></i> คัดลอกข้อความไปวางในกลุ่ม LINE
          </button>
          <a href="#" class="flex-btn" style="background:#334155;"
            onclick="AppUI.closeModal('line-modal'); AppUI.openCaseModal('${c.id}'); return false;">
            เปิดดูแฟ้มคดีและพิกัดเต็ม
          </a>
        </div>
      </div>
    `;
    document.getElementById('line-modal').classList.remove('hidden');
  },

  closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
  },

  formatDateTime(dtStr) {
    if (!dtStr) return '-';
    const d = new Date(dtStr);
    return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) + ' น.';
  }
};

document.addEventListener('DOMContentLoaded', () => AppUI.init());
