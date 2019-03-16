const utils = require('@coya/utils');
const path = require('path');

const config = require('../config');

//const apiUrl = 'https://www.consortium-immobilier.fr/nxt-version/outils/db/xml.php';
const routes = {
	insert: {
		url: 'https://www.consortium-immobilier.fr/nxt-version/outils/db/xml_insert.php',
		file: config.insertInputFile
	},
	update: {
		url: 'https://www.consortium-immobilier.fr/nxt-version/outils/db/xml_update.php',
		file: config.updateInputFile
	},
	delete: {
		url: 'https://www.consortium-immobilier.fr/nxt-version/outils/db/xml_delete.php',
		file: config.deleteInputFile
	}
};

(async () => {
	const args = process.argv.slice(2);
	let route;
	for (let i in args) {
		if (args[i] == '--route') route = args[Number.parseInt(i) + 1];
	}

	if (!route) {
		console.error('A route is required.');
		process.exit(1);
	} else if (!routes[route]) {
		console.error('Invalid route provided.');
		process.exit(1);
	}

	console.log('Getting new XML %s input file from the API...', route);
	await utils.downloadFile(routes[route].url, path.dirname(routes[route].file), path.basename(routes[route].file));
	console.log('XML %s input file downloaded from the API.', route);
})();
