# TODO

* ~~passer l'intervalle entre chaque action en paramètre du launcher~~
* ~~ne pas lancer un sleeping s'il n'y a plus d'action à traiter~~
* créer une commande "npm run sync" qui vérifie (et qui corrige) la base de données ou les objets en vente s'il y a une différence entre les deux
* ~~sélection d'une annonce à modifier ou à supprimer via le lien et non le titre~~
* améliorer l'attente de la réception de la requête GraphQL qui permet de d'obtenir la liste des annonces en ligne



Deux moyens de savoir si un item a bien été posté :
* vérifier le premier item de la liste dans le HTML, mais pas de facebook id
* attendre la réponse de la requête à GraphQL, récupération du facebook id (mais des fois, elle n'est pas envoyée...)