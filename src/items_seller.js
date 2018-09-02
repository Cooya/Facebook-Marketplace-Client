const sleep = require('sleep');

const pup = require('./utils/pup_utils');

class ItemsSeller {
    startingPointUrl = 'https://www.facebook.com/marketplace/';

    constructor(cookiesFile, options = {}) {
        this.cookiesFile = cookiesFile;

        // open browser and load cookies
        this.browser = await pup.runBrowser({headless: config.headless});
        this.page = await pup.createPage(this.browser, cookiesFile);
        await pup.loadCookies(this.page, cookiesFile);
    }
    
    goToMarketPlace() {
        // go to the marketplace and log in if needed
        await pup.goTo(this.page, ItemsSeller.startingPointUrl);
        const loginForm = await this.page.$('#login_form');
        if(loginForm) {
            if(!config.login || !config.password)
                throw Error('Missing credential declaration in the config file.');
            await logIn(this.page, config.login, config.password);
            await this.page.waitForNavigation();
            await sleep.sleep(1);
            await pup.saveCookies(this.page, config.cookiesFile);
        }
    }

    sellItems(items, commit = false) {
        for(let item of items) {
            console.log('Putting item "' + item.title + '" to sell...');
            await fillSellForm(this.page, item, commit);
            if(commit)
                await manager.markItemAsProcessed(item.id);
            console.log('Selling has succeeded.');
        }
    }

    close() {
        await this.browser.close();
        console.log('Seller closed.');
    }
}

async function logIn(page, login, password) {
    console.log('Logging in...');
    const loginValue = await pup.value(page, '#email');
    if(!loginValue) {
        await page.type('#email', login);
        await sleep.msleep(500);
    }
    await page.type('#pass', password);
    await sleep.msleep(500);
    await page.click("#loginbutton");
    console.log('Logged in.');
}

async function fillSellForm(page, item, commit = false) {
    // open selling form modal
    await page.click('div[role=navigation]:nth-child(1) button');
    await page.waitForSelector('div[role=dialog] input');
    await sleep.sleep(1);

    // remove previous pictures if needed
    while(await page.$('button[title="Remove photo"]')) {
        await page.click('button[title="Remove photo"]');
        await sleep.msleep(500);
    }

    // empty description if needed
    const previousDescriptionValue = await pup.attribute(page, 'div[aria-multiline="true"]', 'textContent');
    if(previousDescriptionValue) {
        await page.type('div[aria-multiline="true"]', '');
        await page.keyboard.down('Control');
        await page.keyboard.down('KeyA');
        await page.keyboard.up('KeyA');
        await page.keyboard.up('Control');
        await page.keyboard.press('Delete');
    }
    
    // title, price and description
    await page.type('input[placeholder="What are you selling?"]', item.title);
    await sleep.msleep(500);
    await page.type('input[placeholder="Price"]', item.price);
    await sleep.msleep(500);
    await page.type('div[aria-multiline="true"]', item.description);
    await sleep.msleep(500);

    // location
    await page.click('input[placeholder="Add Location"]');
    await sleep.msleep(500);
    await page.type('input[placeholder="Add Location"]', item.location);
    await sleep.msleep(2000);
    await page.keyboard.press('ArrowDown');
    await sleep.msleep(500);
    await page.keyboard.press('Enter');
    await sleep.msleep(500);

    // category
    await page.type('input[placeholder="Select a Category"]', item.category);
    await sleep.msleep(500);
    await page.keyboard.press('ArrowDown');
    await sleep.msleep(500);
    await page.keyboard.press('Enter');
    await sleep.msleep(500);

    // pictures
    await (await page.$('input[title="Choose a file to upload"]')).uploadFile(...item.pictures);
    await page.waitForSelector('div[role=dialog] button[type="submit"][aria-haspopup="true"]:disabled', {hidden: true}) // :not('disabled') not working
    console.log('Pictures uploaded.')
    await sleep.sleep(1);

    // submit the form
    if(commit) {
        await page.click('div[role=dialog] button[type="submit"][aria-haspopup="true"]');
        await page.waitForSelector('div[role=dialog] button[type="submit"][aria-haspopup="true"]', {hidden: true});
        await sleep.sleep(utils.getRandomNumber(config.intervalBetweenSellings[0], config.intervalBetweenSellings[1]));
    }
    else { // discard the form
        await page.click('button.layerCancel');
        await page.waitForSelector('div.uiOverlayFooter');
        await sleep.msleep(500);
        await page.click('div.uiOverlayFooter button:nth-child(1)');
        await page.waitForSelector('div[role=dialog] button[type="submit"][aria-haspopup="true"]', {hidden: true});
        await sleep.sleep(2);
    }
}