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

    // Handle primary and destructive buttons first
    content = content.replace(/bg-primary([^"']*)text-white/g, 'bg-primary$1text-primary-foreground');
    content = content.replace(/text-white([^"']*)bg-primary/g, 'text-primary-foreground$1bg-primary');

    content = content.replace(/bg-destructive([^"']*)text-white/g, 'bg-destructive$1text-destructive-foreground');
    content = content.replace(/text-white([^"']*)bg-destructive/g, 'text-destructive-foreground$1bg-destructive');

    // Handle generic cases
    content = content.replace(/\btext-white\b/g, 'text-foreground');
    content = content.replace(/\btext-white\/([0-9]+)\b/g, 'text-foreground/$1');

    content = content.replace(/\bbg-white\/([0-9]+)\b/g, 'bg-foreground/$1');

    // Convert borders to use the semantic border color
    content = content.replace(/\bborder-white\/([0-9]+)\b/g, (match, p1) => {
        // Multiply by 2 for border to keep similar visual weight but with border color
        const op = Math.min(100, parseInt(p1) * 2);
        return `border-border/${op}`;
    });

    content = content.replace(/\bbg-neutral-900\/50\b/g, 'bg-card/50');
    content = content.replace(/\bbg-black\/40\b/g, 'bg-card/40');
    content = content.replace(/\bbg-\[\#050505\]\b/g, 'bg-background');

    if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        changedFiles++;
        console.log(`Updated ${file}`);
    }
}

console.log(`\nMigration complete. Updated ${changedFiles} files.`);
