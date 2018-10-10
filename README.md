# Facebook-Marketplace-Client

## Installation
Avec un terminal, se placer à la racine du projet, puis lancer :
```bash
npm install
```

## Configuration
Copier le fichier "assets/config.template" à la racine du projet en renommant "config.js". Puis le compléter comme suit :
```javascript
module.exports  = {
  picturesFolder: 'assets/pictures/',
  cookiesFile: 'assets/cookies.json',
  insertInputFile: 'assets/insertInput.xml', // fichier d'entrée contenant les annonces à poster
  updateInputFile: 'assets/updateInput.xml', // fichier d'entrée contenant les annonces à modifier
  deleteInputFile: 'assets/deleteInput.xml', // fichier d'entrée contenant les annonces à retirer
  outputFile: 'assets/output.xml', // fichier généré en sortie
  dbFile: 'assets/db.json', // fichier contenant le datastore (base de données portable) du projet
  login: 'TO_COMPLETE', // votre identifiant Facebook
  password: 'TO_COMPLETE', // votre mot de passe Facebook
  itemCategory: 'Property For Sale', // la catégorie des objets à mettre en vente (doit être en anglais)
  headless: false, // détermine si le navigateur est affiché ou non (laisser à false si vous voulez voir ce qu'il se passe pendant l'exécution du script)
  commit: false, // lorsque cette valeur vaut false, la mise en vente est simplement simulée, mettre à true si vous souhaitez réellement mettre les items en vente
  intervalBetweenActions: [30, 300] // intervalle minimum et maximum en secondes entre chaque action (mise en vente, édition ou suppression)
}
```

## Tests
Il peut être intéressant de lancer les tests pour constater que le script fonctionne bien :
```bash
npm test
```

## Exécution
Avant de pouvoir poster des annonces, il est nécessaire de télécharger un fichier XML qui fera office de fichier d'entrée pour compléter la base de données. Il en va de même pour modifier ou supprimer des annonces de la base de données. Pour télécharger depuis l'API de consortium-immobilier.fr chaque fichier correspondant à une action, lancer les commandes suivantes :
```bash
npm run download-insert-input
npm run download-update-input
npm run download-delete-input
```
Ensuite, pour poster, modifier ou supprimer des annonces, les commandes à effectuer sont les suivantes :
```bash
npm run post-ads // ou npm start
npm run edit-ads
npm run remove-ads
```
Pour générer un fichier d'output listant les annonces postées :
```bash
npm run generate-output
```
## Achitecture
Le projet fait appel à [Puppeteer](https://github.com/GoogleChrome/puppeteer), un driver NodeJS pour Google Chrome headless et [LokiJS](http://lokijs.org), une base de données in-memory portable.  
Au lancement du script, le fichier input, si présent, est lu et parsé, puis chaque item récupéré dans ce fichier est inséré dans la base de données (à condition qu'il n'y soit pas déjà, le lien de l'item joue le rôle de clé unique). Ensuite, les items de la base de données sont parcourus tour à tour afin d'être mis en vente. Une fois un item mis en vente, il est marqué comme traité et n'est plus jamais parcouru.
