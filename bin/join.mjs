import fs from 'fs';
import path from 'path';

var dirPath = path.resolve(process.cwd(), 'src', 'json-data');

function dirExists(){
    return fs.existsSync(dirPath);
}

function getFileList(){
    return fs.readdirSync(dirPath);
}

function join(){
    if (!dirExists) return;
    const fileList = getFileList();
    let mlist = [];
    for (const file of fileList) {
        const jsonString = fs.readFileSync(path.join(dirPath, file), { encoding: 'utf-8' });
        const jsonData = JSON.parse(jsonString);
        mlist.push(...jsonData.cards);
    };
    const outPath = path.resolve(process.cwd(), 'src', 'json-data', '_mlist.json');
    if (fs.existsSync(outPath)) {
        fs.rmSync(outPath);
    }
    const writeData = { pokemon_trading_card_game: mlist };
    fs.writeFileSync(outPath, JSON.stringify(writeData));
}

join();