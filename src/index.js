const config = require('../config');
const manager = require('./items_manager');
const ItemsSeller = require('./items_seller');

(async function main() {
    const args = process.argv.slice(2);

    let mode = null;
    for(let i in args) {
        if(args[i] == '--mode')
            mode = i < args.length && args[i + 1];
    }

    const items = await manager.loadItems(config.inputFile);

    if(!mode || mode == 'posting') {
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
        await itemsSeller.close();
    }
    else if(mode == 'edition') {
        
    }
    else if(mode == 'deletion') {
        
    }
    else {
        console.error('Invalid provided mode.');
        process.exit(1);
    }
})();