import fs from 'node:fs';

const path = 'C:\\Users\\abebe\\.gemini\\antigravity-ide\\brain\\4f983177-d887-4d51-957b-51d02748009f\\.system_generated\\steps\\593\\content.md';
const content = fs.readFileSync(path, 'utf8');

const regex = /<a href="textbook-detail\.php\?slug=([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
const books = [];
let match;
while ((match = regex.exec(content)) !== null) {
  const slug = match[1];
  const block = match[2];
  
  // Extract title
  const titleMatch = block.match(/alt="([^"]+)"/) || block.match(/<h6[^>]*>([^<]+)<\/h6>/);
  const title = titleMatch ? titleMatch[1].trim() : slug;
  
  // Extract grade
  const gradeMatch = block.match(/Grade\s*(\d+)/i) || block.match(/G(\d+)/i) || slug.match(/grade-(\d+)/i);
  const grade = gradeMatch ? parseInt(gradeMatch[1]) : null;

  // Extract subject
  const subMatch = block.match(/<span class="text-emerald[^>]*>([^<]+)<\/span>/);
  const subject = subMatch ? subMatch[1].trim() : null;

  books.push({ slug, title, grade, subject });
}

console.log(`Parsed ${books.length} books:`);
books.forEach((b, idx) => {
  console.log(`${idx + 1}. [Grade ${b.grade ?? '?'}] [${b.subject ?? 'General'}] ${b.title} (slug: ${b.slug})`);
});

fs.writeFileSync('var/scratch/ethiopiatemari_books.json', JSON.stringify(books, null, 2));
