require('dotenv').config();
const XLSX = require('xlsx');
const supabase = require('../db');

const FILE_PATH = './data_files/Camp 2026_ Camper Database.xlsx';
const SHEET_NAME = 'Campers';
const HEADER_ROW_INDEX = 3; // 0-based, row 4 in Excel

// Convert Excel date serial number to ISO date string (YYYY-MM-DD)
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  const date = new Date(utc_days * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

async function run() {
  const wb = XLSX.readFile(FILE_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const headers = rows[HEADER_ROW_INDEX];
  const dataRows = rows.slice(HEADER_ROW_INDEX + 1);

  const colIndex = {
    enrolled_date: headers.indexOf('Enrolled Date'),
    first_name:    headers.indexOf('First Name'),
    last_name:     headers.indexOf('Last Name'),
    birthday:      headers.indexOf('Birthday'),
    shirt_size:    headers.indexOf('Shirt'),
  };

  console.log('Column mapping:', colIndex);

  const students = dataRows
    .filter(row => row[colIndex.first_name] && row[colIndex.last_name])
    .map(row => ({
      first_name:    String(row[colIndex.first_name]).trim(),
      last_name:     String(row[colIndex.last_name]).trim(),
      birthday:      excelDateToISO(row[colIndex.birthday]),
      shirt_size:    row[colIndex.shirt_size] ? String(row[colIndex.shirt_size]).trim() : null,
      enrolled_date: excelDateToISO(row[colIndex.enrolled_date]),
      status:        'active',
    }));

  console.log(`Found ${students.length} students to import.`);
  if (students.length === 0) {
    console.log('Nothing to import. Exiting.');
    process.exit(0);
  }

  // Preview first 3 records
  console.log('\nPreview (first 3):');
  students.slice(0, 3).forEach(s => console.log(JSON.stringify(s)));

  // Insert in batches of 100
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const batch = students.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('students').insert(batch);
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${batch.length} records`);
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Errors: ${errors}`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
