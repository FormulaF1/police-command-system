const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbydTeE6PcKCSlvE7UyWVCdUBcuuURfUYvHC9h0UPZdJ_PbtRL1ZV5Vx4kO8k0tMmFKj/exec';

const ApiService = {
  isConfigured() {
    return GAS_WEB_APP_URL && GAS_WEB_APP_URL.startsWith('https://script.google.com/');
  },

  async fetchCases() {
    if (!this.isConfigured()) {
      return StorageService.getCases();
    }
    try {
      const res = await fetch(GAS_WEB_APP_URL);
      const json = await res.json();
      if (json.status === 'success') {
        StorageService.saveCases(json.data); // แคชไว้ในเครื่องเพื่อความเร็ว
        return json.data;
      }
      throw new Error(json.message);
    } catch (err) {
      console.error('โหลดข้อมูลจาก Google Sheets ไม่สำเร็จ:', err);
      return StorageService.getCases();
    }
  },

  async addCase(caseData) {
    if (!this.isConfigured()) {
      StorageService.addCase(caseData);
      return caseData;
    }
    // ใช้ text/plain เพื่อเลี่ยงปัญหา CORS Preflight ของ Google Apps Script
    const res = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'addCase', data: caseData })
    });
    const json = await res.json();
    if (json.status !== 'success') throw new Error(json.message);

    StorageService.addCase(json.data);
    return json.data;
  },

  async updateStatus(caseId, newStatus) {
    StorageService.updateStatus(caseId, newStatus);
    if (!this.isConfigured()) return;

    await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'updateStatus', caseId, newStatus })
    });
  }
};
