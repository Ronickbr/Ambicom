import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '../src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(srcDir);
let changedFiles = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;

    // Replace background colors
    content = content.replace(/\bbg-neutral-900\/([0-9]+)\b/g, 'bg-card/$1');
    content = content.replace(/\bbg-neutral-800\/([0-9]+)\b/g, 'bg-card/$1');
    content = content.replace(/\bbg-black\/([0-9]+)\b/g, 'bg-background/$1');

    // Gradients
    content = content.replace(/\bfrom-neutral-900\/([0-9]+)\b/g, 'from-card/$1');
    content = content.replace(/\bvia-neutral-900\/([0-9]+)\b/g, 'via-card/$1');
    content = content.replace(/\bto-black\/([0-9]+)\b/g, 'to-background/$1');

    // Also remove bg-neutral-900 without opacity
    content = content.replace(/\bbg-neutral-900\b(?![-/])/g, 'bg-card');

    // Specific case in page.tsx where glass-card also has bg-card. glass-card provides its own bg
    // But bg-card/40 is fine as an override.

    if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        changedFiles++;
        console.log(`Updated ${file}`);
    }
}

console.log(`\nMigration 2 complete. Updated ${changedFiles} files.`);
