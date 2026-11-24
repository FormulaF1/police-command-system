const MapService = {
  pickerMap: null,
  pickerMarker: null,
  tacticalMap: null,
  incidentLayer: null,
  cctvLayer: null,

  initPickerMap() {
    if (this.pickerMap) return;
    this.pickerMap = L.map('picker-map').setView(DEFAULT_CENTER, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.pickerMap);

    this.pickerMarker = L.marker(DEFAULT_CENTER, { draggable: true }).addTo(this.pickerMap);
    this.updateCoordInputs(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);

    this.pickerMap.on('click', (e) => {
      this.setPickerLocation(e.latlng.lat, e.latlng.lng);
    });

    this.pickerMarker.on('dragend', () => {
      const pos = this.pickerMarker.getLatLng();
      this.updateCoordInputs(pos.lat, pos.lng);
    });
  },

  setPickerLocation(lat, lng) {
    if (!this.pickerMap) return;
    this.pickerMarker.setLatLng([lat, lng]);
    this.pickerMap.panTo([lat, lng]);
    this.updateCoordInputs(lat, lng);
  },

  updateCoordInputs(lat, lng) {
    document.getElementById('case-lat').value = lat.toFixed(6);
    document.getElementById('case-lng').value = lng.toFixed(6);
  },

  invalidatePicker() {
    if (this.pickerMap) setTimeout(() => this.pickerMap.invalidateSize(), 150);
  },

  initTacticalMap() {
    if (this.tacticalMap) return;
    this.tacticalMap = L.map('tactical-map').setView(DEFAULT_CENTER, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.tacticalMap);

    this.incidentLayer = L.layerGroup().addTo(this.tacticalMap);
    this.cctvLayer = L.layerGroup().addTo(this.tacticalMap);
  },

  renderTacticalMarkers(cases, filterCategory = 'all', showIncidents = true, showCctv = true) {
    if (!this.tacticalMap) this.initTacticalMap();
    this.incidentLayer.clearLayers();
    this.cctvLayer.clearLayers();

    const filtered = filterCategory === 'all'
      ? cases
      : cases.filter((c) => c.category === filterCategory);

    filtered.forEach((c) => {
      const catInfo = CATEGORIES[c.category] || { label: c.category, color: '#3b82f6' };

      if (showIncidents && c.lat && c.lng) {
        const icon = L.divIcon({
          className: 'custom-pin',
          html: `<div style="background:${catInfo.color};width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px ${catInfo.color};"></div>`,
          iconSize: [18, 18]
        });

        L.marker([c.lat, c.lng], { icon })
          .bindPopup(`
            <div style="font-family:Prompt,sans-serif;min-width:200px;">
              <strong>คดี ${c.id}</strong><br/>
              <span style="color:${catInfo.color};font-weight:600;">${catInfo.label}</span><br/>
              <small>${c.locationName}</small><br/>
              <button onclick="AppUI.openCaseModal('${c.id}')" style="margin-top:6px;padding:4px 10px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;">เปิดแฟ้มคดี</button>
            </div>
          `)
          .addTo(this.incidentLayer);
      }

      if (showCctv && c.cctvs && c.cctvs.length > 0) {
        c.cctvs.forEach((cam) => {
          const camLat = cam.lat || c.lat + 0.0006;
          const camLng = cam.lng || c.lng + 0.0006;
          const camIcon = L.divIcon({
            className: 'cctv-pin',
            html: `<div style="background:#f59e0b;color:#000;width:24px;height:24px;border-radius:6px;display:grid;place-items:center;border:2px solid #fff;font-size:11px;"><i class="fa-solid fa-video"></i></div>`,
            iconSize: [24, 24]
          });

          L.marker([camLat, camLng], { icon: camIcon })
            .bindPopup(`
              <div style="font-family:Prompt,sans-serif;">
                <strong>🎥 จุดกล้อง CCTV</strong><br/>
                ${cam.source}<br/>
                <small>ช่วงเวลา: ${cam.timeRange || '-'}</small><br/>
                <small>ติดต่อ: ${cam.contact || '-'}</small><br/>
                <small>เชื่อมโยงคดี: ${c.id}</small>
              </div>
            `)
            .addTo(this.cctvLayer);
        });
      }
    });

    setTimeout(() => this.tacticalMap.invalidateSize(), 150);
  }
};
