const sleep = require('sleep');

const config = require('./config');
const manager = require('./items_manager');
const pup = require('./pup_utils');

const startingPointUrl = 'https://www.facebook.com/marketplace/';

(async function main() {
    const items = await manager.loadItems(config.inputFile);
    if(!items.length) {
        console.warn('No item to process.');
        return;
    }

    // open browser and load cookies
    const browser = await pup.runBrowser({headless: config.headless});
    const page = await pup.createPage(browser, config.cookiesFile);
    await pup.loadCookies(page, config.cookiesFile);

    // go to the marketplace and log in if needed
    await pup.goTo(page, startingPointUrl);
    const loginForm = await page.$('#login_form');
    if(loginForm) {
        if(!config.login || !config.password)
            throw Error('Missing credential declaration in the config file.');
        await logIn(page, config.login, config.password);
        await page.waitForNavigation();
        await sleep.sleep(1);
        await pup.saveCookies(page, config.cookiesFile);
    }

    // put items to sell
    for(let item of items) {
        console.log('Putting item "' + item.title + '" to sell...');
        await fillSellForm(page, item, config.commit);
        if(config.commit)
            await manager.markItemAsProcessed(item.link);
        console.log('Selling has succeeded.');
    }

    console.log('Process done.');
    await browser.close();
})();

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