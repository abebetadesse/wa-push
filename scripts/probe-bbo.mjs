import fs from 'node:fs';

const gradeFolders = [
  'grade1', 'g1', 'kutaa1',
  'grade2', 'g2', 'kutaa2',
  'grade3', 'g3', 'kutaa3',
  'grade4', 'g4', 'kutaa4',
  'grade5', 'g5', 'kutaa5',
  'grade6', 'g6', 'kutaa6',
  'grade7', 'g7', 'kutaa7',
  'grade8', 'g8', 'kutaa8',
  'grade9', 'g9', 'kutaa9',
  'grade10', 'g10', 'kutaa10',
  'grade11', 'g11', 'kutaa11',
  'grade12', 'g12', 'kutaa12',
];

const subjects = [
  'English', 'Maths', 'Mathematics', 'HERREGA', 'Science', 'Saayinsii', 'General_Science',
  'Social_Studies', 'Hawaasa', 'Biology', 'Chemistry', 'Physics', 'Geography', 'History',
  'Economics', 'IT', 'ICT', 'Information_Technology', 'Civics', 'Citizenship', 'FJQ',
  'Amharic', 'AMARIC', 'Afaan_Amaahara', 'Afan_Oromo', 'PVA', 'Og-Aartiiwwan', 'HPE'
];

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.status === 200) {
      const length = res.headers.get('content-length');
      const type = res.headers.get('content-type');
      return { ok: true, status: res.status, length, type };
    }
  } catch (e) {}
  return { ok: false };
}

async function main() {
  console.log('Testing common textbook URL patterns...');
  const found = [];

  for (const folder of gradeFolders) {
    for (const sub of subjects) {
      const variations = [
        `http://213.55.101.25/images/new_book/${folder}/${sub}.pdf`,
        `http://213.55.101.25/images/new_book/${folder}/${sub}_compressed.pdf`,
        `http://213.55.101.25/images/new_book/${folder}/${sub}_Compressed.pdf`,
        `http://213.55.101.25/images/new_book/${folder}/am/${sub}.pdf`,
        `http://213.55.101.25/images/new_book/${folder}/am/${sub}_compressed.pdf`,
      ];
      for (const u of variations) {
        const res = await checkUrl(u);
        if (res.ok) {
          console.log(`FOUND: ${u} (${res.length} bytes, ${res.type})`);
          found.push({ url: u, length: res.length });
        }
      }
    }
  }
  console.log(`Total probed found: ${found.length}`);
}

main().catch(console.error);
