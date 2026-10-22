import fs from 'node:fs';

async function main() {
  for (const g of [2, 4, 6, 7, 8]) {
    const res = await fetch(`http://213.55.101.25/index.php/text-books/grade-${g}`);
    const html = await res.text();
    console.log(`\nGrade ${g} (status ${res.status}, len ${html.length})`);
    fs.writeFileSync(`var/scratch/grade_${g}.html`, html);

    const allHrefs = [...html.matchAll(/href=["']([^"']+)["']/g)].map(m => m[1]);
    const pdfs = allHrefs.filter(h => h.toLowerCase().includes('.pdf'));
    console.log(`Grade ${g} pdfs:`, pdfs);

    const downloads = allHrefs.filter(h => /dropfiles|download|file|new_book/i.test(h));
    console.log(`Grade ${g} download/file links:`, downloads.slice(0, 10));
  }
}

main().catch(console.error);
