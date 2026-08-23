/**
 * excel-engine.js
 * ----------------
 * Same logic as the original Python version, ported to Node/exceljs so it
 * can run inside a stateless Netlify Function.
 *
 * INPUT FORMAT (single sheet, header row 1):
 *   A: type revenu depense            -> free text description
 *   B: Revenu ou Dépense              -> "Revenu" or "Dépense"
 *   C: Fréquence (A - T - B - M - H)  -> A=Annuel, T=Trimestriel(quarterly),
 *                                         B=Bimestriel(every 2 months),
 *                                         M=Mensuel(monthly), H=Hebdomadaire(weekly)
 *   D: Montant                        -> positive number
 *   E: Catégorie                      -> free text category
 *   F: Date écrite sur le courrier de facture -> a real date
 *
 * OUTPUT FORMAT: one sheet per month (January .. December), columns:
 *   A: type   B: revenu_depense   C: frequence   D: montant (signed)
 *   E: categorie   F: date   G: month (1-12)
 *   plus a summary block in columns J (label) / L (formula), rows 2-8.
 *
 * FREQUENCY ASSUMPTIONS (documented, adjust here if your rules differ):
 *   A -> once, in the month of its date.
 *   M -> every month (12x/year), same day-of-month.
 *   T -> every 3 months (4x/year), same day-of-month.
 *   B -> every 2 months (6x/year), same day-of-month.
 *   H -> every week of that date's year, same weekday as the original date.
 */

const ExcelJS = require("exceljs");

const INPUT_HEADERS = [
  "type revenu depense",
  "Revenu ou Dépense",
  "Fréquence\nA - T - B -\n M - H*",
  "Montant",
  "Catégorie",
  "Date écrite sur le courrier de  facture",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ---------------------------------------------------------------------------
// 1. Creating a new, blank input workbook
// ---------------------------------------------------------------------------

async function createInputTemplateBuffer() {
  const wb = new ExcelJS.Workbook();
  const now = new Date();
  const sheetName = `Annuel commentaires ${String(now.getDate()).padStart(2, "0")}.${String(
    now.getMonth() + 1
  ).padStart(2, "0")}.${now.getFullYear()}`;
  const ws = wb.addWorksheet(sheetName.slice(0, 31)); // sheet names max 31 chars

  ws.addRow(INPUT_HEADERS);
  ws.getRow(1).font = { bold: true };

  const year = now.getFullYear();
  ws.addRow(["EXAMPLE - Salary", "Revenu", "M", 5000, "Revenu", new Date(year, 0, 1)]);
  ws.addRow(["EXAMPLE - Home insurance", "Dépense", "A", 300, "Logement facture", new Date(year, 2, 15)]);
  ws.addRow(["EXAMPLE - Groceries", "Dépense", "H", 150, "Dépenses courantes", new Date(year, 0, 2)]);

  const widths = [45, 16, 12, 12, 22, 24];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  ws.getColumn(6).numFmt = "dd/mm/yyyy";

  return wb.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------------
// 2. Expanding a single input row into its date occurrences
// ---------------------------------------------------------------------------

function lastDayOfMonth(year, month /* 1-12 */) {
  return new Date(year, month, 0).getDate();
}

function safeDate(year, month /* 1-12 */, day) {
  const last = lastDayOfMonth(year, month);
  return new Date(year, month - 1, Math.min(day, last));
}

function firstWeekdayOnOrAfter(d, weekday /* 0=Sun..6=Sat */) {
  const diff = (weekday - d.getDay() + 7) % 7;
  const result = new Date(d);
  result.setDate(d.getDate() + diff);
  return result;
}

function toJsDate(value, refYear) {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    // Excel serial date fallback (rare with exceljs, but be safe)
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date(refYear, 0, 1);
}

/**
 * Returns an array of { desc, typ, freq, amount, categorie, date, month }
 * for every occurrence of this row within `refYear`.
 */
function expandRow(desc, typ, freq, montant, categorie, dtRaw, refYear) {
  const dt = toJsDate(dtRaw, refYear);
  const sign = String(typ || "").trim().toLowerCase().startsWith("revenu") ? 1 : -1;
  const numeric = typeof montant === "number" ? montant : parseFloat(montant);
  const amount = sign * Math.abs(isNaN(numeric) ? 0 : numeric);
  const freqCode = (freq || "A").toString().trim().toUpperCase();

  const occurrences = [];
  const day = dt.getDate();

  if (freqCode === "A") {
    occurrences.push(dt);
  } else if (freqCode === "M") {
    for (let m = 1; m <= 12; m++) occurrences.push(safeDate(refYear, m, day));
  } else if (freqCode === "T") {
    for (let k = 0; k < 4; k++) {
      const m = ((dt.getMonth() + k * 3) % 12) + 1;
      occurrences.push(safeDate(refYear, m, day));
    }
  } else if (freqCode === "B") {
    for (let k = 0; k < 6; k++) {
      const m = ((dt.getMonth() + k * 2) % 12) + 1;
      occurrences.push(safeDate(refYear, m, day));
    }
  } else if (freqCode === "H") {
    const jan1 = new Date(refYear, 0, 1);
    let d = firstWeekdayOnOrAfter(jan1, dt.getDay());
    while (d.getFullYear() === refYear) {
      occurrences.push(new Date(d));
      d.setDate(d.getDate() + 7);
    }
  } else {
    occurrences.push(dt);
  }

  return occurrences.map((occDate) => ({
    desc,
    typ,
    freq: freqCode,
    amount,
    categorie,
    date: occDate,
    month: occDate.getMonth() + 1,
  }));
}

// ---------------------------------------------------------------------------
// 3. Building the 12-sheet output workbook
// ---------------------------------------------------------------------------

async function generateOutputBuffer(inputBuffer) {
  const wbIn = new ExcelJS.Workbook();
  await wbIn.xlsx.load(inputBuffer);
  const wsIn = wbIn.worksheets[0];
  if (!wsIn) throw new Error("The uploaded file has no worksheets.");

  const rawRows = [];
  let refYear = null;

  wsIn.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const values = row.values; // 1-indexed array, values[0] undefined
    const desc = values[1];
    const typ = values[2];
    const freq = values[3];
    const montant = values[4];
    const categorie = values[5];
    const dt = values[6];

    if (desc === undefined || desc === null || desc === "") return;
    if (montant === undefined || montant === null || montant === "") return;

    if (refYear === null) {
      const d = toJsDate(dt, new Date().getFullYear());
      refYear = d.getFullYear();
    }
    rawRows.push({ desc, typ, freq, montant, categorie, dt });
  });

  if (refYear === null) refYear = new Date().getFullYear();

  const monthRows = {};
  for (let m = 1; m <= 12; m++) monthRows[m] = [];

  for (const r of rawRows) {
    const occ = expandRow(r.desc, r.typ, r.freq, r.montant, r.categorie, r.dt, refYear);
    for (const item of occ) monthRows[item.month].push(item);
  }

  const wbOut = new ExcelJS.Workbook();

  MONTHS.forEach((mname, idx0) => {
    const idx = idx0 + 1; // 1-12
    const ws = wbOut.addWorksheet(mname);

    ws.addRow(["type", "revenu_depense", "frequence", "montant", "categorie", "date", "month"]);
    ws.getRow(1).font = { bold: true };

    for (const item of monthRows[idx]) {
      ws.addRow([
        item.desc,
        item.typ,
        item.freq,
        Math.round(item.amount * 100) / 100,
        item.categorie,
        item.date,
        item.month,
      ]);
    }

    const prevMonthName = idx > 1 ? MONTHS[idx - 2] : null;
    const l2Formula = prevMonthName === null ? "0" : `${prevMonthName}!L5`;

    ws.getCell("J2").value = "Différence mois précédent:";
    ws.getCell("L2").value = { formula: l2Formula };
    ws.getCell("J3").value = "Total Revenus:";
    ws.getCell("L3").value = { formula: 'SUMIFS(D:D, B:B, "Revenu")' };
    ws.getCell("J4").value = "Total Dépenses:";
    ws.getCell("L4").value = { formula: 'SUMIFS(D:D, B:B, "Dépense")' };
    ws.getCell("J5").value = "Différence:";
    ws.getCell("L5").value = { formula: "L3 + L4 + L2" };
    ws.getCell("J7").value = "Factures";
    ws.getCell("L7").value = { formula: 'SUMIFS(D:D, E:E, "*facture*")' };
    ws.getCell("J8").value = "Non Factures";
    ws.getCell("L8").value = { formula: "L4 - L7" };

    const widths = [40, 14, 10, 10, 22, 12, 8];
    widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
    ws.getColumn(6).numFmt = "dd/mm/yyyy";
    ws.getColumn(10).width = 24;
    ws.getColumn(12).width = 40;
  });

  return wbOut.xlsx.writeBuffer();
}

module.exports = {
  INPUT_HEADERS,
  MONTHS,
  createInputTemplateBuffer,
  expandRow,
  generateOutputBuffer,
};
