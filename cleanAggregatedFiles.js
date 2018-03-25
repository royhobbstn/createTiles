const fs = require('fs');

// node --max_old_space_size=8192 cleanAggregatedFiles.js bg 2016
// (geotype, year)

console.log(`geotype: ${process.argv[2]}`);
console.log(`year: ${process.argv[3]}`);

if (!process.argv[2] || !process.argv[3]) {
  console.log('missing argument: geotype (bg, tract, or place) or year');
  console.log('run like: node --max_old_space_size=8192 cleanAggregatedFiles.js bg 2016');
  process.exit();
}

const GEOTYPE = process.argv[2];
const YEAR = process.argv[3];

let counter = 0;
const key = {};


for (let i = 3; i <= 8; i++) {
  const geojson = JSON.parse(fs.readFileSync(`./aggregated-geojson/${GEOTYPE}_${YEAR}_${i}.json`, 'utf8'));

  geojson.features.forEach(feature => {
    if (feature.properties.GEOID.includes('_')) {
      counter++;

      const new_key = `${GEOTYPE}_${counter}`;
      key[new_key] = feature.properties.GEOID.split('_');
      feature.properties.GEOID = new_key;
    }
  });

  fs.writeFileSync(`./aggregated-cleaned/${GEOTYPE}_${YEAR}_${i}.json`, JSON.stringify(geojson), 'utf8');
}


fs.writeFileSync(`./aggregated-metadata/${GEOTYPE}_${YEAR}_key.json`, JSON.stringify(key), 'utf8');
