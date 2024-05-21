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
//     startDate: new Date(2024,4,9),
//     endDate: today
// })

updateKurseUnsereAnleihen(new Date(2024,4,15))

//Neue Anleihen

// getAnleihen({min_zins: 6, currency: 'EUR'})

// updateAnleihenData()

// updateBranchenStorage()

// updateKurseFromAnleihen()

// removeDuplicatesFromAnleihen()