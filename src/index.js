const config = require('../config');
const ItemsManager = require('./items_manager');
const ItemsSeller = require('./items_seller');

(async function main() {
    const args = process.argv.slice(2);

    let mode = null;
    for(let i in args) {
        if(args[i] == '--mode')
            mode = i < args.length && args[i + 1];
    }

    const itemsManager = new ItemsManager(config);

    if(!mode || mode == 'posting') {
        const items = await itemsManager.loadItems();
        if(!items.length) {
            console.error('No item to process.');
            process.exit(1);
        }

        if(!config.login || !config.password)
            throw Error('Missing credential definition in the config file.');

        const itemsSeller = new ItemsSeller(config);
        await itemsSeller.open();
        await itemsSeller.goToMarketPlace();
        await itemsSeller.sellItems(items);

        const bindings = await itemsSeller.fetchAdBindings();
        await itemsManager.updateItemsWithBindings(bindings);

        await itemsSeller.close();
    }
    else if(mode == 'edition') {
        console.log('Not implemented yet.');
    }
    else if(mode == 'deletion') {
        console.log('Not implemented yet.');
    }
    else {
        console.error('Invalid provided mode.');
        process.exit(1);
    }
})();