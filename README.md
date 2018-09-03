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
  inputFile: 'assets/input.xml', // fichier d'input contenant les items à mettre en vente
  outputFile: 'assets/output.xml', // fichier d'output généré en sortie
  dbFile: 'assets/db.json', // fichier contenant le datastore (base de données portable) du projet
  login: 'TO_COMPLETE', // votre identifiant Facebook
  password: 'TO_COMPLETE', // votre mot de passe Facebook
  itemCategory: 'Property For Sale', // la catégorie des objets à mettre en vente (doit être en anglais)
  headless: false, // détermine si le navigateur est affiché ou non (laisser à false si vous voulez voir ce qu'il se passe pendant l'exécution du script)
  commit: false, // lorsque cette valeur vaut false, la mise en vente est simplement simulée, mettre à true si vous souhaitez réellement mettre les items en vente
  intervalBetweenSellings: [30, 300] // intervalle minimum et maximum en secondes entre chaque vente
}
```

## Exécution
Avant de pouvoir poster des annonces, il est nécessaire de télécharger un fichier XML qui fera office de fichier d'entrée pour compléter la base de données. Pour télécharger ce fichier depuis l'API de consortium-immobilier.fr, lancer la commande suivante :
```bash
npm run download-input
```
Pour lancer la mise en vente d'annonces :
```bash
npm start
```
ou
```bash
npm run post-ads
```
Pour lancer l'édition d'annonces existantes :
```bash
npm run edit-ads
```
Pour lancer la suppression d'annonces en ligne :
```bash
npm run remove-ads
```
Pour générer un fichier d'output listant les annonces postées :
```bash
npm run generate-output
```
## Achitecture
Le projet fait appel à [Puppeteer](https://github.com/GoogleChrome/puppeteer), un driver NodeJS pour Google Chrome headless et [LokiJS](http://lokijs.org), une base de données in-memory portable.  
Au lancement du script, le fichier input, si présent, est lu et parsé, puis chaque item récupéré dans ce fichier est inséré dans la base de données (à condition qu'il n'y soit pas déjà, le lien de l'item joue le rôle de clé unique). Ensuite, les items de la base de données sont parcourus tour à tour afin d'être mis en vente. Une fois un item mis en vente, il est marqué comme traité et n'est plus jamais parcouru.
