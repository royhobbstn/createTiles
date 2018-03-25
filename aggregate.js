// continually combine smaller features.  
// without aggregating across state or county lines
// note: this is beautiful

const present = require('present');
const geojsonRbush = require('geojson-rbush').default;
const fs = require('fs');
const turf = require('@turf/turf');
const { computeFeature } = require('./computeFeature.js');

const aa = present(); // tracks total execution time

// node --max_old_space_size=8192 aggregate.js bg 3 2016
// (geotype, zoomlevel, year)

console.log(`geotype: ${process.argv[2]}`);
console.log(`zoomlevel: ${process.argv[3]}`);
console.log(`year: ${process.argv[4]}`);
console.log(`pct features retained: ${process.argv[5]}`);


if (!process.argv[2] || !process.argv[3] || !process.argv[4] || !process.argv[5]) {
  console.log('missing arguments: (geotype, zoomlevel, year, retain pct');
  console.log('run like: node --max_old_space_size=8192 aggregate.js bg 3 2016 .02');
  process.exit();
}

const GEOTYPE = process.argv[2];
const ZOOMLEVEL = process.argv[3];
const YEAR = process.argv[4];
const RETAINED = process.argv[5];

const SLICE = getGeoidSlice(GEOTYPE);


/*** Mutable Globals ***/

const indexed = require(`./indexed/${GEOTYPE}_${YEAR}.json`);

const ordered_obj = indexed.ordered_obj;
const keyed_geojson = indexed.keyed_geojson;
let counter = indexed.counter;
const tree = geojsonRbush();
tree.fromJSON(indexed.tree);

/****** Setup ******/

const STARTING_GEOJSON_FEATURE_COUNT = Object.keys(keyed_geojson).length;
let geojson_feature_count = STARTING_GEOJSON_FEATURE_COUNT;

console.log(geojson_feature_count);

const DESIRED_NUMBER_FEATURES = parseInt((geojson_feature_count * RETAINED), 10);
const REDUCTIONS_NEEDED = STARTING_GEOJSON_FEATURE_COUNT - DESIRED_NUMBER_FEATURES;

let can_still_simplify = true;


/****** Do this is in a loop ******/

while ((geojson_feature_count > DESIRED_NUMBER_FEATURES) && can_still_simplify) {

  if (geojson_feature_count % 10 === 0) {
    const progress = ((STARTING_GEOJSON_FEATURE_COUNT - geojson_feature_count) / REDUCTIONS_NEEDED) * 100;
    console.log('compute progress: ' + progress.toFixed(2) + '%');
  }

  // error check this for nothing left in coalesced_scores array
  let a_match;

  let lowest = { key: '', value: Infinity };

  // loop through the array of sorted keys, find lowest
  Object.keys(ordered_obj).forEach(geodiv => {

    // nothing left, early exit
    if (!ordered_obj[geodiv].length) {
      delete ordered_obj[geodiv];
      return;
    }

    const item = ordered_obj[geodiv][0];
    const value = item.coalescability;

    if (value < lowest.value) {
      lowest.key = geodiv;
      lowest.value = value;
      lowest.count = item.c_counter;
    }
  });

  if (!lowest.key) {
    // exhausted all features eligible for combining
    a_match = false;
  }
  else {

    // lowest found, now grab it
    const a_next_lowest = ordered_obj[lowest.key].shift();
    a_match = a_next_lowest.match;
  }

  // are there still a pool of features remaining that can be simplified?
  // sometimes constraints such as making sure features are not combined
  // across county lines creates situations where we exhaust the pool of
  // features able to be combined for low (zoomed out) zoom levels
  if (!a_match) {
    can_still_simplify = false;
  }
  else {

    // we only use GEOID.  new geoid is just old geoids concatenated with _
    const properties_a = keyed_geojson[a_match[0]].properties;
    const properties_b = keyed_geojson[a_match[1]].properties;
    const prop_a = properties_a.GEOID;
    const prop_b = properties_b.GEOID;
    const geo_division = properties_a.GEOID.slice(0, SLICE);
    const combined_geoid = properties_a.GEOID + '_' + properties_b.GEOID;

    const combined = turf.union(keyed_geojson[a_match[0]], keyed_geojson[a_match[1]]);

    // overwrite properties with new geoid
    combined.properties = {
      GEOID: combined_geoid
    };

    // create new combined feature
    keyed_geojson[combined_geoid] = combined;

    // delete old features that were combined
    delete keyed_geojson[a_match[0]];
    delete keyed_geojson[a_match[1]];

    geojson_feature_count--;

    // go back through all features and remove everything that was affected by the above transformation
    ordered_obj[geo_division] = ordered_obj[geo_division].filter(item => {
      const geoid_array = item.match;

      if (geoid_array[0] === prop_a || geoid_array[0] === prop_b || geoid_array[1] === prop_a || geoid_array[1] === prop_b) {
        return false;
      }
      return true;

    });

    // update index (remove previous)
    const options = tree.search(combined);

    options.features.forEach(option => {
      if (option.properties.GEOID === properties_a.GEOID || option.properties.GEOID === properties_b.GEOID) {
        tree.remove(option);
      }
    });

    // update index (add new)
    tree.insert(combined);

    // recompute features
    computeFeature(combined, tree, ordered_obj, counter, SLICE);

  }

}

// convert keyed geojson back to array
const geojson_array = Object.keys(keyed_geojson).map(feature => {
  return keyed_geojson[feature];
});

// save combined geojson to file
fs.writeFileSync(`./aggregated-geojson/${GEOTYPE}_${ZOOMLEVEL}.json`, JSON.stringify(turf.featureCollection(geojson_array)), 'utf8');
console.log(present() - aa);



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
