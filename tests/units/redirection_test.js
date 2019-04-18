const assert = require('assert');
const pup = require('@coya/puppy');

const config = require('../../config');

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

		assert(error.message.indexOf('The current page is not the destination page,') !== -1);
	});
});
