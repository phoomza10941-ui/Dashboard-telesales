// ============================================================
//  TELESALES MASTER SHEET — AUTO SETUP SCRIPT
//  วิธีใช้: เปิด Google Sheets ใหม่ → Extensions → Apps Script
//  → วางโค้ดนี้ทั้งหมด → กด Run → เลือก setupMasterSheet()
// ============================================================

// สีจาก Design System
const COLOR = {
  green:      "#87DE81",
  greenDark:  "#3D9B3A",
  cyan:       "#58CEE8",
  cyanDark:   "#0E8FA8",
  text:       "#8B8E8F",
  textStrong: "#3D3D3D",
  border:     "#E8E8E8",
  surface:    "#F7F7F7",
  white:      "#FFFFFF",
  red:        "#FF6B6B",
};

// คอลัมน์ header
const HEADERS = [
  { label: "วัน/เดือน/ปี",     width: 130, note: "กรอกวันที่บันทึก เช่น 30/05/2568" },
  { label: "ชื่อ - สกุล",      width: 180, note: "ชื่อ-นามสกุลลูกค้า" },
  { label: "เบอร์",             width: 130, note: "เบอร์โทรลูกค้า เช่น 0891234567" },
  { label: "ที่อยู่",           width: 250, note: "ที่อยู่สำหรับจัดส่ง" },
  { label: "สินค้าที่ขายได้",  width: 160, note: "ชื่อสินค้าหลักที่ปิดได้" },
  { label: "Upsell (฿)",        width: 130, note: "ยอด Upsell เป็นตัวเลขเท่านั้น เช่น 1990" },
  { label: "CRM (฿)",           width: 130, note: "ยอด CRM เป็นตัวเลขเท่านั้น เช่น 3900" },
  { label: "หมายเหตุ",          width: 250, note: "Note เพิ่มเติม เช่น โอนแล้ว / ติดตาม" },
];

const PRODUCTS = [
  "Beta Life",
  "Beta Life 2 กล่อง",
  "Beta Life 3 กล่อง",
  "Beta Oil",
  "Beta Oil 2 กล่อง",
  "BioActive+",
  "BioActive+ 2 กล่อง",
  "Lab Farm",
  "Lab Farm 2 กล่อง",
  "อื่น ๆ",
];

// ============================================================
//  MAIN: สร้าง Master Sheet ทั้งหมด
// ============================================================
function setupMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename("Telesales Master 2568");

  // ลบ sheet เริ่มต้นถ้ามี
  const defaultSheet = ss.getSheetByName("Sheet1");

  // สร้าง TEMPLATE tab
  let tmpl = ss.getSheetByName("TEMPLATE");
  if (!tmpl) tmpl = ss.insertSheet("TEMPLATE");
  setupAgentSheet(tmpl, "TEMPLATE");
  protectSheet(tmpl, "Template — ห้ามแก้ไข ใช้เป็น reference เท่านั้น");

  // สร้าง SUMMARY tab
  let summary = ss.getSheetByName("SUMMARY");
  if (!summary) summary = ss.insertSheet("SUMMARY");
  setupSummarySheet(ss, summary);

  // ลบ Sheet1 หลังสร้างแล้ว
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // ย้าย SUMMARY ไปหน้าแรก, TEMPLATE ไปที่สอง
  ss.setActiveSheet(summary);
  ss.moveActiveSheet(1);
  ss.setActiveSheet(tmpl);
  ss.moveActiveSheet(2);

  SpreadsheetApp.getUi().alert(
    "✅ สร้าง Template สำเร็จ!\n\n" +
    "วิธีเพิ่ม Agent ใหม่:\n" +
    "Extensions → Apps Script → Run addAgentSheet()\n" +
    "แล้วกรอกชื่อ Agent ใน popup"
  );
}

// ============================================================
//  สร้าง Tab ให้ Agent คนใหม่
// ============================================================
function addAgentSheet() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt("เพิ่ม Agent ใหม่", "กรอกชื่อ Agent (เช่น สมชาย):", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const name = res.getResponseText().trim();
  if (!name) { ui.alert("กรุณากรอกชื่อ"); return; }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tabName = "Agent_" + name;

  if (ss.getSheetByName(tabName)) {
    ui.alert("มี tab ชื่อ " + tabName + " อยู่แล้ว");
    return;
  }

  const sheet = ss.insertSheet(tabName);
  setupAgentSheet(sheet, name);

  // ย้าย tab ไปก่อน SUMMARY
  const summaryIdx = ss.getSheetByName("SUMMARY").getIndex();
  ss.moveActiveSheet(summaryIdx);

  ui.alert("✅ เพิ่ม " + tabName + " สำเร็จ!");
}

// ============================================================
//  ฟังก์ชัน: ตั้งค่า Agent Sheet (ใช้ร่วมกับ TEMPLATE)
// ============================================================
function setupAgentSheet(sheet, agentName) {
  if (!sheet || !agentName) {
    SpreadsheetApp.getUi().alert("⚠️ อย่ารัน setupAgentSheet() ตรง ๆ\n\nใช้:\n• setupMasterSheet() — สร้าง Template ครั้งแรก\n• addAgentSheet() — เพิ่ม Agent ใหม่");
    return;
  }
  sheet.clear();
  sheet.setTabColor(COLOR.green);

  const numCols = HEADERS.length;
  const lastColLetter = colLetter(numCols);

  // ── Row 1: ชื่อ Agent (title row) ──────────────────────────
  sheet.setRowHeight(1, 42);
  const titleRange = sheet.getRange("A1:" + lastColLetter + "1");
  titleRange.merge()
    .setValue(agentName === "TEMPLATE" ? "📋 TEMPLATE — ห้ามกรอกข้อมูลในแถวนี้" : "📊 " + agentName)
    .setBackground(COLOR.textStrong)
    .setFontColor(COLOR.white)
    .setFontSize(13)
    .setFontWeight("bold")
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("left");
  sheet.getRange("A1").setNumberFormat("@");

  // ── Row 2: Headers ─────────────────────────────────────────
  sheet.setRowHeight(2, 36);
  HEADERS.forEach((h, i) => {
    const col = i + 1;
    const cell = sheet.getRange(2, col);
    cell.setValue(h.label)
      .setBackground(COLOR.green)
      .setFontColor(COLOR.textStrong)
      .setFontSize(11)
      .setFontWeight("bold")
      .setVerticalAlignment("middle")
      .setHorizontalAlignment("center")
      .setNote(h.note);
    sheet.setColumnWidth(col, h.width);
  });

  // ── Rows 3-502: Data area (500 rows) ───────────────────────
  const dataRange = sheet.getRange(3, 1, 500, numCols);
  dataRange
    .setBackground(COLOR.white)
    .setFontColor(COLOR.textStrong)
    .setFontSize(11)
    .setVerticalAlignment("middle")
    .setBorder(true, true, true, true, true, true, COLOR.border, SpreadsheetApp.BorderStyle.SOLID);

  // ── Date column (A): format + validation ───────────────────
  sheet.getRange(3, 1, 500, 1)
    .setNumberFormat("DD/MM/YYYY")
    .setHorizontalAlignment("center");

  // ── Phone column (C): text format (ไม่ตัด 0 นำหน้า) ────────
  sheet.getRange(3, 3, 500, 1)
    .setNumberFormat("@")
    .setHorizontalAlignment("center");

  // ── Product column (E): dropdown ───────────────────────────
  const productRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(PRODUCTS, true)
    .setAllowInvalid(true)
    .setHelpText("เลือกสินค้าจากรายการ หรือพิมพ์เองได้")
    .build();
  sheet.getRange(3, 5, 500, 1).setDataValidation(productRule);

  // ── Upsell (F) + CRM (G): number format + validation ───────
  const numberRule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0)
    .setAllowInvalid(false)
    .setHelpText("กรอกเป็นตัวเลขเท่านั้น ไม่ต้องใส่ ฿")
    .build();

  sheet.getRange(3, 6, 500, 1)
    .setNumberFormat('#,##0')
    .setDataValidation(numberRule)
    .setHorizontalAlignment("right");

  sheet.getRange(3, 7, 500, 1)
    .setNumberFormat('#,##0')
    .setDataValidation(numberRule)
    .setHorizontalAlignment("right");

  // ── Conditional formatting: ถ้า Upsell > 0 → เขียวอ่อน ────
  const upsellCF = sheet.getRange(3, 6, 500, 1);
  const cfRuleUpsell = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)
    .setBackground("#E8F8E7")
    .setFontColor(COLOR.greenDark)
    .setRanges([upsellCF])
    .build();

  const crmCF = sheet.getRange(3, 7, 500, 1);
  const cfRuleCRM = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)
    .setBackground("#E0F6FB")
    .setFontColor(COLOR.cyanDark)
    .setRanges([crmCF])
    .build();

  // Alternating row colors
  const evenRows = sheet.getRange(3, 1, 500, numCols);
  const cfRowEven = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied("=MOD(ROW(),2)=0")
    .setBackground("#FAFAFA")
    .setRanges([evenRows])
    .build();

  sheet.setConditionalFormatRules([cfRuleUpsell, cfRuleCRM, cfRowEven]);

  // ── Freeze header rows ──────────────────────────────────────
  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(2); // freeze Date + Name

  // ── Hide gridlines for cleaner look ────────────────────────
  // (cannot hide via Apps Script, but border styling handles it)

  // ── Summary row at bottom label (row 503) ──────────────────
  const sumRow = 503;
  sheet.setRowHeight(sumRow, 32);
  sheet.getRange(sumRow, 1).setValue("รวม").setFontWeight("bold").setBackground(COLOR.surface);
  sheet.getRange(sumRow, 2, 1, 3).setBackground(COLOR.surface);

  // Upsell total
  sheet.getRange(sumRow, 6)
    .setFormula(`=SUM(F3:F502)`)
    .setNumberFormat('#,##0')
    .setFontWeight("bold")
    .setFontColor(COLOR.greenDark)
    .setBackground(COLOR.surface);

  // CRM total
  sheet.getRange(sumRow, 7)
    .setFormula(`=SUM(G3:G502)`)
    .setNumberFormat('#,##0')
    .setFontWeight("bold")
    .setFontColor(COLOR.cyanDark)
    .setBackground(COLOR.surface);

  sheet.getRange(sumRow, 8).setBackground(COLOR.surface);
}

// ============================================================
//  ฟังก์ชัน: สร้าง SUMMARY sheet
// ============================================================
function setupSummarySheet(ss, sheet) {
  sheet.clear();
  sheet.setTabColor(COLOR.cyan);

  const lastColLetter = "F";

  // Title
  sheet.setRowHeight(1, 48);
  sheet.getRange("A1:F1").merge()
    .setValue("📈 SUMMARY — ยอดรวมทุก Agent")
    .setBackground(COLOR.textStrong)
    .setFontColor(COLOR.white)
    .setFontSize(14)
    .setFontWeight("bold")
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("left");

  // Note
  sheet.setRowHeight(2, 28);
  sheet.getRange("A2:F2").merge()
    .setValue("⚡ อัปเดตอัตโนมัติ — ไม่ต้องแก้ไขหน้านี้")
    .setBackground("#FFF9E6")
    .setFontColor("#B7791F")
    .setFontSize(10)
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle");

  // Headers
  const sumHeaders = ["Agent", "จำนวน Rows", "ยอด Upsell (฿)", "ยอด CRM (฿)", "ยอดรวม (฿)", "อัปเดตล่าสุด"];
  const headerWidths = [180, 130, 160, 160, 160, 160];
  sheet.setRowHeight(3, 36);
  sumHeaders.forEach((h, i) => {
    sheet.getRange(3, i + 1)
      .setValue(h)
      .setBackground(COLOR.cyan)
      .setFontColor(COLOR.textStrong)
      .setFontSize(11)
      .setFontWeight("bold")
      .setVerticalAlignment("middle")
      .setHorizontalAlignment("center");
    sheet.setColumnWidth(i + 1, headerWidths[i]);
  });

  sheet.setFrozenRows(3);

  // Note: agent rows จะถูกเพิ่มโดย refreshSummary()
  sheet.getRange("A4:F4").merge()
    .setValue("กด Extensions → Apps Script → refreshSummary() เพื่ออัปเดต")
    .setFontColor(COLOR.text)
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.setRowHeight(4, 32);
}

// ============================================================
//  ฟังก์ชัน: Refresh SUMMARY (รันได้ตลอด)
// ============================================================
function refreshSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summary = ss.getSheetByName("SUMMARY");
  if (!summary) { SpreadsheetApp.getUi().alert("ไม่พบ sheet SUMMARY"); return; }

  // เคลียร์ data rows เก่า
  const lastRow = Math.max(summary.getLastRow(), 4);
  if (lastRow >= 4) {
    summary.getRange(4, 1, lastRow - 3, 6).clearContent().clearFormat();
  }

  const sheets = ss.getSheets();
  const agentSheets = sheets.filter(s => s.getName().startsWith("Agent_"));

  if (agentSheets.length === 0) {
    summary.getRange("A4:F4").merge()
      .setValue("ยังไม่มี Agent — รัน addAgentSheet() เพื่อเพิ่ม")
      .setFontColor(COLOR.text).setHorizontalAlignment("center");
    return;
  }

  let row = 4;
  let grandUpsell = 0;
  let grandCrm = 0;

  agentSheets.forEach(agentSheet => {
    const name = agentSheet.getName().replace("Agent_", "");
    const data = agentSheet.getRange(3, 1, 500, 7).getValues();

    let upsellSum = 0;
    let crmSum = 0;
    let rowCount = 0;

    data.forEach(r => {
      if (r[0] !== "" || r[1] !== "") {
        upsellSum += Number(r[5]) || 0;
        crmSum += Number(r[6]) || 0;
        rowCount++;
      }
    });

    grandUpsell += upsellSum;
    grandCrm += crmSum;

    const total = upsellSum + crmSum;
    const now = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm");

    summary.setRowHeight(row, 32);
    summary.getRange(row, 1).setValue(name).setFontSize(12).setFontColor(COLOR.textStrong);
    summary.getRange(row, 2).setValue(rowCount).setHorizontalAlignment("center").setFontColor(COLOR.text);
    summary.getRange(row, 3).setValue(upsellSum).setNumberFormat('#,##0').setHorizontalAlignment("right")
      .setFontColor(COLOR.greenDark).setFontWeight(upsellSum > 0 ? "bold" : "normal");
    summary.getRange(row, 4).setValue(crmSum).setNumberFormat('#,##0').setHorizontalAlignment("right")
      .setFontColor(COLOR.cyanDark).setFontWeight(crmSum > 0 ? "bold" : "normal");
    summary.getRange(row, 5).setValue(total).setNumberFormat('#,##0').setHorizontalAlignment("right")
      .setFontWeight("bold").setFontColor(total > 0 ? COLOR.textStrong : COLOR.text);
    summary.getRange(row, 6).setValue(now).setFontSize(10).setFontColor(COLOR.text).setHorizontalAlignment("center");

    // Alternating row
    if (row % 2 === 0) {
      summary.getRange(row, 1, 1, 6).setBackground("#FAFAFA");
    } else {
      summary.getRange(row, 1, 1, 6).setBackground("#FFFFFF");
    }

    row++;
  });

  // Grand total row
  const grandRow = row + 1;
  summary.setRowHeight(grandRow, 40);
  summary.getRange(grandRow, 1).setValue("รวมทั้งหมด").setFontWeight("bold").setFontSize(12)
    .setBackground(COLOR.textStrong).setFontColor(COLOR.white);
  summary.getRange(grandRow, 2).setBackground(COLOR.textStrong);
  summary.getRange(grandRow, 3).setValue(grandUpsell).setNumberFormat('#,##0')
    .setFontWeight("bold").setFontColor(COLOR.green).setBackground(COLOR.textStrong).setHorizontalAlignment("right");
  summary.getRange(grandRow, 4).setValue(grandCrm).setNumberFormat('#,##0')
    .setFontWeight("bold").setFontColor(COLOR.cyan).setBackground(COLOR.textStrong).setHorizontalAlignment("right");
  summary.getRange(grandRow, 5).setValue(grandUpsell + grandCrm).setNumberFormat('#,##0')
    .setFontWeight("bold").setFontColor(COLOR.white).setBackground(COLOR.textStrong).setHorizontalAlignment("right");
  summary.getRange(grandRow, 6).setBackground(COLOR.textStrong);

  SpreadsheetApp.getUi().alert("✅ SUMMARY อัปเดตแล้ว!\n\nAgent ทั้งหมด: " + agentSheets.length + " คน\nยอดรวม: ฿" + (grandUpsell + grandCrm).toLocaleString());
}

// ── Utility: แปลง column index → letter ─────────────────────
function colLetter(n) {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ── Utility: Protect a sheet ─────────────────────────────────
function protectSheet(sheet, desc) {
  const protection = sheet.protect().setDescription(desc);
  protection.setWarningOnly(true);
}
