# Đưa website lên mạng — từng bước

## Bạn đang ở đâu

| Thành phần | Hiện tại | Cần làm gì |
|---|---|---|
| Supabase (teams + 33 chunk KB) | Đã trên mây | **Xong, không đụng vào** |
| Gemini, Tavily | Đã trên mây | **Xong** |
| n8n | `localhost:5678` trên laptop | Phần 2 |
| Frontend | `localhost:5500` trên laptop | Phần 3 |

Chỉ còn hai thứ phải chuyển. Supabase và Knowledge Base giữ nguyên — **không phải nạp lại KB**.

---

## Phần 1 — Chọn đường đi

| | Đường A — Tunnel | Đường B — n8n Cloud |
|---|---|---|
| Thời gian | 15 phút | 45 phút |
| Laptop phải bật? | **Có** | Không |
| Link n8n | Đổi mỗi lần khởi động lại | Cố định |
| Chi phí | 0 đ | Miễn phí 14 ngày, sau ~20 €/tháng |
| Hợp cho | Cho team xem ngay hôm nay | Test cả tuần, tiến tới thi thật |

**Cả hai đường đều dùng chung Phần 3 (Vercel).** Bắt đầu bằng A cũng được, sau
chuyển sang B chỉ mất một biến môi trường.

---

## Phần 2A — Đường Tunnel (15 phút)

### 2A.1. Cài Cloudflare Tunnel

Mở PowerShell mới:

```powershell
winget install Cloudflare.cloudflared
```

Cài xong **đóng PowerShell rồi mở lại** (để nhận lệnh mới).

### 2A.2. Mở n8n ra internet

Đảm bảo `n8n start` vẫn đang chạy ở cửa sổ cũ. Rồi ở cửa sổ mới:

```powershell
cloudflared tunnel --url http://localhost:5678
```

Trong đống log nó in ra, tìm dòng có khung viền:

```
+------------------------------------------------+
|  https://random-three-words.trycloudflare.com   |
+------------------------------------------------+
```

Chép địa chỉ đó. **Webhook của bạn** là địa chỉ đó cộng `/webhook/yec-v2`.

**Cửa sổ này phải để nguyên**, đóng là link chết.

### 2A.3. Kiểm tra

Mở PowerShell thứ tư:

```powershell
Invoke-RestMethod -Uri "https://random-three-words.trycloudflare.com/webhook/yec-v2" -Method POST -ContentType "application/json" -Body '{"mode":"login","username":"test1","password":"test1"}'
```

Ra JSON có `status` là được. Sang Phần 3.

Ra `error code: 1033` nghĩa là tunnel chưa lên — đợi thêm 15 giây rồi thử lại.

---

## Phần 2B — Đường n8n Cloud (45 phút)

### 2B.1. Đăng ký

<https://n8n.io> → **Get started free** → chọn bản **Cloud**. Bản dùng thử 14
ngày không cần thẻ tín dụng.

Bạn nhận được địa chỉ dạng `https://<tên-bạn>.app.n8n.cloud`.

### 2B.2. Cài node Tavily

**Settings** (góc dưới trái) → **Community nodes** → **Install a community node**
→ dán `@tavily/n8n-nodes-tavily` → tích ô đồng ý → Install.

> Nếu n8n Cloud chặn community node ở gói này, xem mục "Không cài được Tavily" ở
> cuối file — có cách thay thế không cần cài gì.

### 2B.3. Tạo lại 3 credential

**Đây là phần mất công nhất và không tránh được.** Credential nằm trong từng
instance n8n, không đi theo file workflow. Instance mới sinh ID mới.

**Credentials → Add credential**, làm lần lượt:

| Loại | Điền |
|---|---|
| **Supabase API** | Host: `https://vgkwaebaqqddtztlwlox.supabase.co`<br>Service Role Secret: key `sb_secret_...` |
| **Google Gemini(PaLM) API** | Host: `https://generativelanguage.googleapis.com`<br>API Key: key AI Studio |
| **Tavily API** | API Key: key `tvly-...` |

Sau mỗi lần **Save**, nhìn thanh địa chỉ và chép ID:

```
https://<tên-bạn>.app.n8n.cloud/home/credentials/aBcD1234EfGh5678
                                                  └──── chép ────┘
```

Điền vào đây trước khi đi tiếp:

| Credential | ID mới |
|---|---|
| Supabase | |
| Gemini | |
| Tavily | |

### 2B.4. Build lại workflow

Trên máy, vào thư mục backend rồi mở `build-workflow.js`. Thay 3 ID trong khối
`CRED` bằng ID mới ở trên. **Giữ nguyên** `SUPABASE_URL` — vẫn dùng chung project
Supabase cũ.

```powershell
node build-workflow.js yec-v2.workflow.json
```

Phải thấy `OK — nodes: 40 | connections: 34`.

### 2B.5. Nạp lên n8n Cloud

Cloud không có CLI, làm qua giao diện:

1. **Workflows → Add workflow**
2. Menu **⋯** góc trên phải → **Import from File**
3. Chọn `yec-v2.workflow.json`
4. Bấm **Publish** (góc trên phải)

Mở node **Webhook**, chép **Production URL**:

```
https://<tên-bạn>.app.n8n.cloud/webhook/yec-v2
```

### 2B.6. Kiểm tra

```powershell
Invoke-RestMethod -Uri "https://<tên-bạn>.app.n8n.cloud/webhook/yec-v2" -Method POST -ContentType "application/json" -Body '{"mode":"login","username":"test1","password":"test1"}'
```

Ra JSON có `status: chua_nop` là backend đã sống trên mây. Laptop tắt cũng không sao.

| Lỗi | Xử lý |
|---|---|
| 404 | Chưa bấm Publish |
| *"does not have access to the credential"* | ID chưa khớp — làm lại 2B.4 |
| BAD_LOGIN | Tài khoản `test1` chưa có — kiểm tra bảng `teams` |

---

## Phần 3 — Đưa frontend lên Vercel

Dùng **Vercel CLI**, không cần GitHub. Nhanh hơn và ít vướng hơn.

### 3.1. Vào thư mục frontend

Giải nén `yec-deploy.zip` ra chỗ **không có dấu tiếng Việt, không trong OneDrive**:

```powershell
Expand-Archive -Path "$env:USERPROFILE\Downloads\yec-deploy.zip" -DestinationPath C:\yec-web -Force
cd C:\yec-web\yec-deploy
dir
```

Phải thấy `index.html`, `vercel.json`, `package.json`, và thư mục `api`.

Nếu file zip nằm chỗ khác:

```powershell
Get-ChildItem -Path C:\Users\ -Filter "yec-deploy*.zip" -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 FullName, LastWriteTime
```

### 3.2. Đăng nhập Vercel

```powershell
npx vercel login
```

Chọn **Continue with GitHub** (hoặc Google/Email). Nó mở trình duyệt, bạn xác
nhận, rồi quay lại PowerShell thấy chữ *Success!*

### 3.3. Deploy lần đầu

```powershell
npx vercel
```

Nó hỏi vài câu, trả lời như sau:

| Câu hỏi | Trả lời |
|---|---|
| Set up and deploy? | **Y** |
| Which scope? | Enter (chọn tài khoản của bạn) |
| Link to existing project? | **N** |
| What's your project's name? | `yec-casepilot` rồi Enter |
| In which directory is your code? | Enter (dấu `./`) |
| Want to modify these settings? | **N** |

Đợi ~1 phút. Nó in ra link dạng `https://yec-casepilot-xxxx.vercel.app`.

**Đừng gửi link này cho team vội** — chưa có biến môi trường nên sẽ báo lỗi.

### 3.4. Đặt địa chỉ n8n

```powershell
npx vercel env add N8N_URL production
```

Nó hỏi giá trị — dán webhook đầy đủ của bạn:

- Đường A: `https://random-three-words.trycloudflare.com/webhook/yec-v2`
- Đường B: `https://<tên-bạn>.app.n8n.cloud/webhook/yec-v2`

Enter. Rồi làm tương tự cho hai môi trường còn lại (để bản xem thử cũng chạy):

```powershell
npx vercel env add N8N_URL preview
npx vercel env add N8N_URL development
```

### 3.5. Deploy bản chính thức

```powershell
npx vercel --prod
```

Biến môi trường chỉ được nạp lúc deploy, nên **bắt buộc chạy lại lệnh này** sau
khi thêm biến.

Nó in ra link chính thức, dạng `https://yec-casepilot.vercel.app`. **Đây là link
gửi cho team.**

### 3.6. Kiểm tra

Mở link đó, đăng nhập `test1` / `test1`.

Vào được form 5 khối là xong. Báo lỗi thì xem bảng tra ở cuối file.

---

## Phần 4 — Tài khoản cho team

Trong Supabase SQL Editor:

```sql
insert into teams (username, password, team_name) values
  ('test_an',   'an123',   'An — test'),
  ('test_binh', 'binh123', 'Bình — test'),
  ('test_chi',  'chi123',  'Chi — test')
on conflict (username) do nothing;
```

**Bốn điều phải dặn team:**

**Mỗi người một tài khoản riêng.** Đừng dùng chung `adminfull` — tài khoản này tự
xoá kết quả mỗi lần đăng nhập, hai người dùng chung thì người sau xoá mất bài
đang chạy của người trước. Đây là bẫy dễ dính nhất.

**Mỗi tài khoản chỉ nộp được một lần.** Muốn thử lại:

```sql
update teams set status='chua_nop', report=null, submission=null,
       questions=null, scores=null, submitted_at=null
where username='test_an';
```

**Hạn mức Gemini dùng chung.** Một lượt phân tích gọi 8 node Gemini. Ba người cùng
nộp trên key AI Studio miễn phí thì gần như chắc chắn dính lỗi **429**.

**Đường A thì laptop bạn phải bật**, và cả hai cửa sổ `n8n start` +
`cloudflared` phải chạy. Bạn sleep máy là cả team mất kết nối.

Theo dõi trong lúc team test:

```sql
select * from team_progress;
select username, last_error, updated_at from teams where last_error is not null;
```

---

## Phần 5 — Cập nhật về sau

**Sửa giao diện:**

```powershell
cd C:\yec-web\yec-deploy
npx vercel --prod
```

**Đổi địa chỉ n8n** (đường A: link tunnel đổi mỗi lần khởi động lại):

```powershell
npx vercel env rm N8N_URL production
npx vercel env add N8N_URL production
npx vercel --prod
```

Không chạy `--prod` lại thì vẫn dùng giá trị cũ.

**Sửa workflow:** sửa `build-workflow.js` → build lại → import lại → **Publish**.
Quên Publish là webhook rớt đăng ký và trả 404 body rỗng.

---

## Không cài được Tavily trên n8n Cloud

Workflow gọi Tavily bằng node HTTP Request thường, chỉ mượn kiểu credential
`tavilyApi`. Thay bằng **Header Auth** có sẵn trong mọi bản n8n:

**Credentials → Add credential → Header Auth**

| Ô | Điền |
|---|---|
| Name | `Authorization` |
| Value | `Bearer tvly-...` (nhớ chữ `Bearer` và dấu cách) |

Save, chép ID. Rồi trong `build-workflow.js`, tìm dòng `const tavily = (id, name, x, y) =>`
(khoảng dòng 1415), sửa hai chỗ:

```js
// Cũ:
  position: P(x, y), credentials: CRED.tavily,
// Mới:
  position: P(x, y), credentials: { httpHeaderAuth: { id: 'ID_HEADER_AUTH', name: 'Tavily' } },
```

```js
// Cũ:
    authentication: 'predefinedCredentialType', nodeCredentialType: 'tavilyApi',
// Mới:
    authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
```

Build lại rồi import lại.

---

## Tra lỗi

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| Trang hiện "Chưa đặt biến N8N_URL trong Vercel" | Thêm biến rồi nhưng chưa deploy lại | `npx vercel --prod` |
| **502** "Không gọi được n8n" | Tunnel tắt / laptop sleep / sai địa chỉ | Kiểm tra `N8N_URL`, gọi thẳng bằng `Invoke-RestMethod` |
| **404** body rỗng | Workflow chưa Publish | Vào n8n, bấm Publish |
| `error code: 1033` | Tunnel Cloudflare không có gì ở đầu bên kia | Chạy lại `cloudflared`, cập nhật `N8N_URL`, deploy lại |
| Đăng nhập báo sai mật khẩu | Tài khoản chưa có trong `teams` | `select * from teams;` |
| **429** | Chạm giới hạn key Gemini miễn phí | Đợi một phút, hoặc bật thanh toán Google Cloud |
| Chat treo rồi báo lỗi | Gemini chạy quá 60 giây | Gói Vercel Hobby giới hạn 60s. Nộp bài không sao vì Luồng 1 chạy nền |
| Agent trả lời chung chung, không biết đề | KB rỗng | `select count(*) from documents;` phải ra ~33 |
| Trang trắng | Deploy hỏng | `npx vercel logs <link-của-bạn>` |

Xem log hàm proxy: <https://vercel.com/dashboard> → project → **Deployments** →
bản mới nhất → **Functions** → `api/webhook`

Xem log workflow: n8n → tab **Executions**, lọc `status = error`

---

## Trước ngày thi thật

Ba việc phải làm, đừng để tới sáng hôm đó:

1. **Chuyển sang đường B.** Đường A phụ thuộc laptop và link đổi liên tục.
2. **Bật thanh toán Gemini.** Bậc miễn phí không chịu nổi nhiều đội nộp cùng lúc.
3. **Đổi hết mật khẩu đội.** Mật khẩu lưu thẳng không băm, và `test1` / `admin@`
   hiện tại chỉ để thử. Dặn đội không dùng lại mật khẩu cá nhân.

Thêm một con số cần tính: gói n8n Cloud Starter cho **2.500 lượt chạy/tháng**.
Giao diện hỏi trạng thái mỗi 5 giây trong lúc phân tích, nên một bài nộp ngốn
20–40 lượt. Vài chục đội là hết trong một buổi.
