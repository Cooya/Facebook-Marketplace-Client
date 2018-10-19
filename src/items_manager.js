const DatabaseConnection = require('./database_connection');
const utils = require('./utils/utils');

module.exports = class ItemsManager extends DatabaseConnection {
	constructor(config) {
		super(config.mysql);
		this.itemCategory = config.itemCategory;
		this.picturesFolder = config.picturesFolder;
		this.requiredKeys = ['url_site', 'title', 'price', 'city', 'description', 'url_photo'];
		this.linkRegex = /https:\/\/www\.consortium-immobilier\.fr\/annonce-([0-9]+)\.html/;
	}

	getItemForSale(id) {
		return new Promise((resolve, reject) => {
			this.getItem(id).then((item) => {
				if (!item) {
					console.warn('Item "%s" not found into database.', id);
					resolve(null);
				}
				else if (!item.facebook_id) {
					console.warn('Item "%s" has not been processed yet.', id);
					resolve(null);
				}
				else if (item.deleted_at) {
					console.warn('Item "%s" has been removed..', id);
					resolve(null);
				}
				else
					resolve(item);
			}, reject);
		});
	}

	async loadItemsToSell(inputFile) {
		// if input file exists
		if (inputFile && await utils.fileExists(inputFile)) {
			console.log('Loading items from file "' + inputFile + '"...');

			// read xml file
			const xml = await utils.readXMLFile(inputFile);

			// process items from xml content
			const processedItems = await processItems.call(this, xml.xml.annonce, this.requiredKeys);

			// save processed items into database
			let counter = 0;
			for (let item of processedItems) {
				if (await this.getItem(item.id))
					console.warn('Item "' + item.id + '" already exists in database.');
				else {
					await this.insertItem(item);
					counter++;
				}
			}

			if (counter)
				console.log(counter + ' new items loaded into database.');
			await this.countItems();
		}

		// return the unprocessed items from the database
		return this.getItems(false);
	}

	async loadItemsToEdit(inputFile) {
		// an input file is required
		if (!inputFile)
			throw Error('An input file is required.');
		if (!await utils.fileExists(inputFile))
			throw Error('The input file "%s" does not exist.'.replace('%s', inputFile));

		// read xml file
		console.log('Loading items from file "%s"...', inputFile);
		const xml = await utils.readXMLFile(inputFile);
		if (!xml.xml.annonce)
			throw Error('Invalid input file.');

		// process items from xml content
		const processedItems = await processItems.call(this, xml.xml.annonce, this.requiredKeys);

		// check if items are for sale and not already up-to-date
		return processedItems.reduce(async (acc, processedItem) => {
			let itemForSale = await this.getItemForSale(processedItem.id);
			if (!itemForSale)
				return acc;

			if (areEqualItems(processedItem, itemForSale)) {
				console.warn('Item "%s" is already up-to-date.', processedItem.id);
				return acc;
			}

			// make the correspondance for the future update
			processedItem.facebook_id = itemForSale.facebook_id;
			processedItem.oldTitle = itemForSale.title; // if the title should be changed, we keep the old one to select the item among the items for sale

			acc.push(processedItem);
			return acc;
		}, []);
	}

	async loadItemsToRemove(inputFile) {
		// an input file is required
		if (!inputFile)
			throw Error('An input file is required.');
		if (!await utils.fileExists(inputFile))
			throw Error('The input file "%s" does not exist.'.replace('%s', inputFile));

		// read xml file
		console.log('Loading items from file "%s"...', inputFile);
		const xml = await utils.readXMLFile(inputFile);
		if (!xml.xml.lien)
			throw Error('Invalid input file.');

		// process items from xml content
		return xml.xml.lien.reduce(async (acc, link) => {
			const matchResult = link.match(this.linkRegex);
			if (!matchResult) {
				console.error('Link "%s" is invalid.', link);
				return acc;
			}

			let itemForSale = await this.getItemForSale(matchResult[1]);
			if (!itemForSale) {
				console.warn('Item "%s" is not for sale.', matchResult[1]);
				return acc;
			}

			acc.push(itemForSale);
			return acc;
		}, []);
	}
};

async function processItems(items) { // check if items read from the input file are valid
	console.log('%s items to process.', items.length);
	let invalidCounter = 0;

	const processedItems = [];
	await asyncForEach(items, async (item) => {
		console.log('Processing item "%s"...', item.titre[0]);
		let processedItem = {};
		processedItem.url_site = item.lien[0];
		processedItem.title = item.titre[0];
		processedItem.price = item.prix[0].replace(',00 EUR', '');
		processedItem.city = item.ville && item.ville[0];
		processedItem.description = item.descriptif && item.descriptif[0];
		processedItem.type = this.itemCategory;
		processedItem.facebook_id = null;

		if (item.photos) {
			const pictures = [];
			for (let photo of item.photos[0].photo) {
				let picturePath = await utils.downloadFile(photo, this.picturesFolder);
				if (picturePath)
					pictures.push(picturePath);
			}
			if (!pictures.length) {
				console.error('Unexpected issue when reading pictures from item "' + processedItem.url_site + '".');
				//console.error(processedItem);
				invalidCounter++;
				return;
			}
			processedItem.url_photo = pictures;
		}

		for (let key of this.requiredKeys) {
			if (!processedItem[key]) {
				console.error('Processed item is invalid : "' + processedItem.url_site + '", missing key "' + key + '".');
				//console.error(processedItem);
				invalidCounter++;
				return;
			}
		}

		const matchResult = processedItem.url_site.match(this.linkRegex);
		if (!matchResult) {
			console.error('Processed item is invalid : "' + processedItem.url_site + '", link is invalid.');
			//console.error(processedItem);
			invalidCounter++;
			return;
		}
		processedItem.id = matchResult[1];
		processedItems.push(processedItem);
	});

	console.log(invalidCounter + ' invalid items.');
	return processedItems;
}

async function asyncForEach(array, callback) {
	for (let i = 0; i < array.length; i++)
		await callback(array[i], i, array);
}

function areEqualItems(item1, item2) {
	return item1.id == item2.id &&
		item1.title == item2.title &&
		item1.price == item2.price &&
		item1.city == item2.city &&
		item1.description == item2.description &&
		item1.url_photo.equalsTo(item2.url_photo);
}