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
            console.log('Putting item "' + item.title + '" to sell...');
            await fillSellForm.call(this, item);
            if(this.commit)
                await manager.markItemAsProcessed(item.id);
            console.log('Selling has succeeded.');
        }
    }

    async close() {
        await this.browser.close();
        console.log('Seller closed.');
    }
};

logIn = async function() {
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

fillSellForm = async function(item) {
    // open selling form modal
    await this.page.click('div[role=navigation]:nth-child(1) button');
    await this.page.waitForSelector('div[role=dialog] input');
    await sleep.sleep(1);

    // remove previous pictures if needed
    while(await this.page.$('button[title="Remove photo"]')) {
        await this.page.click('button[title="Remove photo"]');
        await sleep.msleep(500);
    }

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
    await (await this.page.$('input[title="Choose a file to upload"]')).uploadFile(...item.pictures);
    await this.page.waitForSelector('div[role=dialog] button[type="submit"][aria-haspopup="true"]:disabled', {hidden: true}) // :not('disabled') not working
    console.log('Pictures uploaded.')
    await sleep.sleep(1);

    // submit the form
    if(this.commit) {
        await this.page.click('div[role=dialog] button[type="submit"][aria-haspopup="true"]');
        await this.page.waitForSelector('div[role=dialog] button[type="submit"][aria-haspopup="true"]', {hidden: true});
        await sleep.sleep(utils.getRandomNumber(intervalBetweenSellings[0], intervalBetweenSellings[1]));
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