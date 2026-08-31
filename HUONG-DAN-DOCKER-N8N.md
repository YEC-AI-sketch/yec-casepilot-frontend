# Bước 1 chi tiết — Dựng n8n bằng Docker

Tách riêng ra vì đây là chỗ nhiều người vướng nhất. Làm xong bước này bạn sẽ có
n8n chạy ở `http://localhost:5678` và sẵn sàng nhận workflow.

**Thời gian:** 15–25 phút, phần lớn là chờ tải Docker Desktop.

---

## 0. Docker là gì, và vì sao dự án này cần

n8n cần Node, một cơ sở dữ liệu SQLite, và vài thư viện hệ thống ở đúng phiên
bản. Docker đóng gói sẵn tất cả vào một **image** — bạn tải về rồi chạy, không
phải cài từng thứ.

Ba từ sẽ gặp liên tục:

| Từ | Nghĩa |
|---|---|
| **image** | Bản đóng gói sẵn, tải từ mạng về. Ở đây là `docker.n8n.io/n8nio/n8n` |
| **container** | Một lần chạy của image. Ta đặt tên nó là `n8n` |
| **volume** | Ổ đĩa riêng cho container, dữ liệu sống qua mọi lần xoá/tạo lại container |

Volume quan trọng: nếu không có nó, xoá container là mất sạch workflow và
credential đã tạo.

---

## 1. Cài Docker Desktop

### Windows

**Yêu cầu:** Windows 10 64-bit bản 1903 trở lên, hoặc Windows 11. Máy phải bật
được ảo hoá trong BIOS (hầu hết máy đời mới đã bật sẵn).

1. Tải tại <https://www.docker.com/products/docker-desktop/> → **Download for Windows**
2. Chạy file `Docker Desktop Installer.exe`
3. Ở màn hình cấu hình, **để nguyên dấu tích "Use WSL 2 instead of Hyper-V"**
4. Cài xong nó bắt **khởi động lại máy** — phải làm, không bỏ qua được
5. Mở lại máy, Docker Desktop tự chạy. Lần đầu nó hỏi chấp nhận điều khoản → Accept
6. Nó có thể yêu cầu cài **WSL 2 kernel update**. Nếu hiện thông báo đó, mở
   PowerShell **với quyền Administrator** và chạy:
   ```powershell
   wsl --update
   ```
   Rồi mở lại Docker Desktop.

**Dấu hiệu Docker đã sẵn sàng:** biểu tượng con cá voi ở khay hệ thống (góc phải
dưới, cạnh đồng hồ) **đứng yên, không nhấp nháy**. Rê chuột vào phải thấy chữ
*"Docker Desktop is running"*. Lúc nó còn nhấp nháy nghĩa là đang khởi động —
đợi thêm, đừng chạy lệnh vội.

### macOS

1. Tải tại <https://www.docker.com/products/docker-desktop/>, chọn đúng chip
   (**Apple Silicon** cho M1/M2/M3/M4, **Intel** cho máy cũ). Chọn sai thì cài
   được nhưng chạy rất chậm.
2. Mở file `.dmg`, kéo Docker vào thư mục Applications
3. Mở Docker từ Launchpad, cho phép quyền khi macOS hỏi
4. Đợi biểu tượng cá voi trên thanh menu đứng yên

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y docker.io
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Dòng cuối cho phép chạy `docker` không cần `sudo`. **Phải đăng xuất rồi đăng nhập
lại** thì mới có hiệu lực.

---

## 2. Kiểm tra Docker đã chạy

Mở terminal:

- **Windows**: bấm phím Windows, gõ `powershell`, Enter
- **macOS**: Cmd+Space, gõ `terminal`, Enter
- **Linux**: Ctrl+Alt+T

Gõ:

```
docker --version
```

**Đúng** — ra dòng đại loại:
```
Docker version 27.3.1, build ce1223035a
```

**Sai** — một trong hai:

| Báo lỗi | Nghĩa | Xử lý |
|---|---|---|
| `docker: command not found` hoặc `'docker' is not recognized` | Chưa cài, hoặc cài rồi nhưng terminal mở từ trước khi cài | Đóng terminal, mở lại. Vẫn lỗi thì cài lại Docker Desktop |
| `error during connect... The system cannot find the file specified` | Đã cài nhưng Docker Desktop chưa chạy | Mở Docker Desktop, đợi cá voi đứng yên rồi thử lại |

Đừng đi tiếp khi lệnh này còn lỗi.

---

## 3. Hiểu lệnh trước khi chạy

```
docker run -d --name n8n --restart unless-stopped -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

Bóc từng mảnh:

| Mảnh | Làm gì |
|---|---|
| `docker run` | Tạo container mới rồi chạy |
| `-d` | Chạy nền (detached). Không có nó thì terminal bị chiếm, đóng terminal là n8n tắt |
| `--name n8n` | Đặt tên container là `n8n`. **Quan trọng** — các lệnh deploy sau đều gọi `docker exec n8n ...` theo tên này |
| `--restart unless-stopped` | Máy khởi động lại thì container tự lên, trừ khi bạn chủ động dừng nó |
| `-p 5678:5678` | Mở cổng: `localhost:5678` của máy bạn → cổng 5678 trong container |
| `-v n8n_data:/home/node/.n8n` | Volume tên `n8n_data` gắn vào thư mục dữ liệu của n8n. **Đây là chỗ giữ workflow và credential** |
| `docker.n8n.io/n8nio/n8n` | Image cần tải |

Cái dấu `\` trong hướng dẫn gốc chỉ để **xuống dòng cho dễ đọc** trong shell của
macOS/Linux. Nó không phải một phần của lệnh.

---

## 4. Chạy lệnh

### Windows PowerShell

Cách chắc ăn nhất — **viết liền một dòng**, copy nguyên rồi dán:

```powershell
docker run -d --name n8n --restart unless-stopped -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

Muốn xuống dòng cho dễ đọc thì PowerShell dùng **backtick** `` ` `` (phím góc
trên trái bàn phím, cùng phím với `~`), **không phải** dấu `\`:

```powershell
docker run -d --name n8n --restart unless-stopped `
  -p 5678:5678 -v n8n_data:/home/node/.n8n `
  docker.n8n.io/n8nio/n8n
```

Sau backtick **không được có khoảng trắng nào** — đây là lỗi rất hay gặp và
PowerShell báo lỗi khó hiểu.

### Windows CMD

CMD không có ký tự nối dòng tiện dụng. **Viết liền một dòng:**

```cmd
docker run -d --name n8n --restart unless-stopped -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

### macOS / Linux

Dán nguyên khối, dấu `\` hoạt động đúng:

```bash
docker run -d --name n8n --restart unless-stopped \
  -p 5678:5678 -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

### Chạy xong sẽ thấy gì

Lần đầu nó tải image, mất 1–3 phút tuỳ mạng:

```
Unable to find image 'docker.n8n.io/n8nio/n8n:latest' locally
latest: Pulling from n8nio/n8n
c6a83fedfae6: Pull complete
...
Status: Downloaded newer image for docker.n8n.io/n8nio/n8n:latest
a3f8e21b9c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f
```

Dòng cuối là **ID container** — một chuỗi hex dài. Thấy nó nghĩa là container đã
tạo và đang chạy. Bạn không cần chép lại ID này, dùng tên `n8n` là đủ.

---

## 5. Kiểm tra container đã lên

```
docker ps
```

Đúng thì ra bảng như sau (dòng dài, terminal có thể cuộn ngang):

```
CONTAINER ID   IMAGE                    COMMAND           STATUS         PORTS                    NAMES
a3f8e21b9c4d   docker.n8n.io/n8nio/n8n  "tini -- /docker…"  Up 25 seconds  0.0.0.0:5678->5678/tcp   n8n
```

Ba chỗ cần nhìn:

- Cột **STATUS** phải là `Up ...`
- Cột **NAMES** phải là `n8n`
- Cột **PORTS** phải có `0.0.0.0:5678->5678/tcp`

### Nếu `docker ps` ra bảng trống

Container đã tạo nhưng chết ngay. Xem tất cả container kể cả cái đã chết:

```
docker ps -a
```

Thấy `Exited (1)` thì đọc log để biết vì sao:

```
docker logs n8n
```

---

## 6. Mở n8n và tạo tài khoản chủ

Đợi khoảng **20–30 giây** sau khi container lên — n8n cần thời gian khởi tạo
SQLite và chạy migration lần đầu.

Mở trình duyệt: **<http://localhost:5678>**

Lần đầu nó hiện màn hình **Set up owner account**. Điền:

- Email — gõ email nào cũng được, kể cả không có thật. Đây là tài khoản cục bộ
  trên máy bạn, n8n không gửi mail xác thực.
- First name, Last name
- Password — tối thiểu 8 ký tự, phải có ít nhất 1 chữ số và 1 chữ hoa

**Ghi lại mật khẩu này.** Mất thì phải xoá volume và làm lại từ đầu, mất luôn mọi
workflow đã tạo.

Sau đó nó hỏi vài câu khảo sát mục đích sử dụng — bấm **Skip** cũng được.

Vào được màn hình danh sách workflow (trống) là xong bước 1.

### Nếu trang không mở được

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| Trang trắng, xoay mãi | n8n chưa khởi tạo xong | Đợi thêm 30 giây, F5 |
| `ERR_CONNECTION_REFUSED` | Container chưa lên hoặc đã chết | `docker ps` kiểm tra, không thấy thì `docker logs n8n` |
| Mở được nhưng lỗi lạ | Cache trình duyệt | Ctrl+Shift+R |

---

## 7. Lệnh dùng hằng ngày

Nhớ 5 lệnh này là đủ cho cả dự án:

```bash
docker ps              # container nào đang chạy
docker logs n8n        # xem log, chẩn đoán khi hỏng
docker logs -f n8n     # xem log theo thời gian thực (Ctrl+C để thoát)
docker stop n8n        # dừng — dữ liệu vẫn còn
docker start n8n       # chạy lại
```

**Không cần chạy lại `docker run` lần thứ hai.** Lệnh đó tạo container mới; chạy
lại sẽ báo trùng tên. Sau lần đầu, chỉ dùng `docker start n8n`.

### Có nên `docker restart n8n` không

Trên máy riêng của bạn thì được. Nhưng tài liệu dự án cấm điều này vì máy gốc
dùng chung, có 16 workflow của người khác đang chạy production. Nếu sau này bạn
làm việc trên máy chung đó thì nhớ ràng buộc này.

### Dữ liệu nằm ở đâu

Trong volume `n8n_data`. Xem:

```
docker volume ls
```

Volume **sống độc lập với container**. Xoá container rồi tạo lại với cùng dòng
`-v n8n_data:/home/node/.n8n` là mọi workflow và credential vẫn còn nguyên.

Xoá sạch để làm lại từ đầu — **cẩn thận, mất hết**:

```
docker stop n8n
docker rm n8n
docker volume rm n8n_data
```

---

## 8. Bảng lỗi thường gặp

| Báo lỗi | Nghĩa | Xử lý |
|---|---|---|
| `docker: command not found` | Chưa cài, hoặc terminal mở trước khi cài | Đóng terminal mở lại |
| `Cannot connect to the Docker daemon` | Docker Desktop chưa chạy | Mở Docker Desktop, đợi cá voi đứng yên |
| `The container name "/n8n" is already in use` | Đã tạo container tên này rồi | Đang chạy thì thôi. Muốn làm lại: `docker rm -f n8n` rồi chạy lại lệnh `docker run` |
| `port is already allocated` | Cổng 5678 đang bị chương trình khác chiếm | Đổi cổng: `-p 5679:5678`, rồi dùng `localhost:5679`. Nhớ đổi luôn `N8N_URL` ở các bước sau |
| `no matching manifest for linux/arm64` | Mac chip Apple tải nhầm image Intel | Thêm `--platform linux/amd64` vào lệnh `docker run` |
| Container `Exited (1)` ngay | Xem `docker logs n8n` để biết lý do | Thường là volume hỏng — xoá volume rồi tạo lại |
| Trang 5678 mở nhưng bắt đăng nhập lại từ đầu | Volume bị mất | Kiểm tra lệnh `docker run` có đúng `-v n8n_data:/home/node/.n8n` không |

---

## 9. Không muốn dùng Docker

Có cách chạy n8n trực tiếp bằng Node, nhẹ hơn và không cần cài Docker Desktop:

```bash
npm install -g n8n
n8n start
```

Cũng mở ở `localhost:5678`, dữ liệu nằm ở `~/.n8n` (Windows:
`C:\Users\<tên-bạn>\.n8n`).

**Đánh đổi:** mọi lệnh deploy ở bước 5 và 6 phải bỏ phần `docker exec n8n` đi.
Cụ thể:

| Bản Docker | Bản npm |
|---|---|
| `docker cp yec-v2.workflow.json n8n:/tmp/` | *(bỏ hẳn, không cần copy)* |
| `docker exec n8n n8n import:workflow --input=/tmp/yec-v2.workflow.json` | `n8n import:workflow --input=./yec-v2.workflow.json` |
| `docker exec n8n n8n publish:workflow --id=YECcasepilotV2a` | `n8n publish:workflow --id=YECcasepilotV2a` |
| `docker exec -e N8N_RUNNERS_BROKER_PORT=5699 ... n8n n8n execute --id=YECkbIngest001` | `n8n execute --id=YECkbIngest001` |

Chạy `n8n start` chiếm terminal, muốn nền thì phải mở terminal thứ hai để gõ các
lệnh import.

Tài liệu dự án viết theo bản Docker, nên nếu bạn cần đối chiếu với `KIEN-TRUC.md`
thì dùng Docker sẽ khớp hơn. Nhưng bản npm chạy đúng như nhau.

---

## Xong bước này thì làm gì tiếp

Quay lại `HUONG-DAN-NOI-BACKEND.md`:

- **Bước 2** — Supabase: tạo project, chạy 2 file SQL, bù cột `scores`, tạo tài khoản đội
- **Bước 3** — tạo 3 credential trong n8n vừa dựng và ghi lại ID của từng cái
