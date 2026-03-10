require('dotenv').config();
const express = require('express');
const path    = require('path');
const cron    = require('node-cron');
const sendWeeklyProspectSummary = require('./jobs/weeklyProspectSummary');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/centers',   require('./routes/centers'));
app.use('/api/prospects', require('./routes/prospects'));
app.use('/api/prospects/:prospectId/logs', require('./routes/prospect_logs'));
app.use('/api/students',  require('./routes/students'));
app.use('/api/email',     require('./routes/email'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Weekly prospect summary — every Monday at 8:00 AM
  cron.schedule('0 8 * * 1', sendWeeklyProspectSummary, {
    timezone: 'America/New_York'
  });
  console.log('[Cron] Weekly prospect summary scheduled — Mondays at 8:00 AM ET');
});
