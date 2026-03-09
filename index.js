require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/centers',   require('./routes/centers'));
app.use('/api/prospects', require('./routes/prospects'));
app.use('/api/prospects/:prospectId/logs', require('./routes/prospect_logs'));
app.use('/api/students',  require('./routes/students'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
