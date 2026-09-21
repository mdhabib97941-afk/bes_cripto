const fs = require('fs');
let app = fs.readFileSync('public/app.js', 'utf8');

app = app.replace('Demand: $\\${parseFloat(data.demandVolume).toLocaleString()}', '\\${parseFloat(data.demandVolume).toLocaleString()} Coins');
app = app.replace('Supply: $\\${parseFloat(data.supplyVolume).toLocaleString()}', '\\${parseFloat(data.supplyVolume).toLocaleString()} Coins');

fs.writeFileSync('public/app.js', app);
console.log('Fixed Demand/Supply text overlay.');
