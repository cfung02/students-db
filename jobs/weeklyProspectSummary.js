const nodemailer = require('nodemailer');
const supabase   = require('../db');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendWeeklyProspectSummary() {
  console.log('[Weekly Job] Running prospect summary...');

  const { data: prospects, error } = await supabase
    .from('prospects')
    .select('*, centers(name)')
    .in('status', ['new', 'contacted', 'touring'])
    .order('inquiry_date', { ascending: true });

  if (error) {
    console.error('[Weekly Job] Failed to fetch prospects:', error.message);
    return;
  }

  if (!prospects.length) {
    console.log('[Weekly Job] No outstanding prospects. Skipping email.');
    return;
  }

  // Group by status
  const groups = { new: [], contacted: [], touring: [] };
  prospects.forEach(p => groups[p.status]?.push(p));

  const formatDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const daysSince  = d => d ? Math.floor((new Date() - new Date(d)) / 86400000) : '—';

  const buildSection = (title, list) => {
    if (!list.length) return '';
    const rows = list.map(p =>
      `  • ${p.first_name} ${p.last_name} | ${p.email || 'No email'} | ${p.phone || 'No phone'} | ${p.centers?.name || '—'} | Inquired: ${formatDate(p.inquiry_date)} (${daysSince(p.inquiry_date)} days ago)`
    ).join('\n');
    return `\n${title} (${list.length})\n${'─'.repeat(50)}\n${rows}\n`;
  };

  const today    = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const emailBody =
`Weekly Prospect Summary — ${today}

Total outstanding: ${prospects.length} prospect(s) need follow-up.
${buildSection('🆕 NEW — Not yet contacted', groups.new)}
${buildSection('📞 CONTACTED — Awaiting response', groups.contacted)}
${buildSection('🏫 TOURING — Tour scheduled or completed', groups.touring)}
─────────────────────────────────────────────────
This is an automated weekly summary from your Daycare Management system.
Log in to follow up: http://localhost:${process.env.PORT || 3000}/prospects.html
`;

  try {
    await transporter.sendMail({
      from:    `Daycare Management <${process.env.EMAIL_USER}>`,
      to:      process.env.ADMIN_EMAIL,
      subject: `Weekly Prospect Summary — ${prospects.length} outstanding (${today})`,
      text:    emailBody,
    });
    console.log(`[Weekly Job] Summary sent to ${process.env.ADMIN_EMAIL}`);
  } catch (err) {
    console.error('[Weekly Job] Failed to send email:', err.message);
  }
}

module.exports = sendWeeklyProspectSummary;
