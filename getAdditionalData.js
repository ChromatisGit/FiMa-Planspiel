const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
import { convertJSONtoCSV, readJsonFile } from './fileManager.js';
import { toNumber } from './dataTransformer.js';

function findAttribute($, key) {
    const targetRow = $(`td:contains("${key}")`);

    if (targetRow.length === 0) {
        throw new Error(`Couldn't find attribute ${key}`)
    }

    return targetRow.first().next().text().trim();
}

async function getAdditionalData(anleihe) {
    let body;

    try {
        const response = await fetch(anleihe.link);
        if (!response.ok) {
            console.error('Error:', response.status);
            throw new Error(`HTTP Error: ${response.status}`);
        }
        body = await response.text();
    } catch (error) {
        console.error(`Network error connecting to ${anleihe.name} (${anleihe.link}), skipping!`, error);
        return null
    }

    anleihe.ignorieren = false
    if (body.includes('Die Anleihe ist nicht mehr aktiv.')) {
        anleihe.ignorieren = true
        console.error(`${anleihe.name} (${anleihe.link}) is inactive, ignoring!`);
        return anleihe;
    }

    try {
        const $ = cheerio.load(body);
        anleihe.stueckelung = toNumber(findAttribute($, "Stückelung"));
        anleihe.coupon = toNumber(findAttribute($, "Kupon in %")) / 100;
        anleihe.anzahlZinstermine = toNumber(findAttribute($, "Zinstermine pro Jahr"));
        anleihe.land = findAttribute($, "Land")
        anleihe.faelligkeit = findAttribute($, "Fälligkeit").replaceAll('.', '-');
        anleihe.zinstermin = findAttribute($, "nächster Zinstermin").replaceAll('.', '-');
    } catch (error) {
        anleihe.ignorieren = true;
        console.error(`Couldn't process ${anleihe.name} (${anleihe.link}), ignoring!\n${error}`);
    }

    return anleihe;
}

async function updateStorage({ input, storage, branchenPath, missingBranchenPath, storagePath }) {
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