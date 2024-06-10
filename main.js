const { updateZinszahlungen } = require('./updateZinszahlungen.js');
const { updateKurseUnsereAnleihen } = require('./updateKurseUnsereAnleihen.js');
const { getAnleihen } = require('./getAnleihen.js');
const { updateAnleihenData } = require('./updateAnleihenData.js');
const { updateKurseFromAnleihen } = require('./updateKurseFromAnleihen.js');


const today = new Date();

//Unsere Anleihen

// updateZinszahlungen({
//     startDate: new Date(2024,5,6),
//     endDate: today
// })

// updateKurseUnsereAnleihen(today)

//Neue Anleihen

// getAnleihen({min_zins: 10, currency: 'USD'})

// updateAnleihenData()

// updateKurseFromAnleihen()