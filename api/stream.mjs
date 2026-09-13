/* =============================================================================
   Proxy CHẢY CHỮ cho khung chat (13/09/2026).

   Khác api/webhook.mjs ở đúng một điểm sống còn: hàm kia gọi
   `await upstream.text()` — ĐỆM TRỌN GÓI rồi mới trả, nên dù n8n có stream thì
   chữ vẫn về một cục. Hàm này đọc tới đâu ghi ra tới đó.

   Địa chỉ n8n SUY RA từ biến N8N_URL có sẵn (đổi đoạn path cuối), để không phải
   thêm biến môi trường mới trên Vercel:
     N8N_URL = https://.../webhook/yec-v2  ->  https://.../webhook/yec-v2-chat-stream

   Backend trả NDJSON, mỗi dòng một JSON:
     {"type":"begin",...}  {"type":"item","content":"..."}  {"type":"end",...}
   Đội chưa nộp bài hoặc sai mật khẩu thì n8n trả 200 với BODY RỖNG — frontend
   bắt đúng chỗ đó để lùi về đường chat bất đồng bộ cũ.
   ========================================================================== */

/* Gói Hobby trần 60 giây. Đo 78 lượt chat thật: p50 17,7s — p95 41,6s, nên
   2,6% lượt có thể chạm trần. Chạm thì stream đứt, nhưng backend vẫn ghi xong
   câu trả lời vào chat_phien, frontend hỏi lại trạng thái là lấy được. */
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ phase: 'reject', reply: 'Chỉ nhận POST.' });
  }

  const base = process.env.N8N_URL;
  if (!base) {
    return res.status(500).json({
      phase: 'reject',
      reply: 'Chưa đặt biến N8N_URL trong Vercel (Settings > Environment Variables).',
    });
  }
  /* Thay đoạn cuối của đường dẫn, giữ nguyên tên miền và mọi thứ phía trước. */
  const target = base.replace(/\/[^/]*$/, '/yec-v2-chat-stream');

  let upstream;
  try {
    upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
  } catch (err) {
    return res.status(502).json({ phase: 'reject', reply: 'Không gọi được n8n: ' + err.message });
  }

  if (!upstream.ok || !upstream.body) {
    /* Trả body rỗng -> frontend hiểu là "không dùng được", tự lùi đường cũ. */
    res.status(upstream.status || 502);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    return res.end();
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-transform');
  /* Nói với mọi lớp đệm trên đường đi là ĐỪNG gom gói lại. */
  res.setHeader('X-Accel-Buffering', 'no');

  const doc = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await doc.read();
      if (done) break;
      res.write(Buffer.from(value));
      if (typeof res.flush === 'function') res.flush();
    }
  } catch (err) {
    /* Đứt giữa chừng: đóng luôn. Chữ đã gửi được thì đội vẫn thấy, phần còn
       lại frontend lấy qua mode=chat_status. */
  }
  res.end();
}
