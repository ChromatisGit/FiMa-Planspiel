const fs = require('fs');
const csv = require('csv-parser');
const { parse, differenceInDays } = require('date-fns');
const { convertJSONtoCSV } = require('./fileManager.js');
const { toNumber } = require('./dataTransformer.js');

function couponRendite(e, today) {
    const coupon = toNumber(e.Coupon);
    const kaufkurs = toNumber(e.Kaufkurs);
    const dauer = differenceInDays(today, parse(e["Letzter Zinstermin"],'dd-MM-yyyy', new Date()))
    const stueckzinsen = coupon * dauer / 365
    const rendite = coupon / (kaufkurs + stueckzinsen)
    return rendite;
}

const records = {};
const today = new Date()
const path = 'data/neueAnleihen.csv'

fs.createReadStream(path)
    .pipe(csv({ delimiter: ',' }))
    .on('data', (data) => {
        const name = data.Unternehmensname;
        if (!records[name] || couponRendite(data, today) > couponRendite(records[name], today)) {
            records[name] = data;
        }
    })
    .on('end', () => {
        const csv = convertJSONtoCSV(Object.values(records), ['Kaufdatum', 'Unternehmensname', 'Branche des Hauptkonzern', 'Anteile', 'Stückelung', 'Kaufkurs', 'Coupon', 'Zinszahlungen pro Jahr', 'Letzter Zinstermin', 'Land', 'Börse', 'ISIN', 'Quelle', 'Kaufbar', 'Bereits Gekauft', 'Fälligkeit'])
        fs.promises.writeFile(path, csv)
    });