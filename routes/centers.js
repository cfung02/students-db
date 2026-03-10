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
  const ws   = wb.Sheets['Daily Student Counts'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  // Row 0: header ["Group","Mon","Tue","Weds","Thur","Fri"]
  // Remaining rows: group data until blank or Grand Total
  const dayNames = (rows[0] || []).slice(1).map(d => String(d).trim()).filter(Boolean);
  const groups   = [];
  let   totalRow = [];

  for (let r = 1; r < rows.length; r++) {
    const row  = rows[r];
    if (!row || !row[0]) break;
    const name = String(row[0]).trim();
    if (name.toLowerCase().includes('total')) { totalRow = row; break; }
    groups.push({
      name,
      daily: dayNames.map((_, i) => row[i + 1] || 0),
    });
  }

  const dayTotals = dayNames.map((_, i) => totalRow[i + 1] || 0);
  return { type: 'weekly', days: dayNames, dayTotals, groups };
}

// GET /api/centers/:id/dashboard
router.get('/:id/dashboard', async (req, res) => {
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
    // Override grandTotal with actual DB count for this center
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('center_id', req.params.id);
    result.grandTotal = count || result.grandTotal;

    // Group counts from DB
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('group_name')
      .eq('center_id', req.params.id)
      .not('group_name', 'is', null);
    const groupMap = {};
    (enrollments || []).forEach(r => {
      groupMap[r.group_name] = (groupMap[r.group_name] || 0) + 1;
    });
    result.groupCounts = Object.entries(groupMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

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
