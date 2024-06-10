const fs = require('fs').promises;
const { isSameDay, format } = require('date-fns');
const { appendEntryToCSV, readJsonFromSheet, readJsonFile } = require('./fileManager.js');
const { calcLetzterZinstermin } = require('./dataTransformer.js');
const { getAktuellenKurs, getDollarWechselkurse } = require('./requestManager.js');

async function updateKurseUnsereAnleihen(date) {
    const outputPath = 'generated/unsereAnleihen.csv';
    const bufferPath = 'generated/kurseAnleihenBuffer.json';

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

    let processedAnleihenCount = 1;
    const totalAnleihenCount = table.length
    const failedAnleihen = [];
    for (const row of table) {
        if (buffer.kurse[row['ISIN']]) {
            row['Aktueller Kurs'] = buffer.kurse[row['ISIN']];
        } else if (isSameDay(date, row['Kaufdatum'])) {
            row['Aktueller Kurs'] = row['Kaufkurs'];
        } else {
            const fetchedKurs = await getAktuellenKurs({ anleihe: row, date });
            if (fetchedKurs.kurs !== undefined) {
                row['Aktueller Kurs'] = fetchedKurs.kurs;
            } else {
                failedAnleihen.push(fetchedKurs.message);
                row['Aktueller Kurs'] = null;
            }
            buffer.kurse[row['ISIN']] = row['Aktueller Kurs'];
        }

        row['Letzte Zinszahlung'] = calcLetzterZinstermin(row['Zinszahlungen pro Jahr'], row['Letzter Zinstermin'], date);
        row['Aktueller Wechselkurs'] = row['Währung'] === 'EUR' ? 1 : buffer.usd;

        appendEntryToCSV(outputPath, row, keyNames);

        console.clear();
        console.log(`Fortschritt: ${processedAnleihenCount++}/${totalAnleihenCount}`);
    }

    if (failedAnleihen.length !== 0) {
        console.log(`\n${failedAnleihen.length} fehlende Kurse`)
        failedAnleihen.forEach((msg) => console.log(msg))
    }

    fs.writeFile(bufferPath, JSON.stringify(buffer, null, 2))
}

module.exports = {
    updateKurseUnsereAnleihen
};