const loki = require('lokijs');
const util = require('util');

const config = require('./config');
const utils = require('./utils');

const db = new loki(config.dbFile, {verbose: true});
const loadDatabase = util.promisify(db.loadDatabase.bind(db));
const saveDatabase = util.promisify(db.saveDatabase.bind(db));
let itemsCollection;

async function loadItems() {
    await loadDatabase({});

    itemsCollection = db.getCollection('items');
    if(!itemsCollection)
        itemsCollection = db.addCollection('items', {unique: 'link'});

    // read input XML file
    if(config.inputFile) {
        const xml = await utils.readXMLFile(config.inputFile);
        const items = xml.xml.annonce;
        const requiredKeys = ['link', 'title', 'price', 'location', 'pictures'];

        // process items
        console.log(items.length + ' items to process.');
        const processedItems = await Promise.all(items.map(async (item) => {
            const processedItem = {};
            processedItem.link = item.lien[0];
            processedItem.title = item.type[0];
            processedItem.price = item.prix[0].replace(',00 EUR', '');
            processedItem.location = item.ville && item.ville[0];
            processedItem.description = item.descriptif[0];
            processedItem.category = config.itemCategory;
               
            if(item.photos) {
                processedItem.pictures = [];
                for(let photo of item.photos[0].photo)
                    processedItem.pictures.push(await utils.downloadFile(photo, config.picturesFolder));
            }

            for(let key of requiredKeys) {
                if(!processedItem[key]) {
                    console.error('Processed item is invalid : "' + processedItem.link + '", missing key "' + key + '".');
                    return null;
                }
            }

            return processedItem;
        }));

        let counter = 0;
        for(let item of processedItems) {
            if(!item)
                continue;
            if(itemsCollection.findOne({link: item.link}))
                ;//console.warn('Item "' + item.link + '" already exists in database.');
            else {
                item.processed = false;
                itemsCollection.insert(item);
                //console.log('Item "' + item.link + '" inserted into database.');
            }
            counter++;
        }
        
        await saveDatabase();
        console.log(counter + ' new items loaded into database.');
    }

    return itemsCollection.find({processed: false});
}

async function markItemAsProcessed(itemLink) {
    const item = itemsCollection.findOne({link: itemLink});
    if(!item) {
        console.error('The item "' + itemLink + '" has not been found into database.');
        return;
    }
    item.processed = true;
    itemsCollection.update(item);
    await saveDatabase();
    console.log('Item marked as processed.');
}

module.exports = {
    loadItems: loadItems,
    markItemAsProcessed: markItemAsProcessed
};