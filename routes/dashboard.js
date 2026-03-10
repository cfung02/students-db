const express = require('express');
const router  = express.Router({ mergeParams: true });
const path    = require('path');
const XLSX    = require('xlsx');

const FILE_PATH  = path.join(__dirname, '../data_files/Camp 2026_ Camper Database.xlsx');
const SHEET_NAME = 'DailyCounts';

function excelDateToISO(serial) {
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000).toISOString().split('T')[0];
}

// GET /api/centers/:centerId/dashboard
router.get('/', (req, res) => {
  try {
    const wb   = XLSX.readFile(FILE_PATH);
    const ws   = wb.Sheets[SHEET_NAME];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Row 0: date serials (col 2+)
    // Row 1: week numbers (col 2+)
    // Row 2: "Total" / "Unique#" + daily totals
    // Rows 3–29: group data
    // Row 35: TOTAL (unique total)

    const dateRow  = rows[0];
    const weekRow  = rows[1];
    const totalRow = rows[2];

    // Build date headers (skip first 2 cols)
    const dates = [];
    for (let i = 2; i < dateRow.length; i++) {
      if (!dateRow[i]) continue;
      dates.push({
        index:   i,
        serial:  dateRow[i],
        date:    excelDateToISO(dateRow[i]),
        week:    weekRow[i] || null,
        total:   totalRow[i] || 0,
      });
    }

    // Skip week 9 (last 5 cols appear to be week 9 = off-season / near-zero)
    const activeDates = dates.filter(d => d.week && d.week <= 8);

    // Build group rows (rows 3–29, skip blank/placeholder rows)
    const skipGroups = new Set(['Group', 'TRAV B', 'TRAV G', 'TRAVEL TEENS']);
    const groups = [];
    for (let r = 3; r <= 29; r++) {
      const row = rows[r];
      if (!row || !row[0] || skipGroups.has(String(row[0]).trim())) continue;
      const name   = String(row[0]).trim();
      const unique = row[1] || 0;
      const daily  = activeDates.map(d => row[d.index] || 0);
      groups.push({ name, unique, daily });
    }

    // Overall total row (row 35 only has unique total, no daily breakdown)
    const grandTotal = rows[35] ? rows[35][1] || 0 : 0;

    res.json({
      dates: activeDates.map(({ date, week, total }) => ({ date, week, total })),
      groups,
      grandTotal,
    });
  } catch (err) {
    console.error('[dashboard]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
