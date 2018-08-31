const loki = require('lokijs');
const util = require('util');

const config = require('./config');
const utils = require('./utils');

const db = new loki(config.dbFile, {verbose: true});
const loadDatabase = util.promisify(db.loadDatabase.bind(db));
const saveDatabase = util.promisify(db.saveDatabase.bind(db));
const requiredKeys = ['link', 'title', 'price', 'location', 'description', 'pictures'];
let itemsCollection;

async function loadItems(inputFile) {
    await loadDatabase({});

    // load or create the items collection
    itemsCollection = db.getCollection('items');
    if(!itemsCollection)
        itemsCollection = db.addCollection('items', {unique: 'link'});

    // if input file exists
    if(inputFile && await utils.fileExists(inputFile)) {
        console.log('Loading items from file "' + inputFile + '"...');

        // read xml file
        const xml = await utils.readXMLFile(inputFile);

        // process items
        const processedItems = await processItems(xml.xml.annonce, requiredKeys);

        // save processed items into database       
        await saveItemsIntoDatabase(processedItems);
    }

    // return the unprocessed items from the database
    return itemsCollection.find({processed: false});
}

async function processItems(items, requiredKeys = []) {
    console.log(items.length + ' items to process.');
    return await Promise.all(items.map(async (item) => {
        const processedItem = {};
        processedItem.link = item.lien[0];
        processedItem.title = item.type[0];
        processedItem.price = item.prix[0].replace(',00 EUR', '');
        processedItem.location = item.ville && item.ville[0];
        processedItem.description = item.descriptif && item.descriptif[0];
        processedItem.category = config.itemCategory;
            
        if(item.photos) {
            processedItem.pictures = [];
            for(let photo of item.photos[0].photo) {
                let picturePath = await utils.downloadFile(photo, config.picturesFolder);
                if(picturePath)
                    processedItem.pictures.push(picturePath);
            }
            if(!processedItem.pictures.length) {
                console.error('Unexpected issue when reading pictures from item "' + processedItem.link + '".');
                //console.error(processedItem);
                return null;
            }
        }

        for(let key of requiredKeys) {
            if(!processedItem[key]) {
                console.error('Processed item is invalid : "' + processedItem.link + '", missing key "' + key + '".');
                //console.error(processedItem);
                return null;
            }
        }

        return processedItem;
    }));
}

async function saveItemsIntoDatabase(items) {
    let counter = 0;
    for(let item of items) {
        if(!item)
            continue;
        if(itemsCollection.findOne({link: item.link}))
            ;//console.warn('Item "' + item.link + '" already exists in database.');
        else {
            item.processed = false;
            itemsCollection.insert(item);
            //console.log('Item "' + item.link + '" inserted into database.');
            counter++;
        }
    }
    
    await saveDatabase();
    console.log(counter + ' new items loaded into database.');
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