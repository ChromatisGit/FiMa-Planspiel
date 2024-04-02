const ExcelJS = require('exceljs');
const fs = require('fs');
const cheerio = require('cheerio');
const { format } = require('date-fns');

function toNumber(n) {
    return parseFloat(n.replace(',', '.'))
}

async function fetchDataWithRetry(url, options, retries = 0) {
    try {
        const response = await fetch(url, options);

        if (response.ok) {
            return await response.text();
        } else if (response.status === 403 && retries < maxRetries) {
            console.error('Access Denied. Retrying...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            return fetchDataWithRetry(url, options, retries + 1);
        } else {
            console.error('Error:', response.status);
            throw new Error(`HTTP Error: ${response.status}`);
        }
    } catch (error) {
        console.error('Network error:', error);
        throw error;
    }
}

async function readJsonFromSheet(filePath, sheetName, startColumn, endColumn) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found.`);
    }

    const jsonData = [];

    worksheet.eachRow({ includeEmpty: false }, (row) => {
        const rowData = {};
        for (let i = startColumn; i <= endColumn; i++) {
            const cell = row.getCell(i);
            const header = worksheet.getRow(1).getCell(i).value;
            rowData[header] = cell.value.result ?? cell.value.text ?? cell.value; //If it's a formula or a hyperlink, filter the value out
        }
        jsonData.push(rowData);
    });
    jsonData.shift()

    return jsonData;
}

function calcLetzterZinstermin(zinszahlungenProJahr, ersteZinszahlung, heute) {
    var monateSeitZinszahlung = (heute.getFullYear() - ersteZinszahlung.getFullYear()) * 12;
    monateSeitZinszahlung += heute.getMonth() - ersteZinszahlung.getMonth();
    monateSeitZinszahlung += (heute.getDate() >= ersteZinszahlung.getDate()) ? 0 : -1;

    var anzahlZinszahlungen = Math.floor(monateSeitZinszahlung / (12 / zinszahlungenProJahr));

    var letzteZinszahlung = new Date(ersteZinszahlung);
    letzteZinszahlung.setMonth(letzteZinszahlung.getMonth() + Math.floor(anzahlZinszahlungen * (12 / zinszahlungenProJahr)));

    return {anzahlZinszahlungen, letzteZinszahlung};
}

function convertJSONtoCSV(obj, keys) {
    const csvRows = obj.map((item) => {
        return keys.map(key => {
            let field = item[key];
            if (typeof field === 'number') {
                field = field.toString().replace('.', ','); // Replace decimal period with decimal comma because Excel sucks and ignores regional settings
            }
            if (field instanceof Date) {
                field = format(field, 'dd-MM-yyyy')
            }
            if (typeof field === 'string' && field.includes(',')) {
                field = `"${field}"`; // Enclose fields containing commas in quotes
            }
            return field;
        }).join(',');
    });

    const csv = [keys.join(','), ...csvRows].join('\n');
    return csv;
}

const BoersenCodeMap = {
    'Berlin': 'BER',
    'Düsseldorf': 'DUS',
    'Frankfurt': 'FSE',
    'Hamburg': 'HAM',
    'Hannover': 'HAN',
    'Lang & Schwarz': 'L&S',
    'München': 'MUN',
    'Stuttgart': 'STU',
    'Tradegate': 'TGT',
    'Baader Bank': 'BAE',
    'Gettex': 'BMN',
    'Ste Generale': 'SCGP',
    'Wien': 'WIEN',
    'Quotrix': 'XQTX'
}

async function getAktuellenKurs(anleihe, date) {
    const currDate = new Date(date)
    const prefixLength = 'https://www.finanzen.net/anleihen/'.length;
    const suffixLength = '-anleihe'.length;
    const id = anleihe['Quelle'].slice(prefixLength, -suffixLength)
    const code = BoersenCodeMap[anleihe['Börse']];
    const to = format(currDate, "yyyy-MM-dd")
    currDate.setDate(currDate.getDate()-7)
    const from = format(currDate, "yyyy-MM-dd")
    const url = `https://www.finanzen.net/Ajax/BondController_HistoricPriceList/${id}/${code}/${from}_${to}`


    const body = await fetchDataWithRetry(url, { method: 'POST' });
    const $ = cheerio.load(body);

    if ($('p').first().text() === 'Keine Daten verfügbar') {
        console.log(`Couldn't find any data for ${anleihe['Unternehmensname']} on ${date} for ${anleihe['Börse']}.`)
        console.log($.html())
        return null
    }

    return toNumber($('td').eq(2).text().trim()) / 100
}

async function getUnsereAnleihen() {
    const today = new Date()

    let table = await readJsonFromSheet('FiMa.xlsx', 'Anleihenkäufe', 1, 16)
    table = table.filter((row) => {
        return row['Im Besitz']
    })

    let processedCount = 1;

    for (const row of table) {
        if (today === new Date(row['Kaufdatum'])) {
            row['Aktueller Kurs'] = row['Kaufkurs'];
        }
        else {
            row['Aktueller Kurs'] = await getAktuellenKurs(row, today);
        }
        const {anzahlZinszahlungen, letzteZinszahlung} = calcLetzterZinstermin(row['Zinszahlungen pro Jahr'], row['Letzter Zinstermin'], today);
        row['Letzte Zinszahlung'] = letzteZinszahlung
        row['Anzahl Zinszahlungen'] = anzahlZinszahlungen
        console.log(`Processed entry ${processedCount}`);
        processedCount++;
    }

    const csv = convertJSONtoCSV(table, ['Unternehmensname', 'Branche des Hauptkonzern', 'Coupon', 'Aktueller Kurs', ' ', 'Kaufpreis', 'Kaufkurs', 'Kaufdatum', 'Anteile', 'Stückelung','Letzte Zinszahlung', 'Anzahl Zinszahlungen'])
    fs.writeFile('data/unsereAnleihen.csv', csv, (err) => {
        if (err) {
            console.error('Error writing file:', err);
        } else {
            console.log('File written successfully.');
        }
    })
}

getUnsereAnleihen()

