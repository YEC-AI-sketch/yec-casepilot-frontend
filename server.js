#!/usr/bin/env node
/* =============================================================================
   YEC CasePilot — máy chủ chạy cục bộ (không cần cài thư viện ngoài)

   Làm 2 việc:

   1. Phục vụ tĩnh  index.html  tại  http://localhost:5500
   2. Nhận POST  /webhook/yec-v2  — cùng origin với trang nên KHÔNG dính CORS:
        - chưa đặt N8N_URL  -> trả lời bằng BẢN GIẢ LẬP chạy trong bộ nhớ
        - đã đặt N8N_URL    -> chuyển tiếp nguyên văn sang n8n thật

   Chạy:
     node server.js                                          -> giả lập
     N8N_URL=http://localhost:5678/webhook/yec-v2 node server.js  -> n8n thật

   Biến môi trường:
     PORT     cổng, mặc định 5500
     N8N_URL  địa chỉ webhook v2 thật. Bỏ trống = dùng bản giả lập.
   ========================================================================== */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT     = Number(process.env.PORT || 5500);
const N8N_URL  = process.env.N8N_URL || '';
const IS_MOCK  = !N8N_URL;
const HOOK     = '/webhook/yec-v2';

/* =============================================================================
   BẢN GIẢ LẬP BACKEND v2 — cùng hợp đồng với workflow thật, nhưng không gọi LLM.
   Sửa mảng `mockTeams` bên dưới để thêm tài khoản thử.
   ========================================================================== */
const mockTeams = {
  demo: {
    password: 'demo123',
    team_name: 'Đội Demo',
    status: 'chua_nop',
    report: '', questions: '', scores: null, submission: null,
  },
  adminfull: {
    password: 'adminfull',
    team_name: 'Đội thử — chạy full Luồng 1',
    status: 'chua_nop',
    report: '', questions: '', scores: null, submission: null,
  },
  adminhalf: {
    password: 'adminhalf',
    team_name: 'Đội thử — có sẵn báo cáo',
    status: 'da_xong',
    report: '', questions: '', scores: null, submission: null,
  },
};

/* Tài khoản tự xoá kết quả cũ mỗi lần đăng nhập — khớp hằng AUTO_RESET trong
   build-workflow.js. Chỉ reset ở mode='login', KHÔNG reset ở mode='status'. */
const AUTO_RESET = ['adminfull'];

/* Luồng 1 thật mất 36–200 giây. Giả lập rút xuống 12 giây để xem được vòng poll. */
const FAKE_ANALYSIS_MS = 12000;

const MOCK_REPORT = `# Nhận định chung
Đây là **báo cáo giả lập** do \`server.js\` sinh ra để bạn xem giao diện chạy. Khi
trỏ \`N8N_URL\` sang n8n thật, chỗ này là báo cáo do hai agent Thẩm định và Đối
kháng viết.

# Bốn mắt xích
• **① Số liệu → ② Vấn đề**: số liệu đội nêu chưa nói rõ dùng để chứng minh điều gì.
• **② Vấn đề → ③ Đối tượng**: nhóm đối tượng chưa suy ra được từ phát biểu vấn đề.
• **③ Đối tượng → ④ Kế hoạch**: hoạt động chưa gắn với hành vi cụ thể của nhóm này.
• **④ Kế hoạch → ⑤ KPI**: KPI chưa có giá trị nền nên không đo được mức cải thiện.

# Ba mũi phản biện
• Nếu giả định về mức tăng doanh thu sai một nửa thì kế hoạch còn đứng được không?
• Vì sao chọn nhóm này thay vì nhóm liền kề có quy mô lớn hơn?
• Điều kiện dừng của kế hoạch là gì — mốc nào thì đội thừa nhận hướng đi sai?`;

const MOCK_QUESTIONS = `• Con số nền của từng KPI lấy từ đâu?
• Ngân sách phân bổ theo tỷ lệ nào giữa các kênh, và vì sao?
• Rủi ro nào đội cho là có xác suất cao nhất?`;

const MOCK_SCORES = {
  version: 1, thang_goc: 100, tong_tho: 64, tong_100: 64,
  cham_luc: new Date().toISOString(), thieu_tieu_chi: 0,
  nhan_xet_toan_bai: 'Bài có cấu trúc rõ, điểm yếu nằm ở khâu nối bằng chứng với kết luận.',
  tieu_chi: [
    { ma: 'A', ten: 'Phân tích thực trạng & Chẩn đoán vấn đề', diem: 16, diem_toi_da: 25, band: '16-20',
      nhan_xet: 'Đội khai thác dữ liệu chuỗi cung ứng tốt, chỉ ra được chênh lệch tồn kho và nút thắt OTIF giữa các phân vùng. Tuy nhiên phần chẩn đoán nhầm lẫn dữ kiện case.',
      trich_dan: 'Tồn kho tại vùng Bắc cao hơn 34% so với vùng Nam trong quý gần nhất.',
      thieu_gi: ['Nhầm dữ kiện: 4/5 SKU bị áp thuế SCT (thực tế chỉ 1 SKU)', 'Trộn lẫn dữ liệu khảo sát toàn ngành với dữ liệu pulse của TEA+'], khong_cham_duoc: false },
    { ma: 'B', ten: 'Lựa chọn chiến lược & Đề xuất giá trị', diem: 13, diem_toi_da: 20, band: '11-15',
      nhan_xet: 'Có ý tưởng thương mại thực tiễn, nhưng định vị chiến lược bị rỗng ruột khi thay chân dung người tiêu dùng bằng 4 vùng địa lý.',
      thieu_gi: ['Thay chân dung người tiêu dùng bằng vùng địa lý', 'Giảm 0,1–0,2g đường vẫn chịu thuế SCT 8% (lỗi logic)'], khong_cham_duoc: false },
    { ma: 'C', ten: 'Triển khai & Khả thi', diem: 15, diem_toi_da: 25, band: '11-15',
      nhan_xet: 'Mốc thời gian rõ ràng, phân vai cụ thể. Chưa nêu điều kiện dừng nếu chỉ số không đạt.',
      thieu_gi: ['Thiếu điều kiện dừng của kế hoạch'], khong_cham_duoc: false },
    { ma: 'D', ten: 'Trình bày & Tính thuyết phục', diem: 12, diem_toi_da: 20, band: '11-15',
      nhan_xet: 'Bố cục mạch lạc, nhưng phần tài chính thiếu biên lợi nhuận theo kênh nên khó thẩm định.',
      thieu_gi: ['Thiếu biên lợi nhuận theo kênh'], khong_cham_duoc: false },
    { ma: 'E', ten: 'Rủi ro & KPI', diem: 8, diem_toi_da: 10, band: '8-10',
      nhan_xet: 'Đầy đủ, có biện pháp xử lý cho từng rủi ro đã nêu.',
      thieu_gi: [], khong_cham_duoc: false },
  ],
};

mockTeams.adminhalf.report    = MOCK_REPORT;
mockTeams.adminhalf.questions = MOCK_QUESTIONS;
mockTeams.adminhalf.scores    = MOCK_SCORES;

const FIELD_LABELS = {
  so_lieu:    '① Số liệu đã research',
  van_de:     '② Vấn đề đội xác định',
  doi_tuong:  '③ Đối tượng hướng đến',
  ke_hoach:   '④ Kế hoạch triển khai',
  rui_ro_kpi: '⑤ Quản trị rủi ro & KPI',
};
const MIN_CHARS = 40;

function mockHandle(req) {
  const mode = String(req.mode || '').trim();
  const u    = String(req.username || '').trim().toLowerCase();
  const rec  = mockTeams[u];

  if (!u || !req.password) {
    return { phase: 'reject', error: 'NO_ACCOUNT', reply: 'Thiếu tên đăng nhập hoặc mật khẩu.' };
  }
  /* Sai tên và sai mật khẩu trả CÙNG một thông báo để không lộ danh sách đội */
  if (!rec || rec.password !== req.password) {
    return { phase: 'reject', error: 'BAD_LOGIN', reply: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  if (mode === 'login' && AUTO_RESET.indexOf(u) !== -1) {
    Object.assign(rec, { status: 'chua_nop', report: '', questions: '', scores: null, submission: null });
  }

  if (mode === 'login' || mode === 'status') {
    return {
      ok: true, phase: 'info', status: rec.status, team: rec.team_name, username: u,
      report: rec.report, questions: rec.questions, scores: rec.scores,
      message: rec.status === 'dang_phan_tich' ? 'Đang phân tích...' : '',
    };
  }

  if (mode === 'submit') {
    if (rec.status === 'da_xong') {
      return { phase: 'reject', error: 'LOCKED',
        reply: 'Đội đã nộp bài và nhận báo cáo rồi. Mỗi đội chỉ được nộp **một lần duy nhất**. ' +
               'Đội có thể tiếp tục trao đổi thêm về báo cáo ở khung chat.' };
    }
    if (rec.status === 'dang_phan_tich') {
      return { phase: 'reject', error: 'PROCESSING', reply: 'Bài của đội đang được phân tích, vui lòng chờ.' };
    }
    const s = req.submission || {};
    const thieu = Object.keys(FIELD_LABELS).filter((k) => String(s[k] || '').trim().length < MIN_CHARS);
    if (thieu.length) {
      return { phase: 'reject', error: 'INCOMPLETE',
        reply: 'Các mục sau còn trống hoặc quá sơ sài (cần tối thiểu ' + MIN_CHARS + ' ký tự):\n\n' +
               thieu.map((k) => '- ' + FIELD_LABELS[k]).join('\n') };
    }
    rec.submission = s;
    rec.status = 'dang_phan_tich';
    setTimeout(() => {
      rec.status = 'da_xong';
      rec.report = MOCK_REPORT;
      rec.questions = MOCK_QUESTIONS;
      rec.scores = MOCK_SCORES;
    }, FAKE_ANALYSIS_MS);
    return { accepted: true, phase: 'processing', reply: 'Đã nhận bài. Đang phân tích...' };
  }

  if (mode === 'chat') {
    if (rec.status !== 'da_xong' || !rec.report) {
      return { phase: 'reject', error: 'NO_REPORT', reply: 'Đội chưa có báo cáo để trao đổi. Hãy điền form và nộp bài trước.' };
    }
    const q = String(req.message || '').trim();
    return { phase: 'chat', reply:
      '*(Trả lời giả lập — chưa gọi Gemini.)*\n\nBạn hỏi: **' + q.slice(0, 200) + '**\n\n' +
      'Khi chạy thật, agent Luồng 2 sẽ neo vào báo cáo đã lưu và trả lời theo 5 nguyên tắc ' +
      'trong `CORE_RULES`: chỉ phản biện lập luận, không quyết định hộ nội dung.' };
  }

  if (mode === 'grade') {
    if (rec.status !== 'da_xong' || !rec.report) {
      return { phase: 'reject', error: 'NOT_READY', reply: 'Chưa có báo cáo để chấm. Đội cần nộp bài trước.' };
    }
    rec.scores = MOCK_SCORES;
    return { accepted: true, phase: 'grading', reply: 'Đang chấm lại...' };
  }

  return { phase: 'reject', error: 'BAD_MODE', reply: 'mode không hợp lệ.' };
}

/* ------------------------------------------------------------- HTTP ------ */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 8e6) req.destroy(); });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml', '.png': 'image/png',
  '.jpg':  'image/jpeg',    '.ico': 'image/x-icon',
};

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/health') {
    return json(res, 200, {
      ok: true,
      mode: IS_MOCK ? 'mock' : 'live',
      n8n_url: N8N_URL || null,
      accounts: IS_MOCK ? Object.keys(mockTeams) : 'quản lý ở bảng teams trên Supabase',
      port: PORT,
    });
  }

  if (url.pathname === HOOK && req.method === 'POST') {
    const raw = await readBody(req);

    if (IS_MOCK) {
      let body;
      try { body = JSON.parse(raw || '{}'); }
      catch (e) { return json(res, 400, { phase: 'reject', reply: 'Body không phải JSON hợp lệ.' }); }
      const out = mockHandle(body);
      console.log(`  ${body.mode || '?'}  ${body.username || '-'}  -> ${out.phase}`);
      return json(res, 200, out);
    }

    /* Chuyển tiếp sang n8n thật. Trang và webhook cùng origin nên trình duyệt
       không cần preflight, khỏi phải cấu hình CORS ở n8n. */
    try {
      const up = await fetch(N8N_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw,
      });
      const text = await up.text();
      res.writeHead(up.status, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(text || '{}');
    } catch (e) {
      console.error('[proxy]', e.message);
      return json(res, 502, { phase: 'reject', reply: 'Không gọi được n8n: ' + e.message });
    }
  }

  /* Tệp tĩnh */
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  const abs = path.join(__dirname, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(abs, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 — không tìm thấy ' + file);
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  YEC CasePilot — máy chủ cục bộ');
  console.log('  ─────────────────────────────────────────────────────');
  console.log(`  Giao diện   http://localhost:${PORT}/index.html`);
  console.log(`  Chế độ      ${IS_MOCK ? 'GIẢ LẬP (không cần n8n/Supabase/Gemini)' : 'THẬT — chuyển tiếp sang n8n'}`);
  if (!IS_MOCK) console.log(`  Backend     ${N8N_URL}`);
  console.log('  ─────────────────────────────────────────────────────');
  if (IS_MOCK) {
    console.log('  Tài khoản thử:');
    Object.keys(mockTeams).forEach((u) => {
      console.log(`    ${u.padEnd(10)} / ${mockTeams[u].password.padEnd(10)}  ${mockTeams[u].team_name}`);
    });
    console.log('  ─────────────────────────────────────────────────────');
  }
  console.log('  Dừng: Ctrl + C');
  console.log('');
});
