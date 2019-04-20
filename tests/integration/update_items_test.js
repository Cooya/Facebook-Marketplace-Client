const assert = require('assert');
const mock = require('simple-mock').mock;

const config = require('../../config');
const logger = require('../../src/logger');
const setup = require('./setup');

describe('items update : testing items to edit loading from file and database', () => {
	let launcher;

	before(async () => {
		launcher = await setup();
	});

	after(async () => {
		await launcher.itemsManager.end();
	});

	describe('load items from xml file with empty database', async () => {
		let warnings;
		let errors;

		before(async () => {
			warnings = mock(logger, 'warning');
			errors = mock(logger, 'error');
		});

		it('should be 0 present item, 1 invalid and 3 not found into database', async () => {
			const items = await launcher.itemsManager.loadItemsToEdit(config.updateInputFile);
			assert.equal(items.length, 0);

			let missingPicturesCounter = 0;
			let missingDescriptionCounter = 0;
			let missingLocationCounter = 0;
			let invalidLinkCounter = 0;
			for (let call of errors.calls) {
				if (call.arg.indexOf('missing key "photo_url"') != -1)
					missingPicturesCounter++;
				if (call.arg.indexOf('missing key "description"') != -1)
					missingDescriptionCounter++;
				if (call.arg.indexOf('missing key "city"') != -1)
					missingLocationCounter++;
				if (call.arg.indexOf('link is invalid') != -1)
					invalidLinkCounter++;
			}

			assert.equal(missingPicturesCounter, 0);
			assert.equal(missingDescriptionCounter, 0);
			assert.equal(missingLocationCounter, 1);
			assert.equal(invalidLinkCounter, 0);

			let itemNotFoundCounter = 0;
			for (let call of warnings.calls) {
				if (call.arg == 'Item "%s" not found into database.')
					itemNotFoundCounter++;
			}

			assert.equal(itemNotFoundCounter, 3);
		});
	});

	describe('update items from xml file with loaded database', async () => {

		before(async () => {
			// load items to sell into database and set them a random facebook id
			const items = await launcher.itemsManager.loadItemsToSell(config.insertInputFile);
			for (let item of items) {
				item.facebook_id = Math.random().toString(36).substring(7);
				item.sent_at = new Date();
				await launcher.itemsManager.updateItem(item);
			}
		});

		it('one item should be updated', async () => {
			let item = await launcher.itemsManager.getItem('123');
			assert.equal(item.title, 'MAISON [123]');
			assert.equal(item.price, '300 000');
			assert.equal(item.description, 'Jolie maison avec vue sur un parc où l\'on peut aperçevoir des écureuils roux.');
			assert.equal(item.sent_at instanceof Date, true);
			assert.equal(item.updated_at, null);

			await launcher.run('edition');

			item = await launcher.itemsManager.getItem('123');
			assert.equal(item.title, 'MAISONNETTE [123]');
			assert.equal(item.price, '200 000');
			assert.equal(item.description, 'Jolie maison avec vue sur un parc où l\'on peut aperçevoir des écureuils roux et gris.');
			assert.equal(item.sent_at instanceof Date, true);
			assert.equal(item.updated_at instanceof Date, true);
		});
	});
});