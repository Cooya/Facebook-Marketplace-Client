const assert = require('assert');

const config = require('../../config');
const pup = require('../../src/pup_utils');

describe('test for page redirection', async () => {
	let browser;

	after(async () => {
		browser.close();
	});

	it('should throw an error', async function() {
		this.timeout(config.testsTimeout);

		browser = await pup.runBrowser(config);
		const page = await pup.createPage(browser);

		let error = {};
		try {
			await pup.goTo(page, 'https://www.facebook.com/find-friends/browser/');
		} catch (e) {
			error = e;
		}

		assert.equal(error.message, 'The current page is not the destination page.');
	});
});
