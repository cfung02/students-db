require('dotenv').config();
const supabase = require('./db');

async function migrate() {
  const { data, error } = await supabase.from('students').select('id').limit(1);
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  console.log('Connection OK: students table is ready.');
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
