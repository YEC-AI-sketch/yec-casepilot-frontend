# Chạy hẳn trên internet — không phụ thuộc laptop

Mục tiêu: cả team mở một link là dùng được, không cần máy bạn bật.

---

## Đọc trước: GitHub không chạy backend

Repo `yec-casepilot-v2` bạn vừa đẩy lên là **mã nguồn**, không phải hệ thống đang
chạy. GitHub chỉ lưu file. `build-workflow.js` là công thức sinh ra workflow, còn
n8n phải chạy ở một nơi nào đó có điện và có IP công khai.

Hiện trạng của bạn:

| Thành phần | Đang ở đâu | Phụ thuộc laptop? |
|---|---|---|
| Supabase (bảng teams, Knowledge Base 33 chunk) | Đám mây | **Không** — đã xong |
| Gemini, Tavily | Đám mây | **Không** — đã xong |
| **n8n** | `localhost:5678` trên laptop | **Có** ← chỗ duy nhất cần chuyển |
| Frontend | `localhost:5500` trên laptop | **Có** ← lên Vercel |

Nên chỉ còn hai việc: đưa n8n lên host, đưa frontend lên Vercel.

**Tin tốt:** Knowledge Base đã nằm trong Supabase rồi, nên bạn **không phải chạy
lại bước nạp KB**. 33 chunk đó dùng được cho mọi instance n8n mới.

---

## Bước 1 — Chọn chỗ chạy n8n

| Cách | Giá | Công sức | Hợp cho |
|---|---|---|---|
| **n8n Cloud** | Miễn phí 14 ngày (không cần thẻ), sau đó ~20 €/tháng | 10 phút | **Test với team ngay** |
| **Railway** | ~5–10 USD/tháng | 30 phút | Vài tuần |
| **VPS + Docker** | ~5–7 USD/tháng | 1–2 giờ | Ngày thi thật, nếu bạn quen Linux |

**Khuyên dùng n8n Cloud trước.** Bản dùng thử 14 ngày không cần thẻ tín dụng, đủ
cho cả giai đoạn test. Hết hạn mà thấy hợp thì trả tiền, không thì chuyển sang
Railway — lúc đó bạn đã biết chính xác mình cần gì.

Lưu ý về giới hạn: gói Starter cho **2.500 lượt chạy/tháng**. Nghe nhiều nhưng mỗi
lần đội đăng nhập, hỏi trạng thái, hay chat đều tính một lượt. Giao diện hỏi
trạng thái **mỗi 5 giây** trong lúc phân tích, tức một bài nộp có thể ngốn 20–40
lượt. Với vài chục đội thi thật thì phải tính lại, hoặc tự host để không giới hạn.

---

## Bước 2 — Dựng n8n trên n8n Cloud

### 2.1. Đăng ký

Vào <https://n8n.io> → **Get started free**. Chọn bản Cloud, đăng ký, nó cho bạn
địa chỉ dạng:

```
https://<tên-bạn>.app.n8n.cloud
```

### 2.2. Tạo lại 3 credential

**Đây là chỗ mất công nhất, và không tránh được.** Credential nằm trong từng
instance n8n, không đi theo file workflow. Instance mới có ID mới.

Vào **Credentials → Add credential**, tạo đủ ba cái y như đã làm ở máy:

| Loại | Điền gì |
|---|---|
| **Supabase API** | Host `https://vgkwaebaqqddtztlwlox.supabase.co`, Service Role Secret = key `sb_secret_...` |
| **Google Gemini(PaLM) API** | Host `https://generativelanguage.googleapis.com`, API key AI Studio |
| **Tavily API** | API key Tavily |

Tavily là community node, phải cài trước: **Settings → Community nodes → Install**,
gõ `@tavily/n8n-nodes-tavily`.

> n8n Cloud gói thấp có thể chặn community node. Nếu không cài được, dùng cách
> thay thế: tạo credential **Header Auth** (Name `Authorization`, Value
> `Bearer tvly-...`) rồi sửa node Tavily trong `build-workflow.js` — xem mục
> "Cách 2" trong hướng dẫn trước.

Sau mỗi lần Save, **chép ID từ thanh địa chỉ**:

```
https://<tên-bạn>.app.n8n.cloud/home/credentials/aBcD1234EfGh5678
                                                  └──── ID ────┘
```

Điền vào bảng này:

| Credential | ID mới |
|---|---|
| Supabase | |
| Gemini | |
| Tavily | |

### 2.3. Build lại workflow với ID mới

Trên máy, trong thư mục backend:

```powershell
git pull
```

Mở `build-workflow.js`, thay 3 ID trong khối `CRED` bằng ID mới. `SUPABASE_URL`
giữ nguyên vì vẫn dùng chung project Supabase đó.

```powershell
node build-workflow.js yec-v2.workflow.json
```

Phải thấy `OK — nodes: 40 | connections: 34`.

### 2.4. Nạp workflow lên n8n Cloud

n8n Cloud không có CLI, phải import qua giao diện:

1. Mở n8n Cloud → **Workflows → Add workflow**
2. Menu **⋯** góc trên phải → **Import from File**
3. Chọn `yec-v2.workflow.json`
4. **Publish** (nút góc trên phải)

Lấy địa chỉ webhook: mở node **Webhook**, chép **Production URL**. Dạng:

```
https://<tên-bạn>.app.n8n.cloud/webhook/yec-v2
```

### 2.5. Kiểm tra

```powershell
Invoke-RestMethod -Uri "https://<tên-bạn>.app.n8n.cloud/webhook/yec-v2" -Method POST -ContentType "application/json" -Body '{"mode":"login","username":"test1","password":"test1"}'
```

Ra JSON có `status: chua_nop` là backend đã sống trên mây. Từ đây laptop tắt cũng
không sao.

Ra 404 thì workflow chưa Publish. Ra lỗi credential thì ID chưa khớp — làm lại 2.3.

---

## Bước 3 — Frontend lên Vercel

### 3.1. Tạo repo riêng cho frontend

Backend và frontend nên để hai repo. Vercel cần repo có `index.html` ở gốc.

Vào <https://github.com/new>:
- Owner: `YEC-AI-sketch` (hoặc tài khoản cá nhân)
- Name: `yec-casepilot-frontend`
- **Private**, không tích "Add a README"

### 3.2. Đẩy mã lên

Giải nén `yec-deploy.zip` ra thư mục **ngoài OneDrive**, ví dụ `C:\yec-fe`:

```powershell
Expand-Archive -Path "$env:USERPROFILE\Downloads\yec-deploy.zip" -DestinationPath C:\yec-fe -Force
cd C:\yec-fe\yec-deploy
git init
git add .
git commit -m "YEC CasePilot frontend"
git branch -M main
git remote add origin https://github.com/YEC-AI-sketch/yec-casepilot-frontend.git
git push -u origin main
```

Lần đầu push sẽ mở cửa sổ đăng nhập GitHub. Nếu Git hỏi danh tính:

```powershell
git config --global user.name  "Mai Phuong"
git config --global user.email "email-github@example.com"
```

### 3.3. Deploy

1. <https://vercel.com> → **Continue with GitHub**
2. **Add New → Project** → tìm `yec-casepilot-frontend` → **Import**
3. Framework Preset: **Other**. Build Command, Output Directory: để trống.
4. Mở **Environment Variables**, thêm **trước khi bấm Deploy**:

   | Name | Value |
   |---|---|
   | `N8N_URL` | `https://<tên-bạn>.app.n8n.cloud/webhook/yec-v2` |

5. **Deploy**. Đợi ~1 phút.

Xong. Link dạng `https://yec-casepilot-frontend.vercel.app` — gửi cho team.

---

## Cách nó hoạt động

```
Trình duyệt đồng đội
   │  POST /webhook/yec-v2
   ▼
Vercel ──► vercel.json viết lại đường dẫn ──► api/webhook.js
                                                  │ đọc process.env.N8N_URL
                                                  ▼
                                       n8n Cloud (webhook/yec-v2)
                                                  │
                                                  ▼
                                    Supabase + Gemini + Tavily
```

Trình duyệt **không bao giờ** biết địa chỉ n8n — nó chỉ gọi `/webhook/yec-v2`
trên chính domain Vercel. Nhờ vậy không phải cấu hình CORS ở n8n, và không ai dò
được webhook để gọi thẳng.

`index.html` không sửa dòng nào. Chạy cục bộ thì `server.js` làm proxy, chạy trên
Vercel thì `api/webhook.js` làm — cùng một hợp đồng.

---

## Bước 4 — Tài khoản cho team

Trong Supabase SQL Editor:

```sql
insert into teams (username, password, team_name) values
  ('test_an',   'an123',   'An — test'),
  ('test_binh', 'binh123', 'Bình — test'),
  ('test_chi',  'chi123',  'Chi — test')
on conflict (username) do nothing;
```

**Bốn điều phải dặn team:**

**Đừng dùng chung `adminfull`.** Tài khoản này tự xoá kết quả mỗi lần đăng nhập.
Hai người dùng chung thì người sau xoá mất bài đang chạy của người trước. Đây là
bẫy dễ dính nhất.

**Mỗi tài khoản chỉ nộp một lần.** Nộp xong muốn thử lại:

```sql
update teams set status='chua_nop', report=null, submission=null,
       questions=null, scores=null, submitted_at=null
where username='test_an';
```

**Hạn mức Gemini dùng chung.** Một lượt phân tích gọi 8 node Gemini. Ba người
cùng nộp trên key AI Studio miễn phí thì gần như chắc chắn dính lỗi **429**.

**Theo dõi lúc test:**

```sql
select * from team_progress;
select username, last_error, updated_at from teams where last_error is not null;
```

---

## Cập nhật mã sau này

**Frontend:**
```powershell
cd C:\yec-fe\yec-deploy
git add .; git commit -m "mô tả"; git push
```
Vercel tự deploy lại sau ~1 phút.

**Backend:** sửa `build-workflow.js` → `node build-workflow.js yec-v2.workflow.json`
→ import lại qua giao diện n8n Cloud → **Publish**. Đừng quên Publish, bỏ là
webhook rớt đăng ký và trả 404 body rỗng.

**Đổi địa chỉ n8n:** Vercel → Settings → Environment Variables → sửa `N8N_URL` →
Save → **Deployments → ⋯ → Redeploy**. Biến môi trường chỉ nạp lúc deploy, sửa
suông không có tác dụng.

---

## Tra lỗi

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| "Chưa đặt biến N8N_URL trong Vercel" | Quên thêm biến, hoặc thêm rồi chưa redeploy | Settings > Environment Variables, rồi Redeploy |
| **502** "Không gọi được n8n" | Sai địa chỉ n8n, hoặc instance chết | Kiểm tra `N8N_URL`, thử gọi thẳng bằng `Invoke-RestMethod` |
| **404** body rỗng | Workflow chưa Publish | Vào n8n Cloud, Publish |
| *"does not have access to the credential"* | ID credential vẫn là của instance cũ | Làm lại bước 2.3 |
| **429** | Chạm giới hạn key Gemini miễn phí | Đợi một phút, hoặc bật thanh toán Google Cloud |
| Timeout khi chat | Gemini chạy quá 60 giây | Gói Vercel Hobby giới hạn 60s. Nộp bài không sao vì chạy nền |
| Agent trả lời chung chung | KB rỗng | `select count(*) from documents;` phải ra ~33 |
| Trang trắng | Vercel build hỏng | Deployments > Build Logs |

Log hàm proxy: **Vercel → Deployments → bản mới nhất → Functions → `api/webhook`**

Log workflow: **n8n Cloud → Executions**, lọc `status=error`

---

## Cho ngày thi thật

Kiểm lại ba thứ trước ngày thi:

1. **Hạn mức Gemini** — bật thanh toán Google Cloud. Bậc miễn phí không chịu nổi
   nhiều đội nộp cùng lúc.
2. **Giới hạn lượt chạy n8n Cloud** — 2.500 lượt/tháng của gói Starter có thể hết
   trong một buổi thi nếu đông đội. Tính trước, hoặc tự host để không giới hạn.
3. **Đổi hết mật khẩu đội** — mật khẩu lưu thẳng không băm, và mấy cái `test1`,
   `admin@` hiện tại chỉ để thử.
