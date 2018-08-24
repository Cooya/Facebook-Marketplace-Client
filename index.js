const sleep = require('sleep');

const config = require('./config');
const pup = require('./pup_utils');
const utils = require('./utils');

const startingPointUrl = 'https://www.facebook.com/marketplace/';

(async function main() {

    // read input XML file
    if(!config.inputFile)
        throw Error('Missing input file declaration in config file.')
    const xml = await utils.readXMLFile(config.inputFile);
    const items = xml.rss.channel[0].item;
    if(!items)
        throw Error('No item to sell.');

    // process items
    for(let item of items) {
        const result = /([0-9 ]+) euros/.exec(item.title[0]);
        if(!result || result.length != 2)
            throw Error('Invalid item title : ' + item.title);
        item.title = item.title[0].substr(0, result.index);
        item.price = result[1].trim();
        item.description = item.link[0];
        item.pictures = [await utils.downloadFile(item.image[0], config.picturesFolder)];
        console.log(item);
        
        if(!item.title || !item.price || !item.description || !item.pictures || !item.pictures.length)
            throw Error('Processed item is invalid : ' + JSON.stringify(item));
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
        await clickOnSellButton(page);
        await fillSellForm(page, item.title, item.price, config.itemCategory, item.description, item.pictures);
        console.log('Selling has succeeded.');
    }

    //await browser.close();
})();

async function logIn(page, login, password) {
    console.log('Logging in...');
    const loginValue = await pup.getValue(page, '#email');
    if(!loginValue) {
        await page.type('#email', login);
        await sleep.msleep(500);
    }
    await page.type('#pass', password);
    await sleep.msleep(500);
    await page.click("#loginbutton");
    console.log('Logged in.');
}

async function clickOnSellButton(page) {
    await page.click('div[role=navigation]:nth-child(1) button');
    await page.waitForSelector('div[role=dialog] input');
    await sleep.sleep(1);
}

async function fillSellForm(page, title, price, category, description, pictures) {
    // title, price and description
    await page.type('input[placeholder="What are you selling?"]', title);
    await sleep.msleep(500);
    await page.type('input[placeholder="Price"]', price);
    await sleep.msleep(500);
    await page.type('div[aria-multiline="true"]', description)
    await sleep.msleep(500);

    // category
    await page.type('input[placeholder="Select a Category"]', category);
    await sleep.msleep(500);
    await page.keyboard.press('ArrowDown');
    await sleep.msleep(500);
    await page.keyboard.press('Enter');
    await sleep.msleep(500);

    // pictures
    await (await page.$('input[title="Choose a file to upload"]')).uploadFile(...pictures);
    await page.waitForSelector('div[role=dialog] button[type="submit"][aria-haspopup="true"]:disabled', {hidden: true}) // :not('disabled') not working
    console.log('Pictures uploaded.')
    await sleep.sleep(1);


    // submit the form
    await page.click('div[role=dialog] button[type="submit"][aria-haspopup="true"]');
    await page.waitForSelector('div[role=dialog] button[type="submit"][aria-haspopup="true"]', {hidden: true});
    await sleep.sleep(10);
}