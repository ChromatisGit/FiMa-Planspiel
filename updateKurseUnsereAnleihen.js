const fs = require('fs').promises;
const { isSameDay, format } = require('date-fns');
const { appendEntryToCSV, readJsonFromSheet, readJsonFile } = require('./fileManager.js');
const { calcLetzterZinstermin } = require('./dataTransformer.js');
const { getAktuellenKurs, getDollarWechselkurse } = require('./requestManager.js');

async function updateKurseUnsereAnleihen(date) {
    const outputPath = 'data/unsereAnleihen.csv';
    const bufferPath = 'data/kurseAnleihenBuffer.json';

    let buffer = await readJsonFile(bufferPath);
    if(!buffer || !isSameDay(new Date(buffer.date), date)) {
        const usd = await getDollarWechselkurse(date);
        buffer = {
            date: format(date, "yyyy-MM-dd"),
            usd: usd[0].kurs,
            kurse: {}
        }
    }

    let table = await readJsonFromSheet('FiMa.xlsx', 'Anleihen(ver)käufe', 1, 19)
    table = table.filter((row) => {
        return row['Im Besitz']
    })

    const keyNames = ['Unternehmensname', 'Branche des Hauptkonzern', 'Coupon', 'Aktueller Kurs', 'Dirty Kaufpreis', 'Kaufkurs', 'Wechselkurs am Kauftag', 'Aktueller Wechselkurs', 'Währung', 'Kaufdatum', 'Anteile', 'Stückelung', 'Letzte Zinszahlung', 'Zinszahlungen pro Jahr', 'Stückzinsen', 'Land', 'Börse', 'ISIN', 'Quelle']

    fs.writeFile(outputPath, keyNames.join(',')+ '\n')

    let processedCount = 1;
    for (const row of table) {
        if(buffer.kurse[row['ISIN']]) {
            row['Aktueller Kurs'] = buffer.kurse[row['ISIN']];
        }
        else {
            row['Aktueller Kurs'] = isSameDay(date, row['Kaufdatum'])? row['Kaufkurs'] : await getAktuellenKurs({anleihe: row, date});
            buffer.kurse[row['ISIN']] = row['Aktueller Kurs'];
        }

        row['Letzte Zinszahlung'] = calcLetzterZinstermin(row['Zinszahlungen pro Jahr'], row['Letzter Zinstermin'], date);
        row['Aktueller Wechselkurs'] = row['Währung'] === 'EUR' ? 1 : buffer.usd;

        appendEntryToCSV(outputPath, row, keyNames)

        console.log(`Processed entry ${processedCount++}`);
    }

    fs.writeFile(bufferPath, JSON.stringify(buffer, null, 2))
}

module.exports = {
    updateKurseUnsereAnleihen
};