const pup = require('@coya/puppy');
const utils = require('@coya/utils');

const logger = require('./logger');

const marketplaceUrl = 'https://www.facebook.com/marketplace/selling';

module.exports = class ItemsSeller {
	constructor(config) {
		this.login = config.login;
		this.password = config.password;
		this.cookiesFile = config.cookiesFile;
		this.commit = config.commit;
		this.headless = config.headless;
		this.proxy = config.proxy && config.proxy.url && config.proxy;
		this.screenshotsFolder = config.screenshotsFolder;
		this.fbIds = {};
		this.adsListReceived = false;

		this.browser = null;
		this.page = null;

		this.fillSellForm = fillSellForm; // private method which needs to be public to be mocked in unit testing

		const wrap = async (method, ...params) => {
			try {
				return await method.call(this, ...params);
			} catch (e) {
				await pup.screenshot(this.page, this.screenshotsFolder);
				throw e;
			}
		};

		this.open = wrap.bind(this, this.open);
		this.sellItem = wrap.bind(this, this.sellItem);
		this.manageItem = wrap.bind(this, this.manageItem);
		this.close = wrap.bind(this, this.close);
	}

	async open() {
		// open browser and load cookies
		this.browser = await pup.runBrowser({headless: this.headless, proxy: this.proxy, logger});
		this.page = await pup.createPage(this.browser, this.cookiesFile);

		this.page.on('response', async (response) => {
			if (
				response.url() == 'https://www.facebook.com/api/graphql/' &&
				response
					.request()
					.postData()
					.indexOf('MARKETPLACE_SELLING_ITEM_IMAGE_WIDTH') != -1
			) {
				logger.info('Processing ads list...');
				let json;
				try {
					json = await response.json();
				} catch (e) {
					if (e.message == 'Protocol error (Network.getResponseBody): No resource with given identifier found') {
						logger.error('No resource with given identifier found.');
						return;
					}
					if (e.message.indexOf('Unexpected token') !== -1) {
						logger.error('Bad JSON received.');
						return;
					}
					throw e;
				}
				json.data.viewer.selling_feed_one_page.edges.forEach((ad) => {
					if (!this.fbIds[ad.node.group_commerce_item_title]) this.fbIds[ad.node.group_commerce_item_title] = ad.node.id;
				});
				//logger.debug(this.fbIds);
				this.adsListReceived = true;
			}
		});

		await goToMarketPlace.call(this);
	}

	async sellItem(item) {
		await fillSellFormWrapped.call(this, 'sell', item);

		if (this.commit) {
			await utils.randomSleep(1, 2);
			this.adsListReceived = false;
			while (true) {
				// wait for the request response from the graphql api
				logger.info('Reloading the page...');
				await pup.goTo(this.page, this.page.url());
				logger.info('Waiting until the item has been found into the selling list.');
				if (await utils.waitForValue(this.adsListReceived, true)) break;
				logger.info('Item found.');
			}
		}
	}

	async manageItem(item, action) {
		const actions = {
			edit: editItem,
			remove: removeItem
		};

		const found = await pup.infiniteScroll(this.page, async () => {
			const title = item.oldTitle || item.title;
			logger.debug('Looking for ad "' + title + '"...');
			let actionSelectorButton;
			for (let itemContainer of await this.page.$$('div.clearfix[direction="left"]')) {
				if (!(await itemContainer.$('section')))
					// if false, it means this is a comment so we skip it
					continue;
				logger.debug(await itemContainer.$eval('span[lines="2"] > span', (node) => node.innerText));
				if (await itemContainer.$('span[title="' + title + '"')) {
					logger.debug('Ad found into the marketplace.');
					actionSelectorButton = await itemContainer.$('a > span > i[alt=""]');
					await actionSelectorButton.click();
					await this.page.waitForSelector('li[role="presentation"] > a[role="menuitem"]');
					await utils.randomSleep(1, 2);
					await actions[action].call(this, item);
					return true;
				}
			}
			logger.debug('Ad not found yet into the marketplace.');
			return false;
		});

		if (!found) {
			logger.error('Cannot update or delete item "%s", not found in selling.', item.id);
			await utils.randomSleep(3);
		}
		return found;
	}

	async close() {
		await this.browser.close();
		logger.info('Seller closed.');
	}
};

async function goToMarketPlace() {
	await pup.goTo(this.page, marketplaceUrl);
	const loginForm = await this.page.$('#login_form');
	if (loginForm) {
		// log in if needed
		await logIn.call(this);
		await utils.randomSleep(1, 2);
		await pup.saveCookies(this.page, this.cookiesFile);
	}
}

async function logIn() {
	logger.info('Logging in...');
	const loginValue = await pup.value(this.page, '#email');
	if (loginValue) await emptyInput(this.page, '#email');
	await this.page.type('#email', this.login);
	await utils.randomSleep(1, 2);
	await this.page.type('#pass', this.password);
	await utils.randomSleep(1, 2);
	await this.page.click('#loginbutton');
	await this.page.waitForNavigation();
	const loginButton = await this.page.$('#loginbutton');
	if (loginButton) throw Error('The log in has failed.');
	logger.info('Logged in.');
}

async function openFormModal(formType) {
	const formTypeSelector = 'div[aria-label="Create a new sale post on Marketplace"] a[role="button"] i';
	const formInputSelector = 'div[aria-label="Create a new sale post on Marketplace"] input[placeholder="What are you selling?"]';

	logger.info('Opening form modal...');
	if (formType == 'sell') {
		await this.page.click('div[role=navigation]:nth-child(1) button');
		await this.page.waitForSelector(formTypeSelector + ', ' + formInputSelector);
		await utils.randomSleep(1, 2);
		if(await this.page.$(formTypeSelector)) // this step seems to have disappeared
			await this.page.click(formTypeSelector + ':nth-child(1)');
	} else {
		await this.page.click('div.uiLayer:not(.hidden_elem) li[role="presentation"]:nth-child(2) > a[role="menuitem"]');
	}
	await this.page.waitForSelector(formInputSelector);
	await utils.randomSleep(1, 2);
}

async function fillSellFormWrapped(formType, item) {
	for (let i = 0; i < 3; ++i) {
		try {
			await openFormModal.call(this, formType);
			await this.fillSellForm(item);
			logger.info('Form submitted sucessfully.');
			return;
		} catch (e) {
			// display the error and take a screenshot
			logger.error('An error has occurred while filling out the form :');
			logger.error(e);
			await pup.screenshot(this.page, this.screenshotsFolder);

			// close the modal and try again
			logger.info('Trying again to fill out the form...');
			await this.page.click('button.layerCancel'); // close the modal
			await utils.randomSleep(1, 2);
			const confirmationBox = await this.page.$('div.uiOverlayFooter button');
			if (confirmationBox) {
				await confirmationBox.click(); // confirm the closing
				await this.page.waitForSelector('div.uiOverlayFooter button', {hidden: true});
			}
			await this.page.waitForSelector('button.layerCancel', {hidden: true}); // wait for the modal to be closed
		}
	}
	throw new Error('It seems there is a problem when submitting the form.');
}

async function fillSellForm(item) {
	// description
	const previousDescriptionValue = await pup.attribute(this.page, 'div[aria-multiline="true"]', 'textContent');
	if (previousDescriptionValue) await emptyInput(this.page, 'div[aria-multiline="true"]'); // empty description if needed
	await this.page.type('div[aria-multiline="true"]', item.description);
	await utils.randomSleep(1, 2);

	// title
	await this.page.click('input[placeholder="What are you selling?"]', {clickCount: 3}); // select all the title text
	await utils.randomSleep(1, 2);
	await this.page.type('input[placeholder="What are you selling?"]', item.title);
	await utils.randomSleep(1, 2);

	// price
	await this.page.click('input[placeholder="Price"]', {clickCount: 3}); // select all the price text
	await utils.randomSleep(1, 2);
	await this.page.type('input[placeholder="Price"]', item.price);
	await utils.randomSleep(1, 2);

	// location
	await this.page.click('input[placeholder="Add Location"]'); // select all the location text
	await utils.randomSleep(1, 2);
	await this.page.type('input[placeholder="Add Location"]', item.city);
	await utils.randomSleep(2, 3);
	// Facebook now preselects the first entry
	// await this.page.keyboard.press('ArrowDown');
	// await utils.randomSleep(1, 2);
	await this.page.keyboard.press('Enter');
	await utils.randomSleep(1, 2);

	// category
	await this.page.click('input[placeholder="Select a Category"]'); // select all the category text
	await utils.randomSleep(1, 2);
	await this.page.type('input[placeholder="Select a Category"]', item.type);
	await utils.randomSleep(1, 2);
	await this.page.keyboard.press('ArrowDown');
	await utils.randomSleep(1, 2);
	await this.page.keyboard.press('Enter');
	await utils.randomSleep(1, 2);

	// pictures
	const cleanPictures = async () => {
		const selector = 'button[title="Remove photo"], div.fbScrollableAreaContent button[title="Remove"]';
		while (await this.page.$(selector)) {
			await this.page.click(selector);
			await utils.randomSleep(1, 2);
		}
	};
	await cleanPictures(); // remove previous pictures if needed

	let pictureUploadError;
	for (let i = 0; i < 3; ++i) {
		await (await this.page.$('input[title="Choose a file to upload"]')).uploadFile(...item.url_photo);
		try {
			await this.page.waitForSelector('div[role=dialog] button[type="submit"][data-testid="react-composer-post-button"]:disabled', {hidden: true}); // :not('disabled') not working
			break;
		} catch (e) {
			pictureUploadError = await this.page.$('div[aria-haspopup="true"] p');
			if (pictureUploadError) {
				// error in pictures upload
				logger.error('Error in pictures upload, trying again...');
				await cleanPictures();
			} else throw e;
		}
	}
	if (pictureUploadError) throw new Error('One or several pictures are invalid for the item "' + item.title + '".');
	logger.info('Pictures uploaded successfully.');
	await utils.randomSleep(1, 2);

	// submit the form if commit mode is enabled
	if (this.commit) {
		const submitButtonSelector = 'div[role=dialog] button[type="submit"][data-testid="react-composer-post-button"]';
		if ((await pup.attribute(this.page, submitButtonSelector, 'innerText')) == 'Next') {
			await this.page.click(submitButtonSelector);
			await utils.randomSleep(3, 5);
		}
		await this.page.click(submitButtonSelector);
		await this.page.waitForSelector(submitButtonSelector, {hidden: true});
	} else {
		// discard the form otherwise
		await this.page.click('button.layerCancel');
		await this.page.waitForSelector('div.uiOverlayFooter');
		await utils.randomSleep(1, 2);
		await this.page.click('div.uiOverlayFooter button:nth-child(1)');
		await this.page.waitForSelector('div[role=dialog] button[type="submit"][aria-haspopup="true"]', {hidden: true});
	}
	logger.info('Sell form filled successfuly.');
}

async function editItem(item) {
	await fillSellFormWrapped.call(this, 'edit', item);
}

async function removeItem() {
	await this.page.click('li[role="presentation"]:nth-child(1) > a[role="menuitem"]');
	await this.page.waitForSelector('div[data-testid="simple_xui_dialog_footer"]');
	await utils.randomSleep(1, 2);
	if (this.commit) {
		await this.page.click('div[data-testid="simple_xui_dialog_footer"] a[action="cancel"]:nth-child(2)');
		await this.page.waitForSelector('div[data-testid="simple_xui_dialog_footer"]', {
			hidden: true
		});
	} else {
		await this.page.click('div[data-testid="simple_xui_dialog_footer"] a[action="cancel"]:nth-child(1)');
		await this.page.waitForSelector('div[data-testid="simple_xui_dialog_footer"]', {
			hidden: true
		});
	}
	logger.info('Item removed sucessfully.');
}

async function emptyInput(page, inputSelector) {
	await page.type(inputSelector, '');
	await page.keyboard.down('Control');
	await page.keyboard.down('KeyA');
	await page.keyboard.up('KeyA');
	await page.keyboard.up('Control');
	await page.keyboard.press('Delete');
}
