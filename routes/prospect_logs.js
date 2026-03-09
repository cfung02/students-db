const express = require('express');
const router = express.Router({ mergeParams: true });
const supabase = require('../db');

// GET all logs for a prospect
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('prospect_logs')
    .select('*')
    .eq('prospect_id', req.params.prospectId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST manual log entry
router.post('/', async (req, res) => {
  const { action, note } = req.body;
  const { data, error } = await supabase
    .from('prospect_logs')
    .insert({ prospect_id: req.params.prospectId, action, note })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE a log entry
router.delete('/:logId', async (req, res) => {
  const { error } = await supabase
    .from('prospect_logs').delete().eq('id', req.params.logId);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
