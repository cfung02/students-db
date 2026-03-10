const express = require('express');
const router = express.Router();
const supabase = require('../db');

async function addLog(prospect_id, action, note = null, status_from = null, status_to = null) {
  await supabase.from('prospect_logs').insert({ prospect_id, action, note, status_from, status_to });
}

// GET all prospects
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('prospects')
    .select('*, centers(name)')
    .order('inquiry_date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET one
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('prospects').select('*, centers(name)').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// POST create
router.post('/', async (req, res) => {
  const { center_id, first_name, last_name, email, phone, inquiry_date, interested_session, notes } = req.body;
  const { data, error } = await supabase
    .from('prospects')
    .insert({ center_id, first_name, last_name, email, phone, inquiry_date, interested_session, notes, status: 'new' })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });

  await addLog(data.id, 'inquiry_received', `Inquiry logged for ${first_name} ${last_name}`);
  res.status(201).json(data);
});

// PUT update — auto-convert to student when status becomes 'enrolling'
router.put('/:id', async (req, res) => {
  const { center_id, first_name, last_name, email, phone, interested_session, notes, status } = req.body;

  const { data: current, error: fetchErr } = await supabase
    .from('prospects').select('*').eq('id', req.params.id).single();
  if (fetchErr) return res.status(404).json({ error: 'Not found' });

  let student_id = current.student_id;
  let converted = false;

  // Auto-convert to student if changing to 'enrolling' and not yet converted
  if (status === 'enrolling' && !student_id) {
    const { data: student, error: sErr } = await supabase
      .from('students')
      .insert({ first_name, last_name, status: 'enrolling' })
      .select().single();
    if (sErr) return res.status(400).json({ error: 'Failed to create student: ' + sErr.message });
    student_id = student.id;
    converted = true;
  }

  const { data, error } = await supabase
    .from('prospects')
    .update({ center_id, first_name, last_name, email, phone, interested_session, notes, status, student_id })
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(400).json({ error: error.message });

  // Auto-log status change
  if (status !== current.status) {
    await addLog(data.id, 'status_changed', null, current.status, status);

    // Sync student status if a linked student exists
    if (student_id) {
      const studentStatusMap = {
        touring:   'touring',
        enrolling: 'enrolling',
        enrolled:  'active',
        lost:      'withdrawn',
      };
      const newStudentStatus = studentStatusMap[status];
      if (newStudentStatus) {
        await supabase.from('students')
          .update({ status: newStudentStatus })
          .eq('id', student_id);
      }
    }
  }

  // Auto-log student conversion
  if (converted) {
    await addLog(data.id, 'converted_to_student', `Student record created (ID #${student_id})`);
  }

  res.json({ ...data, converted, student_id });
});

// DELETE
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('prospects').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
