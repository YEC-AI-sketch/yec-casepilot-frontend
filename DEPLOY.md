# Đưa lên GitHub và Vercel

---

## Đọc trước: Vercel một mình không đủ

Vercel chỉ chạy được **frontend**. Backend của bạn là n8n + Supabase, và n8n đang
nằm ở `localhost:5678` trên laptop.

```
Đồng đội ──► Vercel (đám mây) ──► localhost:5678 ??? 
                                   Vercel không với tới máy bạn được
```

Nên trước khi deploy, phải làm n8n **truy cập được từ internet**. Ba đường:

| Cách | Công sức | Ổn định | Hợp cho |
|---|---|---|---|
| **A. Cloudflare Tunnel tạm** | 5 phút | Link đổi mỗi lần khởi động lại | Test với team |
| **B. Cloudflare Tunnel cố định** | 30 phút, cần tên miền | Link không đổi | Nhiều tuần |
| **C. n8n Cloud / VPS** | 1–2 giờ, mất phí | Không phụ thuộc laptop | Ngày thi thật |

Phần dưới đi theo **cách A** vì bạn đang cần test với team. Chuyển sang B hay C
sau này chỉ là đổi giá trị một biến môi trường.

Supabase thì đã ở trên mây sẵn, không phải làm gì.

---

## Bước 1 — Mở n8n ra internet

Cài Cloudflare Tunnel:

```powershell
winget install Cloudflare.cloudflared
```

Mở **cửa sổ PowerShell mới** (giữ nguyên các cửa sổ đang chạy):

```powershell
cloudflared tunnel --url http://localhost:5678
```

Nó in ra một địa chỉ dạng:

```
https://random-three-words-here.trycloudflare.com
```

Chép lại. Webhook đầy đủ của bạn là:

```
https://random-three-words-here.trycloudflare.com/webhook/yec-v2
```

Thử ngay:

```powershell
Invoke-RestMethod -Uri "https://random-three-words-here.trycloudflare.com/webhook/yec-v2" -Method POST -ContentType "application/json" -Body '{"mode":"login","username":"test1","password":"test1"}'
```

Ra JSON có `status` là được.

**Cửa sổ này phải để nguyên.** Đóng là link chết. Mở lại sẽ ra link mới và phải
cập nhật biến trên Vercel.

---

## Bước 2 — Đưa mã lên GitHub

### 2.1. Cài Git nếu chưa có

```powershell
git --version
```

Báo lỗi thì: `winget install Git.Git`, rồi **mở lại PowerShell**.

### 2.2. Tạo repo trên GitHub

Vào <https://github.com/new>:

- Repository name: `yec-casepilot-frontend`
- Chọn **Private** (nên chọn, dù mã không chứa bí mật)
- **Không** tích "Add a README file" — repo phải trống

Bấm **Create repository**.

### 2.3. Đẩy mã lên

Giải nén `yec-deploy.zip` ra một thư mục **không nằm trong OneDrive**, ví dụ
`C:\yec-fe`. Rồi:

```powershell
cd C:\yec-fe
git init
git add .
git commit -m "YEC CasePilot frontend"
git branch -M main
git remote add origin https://github.com/<tên-github-của-bạn>/yec-casepilot-frontend.git
git push -u origin main
```

Lần đầu `git push` sẽ mở cửa sổ đăng nhập GitHub trong trình duyệt. Đăng nhập,
cho phép, xong.

Nếu Git hỏi danh tính, chạy một lần rồi commit lại:

```powershell
git config --global user.name  "Mai Phuong"
git config --global user.email "email-github-cua-ban@example.com"
```

---

## Bước 3 — Deploy lên Vercel

1. Vào <https://vercel.com>, **Continue with GitHub**
2. **Add New → Project**
3. Tìm `yec-casepilot-frontend`, bấm **Import**
4. Framework Preset: để **Other**. Build Command và Output Directory bỏ trống.
5. Mở **Environment Variables**, thêm:

   | Name | Value |
   |---|---|
   | `N8N_URL` | `https://random-three-words-here.trycloudflare.com/webhook/yec-v2` |

   **Phải thêm ở bước này**, trước khi bấm Deploy. Quên thì deploy xong trang sẽ
   báo "Chưa đặt biến N8N_URL".

6. Bấm **Deploy**, đợi ~1 phút.

Xong, bạn có link dạng `https://yec-casepilot-frontend.vercel.app`. Gửi cho team.

---

## Cách nó hoạt động

```
Trình duyệt đồng đội
   │  POST /webhook/yec-v2
   ▼
Vercel  ──►  vercel.json viết lại đường dẫn  ──►  api/webhook.js
                                                      │  đọc process.env.N8N_URL
                                                      ▼
                                          Cloudflare Tunnel
                                                      │
                                                      ▼
                                       n8n trên laptop bạn (localhost:5678)
                                                      │
                                                      ▼
                                          Supabase + Gemini + Tavily
```

Trình duyệt **không bao giờ** biết địa chỉ n8n — nó chỉ gọi `/webhook/yec-v2`
trên chính domain Vercel. Nhờ vậy không phải cấu hình CORS ở n8n, và không ai dò
được webhook để gọi thẳng.

`index.html` giữ nguyên, không sửa dòng nào. Chạy cục bộ thì `server.js` làm
proxy, chạy trên Vercel thì `api/webhook.js` làm — cùng một hợp đồng.

---

## Đổi địa chỉ n8n về sau

Mỗi lần khởi động lại `cloudflared` là ra link mới. Cập nhật:

**Vercel → Settings → Environment Variables → N8N_URL → Edit**, dán link mới, Save.

Rồi **Deployments → dấu ba chấm ở bản mới nhất → Redeploy**. Biến môi trường chỉ
được nạp lúc deploy, sửa xong không redeploy thì vẫn chạy giá trị cũ.

---

## Cập nhật mã sau này

```powershell
cd C:\yec-fe
git add .
git commit -m "mô tả thay đổi"
git push
```

Vercel tự deploy lại sau mỗi lần push lên nhánh `main`, khoảng 1 phút.

---

## Phải dặn team bốn điều

**Máy bạn phải bật.** Bốn cửa sổ PowerShell phải chạy: `n8n start`,
`cloudflared tunnel`, và hai cửa sổ còn lại để gõ lệnh. Bạn sleep máy là cả team
mất kết nối. Vercel vẫn phục vụ trang nhưng mọi request sẽ trả 502.

**Mỗi người một tài khoản riêng.** Đây là bẫy dễ dính nhất — `adminfull` tự xoá
kết quả mỗi lần đăng nhập, hai người dùng chung thì người sau xoá mất bài đang
chạy của người trước.

```sql
insert into teams (username, password, team_name) values
  ('test_an',   'an123',   'An — test'),
  ('test_binh', 'binh123', 'Bình — test'),
  ('test_chi',  'chi123',  'Chi — test')
on conflict (username) do nothing;
```

**Mỗi tài khoản chỉ nộp một lần.** Mở lại:

```sql
update teams set status='chua_nop', report=null, submission=null,
       questions=null, scores=null, submitted_at=null
where username='test_an';
```

**Hạn mức Gemini dùng chung.** Một lượt phân tích gọi 8 node Gemini. Ba người
cùng nộp trên key AI Studio miễn phí thì gần như chắc chắn dính lỗi 429.

Theo dõi trong lúc team test:

```sql
select * from team_progress;
```

---

## Tra lỗi

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| "Chưa đặt biến N8N_URL trong Vercel" | Quên thêm biến, hoặc thêm rồi mà chưa redeploy | Settings > Environment Variables, rồi Redeploy |
| **502** "Không gọi được n8n" | Tunnel tắt, hoặc laptop sleep | Chạy lại `cloudflared`, cập nhật `N8N_URL`, redeploy |
| **404** body rỗng | Workflow trong n8n bị Unpublish | Vào n8n, Publish lại |
| Trang trắng | Vercel deploy hỏng | Xem tab Deployments > Build Logs |
| Timeout khi chat | Gemini chạy quá 60 giây | Gói Hobby giới hạn 60s. Nộp bài không sao vì chạy nền, chỉ mode=chat mới đụng giới hạn này |
| Đăng nhập báo sai mật khẩu | Tài khoản chưa có trong bảng `teams` | `select * from teams;` kiểm tra |

Xem log của hàm proxy: **Vercel → Deployments → bản mới nhất → Functions →
`api/webhook`**.

---

## Khi cần dùng cho ngày thi thật

Cách A không dùng được cho ngày thi — link đổi liên tục và phụ thuộc laptop của
bạn. Lúc đó cần:

- **n8n Cloud** (khoảng 20–50 USD/tháng) hoặc **VPS** chạy n8n bằng Docker
- Nâng key Gemini lên bậc trả phí để tránh 429
- Vercel giữ nguyên, chỉ đổi `N8N_URL` sang địa chỉ mới rồi redeploy

Phần frontend không phải sửa gì.
