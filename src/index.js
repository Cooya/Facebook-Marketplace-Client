const sleep = require('sleep');

const config = require('../config');
const ItemsManager = require('./items_manager');
const ItemsSeller = require('./items_seller');
const utils = require('./utils/utils');

const modes = {
    posting: {
        file: config.insertInputFile,
        fct: ItemsManager.prototype.loadItemsToSell
    },
    edition: {
        file: config.updateInputFile,
        fct: ItemsManager.prototype.loadItemsToEdit
    },
    deletion: {
        file: config.deleteInputFile,
        fct: ItemsManager.prototype.loadItemsToRemove
    }
};

(async function main() {
    if(!config.login || !config.password)
        throw Error('Missing credential definition in the config file.');

    const args = process.argv.slice(2);
    let mode = null;
    for(let i in args) {
        if(args[i] == '--mode')
            mode = i < args.length && args[Number.parseInt(i) + 1];
    }

    if(!modes[mode])
        throw Error('Invalid provided mode.');

    const itemsManager = new ItemsManager(config);
    const items = await modes[mode].fct.call(itemsManager, modes[mode].file);
    if(!items.length)
        throw Error('No item to process.');
    
    const itemsSeller = new ItemsSeller(config);
    await itemsSeller.open();

    if(mode == 'posting') {
        for(let item of items) {
            console.log('Selling item "' + item.title + '"...');
            await itemsSeller.sellItem(item);
            if(config.commit)
                await itemsManager.updateItemsWithBindings(itemsSeller.bindings);
            await randomSleep(config.intervalBetweenSellings, config.commit);
            console.log('Item "%s" is now selling.', item.id);
        }    
    }
    else if(mode == 'edition') {
        for(let item of items) {
            if(!getProcessedItem(item.id, itemsManager))
                continue;

            console.log('Updating item "%s"...', item.id);
            const success = await itemsSeller.manageItem(item, 'edit');
            if(success) {
                if(config.commit)
                    await itemsManager.updateItem(item);
                await randomSleep(config.intervalBetweenSellings, config.commit);
                console.log('Item "%s" has been updated successfully.', item.id);
            }
        }
    }
    else if(mode == 'deletion') {
        let processedItem;
        for(let id of items) {
            processedItem = getProcessedItem(id, itemsManager);
            if(!processedItem)
                continue;

            console.log('Removing item "%s"...', id);
            await itemsSeller.manageItem(processedItem, 'remove');
            if(config.commit)
                await itemsManager.removeItem(processedItem);
            await randomSleep(config.intervalBetweenSellings, config.commit);
            console.log('Item "%s" has been removed successfully.', id);
        }
    }
    
    await itemsSeller.close();
})();

function getProcessedItem(id, itemsManager) {
    const item = itemsManager.getItem(id);
    if(!item) {
        console.error('Item "%s" not found into database.', id);
        return null;
    }
    if(!item.fbId) {
        console.error('Item "%s" has not been processed yet.', id);
        return null;
    }
    return item;
}

async function randomSleep(interval, commit) {
    let seconds = commit ? utils.getRandomNumber(interval[0], interval[1]) : 2;
    console.log('Sleeping for %s seconds...', seconds);
    await sleep.sleep(seconds);
}