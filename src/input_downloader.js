const path = require('path');

const config = require('../config');
const utils = require('./utils/utils');

const apiUrl = 'https://www.consortium-immobilier.fr/nxt-version/outils/db/xml.php';

(async () => {
    console.log('Getting new XML input file from the API...');
    await utils.downloadFile(apiUrl, path.dirname(config.inputFile), path.basename(config.inputFile));
    console.log('XML input file downloaded from the API.');
})();