const fs = require('fs');
const turf = require('@turf/turf');


// two worries;  zoom out data (can derive by reading cluster info on screen);
// and zoom in data - depends on where the cursor is on the map. (can't be derived from reading cluster info on screen);

// i think the solution is a lambda service that requests data by where you are on the screen
// you'll need to post an index of known data though, so it doesn't send again.

//**************//


const tr3 = require('./aggregated-geojson/tract_2015_3.json');
const tr4 = require('./aggregated-geojson/tract_2015_4.json');
const tr5 = require('./aggregated-geojson/tract_2015_5.json');
const tr6 = require('./aggregated-geojson/tract_2015_6.json');
const tr7 = require('./aggregated-geojson/tract_2015_7.json');
const tr8 = require('./aggregated-geojson/tract_2015_8.json');
const tr9 = require('./merged-geojson/tract_2015.json');

console.log('all geojson has been loaded');


// per each cluster, cluster again
const geoids = [];

tr3.features.forEach(feature => {
  geoids.push(feature.properties.GEOID);
});

const filtered_tr4 = tr4.features.filter(feature => {
  return !geoids.includes(feature.properties.GEOID);
});

console.log('filtered level 4');

filtered_tr4.forEach(feature => {
  geoids.push(feature.properties.GEOID);
});

const filtered_tr5 = tr5.features.filter(feature => {
  return !geoids.includes(feature.properties.GEOID);
});

filtered_tr5.forEach(feature => {
  geoids.push(feature.properties.GEOID);
});

console.log('filtered level 5');

const filtered_tr6 = tr6.features.filter(feature => {
  return !geoids.includes(feature.properties.GEOID);
});

filtered_tr6.forEach(feature => {
  geoids.push(feature.properties.GEOID);
});

console.log('filtered level 6');

const filtered_tr7 = tr7.features.filter(feature => {
  return !geoids.includes(feature.properties.GEOID);
});

filtered_tr7.forEach(feature => {
  geoids.push(feature.properties.GEOID);
});

console.log('filtered level 7');

const filtered_tr8 = tr8.features.filter(feature => {
  return !geoids.includes(feature.properties.GEOID);
});

filtered_tr8.forEach(feature => {
  geoids.push(feature.properties.GEOID);
});

console.log('filtered level 8');

const filtered_tr9 = tr9.features.filter(feature => {
  return !geoids.includes(feature.properties.GEOID);
});

filtered_tr9.forEach(feature => {
  geoids.push(feature.properties.GEOID);
});

console.log('filtered level 9');

console.log('saving files');

fs.writeFileSync('./aggregated-cleaned/filtered_4.json', JSON.stringify(turf.featureCollection(filtered_tr4)), 'utf8');
fs.writeFileSync('./aggregated-cleaned/filtered_5.json', JSON.stringify(turf.featureCollection(filtered_tr5)), 'utf8');
fs.writeFileSync('./aggregated-cleaned/filtered_6.json', JSON.stringify(turf.featureCollection(filtered_tr6)), 'utf8');
fs.writeFileSync('./aggregated-cleaned/filtered_7.json', JSON.stringify(turf.featureCollection(filtered_tr7)), 'utf8');
fs.writeFileSync('./aggregated-cleaned/filtered_8.json', JSON.stringify(turf.featureCollection(filtered_tr8)), 'utf8');
fs.writeFileSync('./aggregated-cleaned/filtered_9.json', JSON.stringify(turf.featureCollection(filtered_tr9)), 'utf8');

console.log('done');
