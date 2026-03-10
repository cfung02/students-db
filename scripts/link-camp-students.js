require('dotenv').config();
const XLSX     = require('xlsx');
const supabase = require('../db');

async function run() {
  // Load camp Excel data
  const wb       = XLSX.readFile('./data_files/Camp 2026_ Camper Database.xlsx');
  const ws       = wb.Sheets['Campers'];
  const rows     = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const dataRows = rows.slice(4).filter(r => r[1] && r[2]);

  const campMap = {};
  dataRows.forEach(r => {
    const key = (String(r[1]).trim() + '|' + String(r[2]).trim()).toLowerCase();
    campMap[key] = {
      group_name: r[7] ? String(r[7]).trim() : null,
      new_group:  r[8] ? String(r[8]).trim() : null,
    };
  });

  // Get orphaned students (no enrollment)
  const { data: allStudents } = await supabase.from('students').select('id, first_name, last_name');
  const { data: enrolled }    = await supabase.from('enrollments').select('student_id');
  const enrolledIds = new Set(enrolled.map(e => e.student_id));
  const orphans = allStudents.filter(s => !enrolledIds.has(s.id));
  console.log('Orphaned students:', orphans.length);

  const enrollments = orphans.map(s => {
    const key = (s.first_name + '|' + s.last_name).toLowerCase();
    const info = campMap[key] || {};
    return {
      student_id: s.id,
      center_id:  1,
      session:    'summer',
      year:       2026,
      group_name: info.group_name || null,
      new_group:  info.new_group  || null,
    };
  });

  console.log('Sample:', enrollments.slice(0, 3));

  const { error } = await supabase.from('enrollments').insert(enrollments);
  if (error) console.error('Error:', error.message);
  else console.log('Done — linked', enrollments.length, 'Camp students to center_id=1');
}

run().catch(console.error);
