const fs = require('fs').promises;
const { getDollarWechselkurs } = require('./requestManager.js');

async function updateWechselkurse() {
    const today = new Date();
    const usd = await getDollarWechselkurs(today);

    const wechselkurse = {
        "EUR": 1,
        "USD": usd
    }

    fs.writeFile('data/currentWechselkurse.json', JSON.stringify(wechselkurse, null, 2))
    console.log('Exported Wechselkurse')
}

updateWechselkurse()