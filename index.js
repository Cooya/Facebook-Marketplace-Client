const sleep = require('sleep');

const config = require('./config');
const pup = require('./pup_utils');
const reader = require('./reader');

const startingPointUrl = 'https://www.facebook.com/marketplace/';

(async function main() {

    // read input XML file
    if(!config.inputFile)
        throw Error('Missing input file declaration in config file.')
    const xml = await reader.readXMLFile(config.inputFile);
    const items = xml.rss.channel[0].item;
    if(!items)
        throw Error('No item to sell.');

    // open browser and load cookies
    const browser = await pup.runBrowser({headless: false});
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

    for(let item of items) {
        await clickOnSellButton(page);
        await fillSellForm(page, 'toto', '50', 'Cars, Trucks & Motorcycles', 'salut les gens');
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

async function fillSellForm(page, title, price, category, description, pics) {
    await page.type('input[placeholder="What are you selling?"]', title);
    await sleep.msleep(500);
    await page.type('input[placeholder="Price"]', price);
    await sleep.msleep(500);
    await page.type('input[placeholder="Select a Category"]', category);
    await sleep.msleep(500);
    await page.keyboard.press('ArrowDown');
    await sleep.msleep(500);
    await page.keyboard.press('Enter');
    await sleep.msleep(500);
    await page.type('div[aria-multiline="true"]', description)
    await sleep.msleep(500);

    const elementHandle = await page.$('input[title="Choose a file to upload"]');
    await elementHandle.uploadFile('hero.jpg');
    await sleep.msleep(500);
}