import { copyFileSync } from 'node:fs';

// GitHub Pages n'a pas de SPA fallback natif : une URL directe comme
// /OS-360-viewer/viewer?id=XXX renverrait 404.
// On copie index.html vers 404.html (même shell SPA) : le navigateur garde
// l'URL demandée, le routeur client lit /viewer?id= et affiche la visonneuse.
copyFileSync('dist/index.html', 'dist/404.html');
console.log('SPA fallback: dist/404.html generated from dist/index.html');
