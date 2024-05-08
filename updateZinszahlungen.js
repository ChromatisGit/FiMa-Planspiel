const { parse } = require('date-fns');
const { calcLetzterZinstermin } = require('./dataTransformer.js');
const { appendEntryToCSV, readJsonFromSheet, readJsonFile } = require('./fileManager.js');

async function updateZinszahlungen({startDate, endDate}) {
    const outputPath = 'data/zinszahlungen.csv';
    const wechselkursePath = 'data/currentWechselkurse.json';
    const wechselkurse = await readJsonFile(wechselkursePath);

    let table = await readJsonFromSheet('FiMa.xlsx', 'Anleihen(ver)käufe', 1, 19)
    table = table.filter((row) => {
        return row['Im Besitz']
    })

    const keyNames = ['Datum', 'Art', 'Unternehmensname', 'Wechselkurs', 'Währung', 'Anteile', 'Stückelung', 'Coupon', 'Zinszahlungen pro Jahr', 'ISIN']
    const newZinszahlungen = [];

    for (const row of table) {
        const letzteZinszahlung = parse(calcLetzterZinstermin(row['Zinszahlungen pro Jahr'], row['Letzter Zinstermin'], endDate), 'dd-MM-yyyy', new Date())
        if(letzteZinszahlung < startDate) {
            continue;
        }

        row['Art'] = 'Zinsen'

        row['Datum'] = letzteZinszahlung
        row['Wechselkurs'] = wechselkurse[row['Währung']];
        newZinszahlungen.push(row);
    }

    newZinszahlungen.sort((a, b) => a.Datum - b.Datum)

    for(row of newZinszahlungen) {
        await appendEntryToCSV(outputPath, row, keyNames);
    }
}

module.exports = {
    updateZinszahlungen
};