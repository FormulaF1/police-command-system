const DEFAULT_CENTER = [8.4304, 99.9631]; // พิกัดเริ่มต้น (สามารถปรับเปลี่ยนตามพื้นที่สถานีได้)
const STORAGE_KEY = 'police_command_cases_v1';

const CATEGORIES = {
  theft: { label: 'ลักทรัพย์ / ชิงทรัพย์', color: '#ef4444' },
  assault: { label: 'ทะเลาะวิวาท / ทำร้ายร่างกาย', color: '#f59e0b' },
  drugs: { label: 'ยาเสพติด', color: '#8b5cf6' },
  traffic: { label: 'อุบัติเหตุจราจร', color: '#3b82f6' },
  cyber: { label: 'ฉ้อโกง / ออนไลน์', color: '#10b981' }
};

const STATUSES = {
  open: { label: 'รับแจ้งเหตุใหม่', badge: 'badge-red' },
  investigating: { label: 'กำลังสืบสวน', badge: 'badge-gold' },
  closed: { label: 'ปิดคดีแล้ว', badge: 'badge-green' }
};

const StorageService = {
  getCases() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  saveCases(cases) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  },

  addCase(newCase) {
    const cases = this.getCases();
    cases.unshift(newCase);
    this.saveCases(cases);
  },

  updateStatus(caseId, newStatus) {
    const cases = this.getCases();
    const target = cases.find((c) => c.id === caseId);
    if (target) {
      target.status = newStatus;
      this.saveCases(cases);
    }
  },

  generateCaseId() {
    const now = new Date();
    const thaiYear = String(now.getFullYear() + 543).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const prefix = `${thaiYear}-${mm}${dd}`;
    const todayCount = this.getCases().filter((c) => c.id.startsWith(prefix)).length + 1;
    return `${prefix}-${String(todayCount).padStart(3, '0')}`;
  }
};
