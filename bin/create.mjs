import fs from 'fs';
import path from 'path';

var dir = path.resolve(process.cwd(), 'src', 'json');

if (fs.existsSync(dir)) {
    console.log('Dir exists.')
    process.exit(0);
}

try {
    fs.mkdirSync(dir);
    console.log('Created dir');
    process.exit(0);
} catch(e) {
    console.error(e);
    process.exit(1);
}