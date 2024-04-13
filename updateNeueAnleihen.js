const { fetchDataWithRetry } = require('./fetchManager.js');
const { readJsonFile, readJsonFromSheet, appendEntryToCSV } = require('./fileManager.js');
const { calcLetzterZinstermin, toNumber } = require('./dataTransformer.js');
const { parse } = require('date-fns');
const fs = require('fs').promises;
const cheerio = require('cheerio');

async function findBestBoerse(url, date) {
    const prefixLength = 'https://www.finanzen.net/anleihen/'.length;
    const link = 'https://www.finanzen.net/anleihen/boersenplaetze/' + url.slice(prefixLength)

    const body = await fetchDataWithRetry(link);
    const $ = cheerio.load(body);

    const boersenKurse = []

    const targetTable = $(`th:contains("Börse")`);
    targetTable.closest('thead').next().find('tr').each((_, row) => {
        const kurs = toNumber($(row).find('td:eq(1)').text().trim().slice(0, -2));
        const aufrufDatum = parse($(row).find('td:eq(7)').text().trim(), 'dd.MM.yyyy', new Date());
        const boerse = $(row).find('td:first a').text().trim()
        boersenKurse.push({ kurs, aufrufDatum, boerse })
    })

    const datumLimit = new Date(date)
    datumLimit.setDate(datumLimit.getDate() - 3)

    const bestBoerse = boersenKurse
        .filter(e => e.aufrufDatum >= datumLimit)
        .filter(e => e.kurs > 0)
        .reduce((minObj, obj) => {
            return obj.kurs < minObj.kurs ? obj : minObj;
        }, { boerse: undefined, kurs: Infinity });

    return bestBoerse;
}

async function processAnleihen() {
    const inputPath = 'data/fetchedAnleihenWithData.json';
    const outputPath = 'data/neueAnleihen.csv';
    const wechselkursePath = 'data/currentWechselkurse.json';
    const sheetPath = 'FiMa.xlsx'

    const investiertesKapital = 2000
    const today = new Date()

    const input = await readJsonFile(inputPath);
    const wechselkurse = await readJsonFile(wechselkursePath);

    let currentAnleihen = await readJsonFromSheet(sheetPath, 'Anleihenkäufe', 1, 16)
    currentAnleihen = currentAnleihen.filter((row) => {
        return row['Im Besitz']
    })

    const columnNames = ['Kaufdatum', 'Unternehmensname', 'Branche des Hauptkonzern', 'Anteile', 'Stückelung', 'Kaufkurs', 'Coupon', 'Wechselkurs am Kauftag', 'Währung', 'Zinszahlungen pro Jahr', 'Letzter Zinstermin', 'Land', 'Börse', 'ISIN', 'Quelle', 'Kaufbar', 'Bereits Gekauft']
    const keyNames = ['kaufdatum', 'name', 'branche', 'anteile', 'stueckelung', 'kurs', 'coupon', 'wechselkurs', 'waehrung', 'anzahlZinstermine', 'zinstermin', 'land', 'boerse', 'id', 'link', 'kaufbar', 'bereitsGekauft']
    fs.writeFile(outputPath, columnNames.join(',') + '\n')

    let processedCount = 1;

    for (const anleihe of input) {
        const { kurs, boerse } = await findBestBoerse(anleihe.link, today)

        if (boerse === undefined) {
            console.log(`Derzeit keine aktiven Trades für ${anleihe.name} (${anleihe.link})`)
            continue;
        }

        anleihe.kurs = kurs / 100;
        anleihe.boerse = boerse;
        anleihe.kaufdatum = today
        anleihe.kaufbar = true
        anleihe.zinstermin = calcLetzterZinstermin(anleihe.anzahlZinstermine, parse(anleihe.zinstermin, 'dd-MM-yyyy', new Date()), today);
        anleihe.anteile = Math.ceil(investiertesKapital / anleihe.stueckelung)
        anleihe.wechselkurs = wechselkurse[anleihe.waehrung];

        const gekaufteAnleihe = currentAnleihen.find(a => a.Unternehmensname === anleihe.name)


        if (gekaufteAnleihe === undefined) {
            console.log(`Neue Anleihe gefunden. ${processedCount}`);
            processedCount++;
            appendEntryToCSV(outputPath, anleihe, keyNames)
            continue;
        }

        if (gekaufteAnleihe['Börse'] !== anleihe.boerse) {
            anleihe.bereitsGekauft = true;
            console.log(`Bessere Börse für Anleihe gefunden. ${processedCount}`);
            processedCount++;
        }
    }
}

processAnleihen()