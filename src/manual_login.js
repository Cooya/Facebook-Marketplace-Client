const config = require('../config');
const pup = require('./utils/pup_utils');

(async () => {
	const browser = await pup.runBrowser({headless: false});
	const page = await pup.createPage(browser, config.cookiesFile);
	await page.goto('https://www.facebook.com/');
	await page.waitFor(60000);
	await pup.saveCookies(page, config.cookiesFile);
	await browser.close();
})();