# Nối frontend vào backend v2 — hướng dẫn chi tiết

Làm theo đúng thứ tự. Mỗi bước có cách kiểm tra riêng, sai ở đâu biết ngay ở đó
thay vì tới cuối mới phát hiện.

**Tổng thời gian:** khoảng 45–60 phút nếu chưa có gì.

```
Bước 1  Chuẩn bị máy         (Node, Docker)
Bước 2  Supabase             (2 bảng + 2 cột thiếu + tài khoản đội)
Bước 3  Ba credential trong n8n
Bước 4  Sửa 4 hằng số trong build-workflow.js   ← chỗ hay bỏ sót nhất
Bước 5  Build + import + kích hoạt workflow
Bước 6  Nạp Knowledge Base
Bước 7  Chẩn đoán backend    (node chan-doan.js)
Bước 8  Bật frontend
```

---

## Bước 0 — Hiểu trước hai điều, đỡ mất một buổi

**Thứ nhất: ID credential trong zip là của máy người khác.**

`build-workflow.js` ghi cứng ID credential và địa chỉ Supabase của dự án gốc:

```js
gemini:   { googlePalmApi: { id: '7WbWSiVXISs3bcCu', ... } }
supabase: { supabaseApi:   { id: 'YECsupabaseKB001', ... } }
tavily:   { tavilyApi:     { id: 'YECtavilyWeb0001', ... } }
const SUPABASE_URL = 'https://tgaimqbmtkvrwqotejtp.supabase.co';
```

Import thẳng vào n8n của bạn thì workflow lên được, `active=true`, nhìn như đã
chạy — nhưng mọi request sẽ chết ở node đầu tiên chạm Supabase với lỗi
*"does not have access to the credential"*. Đây đúng là sự cố đã xảy ra thật với
dự án gốc, ghi trong `build-workflow.js` dòng 9–13.

→ **Bước 4 bắt buộc làm**, không bỏ được.

**Thứ hai: bảng `teams` trong zip thiếu cột `scores`.**

`KIEN-TRUC.md` mục 7.1 liệt kê `scores jsonb`, node `Ghi diem` PATCH vào cột này,
nhưng `supabase-teams.sql` **không có** câu tạo cột đó và cũng không có migration
nào trong zip. Thiếu cột thì PostgREST trả `400 PGRST204` và đội mất bảng điểm.

→ Bước 2 có câu SQL bù vào.

---

## Bước 1 — Chuẩn bị máy

| Cần | Kiểm tra | Nếu chưa có |
|---|---|---|
| Node.js 18+ | `node -v` | <https://nodejs.org> bản LTS, hoặc `winget install OpenJS.NodeJS.LTS` |
| Docker | `docker -v` | Docker Desktop (Windows/macOS), `sudo apt install docker.io` (Linux) |

Giải nén `yec-casepilot-v2-main.zip` ra một thư mục, ví dụ `D:\yec-backend`.
Thư mục `yec-local` (frontend) để riêng, ví dụ `D:\yec-local`.

Dựng n8n — **xem file riêng `HUONG-DAN-DOCKER-N8N.md`**, giải thích từng cờ lệnh,
cách chạy đúng trên PowerShell / CMD / bash, và cả cách chạy không cần Docker.

Tóm tắt lệnh (Windows PowerShell và CMD viết liền một dòng):

```bash
docker run -d --name n8n --restart unless-stopped \
  -p 5678:5678 -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

Đợi ~20 giây rồi mở <http://localhost:5678>, tạo tài khoản chủ instance.

Kiểm tra: `docker ps` phải thấy container `n8n` ở trạng thái `Up`.

---

## Bước 2 — Supabase

### 2.1. Tạo project

Vào <https://supabase.com>, tạo project mới. Chọn region **Singapore** cho gần.
Đợi ~2 phút cho project khởi tạo xong.

### 2.2. Chạy hai file SQL

Vào **SQL Editor → New query**, dán nội dung `supabase-setup.sql` (bảng
`documents` cho Knowledge Base), bấm **Run**.

Rồi **New query** lần nữa, dán `supabase-teams.sql`, bấm **Run**.

### 2.3. Bù hai cột còn thiếu — bắt buộc

PostgREST không cho chạy DDL qua REST nên phải làm tay:

```sql
alter table teams add column if not exists last_error text;
alter table teams add column if not exists scores     jsonb;
```

Câu `last_error` đã có sẵn ở cuối `supabase-teams.sql` rồi, chạy lại không sao
(có `if not exists`). Câu `scores` thì **không có ở đâu trong zip** — phải tự thêm.

Kiểm tra đủ cột chưa:

```sql
select column_name from information_schema.columns
where table_name = 'teams' order by ordinal_position;
```

Phải thấy đủ 11 cột: `username`, `password`, `team_name`, `status`, `submission`,
`report`, `questions`, `submitted_at`, `updated_at`, `last_error`, `scores`.

### 2.4. Tạo tài khoản đội

`supabase-teams.sql` có sẵn 3 dòng mẫu `doi01/doi02/doi03` với mật khẩu
`thay-mat-khau-1`. Thay bằng danh sách thật, và thêm hai tài khoản thử cho BTC:

```sql
insert into teams (username, password, team_name) values
  ('adminfull', 'adminfull', 'Đội thử — chạy full Luồng 1'),
  ('adminhalf', 'adminhalf', 'Đội thử — bỏ qua Luồng 1'),
  ('doi01',     'yec-a7k2',  'Đội 01 — THPT ABC'),
  ('doi02',     'yec-m9p4',  'Đội 02 — THPT XYZ')
on conflict (username) do nothing;
```

`username` viết thường, không dấu, không khoảng trắng — Router hạ chữ thường
trước khi tra nên `Doi01` và `doi01` là một.

Mật khẩu **lưu thẳng, không băm**. Đây là chủ ý của dự án: BTC cần cấp lại được
cho đội quên, và đây là mật khẩu dùng một ngày. Nhưng phải dặn đội **không dùng
lại mật khẩu cá nhân**.

`adminfull` có hành vi đặc biệt: mỗi lần đăng nhập tự xoá kết quả cũ để chạy lại
full. Hành vi này nằm ở hằng `AUTO_RESET` trong Router (`build-workflow.js` dòng
~726), **không phải cột DB**. Muốn thêm tài khoản tự-reset thì sửa mảng đó rồi
build lại.

### 2.5. Lấy hai thứ để dùng ở bước sau

Vào **Project Settings → API**, chép lại:

- **Project URL** — dạng `https://abcdefgh.supabase.co` → dùng ở bước 4
- **service_role key** — key dài, ở mục *Project API keys* → dùng ở bước 3

Phải là **service_role**, không phải `anon`. Bảng `teams` bật RLS và không có
policy nào, nên `anon` bị chặn sạch.

---

## Bước 3 — Ba credential trong n8n

Vào n8n → **Credentials → Add credential**. Tạo đủ ba cái, và **ghi lại ID của
từng cái** ngay sau khi lưu.

### Cách lấy ID credential

Mở credential vừa tạo, nhìn thanh địa chỉ:

```
http://localhost:5678/home/credentials/aBcD1234EfGh5678
                                        └── đây là ID ──┘
```

### 3.1. Supabase

- Loại: **Supabase API**
- Host: Project URL ở bước 2.5
- Service Role Secret: service_role key ở bước 2.5

### 3.2. Google Gemini

- Loại: **Google Gemini(PaLM) API**
- **Host: `https://api.shopaikey.com`** ← phải đặt tay, đây là proxy bán lại, không gọi Google trực tiếp
- API Key: key của proxy

Nếu bạn có key Google chính chủ thì để Host mặc định của Google. Nhưng model
trong workflow đang là `gemini-3.6-flash` và `gemini-embedding-001` — kiểm tra
key của bạn có hai model đó không, không thì phải sửa hằng `MODEL_FAST` /
`MODEL_DEEP` trong `build-workflow.js`.

Liệt kê model của proxy: `GET https://api.shopaikey.com/v1/models` (Bearer token).

### 3.3. Tavily

- Loại: **Tavily API**
- API Key: lấy ở <https://tavily.com>

Đề 2026 **yêu cầu** research công khai và bắt buộc trích nguồn, nên Tavily là bắt
buộc chứ không phải tuỳ chọn.

### Bảng ghi lại

Điền vào đây trước khi sang bước 4:

| Credential | ID của bạn |
|---|---|
| Supabase | `________________` |
| Gemini | `________________` |
| Tavily | `________________` |
| Supabase Project URL | `https://________.supabase.co` |

---

## Bước 4 — Sửa build-workflow.js

Mở `build-workflow.js`, sửa **4 chỗ** ở đầu file (dòng 4–22):

```js
const CRED = {
  gemini:   { googlePalmApi: { id: 'ID_GEMINI_CUA_BAN',   name: 'Gemini' } },
  supabase: { supabaseApi:   { id: 'ID_SUPABASE_CUA_BAN', name: 'Supabase' } },
  tavily:   { tavilyApi:     { id: 'ID_TAVILY_CUA_BAN',   name: 'Tavily' } },
};

const SUPABASE_URL = 'https://project-cua-ban.supabase.co';
```

Trường `name` không quan trọng, n8n khớp theo `id`.

**Sửa y hệt trong `build-ingest.js`** (dòng 19–22) — file này chỉ cần Gemini và
Supabase, không cần Tavily.

Muốn thêm tài khoản tự-reset thì tìm `AUTO_RESET` trong `build-workflow.js` và
sửa mảng:

```js
const AUTO_RESET = ['adminfull'];
```

---

## Bước 5 — Build, import, kích hoạt

**Bốn bước, bỏ bước nào cũng hỏng.** Chạy trong thư mục backend đã giải nén.

```bash
# 1. Build — tự kiểm cú pháp MỌI Code node, sai thì DỪNG, không ra file
node build-workflow.js yec-v2.workflow.json
```

Thấy dòng này là được:

```
OK — nodes: 40 | connections: 34
Barem: 5 tiêu chí hệ thống chấm — điểm hiển thị quy về thang 100
```

Nếu build dừng vì lỗi cú pháp thì **đừng deploy** — hàng rào này dựng lên chính
vì sự cố ngày 22/08/2026 làm chết webhook production.

```bash
# 2. Copy vào container + import
docker cp yec-v2.workflow.json n8n:/tmp/yec-v2.workflow.json
docker exec n8n n8n import:workflow --input=/tmp/yec-v2.workflow.json
```

> Tài liệu gốc có thêm `--projectId=3T8k53UUWciVNWiF`. Đó là ID project của dự án
> gốc trên máy dùng chung. **Máy riêng của bạn thì bỏ tham số này đi** — thêm vào
> sẽ lỗi vì project đó không tồn tại.

```bash
# 3. Publish
docker exec n8n n8n publish:workflow --id=YECcasepilotV2a
```

**4. Đăng ký lại webhook — bỏ bước này là mọi request trả 404 với body rỗng.**

`import:workflow` ghi thẳng vào SQLite. Tiến trình n8n đang chạy không biết có
thay đổi nên huỷ đăng ký webhook. `publish:workflow` xử lý version nhưng **không**
tự đăng ký lại.

Cách dễ nhất — làm tay trong n8n UI:

> Mở workflow `YEC CasePilot v2` → gạt công tắc **Active** ở góc trên bên phải
> **TẮT**, đợi 2 giây, gạt **BẬT** lại.

Cách bằng lệnh (cần n8n API key, tạo ở **Settings → n8n API**):

```powershell
$h = @{ "X-N8N-API-KEY" = "<key-cua-ban>" }
Invoke-RestMethod -Uri "http://localhost:5678/api/v1/workflows/YECcasepilotV2a/deactivate" `
  -Method POST -Headers $h -ContentType "application/json" -Body "{}"
Invoke-RestMethod -Uri "http://localhost:5678/api/v1/workflows/YECcasepilotV2a/activate" `
  -Method POST -Headers $h -ContentType "application/json" -Body "{}"
```

Bắt buộc có `-ContentType "application/json" -Body "{}"` — thiếu thì n8n trả 415.
Bắt buộc deactivate rồi mới activate — activate suông khi DB đã ghi `active=true`
thì không có gì thay đổi để n8n đăng ký lại.

macOS/Linux:

```bash
KEY="<key-cua-ban>"
curl -X POST -H "X-N8N-API-KEY: $KEY" -H "Content-Type: application/json" -d '{}' \
  http://localhost:5678/api/v1/workflows/YECcasepilotV2a/deactivate
curl -X POST -H "X-N8N-API-KEY: $KEY" -H "Content-Type: application/json" -d '{}' \
  http://localhost:5678/api/v1/workflows/YECcasepilotV2a/activate
```

---

## Bước 6 — Nạp Knowledge Base

Không có bước này thì agent không biết gì về đề bài TEA+ Oolong.

```bash
node build-ingest.js yec-ingest.workflow.json
docker cp yec-ingest.workflow.json n8n:/tmp/yec-ingest.workflow.json
docker exec n8n n8n import:workflow --input=/tmp/yec-ingest.workflow.json
docker exec -e N8N_RUNNERS_BROKER_PORT=5699 -e N8N_RUNNERS_AUTH_TOKEN=localtoken \
  n8n n8n execute --id=YECkbIngest001
```

Hai biến `N8N_RUNNERS_*` là bắt buộc. Thiếu thì CLI báo *"Task Broker's port 5679
is already in use"* vì đụng tiến trình n8n đang chạy.

Kiểm tra trong Supabase SQL Editor:

```sql
select count(*) from documents;
```

Phải ra khoảng **31**. Ra 0 thì credential Gemini sai hoặc hết hạn mức.

**Chạy lại là CHÈN THÊM, không thay thế.** Nạp lại sạch thì `delete from documents;` trước.

---

## Bước 7 — Chẩn đoán backend

Trước khi động vào frontend, kiểm tra backend đã. Copy `chan-doan.js` (trong thư
mục `yec-local`) ra đâu cũng được rồi chạy:

```bash
node chan-doan.js --url=http://localhost:5678/webhook/yec-v2
```

Ba bước đầu qua thì thử đăng nhập thật:

```bash
node chan-doan.js --url=http://localhost:5678/webhook/yec-v2 \
                  --user=adminfull --pass=adminfull
```

Kết quả mong đợi:

```
  [1/4] Webhook có phản hồi không
  ✓ Webhook sống, trả 200

  [2/4] Node Router có chạy không
  ✓ Router chạy đúng — gửi payload rỗng thì bị chặn NO_ACCOUNT

  [3/4] Đọc được bảng teams trên Supabase không
  ✓ Đọc được bảng teams — tài khoản không tồn tại bị chặn BAD_LOGIN

  [4/4] Đăng nhập bằng tài khoản thật
  ✓ Đăng nhập được
    Đội         : Đội thử — chạy full Luồng 1
    Trạng thái  : chua_nop
```

Script tự dịch mã lỗi thành nguyên nhân. Ý nghĩa từng bước:

| Bước hỏng | Nghĩa là |
|---|---|
| 1 | n8n chưa chạy, sai cổng, hoặc webhook chưa đăng ký (làm lại bước 5.4) |
| 2 | Workflow chết ở Code node — xem execution log |
| 3 | Credential Supabase sai, hoặc `SUPABASE_URL` sai (làm lại bước 4) |
| 4 | Tài khoản chưa có trong bảng `teams` (làm lại bước 2.4) |

---

## Bước 8 — Bật frontend

Vào thư mục `yec-local`:

**Windows PowerShell**
```powershell
cd D:\yec-local
$env:N8N_URL = "http://localhost:5678/webhook/yec-v2"
node server.js
```

**Windows CMD** — hoặc nhấp đúp `start-live.bat`
```cmd
cd /d D:\yec-local
set N8N_URL=http://localhost:5678/webhook/yec-v2
node server.js
```

**macOS / Linux**
```bash
cd ~/yec-local
N8N_URL=http://localhost:5678/webhook/yec-v2 node server.js
```

Thấy dòng `Chế độ  THẬT — chuyển tiếp sang n8n` là đúng. Mở
<http://localhost:5500/index.html>, đăng nhập `adminfull` / `adminfull`.

Kiểm tra nhanh cấu hình: <http://localhost:5500/api/health>

Ở chế độ này `server.js` chỉ làm hai việc: phục vụ `index.html`, và chuyển tiếp
`/webhook/yec-v2` sang n8n. Trang và webhook cùng origin nên trình duyệt không
cần preflight — **khỏi phải cấu hình CORS ở n8n**.

### Đường đi kiểm thử đầu-cuối

1. Đăng nhập `adminfull` / `adminfull` → vào form 5 khối.
2. Điền mỗi khối **tối thiểu 40 ký tự**. Điền thiếu thì server trả về đúng danh
   sách khối còn thiếu.
3. Bấm **Nộp kế hoạch**. Server trả `accepted` trong dưới 0,3 giây rồi chạy nền.
4. Giao diện hỏi trạng thái mỗi 5 giây. Luồng 1 mất **36–200 giây** tuỳ tải — kiên nhẫn.
5. Bảng điểm + báo cáo đổ về. Chat tiếp để hỏi đáp.
6. Đăng xuất, đăng nhập lại `adminfull` → kết quả cũ bị xoá, chạy lại được từ đầu.
7. Đăng nhập `adminhalf` → nếu chưa từng nộp thì vẫn ở `chua_nop`. Muốn nó có sẵn
   báo cáo như tài liệu mô tả thì phải nộp một lần cho tài khoản này trước.

Theo dõi từ phía BTC, chạy trong Supabase SQL Editor:

```sql
select * from team_progress;
```

---

## Tra lỗi

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| **404, body rỗng** | Webhook rớt đăng ký sau `import:workflow` | Tắt/bật công tắc Active (bước 5.4) |
| **404, có body** | Sai path hoặc workflow chưa active | Path phải là `yec-v2`, kiểm tra công tắc Active |
| **502** | Container n8n chết | Bật lại Docker Desktop, container tự lên sau ~15s |
| **524** | Proxy Gemini timeout | Bài vẫn chạy nền, giao diện tự poll tiếp |
| **401 Invalid token** | **Hết hạn mức proxy Gemini** — không phải sai key | Nạp thêm hạn mức |
| **400 PGRST204** | Payload có trường ứng với cột không tồn tại | Chạy lại hai câu `alter table` ở bước 2.3 |
| *"does not have access to the credential"* | ID credential vẫn là của dự án gốc | Làm lại bước 4 rồi build + import lại |
| Đăng nhập luôn sai | Tài khoản chưa có trong bảng `teams` | `select * from teams;` kiểm tra |
| Nộp bài xong đợi mãi | Luồng 1 chết giữa chừng | `select username, last_error from teams;` |
| Có báo cáo nhưng không có điểm | Thiếu cột `scores` | `alter table teams add column if not exists scores jsonb;` |
| Agent trả lời chung chung, không biết đề | Knowledge Base rỗng | `select count(*) from documents;` phải ra ~31, không thì làm lại bước 6 |
| **LOCKED** khi nộp | Mỗi đội chỉ nộp một lần | Mở lại bằng SQL ở dưới |
| Sửa `index.html` không thấy đổi | Cache trình duyệt | Ctrl+Shift+R |

### SQL vận hành

```sql
-- Toàn cảnh ngày thi
select * from team_progress;

-- Xem điểm, cao xuống thấp
select username, team_name, status, scores->>'tong_100' as diem, updated_at
from teams order by (scores->>'tong_100')::int desc nulls last;

-- Lỗi gần đây (chẩn đoán kỹ thuật, KHÔNG đọc cho đội nghe)
select username, last_error, updated_at from teams
where last_error is not null order by updated_at desc;

-- Mở lại cho một đội nộp
update teams set status='chua_nop', report=null, submission=null,
       questions=null, scores=null, submitted_at=null
where username='doi01';

-- Gỡ phiên treo quá 10 phút
update teams set status='chua_nop'
where status='dang_phan_tich' and updated_at < now() - interval '10 minutes';
```

### Đọc execution log

API `/executions` mặc định **chỉ liệt kê execution thành công**. Muốn thấy lỗi
phải lọc rõ:

```
GET /api/v1/executions?workflowId=YECcasepilotV2a&status=error&limit=5
GET /api/v1/executions/<id>?includeData=true
```

Trong dữ liệu trả về, `resultData.lastNodeExecuted` cho biết dừng ở node nào.

---

## Kiểm thử không tốn hạn mức Gemini

Trong thư mục backend:

```bash
node score-lib.test.js      # 37 ca cho bộ chấm điểm
node test-luu-va-khoa.js    # 19 ca cho logic lưu và khoá
```

Hai bộ này chạy offline hoàn toàn, không gọi LLM. Chạy trước mỗi lần deploy.

---

## Nếu sửa workflow sau này

Sửa `build-workflow.js`, **không sửa** `yec-v2.workflow.json` (file sinh ra).
Rồi làm lại đủ bước 5 — cả bốn bước, kể cả tắt/bật Active.

Bài phân tích đang chạy nền **không bị ảnh hưởng** khi webhook rớt: nó vẫn chạy
xong và lưu báo cáo, chỉ tạm thời không gọi được cho tới khi webhook sống lại.
