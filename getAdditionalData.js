const fs = require('fs').promises;
const { parse } = require('date-fns');
const path = require('path');
const { convertJSONtoCSV, readJsonFile } = require('./fileManager.js');
const { getAdditionalData } = require('./requestManager.js');


async function updateStorage({ input, storage, branchenPath, missingBranchenPath, storagePath }) {
    const endOfProject = new Date(2024,7,1)
    const missingBranchen = [];
    const branchen = await readJsonFile(branchenPath)
    let updatedStorage = false;
    let entryCount = 0;

    for (let anleihe of input) {
        entryCount++;
        if (storage.hasOwnProperty(anleihe.id)) {
            console.log(`${entryCount} is in storage!`)
            continue;
        }

        if (!branchen.hasOwnProperty(anleihe.name)) {
            if (!missingBranchen.some((a) => a.name === anleihe.name)) {
                missingBranchen.push(anleihe)
            }
            console.log(`${entryCount} is missing it's branche!`)
            continue;
        }

        anleihe.branche = branchen[anleihe.name];
        if (anleihe.branche === 'Insolvent') {
            anleihe.ignorieren = true
            storage[anleihe.id] = anleihe;
            updatedStorage = true;
            console.log(`${entryCount} has been added to storage!`)
            continue;
        }

        anleihe = await getAdditionalData(anleihe);
        if (anleihe === null) {
            continue;
        }

        if (parse(anleihe.faelligkeit, 'dd-MM-yyyy', new Date()) < endOfProject ) {
            anleihe.ignorieren = true
            storage[anleihe.id] = anleihe;
            updatedStorage = true;
            console.log(`${entryCount} has been added to storage!`)
            continue;
        }

        storage[anleihe.id] = anleihe;
        updatedStorage = true;
        console.log(`${entryCount} has been added to storage!`)
    }

    if(updatedStorage) {
        console.log(storagePath)
        fs.writeFile(storagePath, JSON.stringify(storage, null, 2));
    }

    if (missingBranchen.length > 0) {
        fs.writeFile(missingBranchenPath, convertJSONtoCSV(missingBranchen, ['name', 'link']))
        console.log(`${missingBranchen.length} Anleihen ohne Branche gefunden!`)
    }
}

async function processAnleihen() {
    const inputPath = path.join(__dirname, 'data/fetchedAnleihen.json');
    const outputPath = path.join(__dirname, 'data/fetchedAnleihenWithData.json');
    const storagePath = path.join(__dirname, 'data/storage/anleihenDaten.json');
    const branchenPath = path.join(__dirname, 'data/storage/branchen.json');
    const missingBranchenPath = path.join(__dirname, 'branchenlos.csv');

    const [input, storage] = await Promise.all([
        readJsonFile(inputPath),
        readJsonFile(storagePath)
    ]);

    await updateStorage({ input, storage, branchenPath, missingBranchenPath, storagePath });

    const output = input
        .map(anleihe => storage[anleihe.id])
        .filter(anleihe => anleihe)
        .filter(anleihe => !anleihe.ignorieren);

    fs.writeFile(outputPath, JSON.stringify(output, undefined, 2));
}

processAnleihen()