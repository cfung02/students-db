const express    = require('express');
const router     = express.Router();
const nodemailer = require('nodemailer');
const supabase   = require('../db');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// POST send email
router.post('/send', async (req, res) => {
  const { to, subject, body, prospect_id, follow_up_number } = req.body;
  if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject, and body are required.' });

  try {
    await transporter.sendMail({
      from: `Daycare Management <${process.env.EMAIL_USER}>`,
      to, subject, text: body,
    });

    // Auto-log the email if prospect_id provided
    if (prospect_id) {
      const labels = {
        followup1: '1st Follow-up Email',
        followup2: '2nd Follow-up Email',
        called:    'After-Call Email',
        toured:    'After-Tour Email',
      };
      const label = labels[follow_up_number] || 'Email';
      await supabase.from('prospect_logs').insert({
        prospect_id,
        action: 'emailed',
        note: `${label} sent to ${to} — Subject: "${subject}"`,
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
