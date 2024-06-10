const { readJsonFile, readJsonFromSheet, appendEntryToCSV } = require('./fileManager.js');
const { calcLetzterZinstermin } = require('./dataTransformer.js');
const { getBoersen, getDollarWechselkurse } = require('./requestManager.js');
const { removeDuplicatesFromAnleihen } = require('./removeDuplicatesFromAnleihen.js');
const { parse } = require('date-fns');
const fs = require('fs').promises;
const MIN_KURS = 20

async function findBestBoerse(url, date) {
    let boersenKurse;
    try {
    boersenKurse = await getBoersen(url)
    }
    catch {
        return { kurs: undefined, boerse: undefined};
    }

    const datumLimit = new Date(date)
    datumLimit.setDate(datumLimit.getDate() - 7)

    const bestBoerse = boersenKurse
        .filter(e => e.aufrufDatum >= datumLimit)
        .filter(e => e.kurs > 0)
        .reduce((minObj, obj) => {
            return obj.kurs < minObj.kurs ? obj : minObj;
        }, { boerse: undefined, kurs: Infinity });

    return bestBoerse;
}

async function updateKurseFromAnleihen() {
    const inputPath = 'generated/fetchedAnleihenWithData.json';
    const outputPath = 'generated/neueAnleihen.csv';
    const sheetPath = 'FiMa.xlsx'

    const investiertesKapital = 2000
    const today = new Date()

    const input = await readJsonFile(inputPath);
    const usd = await getDollarWechselkurse(today);
    const wechselkurse = {
        "EUR": 1,
        "USD": usd[0].kurs
    }

    let currentAnleihen = await readJsonFromSheet(sheetPath, 'Anleihen(ver)käufe', 1, 19)
    currentAnleihen = currentAnleihen.filter((row) => {
        return row['Im Besitz']
    })

    const columnNames = ['Kaufdatum', 'Unternehmensname', 'Branche des Hauptkonzern', 'Anteile', 'Stückelung', 'Kaufkurs', 'Coupon', 'Wechselkurs am Kauftag', 'Währung', 'Zinszahlungen pro Jahr', 'Letzter Zinstermin', 'Land', 'Börse', 'ISIN', 'Quelle', 'Kaufbar']
    const keyNames = ['kaufdatum', 'name', 'branche', 'anteile', 'stueckelung', 'kurs', 'coupon', 'wechselkurs', 'waehrung', 'anzahlZinstermine', 'zinstermin', 'land', 'boerse', 'id', 'link', 'kaufbar']
    fs.writeFile(outputPath, columnNames.join(',') + '\n')

    let processedAnleihenCount = 1;
    let successfulAnleihenCount = 0;
    const totalAnleihenCount = input.length
    for (const anleihe of input) {
        console.clear();
        console.log(`Fortschritt: ${processedAnleihenCount++}/${totalAnleihenCount}`);
        const gekaufteAnleihe = currentAnleihen.find(a => a.Unternehmensname === anleihe.name)
        if (gekaufteAnleihe !== undefined) {
            continue;
        }

        const { kurs, boerse } = await findBestBoerse(anleihe.link, today)

        if (boerse === undefined) {
            continue;
        }

        if (kurs <= MIN_KURS) {
            continue;
        }

        anleihe.kurs = kurs / 100;
        anleihe.boerse = boerse;
        anleihe.kaufdatum = today
        anleihe.kaufbar = true
        anleihe.zinstermin = calcLetzterZinstermin(anleihe.anzahlZinstermine, parse(anleihe.zinstermin, 'dd-MM-yyyy', new Date()), today);
        anleihe.anteile = Math.ceil(investiertesKapital / anleihe.stueckelung)
        anleihe.wechselkurs = wechselkurse[anleihe.waehrung];

        appendEntryToCSV(outputPath, anleihe, keyNames);
    }

    console.log(`\n${successfulAnleihenCount} neue Anleihen gefunden!`)

    removeDuplicatesFromAnleihen();
}

module.exports = {
    updateKurseFromAnleihen
};