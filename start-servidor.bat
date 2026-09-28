@echo off
REM EstoquePro - inicia o servidor (necessario para usar o sistema no navegador)
cd /d "%~dp0"
echo ============================================
echo  EstoquePro - Controle de Estoque
echo  Acesse: http://localhost:3000
echo  Nao feche esta janela enquanto usar o sistema.
echo ============================================
node server.js
pause
