const loki = require('lokijs');
const util = require('util');

const utils = require('./utils/utils');

const loadDatabase = util.promisify(new loki().loadDatabase);
const saveDatabase = util.promisify(new loki().saveDatabase);

module.exports = class ItemsManager {
	
	constructor(config) {
		this.db = new loki(config.dbFile);
		this.itemCategory = config.itemCategory;
		this.picturesFolder = config.picturesFolder;
		this.requiredKeys = ['link', 'title', 'price', 'location', 'description', 'pictures'];
		this.linkRegex = /https:\/\/www\.consortium-immobilier\.fr\/annonce-([0-9]+)\.html/;
		this.itemsCollection = null;
	}

	async loadCollection() {
		if(!this.itemsCollection) {
			await loadDatabase.call(this.db, {});
			this.itemsCollection = this.db.getCollection('items');
			if(!this.itemsCollection)
				this.itemsCollection = this.db.addCollection('items', {unique: ['title', 'id', 'fbId']});
		}
	}

	getItem(id) {
		return this.itemsCollection.findOne({id: id});
	}

	getItemForSale(id) {
		const item = this.getItem(id);
		if(!item) {
			console.warn('Item "%s" not found into database.', id);
			return null;
		}
		if(!item.fbId) {
			console.warn('Item "%s" has not been processed yet.', id);
			return null;
		}
		return item;
	}

	getItemsForSale() {
		return this.itemsCollection.find({fbId: {$ne: null}});
	}

	areEqualItems(item1, item2) {
		return item1.id == item2.id &&
			item1.title == item2.title &&
			item1.price == item2.price &&
			item1.location == item2.location &&
			item1.description == item2.description &&
			item1.pictures.equalsTo(item2.pictures);
	}

	async loadItemsToSell(inputFile) {
		await this.loadCollection();
	
		// if input file exists
		if(inputFile && await utils.fileExists(inputFile)) {
			console.log('Loading items from file "' + inputFile + '"...');
	
			// read xml file
			const xml = await utils.readXMLFile(inputFile);
	
			// process items from xml content
			const processedItems = await processItems.call(this, xml.xml.annonce, this.requiredKeys);
	
			// save processed items into database
			await saveItemsIntoDatabase.call(this, processedItems);
		}
	
		// return the unprocessed items from the database
		return this.itemsCollection.find({fbId: null});
	}

	async loadItemsToEdit(inputFile) {
		await this.loadCollection();

		// an input file is required
		if(!inputFile)
			throw Error('An input file is required.');
		if(!await utils.fileExists(inputFile))
			throw Error('The input file "%s" does not exist.'.replace('%s', inputFile));

		// read xml file
		console.log('Loading items from file "%s"...', inputFile);
		const xml = await utils.readXMLFile(inputFile);
		if(!xml.xml.annonce)
			throw Error('Invalid input file.');

		// process items from xml content
		const processedItems = await processItems.call(this, xml.xml.annonce, this.requiredKeys);

		// check if items are for sale and not already up-to-date
		return processedItems.reduce((acc, processedItem) => {
			let itemForSale = this.getItemForSale(processedItem.id);
			if(!itemForSale)
				return acc;
			
			if(this.areEqualItems(processedItem, itemForSale)) {
				console.warn('Item "%s" is already up-to-date.', processedItem.id);
				return acc;
			}

			// make the correspondance for the future update
			processedItem.fbId = itemForSale.fbId;
			processedItem.$loki = itemForSale.$loki;
			processedItem.meta = itemForSale.meta;

			acc.push(processedItem);
			return acc;
		}, []);
	}

	async loadItemsToRemove(inputFile) {
		await this.loadCollection();

		// an input file is required
		if(!inputFile)
			throw Error('An input file is required.');
		if(!await utils.fileExists(inputFile))
			throw Error('The input file "%s" does not exist.'.replace('%s', inputFile));

		// read xml file
		console.log('Loading items from file "%s"...', inputFile);
		const xml = await utils.readXMLFile(inputFile);
		if(!xml.xml.lien)
			throw Error('Invalid input file.');

		// process items from xml content
		return xml.xml.lien.reduce((acc, link) => {
			const matchResult = link.match(this.linkRegex);
			if(!matchResult) {
				console.error('Link "%s" is invalid.', link);
				return acc;
			}

			let itemForSale = this.getItemForSale(matchResult[1]);
			if(!itemForSale) {
				console.warn('Item "%s" is not for sale.', matchResult[1]);
				return acc;
			}

			acc.push(itemForSale);
			return acc;
		}, []);
	}

	async updateItem(item) {
		this.itemsCollection.update(item);
		await saveDatabase.call(this.db);
		console.log('Item "%s" updated into database.', item.id);
	}

	async removeItem(item) {
		this.itemsCollection.remove(item);
		await saveDatabase.call(this.db);
		console.log('Item "%s" deleted from database.', item.id);
	}
};

async function processItems(items) {
	console.log('%s items to process.', items.length);
	let invalidCounter = 0;

	const processedItems = [];
	await asyncForEach(items, async (item) => {
		let processedItem = {};
		processedItem.link = item.lien[0];
		processedItem.title = item.titre[0];
		processedItem.price = item.prix[0].replace(',00 EUR', '');
		processedItem.location = item.ville && item.ville[0];
		processedItem.description = item.descriptif && item.descriptif[0];
		processedItem.category = this.itemCategory;
			
		if(item.photos) {
			processedItem.pictures = [];
			for(let photo of item.photos[0].photo) {
				let picturePath = await utils.downloadFile(photo, this.picturesFolder);
				if(picturePath)
					processedItem.pictures.push(picturePath);
			}
			if(!processedItem.pictures.length) {
				console.error('Unexpected issue when reading pictures from item "' + processedItem.link + '".');
				//console.error(processedItem);
				invalidCounter++;
				return;
			}
		}

		for(let key of this.requiredKeys) {
			if(!processedItem[key]) {
				console.error('Processed item is invalid : "' + processedItem.link + '", missing key "' + key + '".');
				//console.error(processedItem);
				invalidCounter++;
				return;
			}
		}

		const matchResult = processedItem['link'].match(this.linkRegex);
		if(!matchResult) {
			console.error('Processed item is invalid : "' + processedItem.link + '", link is invalid.');
			//console.error(processedItem);
			invalidCounter++;
			return;
		}
		processedItem.id = matchResult[1];
		processedItem.fbId = null;
		processedItems.push(processedItem);
	});

	console.log(invalidCounter + ' invalid items.');
	return processedItems;
}

async function saveItemsIntoDatabase(items) {
	let counter = 0;
	for(let item of items) {
		if(this.itemsCollection.findOne({id: item.id}))
			;//console.warn('Item "' + item.id + '" already exists in database.');
		else {
			this.itemsCollection.insert(item);
			//console.log('Item "' + item.id + '" inserted into database.');
			counter++;
		}
	}
	
	if(counter) {
		await saveDatabase.call(this.db);
		console.log(counter + ' new items loaded into database.');
	}
	console.log(this.itemsCollection.data.length + ' items currently in database.');
}

async function asyncForEach(array, callback) {
	for (let i = 0; i < array.length; i++)
		await callback(array[i], i, array);
}