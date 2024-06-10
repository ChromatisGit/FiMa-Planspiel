const { parse } = require('date-fns');
const fs = require('fs').promises;
const { calcLetzterZinstermin } = require('./dataTransformer.js');
const { appendEntryToCSV, readJsonFromSheet, convertJSONtoCSV } = require('./fileManager.js');
const { getDollarWechselkurse } = require('./requestManager.js');

async function updateZinszahlungen({startDatum, endDatum}) {
    const outputPath = 'generated/zinszahlungen.csv';
    const sheetPath = 'FiMa.xlsx'

    //Recreate csv file from sheet
    let zinszahlungen = await readJsonFromSheet(sheetPath, 'Zinszahlungen Anleihen', 1, 11);
    const keyNames = ['Datum', 'Art', 'Unternehmensname', 'Wechselkurs', 'Währung', 'Anteile', 'Stückelung', 'Coupon', 'Zinszahlungen pro Jahr', 'ISIN']
    fs.writeFile(outputPath, convertJSONtoCSV(zinszahlungen, keyNames))

    let table = await readJsonFromSheet(sheetPath, 'Anleihen(ver)käufe', 1, 19)
    table = table.filter((row) => {
        return row['Im Besitz']
    })

    const newZinszahlungen = [];

    const dollarWechselkurse = await getDollarWechselkurse(startDatum, endDatum)

    for (const row of table) {
        const letzteZinszahlung = parse(calcLetzterZinstermin(row['Zinszahlungen pro Jahr'], row['Letzter Zinstermin'], endDatum), 'dd-MM-yyyy', new Date())
        if(letzteZinszahlung < startDatum) {
            continue;
        }

        row['Art'] = 'Zinsen';
        row['Datum'] = letzteZinszahlung;
        row['Wechselkurs'] = 1;

        if (row['Währung'] === 'USD') {
            row['Wechselkurs'] = (dollarWechselkurse).find( entry => {
                return row['Datum'] >= entry.date
            }).kurs;
        };

        newZinszahlungen.push(row);
    }

    newZinszahlungen.sort((a, b) => a.Datum - b.Datum)

    for(row of newZinszahlungen) {
        await appendEntryToCSV(outputPath, row, keyNames);
    }

    console.log('Zinszahlungen erfolgreich aktualisiert!')
}

module.exports = {
    updateZinszahlungen
};