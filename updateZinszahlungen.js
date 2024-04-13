const { parse } = require('date-fns');
const { calcLetzterZinstermin } = require('./dataTransformer.js');
const { appendEntryToCSV, readJsonFromSheet } = require('./fileManager.js');

async function getZinszahlungen({startDate, endDate}) {
    const outputPath = 'data/zinszahlungen.csv';

    let table = await readJsonFromSheet('FiMa.xlsx', 'Anleihenkäufe', 1, 19)
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
        if(row['Währung'] === 'EUR') {
            row['Wechselkurs'] = 1;
            newZinszahlungen.push(row);
            continue;
        }
        row['Wechselkurs'] = 0;
        newZinszahlungen.push(row);
        // TODO Wechselkurs für den Tag raussuchen
    }

    newZinszahlungen.sort((a, b) => a.Datum - b.Datum)

    for(row of newZinszahlungen) {
        await appendEntryToCSV(outputPath, row, keyNames);
    }
}

getZinszahlungen({
    startDate: new Date(2024,2,28),
    endDate: new Date(2024,3,13)
})