const { updateWechselkurse } = require('./updateWechselkurse.js');
const { updateZinszahlungen } = require('./updateZinszahlungen.js');
const { updateKurseUnsereAnleihen } = require('./updateKurseUnsereAnleihen.js');
const { getAnleihen } = require('./getAnleihen.js');
const { updateAnleihenData } = require('./updateAnleihenData.js');
const { updateBranchenStorage } = require('./updateBranchenStorage.js');
const { updateKurseFromAnleihen } = require('./updateKurseFromAnleihen.js');
const { removeDuplicatesFromAnleihen } = require('./removeDuplicatesFromAnleihen.js');


const today = new Date();

// updateWechselkurse(today)

//Unsere Anleihen

// updateZinszahlungen({
//     startDate: new Date(2024,3,18),
//     endDate: today
// })

// updateKurseUnsereAnleihen(today)

//Neue Anleihen

// getAnleihen({min_zins: 9, currency: 'USD'})

// updateAnleihenData()

// updateBranchenStorage()

// updateKurseFromAnleihen()

// removeDuplicatesFromAnleihen()