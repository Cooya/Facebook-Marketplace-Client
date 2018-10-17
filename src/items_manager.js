var mysql = require('mysql');

const utils = require('./utils/utils');

module.exports = class ItemsManager {
	constructor(config, selectDatabase = true) {
		if(selectDatabase)
			this.connection = mysql.createConnection(config.mysql);
		else { // useful for tests
			this.connection = mysql.createConnection({
				multipleStatements: true, // just for tests
				host: config.mysql.host,
				user: config.mysql.user,
				password: config.mysql.password
			});
		}
		this.itemCategory = config.itemCategory;
		this.picturesFolder = config.picturesFolder;
		this.requiredKeys = ['link', 'title', 'price', 'location', 'description', 'pictures'];
		this.linkRegex = /https:\/\/www\.consortium-immobilier\.fr\/annonce-([0-9]+)\.html/;
	}

	async connect() {
		return new Promise((resolve, reject) => {
			this.connection.connect((err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	getItem(id) {
		return new Promise((resolve, reject) => {
			this.connection.query('SELECT * FROM facebook_ad WHERE id = ' + id, (err, result) => {
				if (err) reject(err);
				else resolve(result[0]);
			});
		});
	}

	getItemForSale(id) {
		return new Promise((resolve, reject) => {
			this.getItem(id).then((item) => {
				if (!item) {
					console.warn('Item "%s" not found into database.', id);
					resolve(null);
				}
				else if (!item.fbId) {
					console.warn('Item "%s" has not been processed yet.', id);
					resolve(null);
				}
				else
					resolve(item);
			}, reject);
		});
	}

	getItemsForSale() {
		return new Promise((resolve, reject) => {
			this.connection.query('SELECT * FROM facebook_ad WHERE published IS TRUE', (err, result) => {
				if (err) reject(err);
				else resolve(result);
			});
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
		return new Promise((resolve, reject) => {
			this.connection.query('SELECT * FROM facebook_ad WHERE published IS FALSE', (err, result) => {
				if (err) reject(err);
				else resolve(result);
			});
		});
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
			processedItem.fbId = itemForSale.fbId;
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

	insertItem(item) {
		return new Promise((resolve, reject) => {
			const query = buildInsertQuery(item);
			console.debug(query);
			this.connection.query('INSERT INTO facebook_ad ' + query[0] + ' VALUES ' + query[1], (err) => {
				if (err) reject(err);
				else {
					console.log('Item "%s" inserted into database.', item.id);
					resolve();
				}
			});
		});				
	}

	updateItem(item) {
		return new Promise((resolve, reject) => {
			this.connection.query('UPDATE facebook_ad SET ' + buildUpdateQuery(item) + ' WHERE id = ' + item.id, (err) => {
				if (err) reject(err);
				else {
					console.log('Item "%s" updated into database.', item.id);
					resolve();
				}
			});
		});
	}

	removeItem(item) {
		return new Promise((resolve, reject) => {
			this.connection.query('DELETE FROM facebook_ad WHERE id = ' + item.id, (err) => {
				if (err) reject(err);
				else {
					console.log('Item "%s" deleted from database.', item.id);
					resolve();
				}
			});
		});
	}

	countItems() {
		return new Promise((resolve, reject) => {
			this.connection.query('SELECT COUNT(id) AS counter FROM facebook_ad', (err, result) => {
				if (err) reject(err);
				else {
					console.log(result[0].counter + ' items currently into the database.');
					resolve();
				}
			});
		});	
	}

	clearItems() {
		return new Promise((resolve, reject) => {
			this.connection.query('DROP TABLE facebook_ad', (err) => {
				if (err) reject(err);
				else {
					console.log('All items has been removed.');
					resolve();
				}
			});
		});	
	}
};

async function processItems(items) { // check if items read from the input file are valid
	console.log('%s items to process.', items.length);
	let invalidCounter = 0;

	const processedItems = [];
	await asyncForEach(items, async (item) => {
		console.log('Processing item "%s"...', item.titre[0]);
		let processedItem = {};
		processedItem.link = item.lien[0];
		processedItem.title = item.titre[0];
		processedItem.price = item.prix[0].replace(',00 EUR', '');
		processedItem.location = item.ville && item.ville[0];
		processedItem.description = item.descriptif && item.descriptif[0];
		processedItem.category = this.itemCategory;

		if (item.photos) {
			processedItem.pictures = [];
			for (let photo of item.photos[0].photo) {
				let picturePath = await utils.downloadFile(photo, this.picturesFolder);
				if (picturePath)
					processedItem.pictures.push(picturePath);
			}
			if (!processedItem.pictures.length) {
				console.error('Unexpected issue when reading pictures from item "' + processedItem.link + '".');
				//console.error(processedItem);
				invalidCounter++;
				return;
			}
		}

		for (let key of this.requiredKeys) {
			if (!processedItem[key]) {
				console.error('Processed item is invalid : "' + processedItem.link + '", missing key "' + key + '".');
				//console.error(processedItem);
				invalidCounter++;
				return;
			}
		}

		const matchResult = processedItem['link'].match(this.linkRegex);
		if (!matchResult) {
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

async function asyncForEach(array, callback) {
	for (let i = 0; i < array.length; i++)
		await callback(array[i], i, array);
}

function areEqualItems(item1, item2) {
	return item1.id == item2.id &&
		item1.title == item2.title &&
		item1.price == item2.price &&
		item1.location == item2.location &&
		item1.description == item2.description &&
		item1.pictures.equalsTo(item2.pictures);
}

function buildInsertQuery(item) {
	let keys = '(';
	Object.keys(item).forEach((key) => {
		if (key == 'id')
			return;
		keys += key + ', ';
	});
	keys = keys.substring(0, keys.length - 2) + ')';
	
	let values = '(';
	Object.keys(item).forEach((key) => {
		if (key == 'id')
			return;
		if (Number.isInteger(item[key]))
			values += item[key] + ', ';
		else
			values += '"' + item[key] + '", ';
	});
	values = values.substring(0, values.length - 2) + ')';

	return [keys, values];	
} 

function buildUpdateQuery(item) {
	let str = '';
	Object.keys(item).forEach((key) => {
		if (key == 'id')
			return;
		if (Number.isInteger(item[key]))
			str += key + ' = ' + item[key] + ', ';
		else
			str += key + ' = "' + item[key] + '", ';
	});

	str = str.substring(0, str.length - 2);
	return str;
}