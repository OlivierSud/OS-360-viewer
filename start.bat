@echo off
title Virtual Tour Editor - Serveur Local

echo ===================================================
echo     Lancement de Virtual Tour Editor...
echo ===================================================
echo.

:: Vérifie si les dépendances sont installées
if not exist "node_modules\" (
    echo [INFO] Premiere execution detectee. Installation des dependances en cours...
    echo Cela peut prendre quelques minutes.
    call npm install
    echo.
    echo [INFO] Dependances installees avec succes !
    echo.
)

echo [INFO] Demarrage du serveur local...
echo La page internet va s'ouvrir automatiquement.
echo.

:: Lance le serveur Vite avec l'option --open pour ouvrir le navigateur automatiquement
call npm run dev -- --open

:: Met le script en pause si le serveur s'arrête de manière inattendue
pause
