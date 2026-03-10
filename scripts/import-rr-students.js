require('dotenv').config();
const XLSX     = require('xlsx');
const supabase = require('../db');

const FILE_PATH      = './data_files/RR school database 2025-26.xlsx';
const SHEET_NAME     = '2025';
const HEADER_ROW_IDX = 3; // 0-based (row 4 in Excel)
const CENTER_ID      = 2;

function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000).toISOString().split('T')[0];
}

async function run() {
  const wb      = XLSX.readFile(FILE_PATH);
  const ws      = wb.Sheets[SHEET_NAME];
  const rows    = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headers = rows[HEADER_ROW_IDX].map(h => (h ? String(h).trim() : ''));
  const dataRows = rows.slice(HEADER_ROW_IDX + 1);

  const col = {
    first_name:    headers.indexOf('First Name'),
    last_name:     headers.indexOf('Last Name'),
    birthday:      headers.indexOf('Birthday'),
    shirt_size:    headers.indexOf('Shirt Size'),
    enrolled_date: headers.indexOf('Enrolled Date'),
    group_name:    headers.indexOf('Group'),
    start_date:    headers.indexOf('Start Date'),
    end_date:      headers.indexOf('End Date'),
    mon:           headers.indexOf('M'),
    tue:           headers.indexOf('T'),
    wed:           headers.indexOf('W'),
    thu:           headers.indexOf('TH'),
    fri:           headers.indexOf('F'),
  };

  console.log('Column mapping:', col);

  const validRows = dataRows.filter(r => r[col.first_name] && r[col.last_name]);
  console.log(`Found ${validRows.length} students to import.`);
  if (!validRows.length) { console.log('Nothing to import.'); process.exit(0); }

  console.log('\nPreview (first 3):');
  validRows.slice(0, 3).forEach(r => console.log(
    String(r[col.first_name]).trim(), String(r[col.last_name]).trim(),
    excelDateToISO(r[col.birthday]), r[col.group_name]
  ));

  let inserted = 0, errors = 0;
  const BATCH = 50;

  for (let i = 0; i < validRows.length; i += BATCH) {
    const batch = validRows.slice(i, i + BATCH);

    // 1. Insert students
    const studentRecords = batch.map(r => ({
      first_name:    String(r[col.first_name]).trim(),
      last_name:     String(r[col.last_name]).trim(),
      birthday:      excelDateToISO(r[col.birthday]),
      shirt_size:    r[col.shirt_size] ? String(r[col.shirt_size]).trim() : null,
      enrolled_date: excelDateToISO(r[col.enrolled_date]),
      status:        'active',
    }));

    const { data: students, error: sErr } = await supabase
      .from('students').insert(studentRecords).select('id');
    if (sErr) { console.error('Student insert error:', sErr.message); errors += batch.length; continue; }

    // 2. Insert enrollments
    const enrollmentRecords = students.map((s, idx) => {
      const r = batch[idx];
      return {
        student_id: s.id,
        center_id:  CENTER_ID,
        session:    'summer',
        year:       2025,
        group_name: r[col.group_name] ? String(r[col.group_name]).trim() : null,
        start_date: excelDateToISO(r[col.start_date]),
        end_date:   excelDateToISO(r[col.end_date]),
      };
    });

    const { error: eErr } = await supabase.from('enrollments').insert(enrollmentRecords);
    if (eErr) console.error('Enrollment insert error:', eErr.message);

    // 3. Insert schedules
    const scheduleRecords = [];
    const { data: enrollments } = await supabase
      .from('enrollments').select('id').eq('center_id', CENTER_ID)
      .in('student_id', students.map(s => s.id));

    if (enrollments) {
      enrollments.forEach((enr, idx) => {
        const r = batch[idx];
        scheduleRecords.push({
          enrollment_id:  enr.id,
          effective_date: excelDateToISO(r[col.start_date]) || '2025-06-30',
          mon: !!r[col.mon],
          tue: !!r[col.tue],
          wed: !!r[col.wed],
          thu: !!r[col.thu],
          fri: !!r[col.fri],
        });
      });
      if (scheduleRecords.length) {
        const { error: scErr } = await supabase.from('schedules').insert(scheduleRecords);
        if (scErr) console.error('Schedule insert error:', scErr.message);
      }
    }

    inserted += batch.length;
    console.log(`Batch ${Math.floor(i/BATCH)+1}: inserted ${batch.length} students`);
  }

  console.log(`\nDone. Inserted: ${inserted}, Errors: ${errors}`);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
