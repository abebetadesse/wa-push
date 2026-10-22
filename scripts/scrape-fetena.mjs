import fs from 'node:fs';

async function main() {
  const res = await fetch('https://fetena.net', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();
  fs.mkdirSync('var/scratch', { recursive: true });
  fs.writeFileSync('var/scratch/fetena_home.html', html);

  const links = [...html.matchAll(/href=["']([^"']+)["']/g)].map(m => m[1]);
  console.log('Total links found:', links.length);
  const relevant = links.filter(l => /textbook|grade|book|curriculum|download/i.test(l));
  console.log('Relevant links:', relevant);
}

main().catch(console.error);
