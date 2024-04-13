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

module.exports = { fetchDataWithRetry };