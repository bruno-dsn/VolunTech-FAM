// Pre-carregado com "--require" ao iniciar o Wrangler dentro do Electron.
//
// O yargs (usado pelo Wrangler) detecta um "app Electron empacotado" e passa a
// descartar apenas 1 item do argv em vez de 2. Resultado: o caminho do script
// vira "argumento desconhecido" e o Wrangler so imprime a ajuda. Marcar
// defaultApp = true restaura o comportamento normal do Node.
process.defaultApp = true;
