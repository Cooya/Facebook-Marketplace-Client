const config = require('../config');
const manager = require('./items_manager');

(async function main() {
    const args = process.argv.slice(2);

    let mode = null;
    for(let i in args) {
        if(args[i] == '--mode')
            mode = i < args.length && args[i]
    }

    if(!mode || mode == 'posting') {

    }
    else if(mode == 'edition') {
        
    }
    else if(mode == 'deletion') {
        
    }
    else {
        console.error('Invalid provided mode.');
        process.exit(1);
    }
    
    const items = await manager.loadItems(config.inputFile);
    if(!items.length) {
        console.warn('No item to process.');
        return;
    }
})();