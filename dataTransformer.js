const { format } = require('date-fns');

function toNumber(n) {
    return parseFloat(n.replace(',', '.'))
}

function calcLetzterZinstermin(zinszahlungenProJahr, ersteZinszahlung, heute) {
    var monateSeitZinszahlung = (heute.getFullYear() - ersteZinszahlung.getFullYear()) * 12;
    monateSeitZinszahlung += heute.getMonth() - ersteZinszahlung.getMonth();
    monateSeitZinszahlung += (heute.getDate() >= ersteZinszahlung.getDate()) ? 0 : -1;

    var anzahlZinszahlungen = Math.floor(monateSeitZinszahlung / (12 / zinszahlungenProJahr));

    var letzteZinszahlung = new Date(ersteZinszahlung);
    letzteZinszahlung.setMonth(letzteZinszahlung.getMonth() + Math.floor(anzahlZinszahlungen * (12 / zinszahlungenProJahr)));

    return format(letzteZinszahlung, 'dd-MM-yyyy');
}

function toCSVString(val) {
    if (typeof val === 'number') {
        val = val.toString().replace('.', ','); // Replace decimal period with decimal comma because Excel sucks and ignores regional settings
    }
    if (val instanceof Date) {
        val = format(val, 'dd-MM-yyyy')
    }
    if (typeof val === 'string' && val.includes(',')) {
        val = `"${val}"`; // Enclose fields containing commas in quotes
    }
    return val;
}

module.exports = {
    toCSVString,
    calcLetzterZinstermin,
    toNumber
};