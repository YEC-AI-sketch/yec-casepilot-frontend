/* =============================================================================
   Hàm serverless chạy trên Vercel — đóng vai trò y hệt phần proxy trong
   server.js khi chạy máy cục bộ.

   Vì sao cần nó thay vì cho trình duyệt gọi thẳng n8n:
     1. Cùng origin với trang -> không phải cấu hình CORS ở n8n.
     2. Địa chỉ n8n nằm trong biến môi trường của Vercel, không lộ ra mã nguồn
        phía client, nên không ai dò được webhook để gọi trực tiếp.

   Cấu hình trên Vercel: Settings > Environment Variables
     N8N_URL = https://<địa-chỉ-n8n-công-khai>/webhook/yec-v2
   ========================================================================== */

/* Gói Hobby cho tối đa 60 giây. Luồng 1 chạy nền nên mode=submit trả về ngay,
   nhưng mode=chat phải chờ Gemini nên cần nới rộng. */
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ phase: 'reject', reply: 'Chỉ nhận POST.' });
  }

  const target = process.env.N8N_URL;
  if (!target) {
    return res.status(500).json({
      phase: 'reject',
      reply: 'Chưa đặt biến N8N_URL trong Vercel (Settings > Environment Variables).',
    });
  }

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });

    const text = await upstream.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(upstream.status).send(text || '{}');
  } catch (err) {
    /* Thường gặp: tunnel tới n8n đã tắt, hoặc máy chạy n8n đã sleep */
    return res.status(502).json({
      phase: 'reject',
      reply: 'Không gọi được n8n: ' + err.message,
    });
  }
}
