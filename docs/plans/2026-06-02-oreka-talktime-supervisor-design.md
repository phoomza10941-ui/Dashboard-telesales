# Design — Talk Time จาก dtac OneCall (Oreka) เข้าหน้า /supervisor

วันที่: 2026-06-02
สถานะ: ออกแบบเสร็จ รอ implement

## เป้าหมาย

ดึง **talk time รายคน** จากระบบ voice-record ของ dtac OneCall มาแสดงในหน้า `/supervisor`
(เฉพาะหน้านี้ — ไม่รวม War Room / My-Desk)

## ข้อค้นพบสำคัญ

- เว็บ `onecallvoicerecord.dtac.co.th/orkui/` คือ **Oreka (OrecX)** — มี **OrkTrack REST API** ในตัว
- Base path: `https://onecallvoicerecord.dtac.co.th/orktrack/rest/`
- ดึงได้ realtime ผ่าน API (ไม่ต้อง import CSV)

## แนวทางที่เลือก

- **Server-side live fetch** — Next.js Server Component / route handler เรียก Oreka REST API
- **Server login เอง** — เก็บ user/password ใน `.env`, login เพื่อขอ token + cookie, refresh อัตโนมัติเมื่อหมดอายุ
- **Cache ~60–120 วินาที** — กัน Oreka โดนยิงถี่ทุกครั้งที่รีเฟรชหน้า
- **Graceful fallback** — Oreka ล่ม/timeout หน้า /supervisor ยังโหลดได้ แค่ขึ้นว่า "talk time ไม่พร้อมใช้งาน"

## Auth Flow

1. `POST /orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true`
   - Header: `Authorization: Basic base64(username:password)` (username = เบอร์ login รูปแบบ `+66...`)
   - Body: ว่าง
   - Response JSON: มี **GUID token** + Set-Cookie `JSESSIONID`
2. `GET /orktrack/rest/recordings?range=custom&startdate=YYYYMMDD_HHMMSS&sort=&page=1&pagesize=N&maxresults=0&includetags=true&includemetadata=true&includeprograms=true`
   - Header: `Authorization: <GUID token>` + Cookie `JSESSIONID`
   - Response JSON: รายการสาย (มี pagination)
3. `logout` endpoint (เรียกเมื่อจำเป็น)

## Recordings — JSON ที่ confirm แล้ว

Response structure:
```json
{
  "objects": [
    { "type": "recordingDto", "id": 100659220,
      "timestamp": "2026-06-02 09:23:27", "duration": 54, ... }
  ],
  "nextPageUri": "https://.../recordings?...&page=2",
  "limitReached": false, "page": 1, "pageSize": 20, "resultCount": -1
}
```

| field | ความหมาย | หมายเหตุ |
|---|---|---|
| `objects[]` | array ของสาย | (ไม่ใช่ `recordings`) |
| `duration` | talk time | **หน่วยวินาที** |
| `timestamp` | เวลาที่โทร | `"YYYY-MM-DD HH:MM:SS"` **UTC** |
| `id` | recording id | |
| localparty | เบอร์ agent | (ยังถูกตัดในภาพ — ยืนยันตอน log; ค่าในตาราง = `+66...`) |
| `limitReached` / `nextPageUri` | pagination | วน `nextPageUri` จน `limitReached: true` |

> **Login response token field = `accesstoken`** (GUID) → ใช้เป็น `Authorization` header เรียก recordings
> Oreka version = orktrack 4.20-14190, สิทธิ์ = VIEW_RECORDINGS / scope GROUP

## การจับคู่ agent

- เพิ่มคอลัมน์ `profiles.oreka_ext TEXT` = Local Party (เบอร์เต็ม `+66...`) ของแต่ละ agent
- Join: `Oreka.localparty` (`+66...`) → `profiles.oreka_ext` → `nickname`
- เหตุผล: เบอร์ unique และนิ่ง แม่นกว่า map ด้วยชื่อ
- ⚠️ Local Party เป็น **เบอร์เต็มรูปแบบ `+66...`** (ไม่ใช่ ext สั้น) — กรอกให้ตรง format

## Timezone

- `startdate` และ `timestamp` ใน Oreka เป็น **UTC**
- query "วันนี้" (ไทย UTC+7): แปลงขอบวันไทย − 7 ชม. เป็น UTC ก่อนส่ง
- รวม duration แล้วแสดงผลตามเวลาไทยในหน้า /supervisor

```sql
ALTER TABLE profiles ADD COLUMN oreka_ext TEXT;
```

## ไฟล์ที่จะสร้าง/แก้

```
lib/oreka.ts                 ← โมดูลใหม่
  ├─ orekaLogin()            → คืน { token, jsessionid } + cache ใน memory
  ├─ fetchRecordings(start,end) → วน page จนครบ, lazy re-login เมื่อ 401
  └─ getTalkTimeByAgent(range)  → รวม duration group by localparty + map profiles.oreka_ext
app/supervisor/...           ← เพิ่มการ์ด/ตาราง Talk Time
profiles.oreka_ext           ← คอลัมน์ใหม่ + กรอกค่าให้แต่ละ agent
.env                         ← OREKA_BASE_URL, OREKA_USER, OREKA_PASSWORD
```

## ความปลอดภัย

- Credential อยู่ใน `.env` เท่านั้น **ไม่ commit** (ตรวจ `.gitignore`)
- เรียก Oreka จาก server เท่านั้น — ไม่เปิดเผย token/credential ฝั่ง client
- พิจารณาเปลี่ยนรหัสผ่าน Oreka หลังทดสอบ (เคยโผล่ใน screenshot)

## งานที่ยังต้องทำ (เปิดอยู่)

- [x] Confirm ชื่อ field ใน recordings JSON → array `objects`, `duration` (วินาที), `timestamp`
- [x] Confirm Local Party → เบอร์เต็ม `+66...`
- [x] Confirm token field ใน login response → `accesstoken`
- [x] Confirm timezone → UTC
- [ ] Confirm ชื่อ field localparty ที่แน่นอนใน recordingDto (log ตอน implement)
- [ ] กรอกค่า `oreka_ext` (`+66...`) ให้แต่ละ agent ใน profiles
