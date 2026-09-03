#!/usr/bin/env node
/* =============================================================================
   chan-doan.js — kiểm tra webhook v2 trước khi nối frontend vào

   Chạy:
     node chan-doan.js
     node chan-doan.js --url=http://localhost:5678/webhook/yec-v2
     node chan-doan.js --url=... --user=adminfull --pass=adminfull

   Script gọi thẳng webhook (không qua giao diện) và dịch mã lỗi thành nguyên
   nhân cụ thể, thay vì để bạn ngồi đoán giữa 404 / 502 / 524 / 401.
   ========================================================================== */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=')];
  })
);

const URL_HOOK = args.url  || process.env.N8N_URL || 'http://localhost:5678/webhook/yec-v2';
const USER     = args.user || '';
const PASS     = args.pass || '';

const ok   = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m);
const bad  = (m) => console.log('  \x1b[31m✗\x1b[0m ' + m);
const info = (m) => console.log('    ' + m);

async function post(payload) {
  const res = await fetch(URL_HOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
}

/* Dịch mã lỗi HTTP thành nguyên nhân, theo mục 9.2 của KIEN-TRUC.md */
function giaiThich(status, text) {
  if (status === 404 && !text.trim()) {
    return ['Webhook bị huỷ đăng ký sau `import:workflow`.',
            'Vào n8n UI, gạt công tắc Active TẮT rồi BẬT lại. Đây là bước 4 bắt buộc.'];
  }
  if (status === 404) {
    return ['Sai đường dẫn webhook, hoặc workflow chưa được kích hoạt.',
            'Kiểm tra path phải đúng là `yec-v2`, và công tắc Active đang bật.'];
  }
  if (status === 502) {
    return ['Không có gì phía sau để chuyển tiếp — container n8n đã chết.',
            'Mở lại Docker Desktop, container tự lên sau ~15 giây theo restart policy.'];
  }
  if (status === 524) {
    return ['Proxy/Cloudflare timeout.',
            'Bài vẫn chạy nền và sẽ lưu báo cáo. Chờ rồi hỏi lại mode=status.'];
  }
  if (status === 401) {
    return ['HẾT HẠN MỨC proxy Gemini (api.shopaikey.com) — KHÔNG phải sai key.',
            'Nạp thêm hạn mức. Kiểm tra: GET https://api.shopaikey.com/v1/models (Bearer).'];
  }
  if (status === 400 && /PGRST204/.test(text)) {
    return ['Payload có trường ứng với cột KHÔNG tồn tại trong bảng teams.',
            'Chạy: alter table teams add column if not exists last_error text;',
            '      alter table teams add column if not exists scores jsonb;'];
  }
  if (status === 500) {
    return ['Workflow chạy nhưng chết giữa chừng.',
            'Xem: GET /api/v1/executions?workflowId=YECcasepilotV2a&status=error&limit=5'];
  }
  return ['Chưa có chẩn đoán sẵn cho mã này.', 'Xem execution log trong n8n UI.'];
}

(async () => {
  console.log('');
  console.log('  Kiểm tra backend YEC CasePilot v2');
  console.log('  ─────────────────────────────────────────────────────');
  console.log('  Webhook  ' + URL_HOOK);
  console.log('  ─────────────────────────────────────────────────────');
  console.log('');

  /* --- 1. Webhook có sống không --------------------------------------- */
  console.log('  [1/4] Webhook có phản hồi không');
  let r;
  try {
    r = await post({});
  } catch (e) {
    bad('Không kết nối được: ' + e.message);
    info('n8n chưa chạy, sai cổng, hoặc sai địa chỉ.');
    info('Kiểm tra: docker ps | findstr n8n   (Windows)');
    info('          docker ps | grep n8n      (macOS/Linux)');
    process.exit(1);
  }

  if (r.status !== 200) {
    bad(`Server trả ${r.status}`);
    giaiThich(r.status, r.text).forEach(info);
    if (r.text) info('Body: ' + r.text.slice(0, 200));
    process.exit(1);
  }
  ok('Webhook sống, trả 200');

  /* --- 2. Router có chạy không ----------------------------------------- */
  console.log('');
  console.log('  [2/4] Node Router có chạy không');
  if (!r.json) {
    bad('Trả 200 nhưng body không phải JSON');
    info('Body: ' + r.text.slice(0, 200));
    info('Thường là workflow chết ở Code node. Xem execution log.');
    process.exit(1);
  }
  if (r.json.error === 'NO_ACCOUNT') {
    ok('Router chạy đúng — gửi payload rỗng thì bị chặn NO_ACCOUNT');
  } else {
    bad('Router trả kết quả lạ với payload rỗng');
    info(JSON.stringify(r.json).slice(0, 300));
    info('Đáng lẽ phải là {"phase":"reject","error":"NO_ACCOUNT"}.');
  }

  /* --- 3. Supabase có nối được không ----------------------------------- */
  console.log('');
  console.log('  [3/4] Đọc được bảng teams trên Supabase không');
  const r2 = await post({ mode: 'login', username: '__khong_ton_tai__', password: 'x' });
  if (r2.status !== 200) {
    bad(`Trả ${r2.status} khi đọc bảng teams`);
    giaiThich(r2.status, r2.text).forEach(info);
    info('Rất thường gặp: credential Supabase sai, hoặc node "Doc tai khoan"');
    info('trỏ sai SUPABASE_URL. Sửa hằng SUPABASE_URL trong build-workflow.js');
    info('rồi build + import lại.');
    process.exit(1);
  }
  if (r2.json && r2.json.error === 'BAD_LOGIN') {
    ok('Đọc được bảng teams — tài khoản không tồn tại bị chặn BAD_LOGIN');
  } else {
    bad('Kết quả lạ khi tra tài khoản không tồn tại');
    info(JSON.stringify(r2.json).slice(0, 300));
  }

  /* --- 4. Đăng nhập thật ------------------------------------------------ */
  console.log('');
  console.log('  [4/4] Đăng nhập bằng tài khoản thật');
  if (!USER || !PASS) {
    info('Bỏ qua — chạy lại kèm --user=... --pass=... để thử.');
    console.log('');
    console.log('  Ba bước đầu đã qua. Giờ chạy:');
    console.log(`    node chan-doan.js --url=${URL_HOOK} --user=adminfull --pass=adminfull`);
    console.log('');
    return;
  }

  const r3 = await post({ mode: 'login', username: USER, password: PASS });
  if (r3.status !== 200) {
    bad(`Trả ${r3.status}`);
    giaiThich(r3.status, r3.text).forEach(info);
    process.exit(1);
  }
  if (r3.json.phase === 'reject') {
    bad('Bị từ chối: ' + r3.json.reply);
    info('Sai tên đăng nhập HOẶC sai mật khẩu — server cố ý không phân biệt.');
    info("Kiểm tra bằng SQL: select username, password from teams where username='" + USER + "';");
    process.exit(1);
  }

  ok('Đăng nhập được');
  info('Đội         : ' + (r3.json.team || '(trống)'));
  info('Trạng thái  : ' + r3.json.status);
  info('Có báo cáo  : ' + (r3.json.report ? 'có (' + r3.json.report.length + ' ký tự)' : 'chưa'));
  info('Có bảng điểm: ' + (r3.json.scores ? 'có' : 'chưa'));

  if (r3.json.scores === null && r3.json.status === 'da_xong') {
    console.log('');
    info('Đã xong nhưng không có điểm — nhiều khả năng thiếu cột `scores`.');
    info('Chạy: alter table teams add column if not exists scores jsonb;');
  }

  console.log('');
  console.log('  ─────────────────────────────────────────────────────');
  console.log('  Backend sẵn sàng. Nối frontend vào:');
  console.log('');
  console.log('    Windows PowerShell:');
  console.log(`      $env:N8N_URL = "${URL_HOOK}"`);
  console.log('      node server.js');
  console.log('');
  console.log('    macOS / Linux:');
  console.log(`      N8N_URL=${URL_HOOK} node server.js`);
  console.log('');
})();
