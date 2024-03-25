const axios = require('axios');
const cheerio = require('cheerio');
const { parse, format } = require('date-fns');
const fs = require('fs').promises;

const MIN_ZINS = 4.9;
const EURO = true;

const dataLabelMap = {
    'Mindest anlage': 'mindestanlage',
    'Aktuell': 'kurs',
    'Zinszahlungs intervall': 'zinszahlungIntervall',
    'Zinszahlungs termin': 'zinszahlungTermin',
    'Fälligkeit': 'faelligkeit',
    'Nominale': 'nominalzins',
    'Stücke lung': 'stueckelung',
    'Sitz des Emittenten': 'land'
};

function mapDataLabel(input) {
    if (dataLabelMap.hasOwnProperty(input)) {
        return dataLabelMap[input];
    } else {
        throw new Error(`String ${input} not found!`);
    }
}

function transformRawData(data) {
    data.forEach((e) => {
        e.kurs = parseFloat(e.kurs.replace(',', '.'));
        e.stueckelung = parseFloat(e.mindestanlage.replaceAll('.', '').replace(',', '.'));
        e.mindestanlage = parseFloat(e.mindestanlage.replaceAll('.', '').replace(',', '.'));
        e.nominalzins = parseFloat(e.nominalzins.replace(',', '.').replace('%', ''));
        e.zinszahlungTermin = e.zinszahlungTermin.replaceAll('.', '-');
        e.faelligkeit = e.faelligkeit.replaceAll('.', '-');
        e.letzteZinszahlung = format(getLetzteZinszahlung(e.zinszahlungTermin, e.zinszahlungIntervall), 'dd-MM-yy');
    })
    return data
}

function getLetzteZinszahlung(termin, intervall) {
    termin = parse(termin, 'dd-MM-yy', new Date());
    const today = new Date();

    termin.setFullYear(today.getFullYear());

    if (intervall === 'Jahr') {
        if (termin > today) {
            termin.setFullYear(today.getFullYear() - 1);
            return termin;
        }
        return termin;
    }
    if (intervall.includes('Monat')) {
        const interval = parseInt(intervall[0]);
        const terminMod = termin.getMonth() % interval;
        const todayDiv = Math.floor(today.getMonth() / interval);
        let todayMod = today.getMonth() % interval;
        let targetMonth = terminMod;
        if (todayMod === terminMod) {
            if (termin.getDay() > today.getDay()) {
                todayMod -= 1;
            }
            else {
                todayMod += 1;
            }
        }
        if (todayMod > terminMod) {
            targetMonth += todayDiv * interval;
        }
        if (todayMod < terminMod) {
            if (todayDiv === 0) {
                targetMonth += Math.floor(11 / interval) * interval;
                termin.setFullYear(termin.getFullYear() - 1);
            }
            else {
                targetMonth += (todayDiv - 1) * interval;
            }
        }

        termin.setMonth(targetMonth);
        return termin;
    }
    throw new Error(`Unknown interval ${intervall}`);
}

function tableRowsToAnleiheObj($, $row) {
    const res = {};
    $row.each((_, td) => {
        const label = $(td).attr('data-label');
        if (label && label !== '') {
            if (label === 'Name') {
                const dataPluginValue = $(td).find('a').attr('data-plugin');
                const regex = /'(.+?(\d+))'/;
                const regexRes = regex.exec(dataPluginValue)
                res['link'] = 'https://www.comdirect.de' + regexRes[1];
                res['id'] = regexRes[2]
                return true;
            }

            if (label === 'Emittent') {
                res['name'] = $(td).find('span').attr('title');
                return true;
            }

            res[mapDataLabel(label)] = $(td).find('span').text().trim();
        }
    });
    return res;
}

async function getAnleihen() {
    const currencyType = EURO ? 'EURO' : 'ANDERE';
    const delayBetweenRequests = 1000;
    const anleihen = [];

    const url = 'https://www.comdirect.de/inf/anleihen/selector/trefferliste.html?'
    const queryParams = `MACAULAY_DURATION_COMPARATOR=gt&COUNTRY_ISSUER_EXCLUDE=false&COUPON_VALUE=${MIN_ZINS}&VOLUME_4_WEEKS_VALUE=&MINIMUM_ORDER_VOLUME_MIN=&SEARCH_VALUE=&DATE_MATURITY_FROM=&FORM_NAME=BondsSelectorForm&SORTDIR=DESCENDING&YIELD_TO_MATURITY_MIN=&ISSUER_TYPE=STAATSANLEIHEN&ISSUER_TYPE=FINANZINSTITUTE&ISSUER_TYPE=UNTERNEHMENSANLEIHEN&OFFSET=0&MACAULAY_DURATION_VALUE=&ACCRUED_INTEREST_VALUE=&MODIFY_DURATION_COMPARATOR=gt&CURRENCY=USD&ISO_REGION_ISSUER=ALL&DATE_MATURITY_TO=&VOLUME_4_WEEKS_COMPARATOR=gt&MINIMUM_ORDER_VOLUME_MAX=10000.0&TYPE_COUPON=&ACCRUED_INTEREST_COMPARATOR=gt&YIELD_TO_MATURITY_MAX=&COUPON_COMPARATOR=gt&ISO_COUNTRY_ISSUER=ALL&CURRENCY_TYPE=${currencyType}&MODIFY_DURATION_VALUE=&SORT=COUPON&TRADABLE_AT_EXCHANGE=KEINE_AUSWAHL&keepCookie=true&COLUMN=PRICE&COLUMN=NAME_COUPON_PERIOD&COLUMN=DATE_NEXT_COUPON&COLUMN=NAME_ISSUER&COLUMN=DATE_MATURITY&COLUMN=COUPON&COLUMN=NAME_COUNTRY_ISSUER&COLUMN=MINIMUM_ORDER_VOLUME&COLUMN=INCREMENT_ORDER_VOLUME`

    let page = 0;

    try {
        while (true) {
            const response = await axios.get(`${url}OFFSET=${page}&${queryParams}`);
            const $ = cheerio.load(response.data);
            console.log(`Loaded Page ${page}`)
            await new Promise(resolve => setTimeout(resolve, delayBetweenRequests))

            const tableRows = $('tr');
            if (tableRows.length <= 2) {
                break;
            }

            tableRows.each((_, row) => {
                const $tds = $(row).find('td');
                if ($tds.length === 0) {
                    return true;
                }

                anleihen.push(tableRowsToAnleiheObj($, $tds))
            });
            page++;
        }

    } catch (error) {
        console.error('Error fetching the website:', error);
    }

    const cleanAnleihen = transformRawData(anleihen);
    fs.writeFile('Anleihen.json', JSON.stringify(cleanAnleihen, null, 2))
    console.log('Exported Anleihen.json')
}

getAnleihen();