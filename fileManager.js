export function convertJSONtoCSV(obj, keys) {
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

export async function appendEntryToCSV(filePath, entry) {
    try {
        let csvRow = Object.values(entry).map(value => {
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',') + '\n';
        await fs.promises.appendFile(filePath, csvRow, 'utf8');
    } catch (error) {
        console.error(`Error appending to CSV file: ${error}`);
        throw error;
    }
}

export async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading file from disk: ${error}`);
        throw error;
    }
}