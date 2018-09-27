const assert = require('assert');

const pup = require('../../src/utils/pup_utils');
const config = require('../../config');

describe('test for page redirection', async () => {
	let browser;

	after(async () => {
		browser.close();
	});

	it('should throw an error', async function() {
		this.timeout(10000);

		browser = await pup.runBrowser(config);
		const page = await pup.createPage(browser);

		let error = {};
		try {
			await pup.goTo(page, 'https://www.facebook.com/marketplace');
		}
		catch(e) {
			console.log(e.message);
			error = e;
		}

		assert.equal(error.message, 'The current page is not the destination page.');
	});
});