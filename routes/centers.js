const express = require('express');
const router = express.Router();
const supabase = require('../db');

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
