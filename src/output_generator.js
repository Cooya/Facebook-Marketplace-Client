const config = require('../config');
const ItemsManager = require('./items_manager');
const utils = require('./utils/utils');

(async () => {
	const itemsManager = new ItemsManager(config);
	await itemsManager.loadCollection();
	
	let items = itemsManager.getItemsForSale();
	if(!items.length) {
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