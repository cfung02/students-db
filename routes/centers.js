const express = require('express');
const router  = express.Router();
const path    = require('path');
const XLSX    = require('xlsx');
const supabase = require('../db');

const CAMP_FILE = path.join(__dirname, '../data_files/Camp 2026_ Camper Database.xlsx');
const RR_FILE   = path.join(__dirname, '../data_files/RR school database 2025-26.xlsx');

function excelDateToISO(serial) {
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000).toISOString().split('T')[0];
}

function parseRRDate(val) {
  if (!val) return null;
  if (typeof val === 'number') return excelDateToISO(val);
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'string') {
    const parts = val.split('/');
    if (parts.length >= 2) {
      const m = parseInt(parts[0]);
      const d = parseInt(parts[1]);
      const year = m >= 6 ? 2025 : 2026;
      return `${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
  }
  return null;
}

function parseCampDashboard(wb) {
  const ws   = wb.Sheets['DailyCounts'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const dateRow  = rows[0];
  const weekRow  = rows[1];
  const totalRow = rows[2];
  const dates = [];
  for (let i = 2; i < dateRow.length; i++) {
    if (!dateRow[i]) continue;
    dates.push({ index: i, date: excelDateToISO(dateRow[i]), week: weekRow[i] || null, total: totalRow[i] || 0 });
  }
  const activeDates = dates.filter(d => d.week && d.week <= 8);
  const skipGroups = new Set(['Group', 'TRAV B', 'TRAV G', 'TRAVEL TEENS']);
  const groups = [];
  for (let r = 3; r <= 29; r++) {
    const row = rows[r];
    if (!row || !row[0] || skipGroups.has(String(row[0]).trim())) continue;
    groups.push({ name: String(row[0]).trim(), unique: row[1] || 0, daily: activeDates.map(d => row[d.index] || 0) });
  }
  const grandTotal = rows[35] ? rows[35][1] || 0 : 0;
  return { dates: activeDates.map(({ date, week, total }) => ({ date, week, total })), groups, grandTotal };
}

function parseRRDashboard(wb) {
  const ws   = wb.Sheets['Daily Count by Group'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  // Row 1: week labels (merged cells — propagate forward)
  const weekLabelRow = rows[1] || [];
  const weekMap = {};
  let currentWeek = null;
  for (let i = 2; i < weekLabelRow.length; i++) {
    const cell = weekLabelRow[i];
    if (cell && typeof cell === 'string' && cell.startsWith('Week ')) {
      currentWeek = parseInt(cell.replace('Week ', ''));
    }
    if (currentWeek !== null) weekMap[i] = currentWeek;
  }
  // Row 2: dates
  const dateRow = rows[2] || [];
  const dates = [];
  for (let i = 2; i < dateRow.length; i++) {
    if (!dateRow[i] || weekMap[i] === undefined) continue;
    const dateStr = parseRRDate(dateRow[i]);
    if (!dateStr) continue;
    dates.push({ index: i, date: dateStr, week: weekMap[i] });
  }
  const activeDates = dates.filter(d => d.week <= 8);
  // Grand total row (row 20)
  const totalRow = rows[20] || [];
  activeDates.forEach(d => { d.total = totalRow[d.index] || 0; });
  const grandTotal = totalRow[1] || 0;
  // Groups: rows 4-19, skip travel groups
  const skipGroups = new Set(['TRAV B', 'TRAV G']);
  const groups = [];
  for (let r = 4; r <= 19; r++) {
    const row = rows[r];
    if (!row || !row[0]) continue;
    const name = String(row[0]).trim();
    if (skipGroups.has(name)) continue;
    groups.push({ name, unique: row[1] || 0, daily: activeDates.map(d => row[d.index] || 0) });
  }
  return { dates: activeDates.map(({ date, week, total }) => ({ date, week, total })), groups, grandTotal };
}

// GET /api/centers/:id/dashboard
router.get('/:id/dashboard', (req, res) => {
  try {
    const id = String(req.params.id);
    let result;
    if (id === '2') {
      const wb = XLSX.readFile(RR_FILE);
      result = parseRRDashboard(wb);
    } else {
      const wb = XLSX.readFile(CAMP_FILE);
      result = parseCampDashboard(wb);
    }
    res.json(result);
  } catch (err) {
    console.error('[dashboard]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET all centers
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('centers').select('*').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET one center
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('centers').select('*').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Center not found' });
  res.json(data);
});

// POST create center
router.post('/', async (req, res) => {
  const { name, address, phone } = req.body;
  const { data, error } = await supabase.from('centers').insert({ name, address, phone }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PUT update center
router.put('/:id', async (req, res) => {
  const { name, address, phone } = req.body;
  const { data, error } = await supabase.from('centers').update({ name, address, phone }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE center
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('centers').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
