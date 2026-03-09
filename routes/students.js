const express = require('express');
const router = express.Router();
const supabase = require('../db');

// GET all students
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('*, student_parents(parent_id, relationship, parents(first_name, last_name, email, phone))')
    .order('last_name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET one
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('*, student_parents(id, parent_id, relationship, parents(*))')
    .eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// POST create
router.post('/', async (req, res) => {
  const { first_name, last_name, birthday, shirt_size, enrolled_date, status } = req.body;
  const { data, error } = await supabase
    .from('students')
    .insert({ first_name, last_name, birthday, shirt_size, enrolled_date, status: status || 'prospect' })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PUT update
router.put('/:id', async (req, res) => {
  const { first_name, last_name, birthday, shirt_size, enrolled_date, status } = req.body;
  const { data, error } = await supabase
    .from('students')
    .update({ first_name, last_name, birthday, shirt_size, enrolled_date, status })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('students').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

// POST link parent to student
router.post('/:id/parents', async (req, res) => {
  const { parent_id, relationship, first_name, last_name, email, phone } = req.body;
  let pid = parent_id;

  // Create new parent if no existing parent selected
  if (!pid) {
    const { data: p, error: pErr } = await supabase
      .from('parents').insert({ first_name, last_name, email, phone }).select().single();
    if (pErr) return res.status(400).json({ error: pErr.message });
    pid = p.id;
  }

  const { data, error } = await supabase
    .from('student_parents')
    .insert({ student_id: req.params.id, parent_id: pid, relationship })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE unlink parent
router.delete('/:id/parents/:linkId', async (req, res) => {
  const { error } = await supabase.from('student_parents').delete().eq('id', req.params.linkId);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
