const fs = require('fs');
const geojsonRbush = require('geojson-rbush').default;
const { computeFeature } = require('./computeFeature.js');

// node --max_old_space_size=8192 createIndex.js bg 2016
// (geotype, year)

console.log(`geotype: ${process.argv[2]}`);
console.log(`year: ${process.argv[3]}`);

if (!process.argv[2] || !process.argv[3]) {
  console.log('missing arguments: (geotype, year');
  console.log('run like: node --max_old_space_size=8192 createIndex.js bg 2016');
  process.exit();
}

const GEOTYPE = process.argv[2];
const YEAR = process.argv[3];
const SLICE = getGeoidSlice(GEOTYPE);

const geojson_file = require(`./merged-geojson/${GEOTYPE}_${YEAR}.json`);
let geojson_feature_count = geojson_file.features.length;
console.log(geojson_feature_count);


/*** Mutable Globals ***/

const ordered_obj = {};
const keyed_geojson = {};
let counter = 0;

/*** Initial index creation and calculation ***/

const tree = geojsonRbush();
tree.load(geojson_file);

geojson_file.features.forEach((feature, index) => {
  if (index % 100 === 0) {
    console.log('index progress: ' + ((index / geojson_feature_count) * 100).toFixed(2) + '%');
  }

  keyed_geojson[feature.properties.GEOID] = Object.assign({}, feature, { properties: { GEOID: feature.properties.GEOID } });
  computeFeature(feature, tree, ordered_obj, counter, SLICE);
});

// write tree & ordered_obj & keyed_geojson & counter

const obj = {
  tree: tree.toJSON(),
  ordered_obj,
  keyed_geojson,
  counter
};

fs.writeFileSync(`./indexed/${GEOTYPE}_${YEAR}.json`, JSON.stringify(obj), 'utf8');



/*** Functions ***/

// set limit on which geo level a geography can simplify up to
function getGeoidSlice(geo) {
  if (geo === "bg") {
    return 5;
  }
  else if (geo === "tract") {
    return 5;
  }
  else if (geo === "place") {
    return 2;
  }
  else {
    console.log('unknown geo: ' + geo);
  }
}
