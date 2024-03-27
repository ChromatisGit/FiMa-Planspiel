const cheerio = require('cheerio');
const { parse, format, differenceInDays } = require('date-fns');
const fs = require('fs');
const path = require('path');


function findAttribute($, key) {
    const targetRow = $(`td:contains("${key}")`);

    if (targetRow.length === 0) {
        throw new Error(`Couldn't find attribute ${key}`)
    }

    return targetRow.first().next().text().trim();
}

function toNumber(n) {
    return parseFloat(n.replace(',', '.'))
}

function findBestBoerse($) {
    let boerseName = "";
    let bestKurs = 10000;

    const targetTable = $(`th:contains("Börse")`);
    targetTable.closest('thead').next().find('tr').each((_, row) => {
        const kurs = toNumber($(row).find('td:eq(1)').text().trim().slice(0, -2));
        if (kurs >= bestKurs || kurs === 0) {
            return true
        }
        bestKurs = kurs
        boerseName = $(row).find('td:first a').text().trim();
    })

    return { kurs: bestKurs, boerse: boerseName }
}

function getLetztenZinstermin(naechsterTermin, anzahlTermine) {
    const termin = parse(naechsterTermin, 'dd-MM-yyyy', new Date());

    let month = termin.getMonth();
    month -= 12 / anzahlTermine;
    // Monate gehen von 0-11
    if (month < 0) {
        termin.setFullYear(termin.getFullYear() - 1);
        month += 11;
    }
    termin.setMonth(month);
    const letzterZinstermin = format(termin, 'dd-MM-yyyy')

    const today = new Date();
    const tageBisTermin = differenceInDays(today, termin);
    return { letzterZinstermin, tageBisTermin }
}


async function getAdditionalData(anleihe) {
    const response = await fetch(anleihe.link);
    const body = await response.text();
    const $ = cheerio.load(body);


    anleihe.stueckelung = toNumber(findAttribute($, "Stückelung"));
    anleihe.coupon = toNumber(findAttribute($, "Kupon in %")) / 100;
    anleihe.anzahlZinstermine = toNumber(findAttribute($, "Zinstermine pro Jahr"));
    anleihe.land = findAttribute($, "Land")
    anleihe.faelligkeit = findAttribute($, "Fälligkeit").replaceAll('.', '-');
    const { kurs, boerse } = findBestBoerse($)
    anleihe.kurs = kurs / 100;
    anleihe.boerse = boerse;

    const naechsterTermin = findAttribute($, "nächster Zinstermin").replaceAll('.', '-');
    const { letzterZinstermin, tageBisTermin } = getLetztenZinstermin(naechsterTermin, anleihe.anzahlZinstermine);
    anleihe.letzterZinstermin = letzterZinstermin;
    anleihe.kaufpreis = (anleihe.kurs * anleihe.stueckelung + anleihe.coupon * anleihe.stueckelung * tageBisTermin / 365).toFixed(6);
    anleihe.couponRendite = (anleihe.coupon * anleihe.stueckelung / anleihe.kaufpreis).toFixed(6);

    return anleihe;
}

async function readJsonFile(filePath) {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading file from disk: ${error}`);
        throw error;
    }
}

async function appendEntryToCSV(filePath, entry) {
    try {
        let csvRow = Object.values(entry).map(value => {
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',') + '\n';
        await fs.promises.appendFile(filePath, csvRow, 'utf8');
    } catch (error) {
        console.error(`Error appending to CSV file: ${error}`);
        throw error;
    }
}

async function processAnleihen() {
    let skipCount = 0;
    const currentAnleihenPath = path.join(__dirname, 'aktuelleAnleihen.json');
    const unsereAnleihenPath = path.join(__dirname, 'unsereAnleihen.json');
    const neueAnleihenCSVPath = path.join(__dirname, 'neueAnleihen.csv');

    const [aktuelleAnleihen, unsereAnleihen] = await Promise.all([
        readJsonFile(currentAnleihenPath),
        readJsonFile(unsereAnleihenPath)
    ]);

    if (!fs.existsSync(neueAnleihenCSVPath) || fs.statSync(neueAnleihenCSVPath) === 0) {
        const updatedAnleihe = await getAdditionalData(aktuelleAnleihen[0]);
        const csvContent = Object.keys(updatedAnleihe).join(',') + '\n';
        await fs.promises.appendFile(neueAnleihenCSVPath, csvContent, 'utf8');
    }

    let processedCount = skipCount;
    for (const anleihe of aktuelleAnleihen) {
        if (skipCount > 0) {
            skipCount--;
            continue;
        }
        if (unsereAnleihen.some((uAnleihe) => uAnleihe.id === anleihe.id)) {
            continue;
        }

        try {
            const updatedAnleihe = await getAdditionalData(anleihe);
            await appendEntryToCSV(neueAnleihenCSVPath, updatedAnleihe);
        } catch (error) {
            console.error(`Couldn't process ${anleihe.name} (${anleihe.link}), skipping!\n${error}`);
        }

        processedCount++;
        console.log(`Processed entry ${processedCount}`);
    }

    console.log('Processing completed.');
}

processAnleihen();