const assert = require('assert');

const config = require('../../config');
const ItemsSeller = require('../../src/items_seller');

describe('test log in failure', async () => {
	let itemsSeller;

	before(async () => {
		itemsSeller = new ItemsSeller(config);
		itemsSeller.login = 'bad@login.com';
		itemsSeller.password = 'bad_password';
		itemsSeller.cookiesFile = null;
		itemsSeller.commit = false;
		itemsSeller.headless = false;
	});

	after(async () => {
		itemsSeller.browser.close();
	});

	it('should throw a bad log in error', async function() {
		this.timeout(20000);

		let error = {};
		try {
			await itemsSeller.open();
		}
		catch(e) {
			error = e;
		}

		assert.equal(error.message, 'The log in has failed.');
	});
});