import fs from 'node:fs';

async function main() {
  const allFound = {};

  for (let g = 1; g <= 12; g++) {
    const urlsToTry = [
      `/index.php/text-books/grade-${g}`,
      `/index.php/text-books/grade${g}`,
      `/index.php/text-books/kutaa-${g}`,
      `/index.php/text-books/kutaa${g}`,
    ];

    allFound[`Grade ${g}`] = [];

    for (const path of urlsToTry) {
      try {
        const url = `http://213.55.101.25${path}`;
        const res = await fetch(url);
        if (res.status === 200) {
          const html = await res.text();
          const pdfs = [...html.matchAll(/href=["']([^"']+\.pdf[^"']*)["']/gi)].map(m => m[1]);
          if (pdfs.length > 0) {
            console.log(`Found ${pdfs.length} PDFs at ${path}`);
            allFound[`Grade ${g}`].push(...pdfs);
          }
        }
      } catch (e) {
        // ignore
      }
    }
    // Deduplicate
    allFound[`Grade ${g}`] = [...new Set(allFound[`Grade ${g}`])];
  }

  console.log('\n--- Summary ---');
  for (const [grade, pdfs] of Object.entries(allFound)) {
    console.log(`${grade}: ${pdfs.length} books`);
    pdfs.forEach(p => console.log(`   ${p}`));
  }

  fs.writeFileSync('var/scratch/bbo_grades_1_12.json', JSON.stringify(allFound, null, 2));
}

main().catch(console.error);
