const express = require('express');
const router  = express.Router();
const path    = require('path');
const XLSX    = require('xlsx');
const supabase = require('../db');

const DASHBOARD_FILE  = path.join(__dirname, '../data_files/Camp 2026_ Camper Database.xlsx');
const DASHBOARD_SHEET = 'DailyCounts';

function excelDateToISO(serial) {
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000).toISOString().split('T')[0];
}

// GET /api/centers/:id/dashboard
router.get('/:id/dashboard', (req, res) => {
  try {
    const wb   = XLSX.readFile(DASHBOARD_FILE);
    const ws   = wb.Sheets[DASHBOARD_SHEET];
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
      groups.push({
        name:  String(row[0]).trim(),
        unique: row[1] || 0,
        daily:  activeDates.map(d => row[d.index] || 0),
      });
    }

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
