const fs = require('fs');
const csv = require('csv-parser');
const { parse } = require('date-fns');
const { convertJSONtoCSV, readJsonFile } = require('./fileManager.js');
const { getAdditionalData } = require('./requestManager.js');


async function updateStorage({ input, storage, branchenPath, missingBranchenPath, storagePath }) {
    const endOfProject = new Date(2024,6,12)
    const missingBranchen = [];
    const branchen = await readJsonFile(branchenPath)
    let updatedStorage = false;

    let processedAnleihenCount = 1;
    const totalAnleihenCount = input.length
    for (let anleihe of input) {
        console.clear();
        console.log(`Fortschritt: ${processedAnleihenCount++}/${totalAnleihenCount}`);

        if (storage.hasOwnProperty(anleihe.id)) {
            continue;
        }

        if (!branchen.hasOwnProperty(anleihe.name)) {
            if (!missingBranchen.some((a) => a.name === anleihe.name)) {
                missingBranchen.push(anleihe)
            }
            continue;
        }

        anleihe.branche = branchen[anleihe.name];
        if (anleihe.branche === 'Insolvent') {
            anleihe.ignorieren = true
            storage[anleihe.id] = anleihe;
            updatedStorage = true;
            continue;
        }

        anleihe = await getAdditionalData(anleihe);
        if (anleihe === null) {
            continue;
        }

        if (anleihe.faelligkeit && parse(anleihe.faelligkeit, 'dd-MM-yyyy', new Date()) < endOfProject ) {
            anleihe.ignorieren = true
            storage[anleihe.id] = anleihe;
            updatedStorage = true;
            continue;
        }

        storage[anleihe.id] = anleihe;
        updatedStorage = true;
    }

    if(updatedStorage) {
        fs.promises.writeFile(storagePath, JSON.stringify(storage, null, 2));
    }

    if (missingBranchen.length > 0) {
        fs.promises.writeFile(missingBranchenPath, convertJSONtoCSV(missingBranchen, ['name', 'link', 'branche']))
    }
    return missingBranchen.length;
}

async function updateAnleihenData() {
    const inputPath = 'generated/fetchedAnleihen.json';
    const outputPath = 'generated/fetchedAnleihenWithData.json';
    const storagePath = 'storage/anleihenDaten.json';
    const branchenPath = 'storage/branchen.json';
    const missingBranchenPath = 'branchen.csv';

    if(fs.existsSync(missingBranchenPath)) {
        const branchen = readJsonFile(branchenPath);

        await new Promise((resolve, reject) => {
            fs.createReadStream(missingBranchenPath)
                .pipe(csv())
                .on('data', (row) => {
                    if (row.name && row.branche) {
                        if (!branchen[row.name]) {
                            branchen[row.name] = row.branche;
                        }
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        await fs.promises.writeFile(branchenPath, JSON.stringify(branchen, null, 4));
        await fs.promises.unlink(missingBranchenPath);
    }

    const [input, storage] = await Promise.all([
        readJsonFile(inputPath),
        readJsonFile(storagePath)
    ]);

    const brachenlos = await updateStorage({ input, storage, branchenPath, missingBranchenPath, storagePath });

    const output = input
        .map(anleihe => storage[anleihe.id])
        .filter(anleihe => anleihe)
        .filter(anleihe => !anleihe.ignorieren);

    fs.promises.writeFile(outputPath, JSON.stringify(output, undefined, 2));

    return brachenlos;
}

module.exports = {
    updateAnleihenData
};