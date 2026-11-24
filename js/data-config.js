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

const INITIAL_CASES = [
  {
    id: '69-1124-001',
    datetime: '2026-11-24T01:20',
    category: 'theft',
    status: 'investigating',
    officer: 'ร.ต.อ. สมชาย รักษาการ',
    locationName: 'ลานจอดรถหน้าตลาดสดคูขวาง',
    lat: 8.4368,
    lng: 99.9635,
    description: 'คนร้ายลักรถจักรยานยนต์ Honda Wave 110i สีแดง-ดำ หลบหนีมุ่งหน้าถนนพัฒนาการคูขวาง',
    suspects: [
      {
        name: 'ไม่ทราบชื่อ (ชาย 1 ราย)',
        description: 'สูงประมาณ 170 ซม. เสื้อคลุมสีดำ หมวกกันน็อกเต็มใบสีขาว',
        vehicle: 'Honda Wave 110i (ของกลาง) ไม่ติดแผ่นป้าย',
        photo: ''
      }
    ],
    cctvs: [
      {
        source: 'กล้องเทศบาล เสาไฟหน้าตลาดสด #14',
        contact: 'ศูนย์ CCTV เทศบาล (075-342-xxx)',
        timeRange: '01:15 - 01:30 น.',
        lat: 8.4375,
        lng: 99.9642,
        photo: ''
      }
    ]
  },
  {
    id: '69-1123-004',
    datetime: '2026-11-23T22:45',
    category: 'assault',
    status: 'open',
    officer: 'ร.ต.ท. วีระชัย สายตรวจ',
    locationName: 'หน้าสถานบันเทิง ถ.พัฒนาการคูขวาง',
    lat: 8.4255,
    lng: 99.9690,
    description: 'กลุ่มวัยรุ่นมีปากเสียงและทำร้ายร่างกายกัน มีผู้บาดเจ็บ 1 ราย นำส่ง รพ. แล้ว',
    suspects: [
      {
        name: 'นายเอ (นามสมมติ)',
        description: 'สวมเสื้อยืดสีขาว กางเกงยีนส์ มีรอยสักที่แขนขวา',
        vehicle: 'กระบะ Isuzu สีบรอนซ์ ทะเบียน กข-4512',
        photo: ''
      }
    ],
    cctvs: [
      {
        source: 'กล้องร้านสะดวกซื้อฝั่งตรงข้าม',
        contact: 'ผู้จัดการสาขา (089-123-xxxx)',
        timeRange: '22:40 - 22:55 น.',
        lat: 8.4259,
        lng: 99.9698,
        photo: ''
      }
    ]
  },
  {
    id: '69-1123-002',
    datetime: '2026-11-23T15:10',
    category: 'traffic',
    status: 'closed',
    officer: 'ร.ต.อ. สมชาย รักษาการ',
    locationName: 'สี่แยกหัวถนน ราชดำเนิน',
    lat: 8.4142,
    lng: 99.9658,
    description: 'รถยนต์เก๋งเฉี่ยวชนรถจักรยานยนต์ ไม่มีผู้เสียชีวิต คู่กรณีตกลงชดใช้ค่าเสียหายได้',
    suspects: [],
    cctvs: [
      {
        source: 'กล้องจราจร สี่แยกหัวถนน',
        contact: 'งานจราจร สภ.เมือง',
        timeRange: '15:05 - 15:15 น.',
        lat: 8.4146,
        lng: 99.9661,
        photo: ''
      }
    ]
  },
  {
    id: '69-1122-009',
    datetime: '2026-11-22T20:30',
    category: 'drugs',
    status: 'closed',
    officer: 'พ.ต.ต. อนันต์ ชุดสืบสวน',
    locationName: 'ซอยหลังสถานีรถไฟ',
    lat: 8.4340,
    lng: 99.9562,
    description: 'ล่อซื้อและจับกุมผู้ต้องหาพร้อมของกลางยาบ้า 45 เม็ด ส่งพนักงานสอบสวนดำเนินคดี',
    suspects: [
      {
        name: 'นายบี (ควบคุมตัวแล้ว)',
        description: 'อายุ 28 ปี ภูมิลำเนา อ.เมือง',
        vehicle: 'รถจักรยานยนต์ PCX สีเทา',
        photo: ''
      }
    ],
    cctvs: []
  }
];

const StorageService = {
  getCases() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CASES));
      return [...INITIAL_CASES];
    }
    return JSON.parse(raw);
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
  },

  resetDemo() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CASES));
    return [...INITIAL_CASES];
  }
};
