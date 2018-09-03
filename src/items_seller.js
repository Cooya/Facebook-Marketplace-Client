const sleep = require('sleep');

const pup = require('./utils/pup_utils');

const marketplaceUrl = 'https://www.facebook.com/marketplace/';
const marketplaceSellingUrl = 'https://www.facebook.com/marketplace/selling';

module.exports = class ItemsSeller {

    constructor(config) {
        this.login = config.login;
        this.password = config.password;
        this.cookiesFile = config.cookiesFile;
        this.commit = config.commit
        this.intervalBetweenSellings = config.intervalBetweenSellings;
        this.headless = config.headless;
    }

    async open() {
        // open browser and load cookies
        this.browser = await pup.runBrowser({headless: this.headless});
        this.page = await pup.createPage(this.browser, this.cookiesFile);
        await pup.loadCookies(this.page, this.cookiesFile);
    }
    
    async goToMarketPlace(url = marketplaceUrl) {
        // go to the marketplace and log in if needed
        await pup.goTo(this.page, url);
        const loginForm = await this.page.$('#login_form');
        if(loginForm) {
            await logIn.call(this);
            await this.page.waitForNavigation();
            await sleep.sleep(1);
            await pup.saveCookies(this.page, this.cookiesFile);
        }
    }

    async fetchAdBindings() {
        const promise = new Promise((resolve, reject) => {
            this.page.on('response', async (response) => {
                if(response.url() == 'https://www.facebook.com/api/graphql/' && response.request().postData().indexOf('MARKETPLACE_SELLING_ITEM_IMAGE_WIDTH') != -1) {
                    console.log('Processing ads list...');
                    let json = await response.json();
                    const bindings = [];
                    for(let ad of json.data.viewer.selling_feed_one_page.edges)
                        bindings.push({fbId: ad.node.id, title: ad.node.group_commerce_item_title});
                    resolve(bindings);
                }
            });
        });
        await this.goToMarketPlace(marketplaceSellingUrl);
        return promise;
    }

    async sellItems(items) {
        for(let item of items) {
            console.log('Selling item "' + item.title + '"...');
            await openSellFormModal.call(this);
            await fillSellForm.call(this, item);
            if(this.commit)
                await manager.markItemAsProcessed(item.id);
            console.log('Selling has succeeded.');
        }
    }

    async editItems(items) {
        for(let item of items) {
            console.log('Updating item "' + item.title + '"...');
            await manageItem.call(this, item, 'edit');
            if(this.commit)
                await manager.editItem(item.id);
            console.log('Item has been updated successfully.');
        }
    }

    async removeItems(items) {
        for(let item of items) {
            console.log('Removing item "' + item.title + '"...');
            await manageItem.call(this, item, 'remove');
            if(this.commit)
                await manager.removeItem(item.id);
            console.log('Item has been removed successfully.');
        }
    }

    async close() {
        await this.browser.close();
        console.log('Seller closed.');
    }
};

async function logIn() {
    console.log('Logging in...');
    const loginValue = await pup.value(this.page, '#email');
    if(!loginValue) {
        await this.page.type('#email', this.login);
        await sleep.msleep(500);
    }
    await this.page.type('#pass', this.password);
    await sleep.msleep(500);
    await this.page.click("#loginbutton");
    console.log('Logged in.');
}

async function openSellFormModal() {
    await this.page.click('div[role=navigation]:nth-child(1) button');
    await this.page.waitForSelector('div[role=dialog] input');
    await sleep.sleep(1);
}

async function fillSellForm(item) {
    const cleanPictures = async () => {
        const selector = 'button[title="Remove photo"], div.fbScrollableAreaContent button[title="Remove"]';
        while(await this.page.$(selector)) {
            await this.page.click(selector);
            await sleep.msleep(500);
        }
    };

    await cleanPictures(); // remove previous pictures if needed

    // empty description if needed
    const previousDescriptionValue = await pup.attribute(this.page, 'div[aria-multiline="true"]', 'textContent');
    if(previousDescriptionValue) {
        await this.page.type('div[aria-multiline="true"]', '');
        await this.page.keyboard.down('Control');
        await this.page.keyboard.down('KeyA');
        await this.page.keyboard.up('KeyA');
        await this.page.keyboard.up('Control');
        await this.page.keyboard.press('Delete');
    }
    
    // title, price and description
    await this.page.type('input[placeholder="What are you selling?"]', item.title);
    await sleep.msleep(500);
    await this.page.type('input[placeholder="Price"]', item.price);
    await sleep.msleep(500);
    await this.page.type('div[aria-multiline="true"]', item.description);
    await sleep.msleep(500);

    // location
    await this.page.click('input[placeholder="Add Location"]');
    await sleep.msleep(500);
    await this.page.type('input[placeholder="Add Location"]', item.location);
    await sleep.msleep(2000);
    await this.page.keyboard.press('ArrowDown');
    await sleep.msleep(500);
    await this.page.keyboard.press('Enter');
    await sleep.msleep(500);

    // category
    await this.page.type('input[placeholder="Select a Category"]', item.category);
    await sleep.msleep(500);
    await this.page.keyboard.press('ArrowDown');
    await sleep.msleep(500);
    await this.page.keyboard.press('Enter');
    await sleep.msleep(500);

    // pictures
    for(let i = 0; i < 3; ++i) {
        await (await this.page.$('input[title="Choose a file to upload"]')).uploadFile(...item.pictures);
        try {
            await this.page.waitForSelector('div[role=dialog] button[type="submit"][aria-haspopup="true"]:disabled', {hidden: true}) // :not('disabled') not working
            break;
        }
        catch(e) {
            if(await this.page.$('div[aria-haspopup="true"] p')) { // error in pictures upload
                console.error('Error in pictures upload, trying again...');
                await cleanPictures();
            }
            else throw e;
        }
    }
    if(await this.page.$('div[aria-haspopup="true"] p')) {
        console.error('One or several pictures are invalid for the item "' + item.title + '".');
        await sleep.sleep(1);
        return;
    }
    console.log('Pictures uploaded successfully.');
    await sleep.sleep(1);
    

    // submit the form
    if(this.commit) {
        await this.page.click('div[role=dialog] button[type="submit"][aria-haspopup="true"]');
        await this.page.waitForSelector('div[role=dialog] button[type="submit"][aria-haspopup="true"]', {hidden: true});
        await sleep.sleep(utils.getRandomNumber(this.intervalBetweenSellings[0], this.intervalBetweenSellings[1]));
    }
    else { // discard the form
        await this.page.click('button.layerCancel');
        await this.page.waitForSelector('div.uiOverlayFooter');
        await sleep.msleep(500);
        await this.page.click('div.uiOverlayFooter button:nth-child(1)');
        await this.page.waitForSelector('div[role=dialog] button[type="submit"][aria-haspopup="true"]', {hidden: true});
        await sleep.sleep(2);
    }
}

async function manageItem(item, action) {
    const actions = {
        'edit': editItem,
        'remove': removeItem
    };

    if(!this.page.url() != marketplaceSellingUrl) {
        await this.goToMarketPlace(marketplaceSellingUrl);
        await sleep.msleep(500);
    }

    const itemContainers = await this.page.$$('div.clearfix [direction="left"]');
    for(let itemContainer of itemContainers) {
        if(await itemContainer.$('span[title="' + item.title + '"')) {
            await this.page.click('a > span > i[alt=""]');
            await this.page.waitForSelector('li[role="presentation"] > a[role="menuitem"]');
            await sleep.msleep(500);
            actions[action].call(this, item);
            break;
        }
    }
}

async function editItem(item) {
    await this.page.click('li[role="presentation"]:nth-child(1) > a[role="menuitem"]');
    await this.page.waitForSelector('div[role=dialog] input');
    await sleep.sleep(1);
    await fillSellForm.call(this, item);
    console.log('Item updated sucessfully.');
}

async function removeItem() {
    await this.page.click('li[role="presentation"]:nth-child(1) > a[role="menuitem"]');
    await this.page.waitForSelector('div[data-testid="simple_xui_dialog_footer"]');
    await sleep.msleep(500);
    if(this.commit) {
        await this.page.click('div[data-testid="simple_xui_dialog_footer"] a[action="cancel"]:nth-child(2)');
        await this.page.waitForSelector('div[data-testid="simple_xui_dialog_footer"]', {hidden: true});
        await sleep.sleep(utils.getRandomNumber(this.intervalBetweenSellings[0], this.intervalBetweenSellings[1]));
    }
    else {
        await this.page.click('div[data-testid="simple_xui_dialog_footer"] a[action="cancel"]:nth-child(1)');
        await this.page.waitForSelector('div[data-testid="simple_xui_dialog_footer"]', {hidden: true});
        await this.page.sleep(2);
    }
    console.log('Item removed sucessfully.');
}