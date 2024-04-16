const { readJsonFile, readJsonFromSheet, appendEntryToCSV } = require('./fileManager.js');
const { calcLetzterZinstermin } = require('./dataTransformer.js');
const { getBoersen } = require('./requestManager.js');
const { parse } = require('date-fns');
const fs = require('fs').promises;

async function findBestBoerse(url, date) {
    const boersenKurse = await getBoersen(url)

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