import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import {
    CARDS_ENDPOINT,
    getSetIdArray
} from '@nickgdev/larvitar-types';

dotenv.config();

var pathToJsonDir = path.resolve(process.cwd(), 'src', 'json-data');

class PokemonTCGAPINetworkError extends Error {
    constructor({ setName }) {
        super(`NetworkException: pulling of set ${setName} failed.`);
    }
}

function doesDirectoryExist(){
    return fs.existsSync(pathToJsonDir);
}

function cleanJsonDirectory(){
    console.log('Starting `cleanDirectory()` operation...');
    try {
       fs.rmSync(pathToJsonDir, { force: true, recursive: true }); 
       console.log('Operation `cleanDirectory` successful.');
    } catch (e) {
        console.log('Operation failed.');
        throw e;
    }
}

function makeJsonDirectory(){
    try {
        console.log('Starting operation `makeJsonDirectory`...');
        fs.mkdirSync(pathToJsonDir);
        console.log('Operation successful.')
    } catch (e) {
        console.log('Operation `makeJsonDirectory` failed.');
        throw e;
    }
}

function standardizeFileName(str) {
    return str.toLowerCase().replace(/[\s\.]/g, '-') + '.json';
}

async function collect () {
    /** 1. Iterate through each set meta data object { name, id } */
    for (const setMeta of getSetIdArray()) {
        /** 2. Create a write stream to a new file utilizing the set name */
        const fileWriteStream = fs.createWriteStream(
            path.join(pathToJsonDir, standardizeFileName(setMeta.name)),
            { encoding: 'utf-8', emitClose: true }
        );

        /** 3. Ahead is code that may throw an error */
        try {
            /** 4. Create the cards endpoint using setId query string */
            const url = CARDS_ENDPOINT + `?q=set.id:${setMeta.setId}`;
            /** 5. Set up api key to rake the pokemon tcg api */
            const headers = {
                'X-Api-Key': process.env.POKEMON_TCG_API_KEY ?? '',
                'Accept': 'application/json'
            };
            /** 6. fetch the first page of cards for the given set */
            const { data, status } = await axios.get(url, { headers });
            /** 7. If the response contains an Error|Exception,
             * throw a PokemonTCGAPINetworkError
             * and move onto the next set
             */
            if (status !== 200) {
                fileWriteStream.close(() => console.error('WriteStream closed due to an exception being thrown.'));
                throw new PokemonTCGAPINetworkError({ setName: setMeta.name });
            }
            /** 8. deconstruct the tcg api response */
            const { data: cardArray, page, count, totalCount } = data;
            /** 9. If there are multiple pages in the card set */
            if (count < totalCount) {
                /** 10. Add the card data from the portion of the set you have acess to */
                let collectedCards = [...cardArray];
    
                /** 11. Set up variables to be used in while loop for continuous page fetching */
                
                let currentCount = count;
                let nextPage = page + 1;

                /** 12. while currentCount is less than the total */
                while (currentCount < totalCount) {
                    /** 12.1 fetch the next page */
                    const { data: nextCardSetData, status } = await axios.get(CARDS_ENDPOINT + `?q=set.id:${setMeta.setId}&page=${nextPage}`);
                    /** 12.2 throw an error if the axios response contains an exception */
                    if (status !== 200) {
                        fileWriteStream.close(() => console.error('WriteStream closed due to an exception being thrown.'));
                        throw new PokemonTCGAPINetworkError({ setName: setMeta.name });
                    }
                    /** 12.3 dec */
                    const { data: nextCardArray, count: nextCount } = nextCardSetData;
                    collectedCards = [...collectedCards, ...nextCardArray];
                    nextPage++;
                    currentCount = currentCount + nextCount;
                }
                const writeData = {
                    set: { ...setMeta },
                    cards: collectedCards
                };
                fileWriteStream.write(JSON.stringify(writeData), (err) => {
                    if (err) {
                        fileWriteStream.close(() => console.error('WriteStream closed due to an exception being thrown.'));
                        console.error(err.message);
                        throw err;
                    }
                    console.log(`Wrote ${setMeta.name} successfully.`);
                })
                fileWriteStream.close(() => console.log(`File ${standardizeFileName(setMeta.name)}.json written. Stream closed w closure code 0;`));
            } else {
                /** single page comprises full set of cards */
                const writeData = {
                    set: { ...setMeta },
                    cards: cardArray
                };
                fileWriteStream.write(JSON.stringify(writeData), (err) => {
                    if (err) {
                        fileWriteStream.close(() => console.error('WriteStream closed due to an exception being thrown.'));
                        console.error(err.message);
                        throw err;
                    }
                    console.log(`Wrote ${setMeta.name} successfully.`);
                })
                fileWriteStream.close(() => console.log(`File ${standardizeFileName(setMeta.name)}.json written. Stream closed w closure code 0;`));
            }
        } catch (e) {
            fileWriteStream.close(() => console.error('WriteStream closed due to an exception being thrown.'));
            const errStream = fs.createWriteStream(path.resolve(process.cwd(), standardizeFileName(setMeta.name) + '-load-script-error.log'));
            errStream.write(JSON.stringify(e));
            errStream.close();
        }
    }
}

async function run () {
    try {
        if (doesDirectoryExist()) {
            cleanJsonDirectory();
        }
        makeJsonDirectory();
        await collect();
    } catch (e) {
        console.error(e.message);
        throw e;
    }
}

await run();