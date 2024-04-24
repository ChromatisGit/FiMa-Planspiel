const fs = require('fs').promises;
const { isSameDay } = require('date-fns');
const { appendEntryToCSV, readJsonFromSheet, readJsonFile } = require('./fileManager.js');
const { calcLetzterZinstermin } = require('./dataTransformer.js');
const { getAktuellenKurs } = require('./requestManager.js');

async function updateKurseUnsereAnleihen(date) {
    const appendFile = false;
    const wechselkursePath = 'data/currentWechselkurse.json';
    const outputPath = 'data/unsereAnleihen.csv';

    const wechselkurse = await readJsonFile(wechselkursePath);

    let table = await readJsonFromSheet('FiMa.xlsx', 'Anleihenkäufe', 1, 19)
    table = table.filter((row) => {
        return row['Im Besitz']
    })

    const keyNames = ['Unternehmensname', 'Branche des Hauptkonzern', 'Coupon', 'Aktueller Kurs', 'Dirty Kaufpreis', 'Kaufkurs', 'Wechselkurs am Kauftag', 'Aktueller Wechselkurs', 'Währung', 'Kaufdatum', 'Anteile', 'Stückelung', 'Letzte Zinszahlung', 'Zinszahlungen pro Jahr', 'Stückzinsen', 'ISIN', 'Quelle']

    let rowCount = 0;
    if (appendFile) {
        fs.createReadStream(outputPath)
            .pipe(csv())
            .on('data', (row) => {
                rowCount++;
            })
    }
    else {
        fs.writeFile(outputPath, keyNames.join(',')+ '\n')
    }

    let processedCount = 1;

    for (const row of table) {
        if (rowCount > 0) {
            rowCount--;
            continue;
        }

        if (isSameDay(date, row['Kaufdatum'])) {
            row['Aktueller Kurs'] = row['Kaufkurs'];
        }
        else {
            row['Aktueller Kurs'] = await getAktuellenKurs({anleihe: row, date});
        }
        row['Letzte Zinszahlung'] = calcLetzterZinstermin(row['Zinszahlungen pro Jahr'], row['Letzter Zinstermin'], date);

        row['Aktueller Wechselkurs'] = wechselkurse[row['Währung']]

        appendEntryToCSV(outputPath, row, keyNames)

        console.log(`Processed entry ${processedCount}`);
        processedCount++;
    }
}

module.exports = {
    updateKurseUnsereAnleihen
};