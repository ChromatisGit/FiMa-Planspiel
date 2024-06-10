const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const { toCSVString } = require('./dataTransformer.js');

function convertJSONtoCSV(table, keys) {
    const csvRows = table.map((item) => {
        return keys
        .map(key => toCSVString(item[key]))
        .join(',');
    });

    const csv = [keys.join(','), ...csvRows].join('\n');
    return csv;
}

async function appendEntryToCSV(filePath, entry, keys) {
    try {
        let csvRow = keys
        .map(key => toCSVString(entry[key]))
        .join(',') + '\n';
        await fs.appendFile(filePath, csvRow, 'utf8');
    } catch (error) {
        console.error(`Error appending to CSV file: ${error}`);
        throw error;
    }
}

async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        fs.writeFile(filePath, '{}');
        return undefined;
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
            if(!cell.value) {
                continue;
            }
            if (cell.value.formula || cell.value.sharedFormula) {
                rowData[header] = cell.value.result ?? 0;
                continue;
            }
            if (cell.value) {
                rowData[header] = cell.value.text ?? cell.value;
                continue;
            }
            rowData[header] = "";
        }
        jsonData.push(rowData);
    });
    jsonData.shift()

    return jsonData;
}

module.exports = { convertJSONtoCSV, appendEntryToCSV, readJsonFile, readJsonFromSheet };