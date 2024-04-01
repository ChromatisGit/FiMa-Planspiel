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

async function findBestBoerse(url) {
    const prefixLength = 'https://www.finanzen.net/anleihen/'.length;
    const link = 'https://www.finanzen.net/anleihen/boersenplaetze/' + url.slice(prefixLength)

    const response = await fetch(link);
    const body = await response.text();
    const $ = cheerio.load(body);

    const boersenKurse = []

    const targetTable = $(`th:contains("Börse")`);
    targetTable.closest('thead').next().find('tr').each((_, row) => {
        const kurs = toNumber($(row).find('td:eq(1)').text().trim().slice(0, -2));
        const aufrufDatum = parse($(row).find('td:eq(7)').text().trim(), 'dd.MM.yyyy', new Date());
        const boerse = $(row).find('td:first a').text().trim()
        boersenKurse.push({ kurs, aufrufDatum, boerse })
    })

    let datumLimit = new Date(Math.max(...boersenKurse.map(e => e.aufrufDatum)))
    datumLimit.setDate(datumLimit.getDate() - 1)

    const bestBoerse = boersenKurse
        .filter(e => e.aufrufDatum >= datumLimit)
        .filter(e => e.kurs > 0)
        .reduce((minObj, obj) => {
            return obj.kurs < minObj.kurs ? obj : minObj;
        }, { kurs: Infinity });

    return bestBoerse;
}

function getLetztenZinstermin(naechsterTermin, anzahlTermine) {
    const termin = parse(naechsterTermin, 'dd-MM-yyyy', new Date());

    let month = termin.getMonth();
    month -= 12 / anzahlTermine;
    // Monate gehen von 0-11
    if (month < 0) {
        termin.setFullYear(termin.getFullYear() - 1);
        month += 12;
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
    const { kurs, boerse } = await findBestBoerse(anleihe.link)
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
    const currentAnleihenPath = path.join(__dirname, 'data/aktuelleAnleihen.json');
    const unsereAnleihenPath = path.join(__dirname, 'data/unsereAnleihen.json');
    const neueAnleihenCSVPath = path.join(__dirname, 'data/neueAnleihen.csv');

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