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

	async getItem(id) {
		await loadCollection.call(this);
		return this.itemsCollection.findOne({id: id});
	}

	async getProcessedItem(id) {
		const item = await this.getItem(id);
		if(!item) {
			console.error('Item "%s" not found into database.', id);
			return null;
		}
		if(!item.fbId) {
			console.error('Item "%s" has not been processed yet.', id);
			return null;
		}
		return item;
	}

	async getProcessedItems() {
		await loadCollection.call(this);
		return this.itemsCollection.find({fbId: {$ne: null}});
	}

	async loadItemsToSell(inputFile) {
		await loadCollection.call(this);
	
		// if input file exists
		if(inputFile && await utils.fileExists(inputFile)) {
			console.log('Loading items from file "' + inputFile + '"...');
	
			// read xml file
			const xml = await utils.readXMLFile(inputFile);
	
			// process items
			const processedItems = await processItems.call(this, xml.xml.annonce, this.requiredKeys);
	
			// save processed items into database
			await saveItemsIntoDatabase.call(this, processedItems);
		}
	
		// return the unprocessed items from the database
		return this.itemsCollection.find({fbId: null});
	}

	async loadItemsToEdit(inputFile) {
		await loadCollection.call(this);

		if(!inputFile)
			throw Error('An input file is required.');
		if(!await utils.fileExists(inputFile))
			throw Error('The input file "%s" does not exist.'.replace('%s', inputFile));
		console.log('Loading items from file "%s"...', inputFile);

		const xml = await utils.readXMLFile(inputFile);
		if(!xml.xml.annonce)
			throw Error('Invalid input file.');
		return await processItems.call(this, xml.xml.annonce, this.requiredKeys);
	}

	async loadItemsToRemove(inputFile) {
		await loadCollection.call(this);

		if(!inputFile)
			throw Error('An input file is required.');
		if(!await utils.fileExists(inputFile))
			throw Error('The input file "%s" does not exist.'.replace('%s', inputFile));
		console.log('Loading items from file "%s"...', inputFile);

		const xml = await utils.readXMLFile(inputFile);
		if(!xml.xml.lien)
			throw Error('Invalid input file.');
		return xml.xml.lien.reduce((acc, link) => {
			const matchResult = link.match(this.linkRegex);
			if(!matchResult) {
				console.error('Link "%s" is invalid.', link);
				return;
			}
			acc.push(matchResult[1]);
			return acc;
		}, []);
	}
	
	async updateItemsWithBindings(bindings) {
		let item;
		for(let binding of bindings) {
			item = this.itemsCollection.findOne({title: binding.title});
			if(!item) {
				console.error('Unknown item "%s".');
				continue;
			}
			if(item.fbId) {
				//console.log('Item "%s" already bound into database.', item.id);
				continue;
			}
	
			item.fbId = binding.fbId;
			this.itemsCollection.update(item);
			console.log('Facebook ID added to item "%s" into database.', item.id);
		}
	
		await saveDatabase.call(this.db);
	}

	async updateItem(oldItem, newItem) {
		if(oldItem.id != newItem.id)
			throw Error('Cannot update item with a different id.');

		newItem.$loki = oldItem.$loki;
		newItem.meta = oldItem.meta;
		this.itemsCollection.update(newItem);
		await saveDatabase.call(this.db);
		console.log('Item "%s" updated into database.', newItem.id);
	}

	async deleteItem(item) {
		this.itemsCollection.remove(item);
		await saveDatabase.call(this.db);
		console.log('Item "%s" deleted from database.', item.id);
	}
};

async function loadCollection() {
	if(!this.itemsCollection) {
		await loadDatabase.call(this.db, {});
		this.itemsCollection = this.db.getCollection('items');
		if(!this.itemsCollection)
			this.itemsCollection = this.db.addCollection('items', {unique: ['title', 'id', 'fbId']});
	}
}

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