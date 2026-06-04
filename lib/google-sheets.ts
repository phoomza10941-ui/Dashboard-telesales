import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export interface SaleRow {
  date: string;
  name: string;
  phone: string;
  address: string;
  product: string;
  upsell: number;
  crm: number;
  note: string;
}

export interface AgentData {
  agentName: string;
  rows: SaleRow[];
  totalUpsell: number;
  totalCrm: number;
  totalSales: number;
  orderCount: number;
}

// วันนี้ในรูปแบบ DD/MM/YYYY และ DD/MM/YYYY (พ.ศ.)
function todayStrings(): string[] {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const ce = now.getFullYear();
  const be = ce + 543;
  return [`${dd}/${mm}/${ce}`, `${dd}/${mm}/${be}`];
}

export function filterToday(rows: SaleRow[]): SaleRow[] {
  const today = todayStrings();
  return rows.filter((r) => today.some((t) => r.date.startsWith(t) || r.date === t));
}

// filter rows ที่ note บ่งบอกว่าต้อง follow-up
export function filterFollowUp(rows: SaleRow[]): SaleRow[] {
  const keywords = ["ติดตาม", "follow", "โทรตาม", "ตาม", "รอตาม", "นัด"];
  return rows.filter((r) =>
    keywords.some((k) => r.note.toLowerCase().includes(k.toLowerCase()))
  );
}

// filter rows ที่ note บ่งบอกว่ารอโอน/รอชำระ
export function filterPending(rows: SaleRow[]): SaleRow[] {
  const keywords = ["รอโอน", "รอสลิป", "รอยืนยัน", "รอชำระ", "รอ"];
  return rows.filter((r) =>
    keywords.some((k) => r.note.toLowerCase().includes(k.toLowerCase()))
  );
}

// สร้าง trend ยอดขายรายวัน (28 วันล่าสุด)
export function buildTrend(rows: SaleRow[]): { day: string; sales: number }[] {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    const key = r.date.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + r.upsell + r.crm);
  });

  const result: { day: string; sales: number }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const ce = d.getFullYear();
    const be = ce + 543;
    const keyCE = `${dd}/${mm}/${ce}`;
    const keyBE = `${dd}/${mm}/${be}`;
    const sales = map.get(keyCE) ?? map.get(keyBE) ?? 0;
    result.push({ day: `${dd}/${mm}`, sales });
  }
  return result;
}

export async function getAgentSheetNames(): Promise<string[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const allSheets = res.data.sheets ?? [];
  return allSheets
    .map((s) => s.properties?.title ?? "")
    .filter((t) => t.startsWith("Agent_"));
}

export async function getAgentData(sheetName: string): Promise<AgentData> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A3:H502`,
  });

  const rawRows = res.data.values ?? [];
  const agentName = sheetName.replace("Agent_", "");

  const rows: SaleRow[] = rawRows
    .filter((r) => r[0] || r[1])
    .map((r) => ({
      date:    r[0] ?? "",
      name:    r[1] ?? "",
      phone:   r[2] ?? "",
      address: r[3] ?? "",
      product: r[4] ?? "",
      upsell:  parseFloat(String(r[5]).replace(/,/g, "")) || 0,
      crm:     parseFloat(String(r[6]).replace(/,/g, "")) || 0,
      note:    r[7] ?? "",
    }));

  const totalUpsell = rows.reduce((s, r) => s + r.upsell, 0);
  const totalCrm    = rows.reduce((s, r) => s + r.crm, 0);

  return {
    agentName,
    rows,
    totalUpsell,
    totalCrm,
    totalSales: totalUpsell + totalCrm,
    orderCount: rows.length,
  };
}

export async function getAllAgentsData(): Promise<AgentData[]> {
  const sheetNames = await getAgentSheetNames();
  return Promise.all(sheetNames.map((name) => getAgentData(name)));
}

export async function getMyData(agentName: string): Promise<AgentData | null> {
  const sheetName = `Agent_${agentName}`;
  try {
    return await getAgentData(sheetName);
  } catch {
    return null;
  }
}

export interface UserRecord {
  username: string;
  passwordHash: string;
  fullName: string;
  nickname: string;
  agentCode: string;
  team: string;
  createdAt: string;
}

// Ensure USERS sheet exists with headers
async function ensureUsersSheet(): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = (meta.data.sheets ?? []).some(s => s.properties?.title === "USERS");
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "USERS" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "USERS!A1:G1",
      valueInputOption: "RAW",
      requestBody: { values: [["username","password_hash","full_name","nickname","agent_code","team","created_at"]] },
    });
  }
}

export async function findUser(username: string): Promise<UserRecord | null> {
  await ensureUsersSheet();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "USERS!A2:G1000",
  });
  const rows = res.data.values ?? [];
  const row = rows.find(r => r[0] === username);
  if (!row) return null;
  return {
    username: row[0] ?? "",
    passwordHash: row[1] ?? "",
    fullName: row[2] ?? "",
    nickname: row[3] ?? "",
    agentCode: row[4] ?? "",
    team: row[5] ?? "",
    createdAt: row[6] ?? "",
  };
}

export async function createUser(user: Omit<UserRecord, "createdAt">): Promise<void> {
  await ensureUsersSheet();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "USERS!A2:G",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        user.username,
        user.passwordHash,
        user.fullName,
        user.nickname,
        user.agentCode,
        user.team,
        new Date().toISOString(),
      ]],
    },
  });
}

function hex(h: string) {
  return {
    red:   parseInt(h.slice(1, 3), 16) / 255,
    green: parseInt(h.slice(3, 5), 16) / 255,
    blue:  parseInt(h.slice(5, 7), 16) / 255,
  };
}

const SHEET_COLORS = {
  green:      hex("#87DE81"),
  greenDark:  hex("#3D9B3A"),
  textStrong: hex("#3D3D3D"),
  white:      hex("#FFFFFF"),
  border:     hex("#E8E8E8"),
  surface:    hex("#F7F7F7"),
  cyanDark:   hex("#0E8FA8"),
  lGreen:     hex("#E8F8E7"),
  lCyan:      hex("#E0F6FB"),
  fafafa:     hex("#FAFAFA"),
};

const SHEET_COL_WIDTHS = [130, 180, 130, 250, 160, 130, 130, 250];
const SHEET_NUM_COLS = 8;
const SHEET_PRODUCTS = [
  "Beta Life", "Beta Life 2 กล่อง", "Beta Life 3 กล่อง",
  "Beta Oil", "Beta Oil 2 กล่อง",
  "BioActive+", "BioActive+ 2 กล่อง",
  "Lab Farm", "Lab Farm 2 กล่อง",
  "อื่น ๆ",
];

async function applyAgentSheetFormat(sheetId: number, sheetName: string, nickname: string): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const C = SHEET_COLORS;
  const numCols = SHEET_NUM_COLS;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${sheetName}!A1`, values: [[`📊 ${nickname}`]] },
        { range: `${sheetName}!A2:H2`, values: [["วัน/เดือน/ปี", "ชื่อ - สกุล", "เบอร์", "ที่อยู่", "สินค้าที่ขายได้", "Upsell (฿)", "CRM (฿)", "หมายเหตุ"]] },
        { range: `${sheetName}!A503`, values: [["รวม"]] },
        { range: `${sheetName}!F503`, values: [["=SUM(F3:F502)"]] },
        { range: `${sheetName}!G503`, values: [["=SUM(G3:G502)"]] },
      ],
    },
  });

  const r = (si: number, ei: number, sc: number, ec: number) => ({ sheetId, startRowIndex: si, endRowIndex: ei, startColumnIndex: sc, endColumnIndex: ec });
  const solidBorder = (c: typeof C.border) => ({ style: "SOLID", color: c });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        { updateSheetProperties: { properties: { sheetId, tabColorStyle: { rgbColor: C.green } }, fields: "tabColorStyle" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 42 }, fields: "pixelSize" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 2 }, properties: { pixelSize: 36 }, fields: "pixelSize" } },
        { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 502, endIndex: 503 }, properties: { pixelSize: 32 }, fields: "pixelSize" } },
        ...SHEET_COL_WIDTHS.map((w, i) => ({
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS" as const, startIndex: i, endIndex: i + 1 },
            properties: { pixelSize: w },
            fields: "pixelSize",
          },
        })),
        { mergeCells: { range: r(0, 1, 0, numCols), mergeType: "MERGE_ALL" } },
        {
          repeatCell: {
            range: r(0, 1, 0, numCols),
            cell: { userEnteredFormat: { backgroundColor: C.textStrong, textFormat: { foregroundColor: C.white, bold: true, fontSize: 13 }, verticalAlignment: "MIDDLE", horizontalAlignment: "LEFT" } },
            fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)",
          },
        },
        {
          repeatCell: {
            range: r(1, 2, 0, numCols),
            cell: { userEnteredFormat: { backgroundColor: C.green, textFormat: { foregroundColor: C.textStrong, bold: true, fontSize: 11 }, verticalAlignment: "MIDDLE", horizontalAlignment: "CENTER" } },
            fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)",
          },
        },
        {
          repeatCell: {
            range: r(2, 502, 0, numCols),
            cell: {
              userEnteredFormat: {
                backgroundColor: C.white,
                textFormat: { foregroundColor: C.textStrong, fontSize: 11 },
                verticalAlignment: "MIDDLE",
                borders: { top: solidBorder(C.border), bottom: solidBorder(C.border), left: solidBorder(C.border), right: solidBorder(C.border) },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,borders)",
          },
        },
        { repeatCell: { range: r(2, 502, 0, 1), cell: { userEnteredFormat: { horizontalAlignment: "CENTER", numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" } } }, fields: "userEnteredFormat(horizontalAlignment,numberFormat)" } },
        { repeatCell: { range: r(2, 502, 2, 3), cell: { userEnteredFormat: { horizontalAlignment: "CENTER", numberFormat: { type: "TEXT" } } }, fields: "userEnteredFormat(horizontalAlignment,numberFormat)" } },
        { repeatCell: { range: r(2, 502, 5, 6), cell: { userEnteredFormat: { horizontalAlignment: "RIGHT", numberFormat: { type: "NUMBER", pattern: "#,##0" } } }, fields: "userEnteredFormat(horizontalAlignment,numberFormat)" } },
        { repeatCell: { range: r(2, 502, 6, 7), cell: { userEnteredFormat: { horizontalAlignment: "RIGHT", numberFormat: { type: "NUMBER", pattern: "#,##0" } } }, fields: "userEnteredFormat(horizontalAlignment,numberFormat)" } },
        { repeatCell: { range: r(502, 503, 0, numCols), cell: { userEnteredFormat: { backgroundColor: C.surface, textFormat: { bold: true } } }, fields: "userEnteredFormat(backgroundColor,textFormat)" } },
        { repeatCell: { range: r(502, 503, 5, 6), cell: { userEnteredFormat: { textFormat: { foregroundColor: C.greenDark, bold: true }, numberFormat: { type: "NUMBER", pattern: "#,##0" }, horizontalAlignment: "RIGHT" } }, fields: "userEnteredFormat(textFormat,numberFormat,horizontalAlignment)" } },
        { repeatCell: { range: r(502, 503, 6, 7), cell: { userEnteredFormat: { textFormat: { foregroundColor: C.cyanDark, bold: true }, numberFormat: { type: "NUMBER", pattern: "#,##0" }, horizontalAlignment: "RIGHT" } }, fields: "userEnteredFormat(textFormat,numberFormat,horizontalAlignment)" } },
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 2, frozenColumnCount: 2 } }, fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount" } },
        { addConditionalFormatRule: { rule: { ranges: [r(2, 502, 5, 6)], booleanRule: { condition: { type: "NUMBER_GREATER", values: [{ userEnteredValue: "0" }] }, format: { backgroundColor: C.lGreen, textFormat: { foregroundColor: C.greenDark } } } }, index: 0 } },
        { addConditionalFormatRule: { rule: { ranges: [r(2, 502, 6, 7)], booleanRule: { condition: { type: "NUMBER_GREATER", values: [{ userEnteredValue: "0" }] }, format: { backgroundColor: C.lCyan, textFormat: { foregroundColor: C.cyanDark } } } }, index: 1 } },
        { addConditionalFormatRule: { rule: { ranges: [r(2, 502, 0, numCols)], booleanRule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=MOD(ROW(),2)=0" }] }, format: { backgroundColor: C.fafafa } } }, index: 2 } },
        { setDataValidation: { range: r(2, 502, 4, 5), rule: { condition: { type: "ONE_OF_LIST", values: SHEET_PRODUCTS.map(v => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false } } },
        { setDataValidation: { range: r(2, 502, 5, 6), rule: { condition: { type: "NUMBER_GREATER_THAN_EQ", values: [{ userEnteredValue: "0" }] }, inputMessage: "กรอกเป็นตัวเลขเท่านั้น", strict: false } } },
        { setDataValidation: { range: r(2, 502, 6, 7), rule: { condition: { type: "NUMBER_GREATER_THAN_EQ", values: [{ userEnteredValue: "0" }] }, inputMessage: "กรอกเป็นตัวเลขเท่านั้น", strict: false } } },
      ],
    },
  });
}

export async function createAgentSheet(nickname: string): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetName = `Agent_${nickname}`;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  if ((meta.data.sheets ?? []).some(s => s.properties?.title === sheetName)) return;

  const createRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
  });
  const sheetId = createRes.data.replies?.[0]?.addSheet?.properties?.sheetId!;
  await applyAgentSheetFormat(sheetId, sheetName, nickname);
}

export async function reformatAgentSheet(nickname: string): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetName = `Agent_${nickname}`;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetMeta = (meta.data.sheets ?? []).find(s => s.properties?.title === sheetName);
  if (!sheetMeta) throw new Error(`ไม่พบ sheet: ${sheetName}`);

  const sheetId = sheetMeta.properties!.sheetId!;
  await applyAgentSheetFormat(sheetId, sheetName, nickname);
}

// เพิ่มแถวข้อมูลลูกค้าใหม่ลงใน sheet ของ agent
export async function appendRow(agentName: string, row: SaleRow): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetName = `Agent_${agentName}`;

  const values = [[
    row.date,
    row.name,
    row.phone,
    row.address,
    row.product,
    row.upsell || "",
    row.crm || "",
    row.note,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A3:H502`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}
