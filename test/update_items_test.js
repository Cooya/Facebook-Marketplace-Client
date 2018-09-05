const assert = require('assert');
const mock = require('simple-mock').mock;

const config = require('../config');
const ItemsManager = require('../src/items_manager');
const ItemsSeller = require('../src/items_seller');
const Launcher = require('../src/launcher');
const utils = require('../src/utils/utils');

describe('items update : testing items to edit loading from file and database', () => {
	let itemsManager;

	before(async () => {
		mock(utils, 'downloadFile').callFn((url) => Promise.resolve(url));
		mock(config, 'dbFile', 'test/db.json');
		mock(config, 'updateInputFile', 'update_sample.xml');
		mock(config, 'commit', true);

		itemsManager = new ItemsManager(config);
	});

	after(async () => {
		try {
			await utils.deleteFile('test/db.json');
		}
		catch (e) { }
	});

	describe('load items from xml file', async () => {
		let errors;

		before(async () => {
			errors = mock(console, 'error');
		});

		it('should be 3 present items and 1 absent item', async () => {
			const items = await itemsManager.loadItemsToEdit('test/update_sample.xml');
			assert.equal(items.length, 3);

			assert.equal(items[0].link, 'https://www.consortium-immobilier.fr/annonce-123.html');
			assert.equal(items[0].pictures.length, 1);
			assert.equal(items[0].description, 'Jolie maison avec vue sur un parc où l\'on peut aperçevoir des écureuils roux et gris.');
			assert.equal(items[0].price, '200 000');

			assert.equal(items[1].link, 'https://www.consortium-immobilier.fr/annonce-789.html');
			assert.equal(items[1].pictures.length, 1);
			assert.equal(items[1].description, 'Appartement sympa et super insonorisé, vous pouvez faire la fête comme des fous.');
			assert.equal(items[1].price, '27 000');

			assert.equal(items[2].link, 'https://www.consortium-immobilier.fr/annonce-000.html');
			assert.equal(items[2].pictures.length, 2);
			assert.equal(items[2].description, 'Maison en bois, avec toilettes turques.');
			assert.equal(items[2].price, '250 000');
		});

		it('should display 1 error', async () => {
			let missingPicturesCounter = 0;
			let missingDescriptionCounter = 0;
			let missingLocationCounter = 0;
			let invalidLinkCounter = 0;
			for (let call of errors.calls) {
				if (call.arg.indexOf('missing key "pictures"') != -1)
					missingPicturesCounter++;
				if (call.arg.indexOf('missing key "description"') != -1)
					missingDescriptionCounter++;
				if (call.arg.indexOf('missing key "location"') != -1)
					missingLocationCounter++;
				if (call.arg.indexOf('link is invalid') != -1)
					invalidLinkCounter++;
			}

			assert.equal(missingPicturesCounter, 0);
			assert.equal(missingDescriptionCounter, 0);
			assert.equal(missingLocationCounter, 1);
			assert.equal(invalidLinkCounter, 0);
		});
	});

	describe('update items', async () => {

		before(async () => {
			try {
				await utils.deleteFile('test/db.json');
			}
			catch (e) { }

			// load items to sell into database and mark them as processed
			const items = await itemsManager.loadItemsToSell('test/insert_sample.xml');
			await itemsManager.updateItemsWithBindings(items.map((item) => {
				return { fbId: Math.random().toString(36).substring(7), title: item.title };
			}));

			// mock ItemsSeller methods
			mock(ItemsSeller.prototype, 'open').callFn(() => Promise.resolve());
			mock(ItemsSeller.prototype, 'close').callFn(() => Promise.resolve());
			mock(ItemsSeller.prototype, 'manageItem').callFn(() => Promise.resolve(true));
			mock(utils, 'randomSleep').callFn(() => Promise.resolve());
		});

		it('one item should be updated', async () => {
			let item = await itemsManager.getItem('123');
			assert.equal(item.price, '300 000');
			assert.equal(item.description, 'Jolie maison avec vue sur un parc où l\'on peut aperçevoir des écureuils roux.');

			const launcher = new Launcher();
			await launcher.run('edition');

			item = await itemsManager.getItem('123');
			assert.equal(item.price, '200 000');
			assert.equal(item.description, 'Jolie maison avec vue sur un parc où l\'on peut aperçevoir des écureuils roux et gris.');
		});
	});
});