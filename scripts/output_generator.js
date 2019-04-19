const utils = require('@coya/utils');

const config = require('../config');
const ItemsManager = require('../src/items_manager');

(async () => {
	const itemsManager = new ItemsManager(config);
	await itemsManager.connect();

	let items = await itemsManager.getItemsForSale();
	if (!items.length) {
		console.error('No item to process.');
		process.exit(1);
	}

	items = items.map((item) => {
		delete item['meta'];
		delete item['$loki'];

		item['pictures'] = item['pictures'].map((picture) => {
			return {picture: picture};
		});

		return {ad: item};
	});

	await utils.writeXMLFile(config.outputFile, items);
	console.log('Output file generated successfully.');
})();
