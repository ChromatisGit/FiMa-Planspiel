const cheerio = require('cheerio');
const { format, parse } = require('date-fns');
const { toNumber } = require('./dataTransformer.js');

async function fetchDataWithRetry(url, options, retries = 0) {
    const maxRetries = 3;
    try {
        const response = await fetch(url, options);

        if (response.ok) {
            return await response.text();
        } else if (response.status === 403 && retries < maxRetries) {
            console.error('Access Denied. Retrying in a minute...');
            await new Promise(resolve => setTimeout(resolve, 60000));
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
    'gettex': 'BMN',
    'Ste Generale': 'SCGP',
    'Wien': 'WIEN',
    'Quotrix': 'XQTX',
    'BNP Zuerich': 'PAR',
    'Amsterdam': 'ASX',
    'ZKB': 'ZKK'
}

async function getAktuellenKurs({anleihe, date}) {
    const currDate = new Date(date)
    const prefixLength = 'https://www.finanzen.net/anleihen/'.length;
    const suffixLength = '-anleihe'.length;
    const id = anleihe['Quelle'].slice(prefixLength, -suffixLength);
    const code = BoersenCodeMap[anleihe['Börse']];
    const to = format(currDate, "yyyy-MM-dd");
    currDate.setDate(currDate.getDate() - 7);
    const from = format(currDate, "yyyy-MM-dd");
    const url = `https://www.finanzen.net/Ajax/BondController_HistoricPriceList/${id}/${code}/${from}_${to}`;

    await new Promise(resolve => setTimeout(resolve, 500))
    const body = await fetchDataWithRetry(url, { method: 'POST' });
    const $ = cheerio.load(body);

    if ($('p').first().text() === 'Keine Daten verfügbar') {
        console.log(`Couldn't find any data for ${anleihe['Unternehmensname']} for ${anleihe['Börse']}.`);
        console.log(url);
        console.log($.html());
        return null;
    }

    return toNumber($('td').eq(2).text().trim()) / 100;
}

async function getBoersen(link) {
    const prefixLength = 'https://www.finanzen.net/anleihen/'.length;
    const url = 'https://www.finanzen.net/anleihen/boersenplaetze/' + link.slice(prefixLength);

    const body = await fetchDataWithRetry(url);
    const $ = cheerio.load(body);

    const boersenKurse = [];

    const targetTable = $(`th:contains("Börse")`);
    targetTable.closest('thead').next().find('tr').each((_, row) => {
        const kurs = toNumber($(row).find('td:eq(1)').text().trim().slice(0, -2));
        const aufrufDatum = parse($(row).find('td:eq(7)').text().trim(), 'dd.MM.yyyy', new Date());
        const boerse = $(row).find('td:first a').text().trim();
        boersenKurse.push({ kurs, aufrufDatum, boerse });
    });

    return boersenKurse;
}

async function getNeueAnleihen({min_zins, currency}) {
    const url = `https://www.finanzen.net/anleihen/suche?anwi=&abti=&aw=${currency}%2C&arendv=&arendb=&arlv=&arlb=&arlfv=&arlfb=&absti=&aemvv=&aemvb=&aei=&al=&alion=&anr=a&arv=&arb=&arak=a&arad=a&aboe=al&anmk=j&astkv=&astkb=5000&aakv=&aakb=&aums=&aspd=&anem=n&akv=${min_zins}&akb=&akt=&aszv=&aszb=&azfv=&azfb=&adv=&adb=&amdv=&amdb=&s=1&pkSortT=8&pkSortR=2`
    const anleihen = []
    let page = 1;

    while (true) {
        const response = await fetch(`${url}&p=${page}`);
        const body = await response.text();
        const $ = cheerio.load(body);
        console.log(`Loaded Page ${page}`);

        const tableRows = $('main > section > article > div > table > tbody > tr');

        if (tableRows.length === 0) {
            break;
        }

        tableRows.each((_, row) => {
            const anleihe = {};
            const firstTd = $(row).find('td:first');
            anleihe.name = firstTd.find('div:first').text().trim();
            anleihe.id = firstTd.find('div:eq(1) a').text().trim();
            anleihe.link = `https://www.finanzen.net${firstTd.find('div:eq(1) a').attr('href')}`;
            anleihe.waehrung = currency;
            anleihen.push(anleihe)
        })
        page++;
    }

    return anleihen;
}

function findAttribute($, key) {
    const targetRow = $(`td:contains("${key}")`);
    if (targetRow.length === 0) {
        throw new Error(`Couldn't find attribute ${key}`)
    }
    return targetRow.first().next().text().trim();
}

async function getAdditionalData(anleihe) {
    let body;

    try {
        const response = await fetch(anleihe.link);
        if (!response.ok) {
            console.error('Error:', response.status);
            throw new Error(`HTTP Error: ${response.status}`);
        }
        body = await response.text();
    } catch (error) {
        console.error(`Network error connecting to ${anleihe.name} (${anleihe.link}), skipping!`, error);
        return null
    }

    anleihe.ignorieren = false
    if (body.includes('Die Anleihe ist nicht mehr aktiv.')) {
        anleihe.ignorieren = true
        console.error(`${anleihe.name} (${anleihe.link}) is inactive, ignoring!`);
        return anleihe;
    }

    try {
        const $ = cheerio.load(body);
        anleihe.stueckelung = toNumber(findAttribute($, "Stückelung"));
        anleihe.coupon = toNumber(findAttribute($, "Kupon in %")) / 100;
        anleihe.anzahlZinstermine = toNumber(findAttribute($, "Zinstermine pro Jahr"));
        anleihe.land = findAttribute($, "Land")
        anleihe.faelligkeit = findAttribute($, "Fälligkeit").replaceAll('.', '-');
        anleihe.zinstermin = findAttribute($, "nächster Zinstermin").replaceAll('.', '-');
    } catch (error) {
        anleihe.ignorieren = true;
        console.error(`Couldn't process ${anleihe.name} (${anleihe.link}), ignoring!\n${error}`);
    }

    return anleihe;
}

async function getDollarWechselkurse(fromDate, toDate = new Date(fromDate)) {
    //Get more dates to have fallback numbers for weekends and holidays
    fromDate.setDate(fromDate.getDate() - 7);
    const from = format(fromDate, "yyyy-MM-dd");
    const to = format(toDate, "yyyy-MM-dd");

    const url = `https://www.finanzen.net/Ajax/ExchangeRateController_HistoricPriceList/dollarkurs/${from}_${to}`
    const body = await fetchDataWithRetry(url, { method: 'POST' });
    const $ = cheerio.load(body);
    const rows = $('tbody .table__tr');
    const res = [];

    rows.each((_, element) => {
        const date = parse($(element).find('td').eq(0).text().trim(), 'dd.MM.yyyy', new Date());
        const kurs = toNumber($(element).find('td').eq(1).text().trim());
        res.push({ date, kurs });
    });

    return res;
}

module.exports = {
    getAdditionalData,
    getAktuellenKurs,
    getBoersen,
    getNeueAnleihen,
    getDollarWechselkurse
};