// node --max_old_space_size=8192 aggregate.js bg 2016
// (geo, year)

const fs = require('fs');
const geojsonRbush = require('geojson-rbush').default;
const { computeFeature } = require('./modules/computeFeature.js');
const present = require('present');
const turf = require('@turf/turf');

// node --max_old_space_size=8192 aggregate.js bg 2016
// (geotype, zoomlevel, year)

console.log(`geotype: ${process.argv[2]}`);
console.log(`year: ${process.argv[3]}`);


if (!process.argv[2] || !process.argv[3]) {
  console.log('missing arguments: (geotype, year');
  console.log('run like: node --max_old_space_size=8192 aggregate.js bg 2016');
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
const threshold = [];

/*** Initial index creation and calculation ***/

const tree = geojsonRbush();
tree.load(geojson_file);

geojson_file.features.forEach((feature, index) => {
  if (index % 100 === 0) {
    console.log('index progress: ' + ((index / geojson_feature_count) * 100).toFixed(2) + '%');
  }

  keyed_geojson[feature.properties.GEOID] = Object.assign({}, feature, { properties: { GEOID: feature.properties.GEOID, NAME: feature.properties.NAME } });
  computeFeature(feature, tree, ordered_obj, counter, SLICE);
});

/********* main ************/

// continually combine smaller features.  
// without aggregating across state or county lines
// note: this is beautiful

const total_time = present(); // tracks total execution time

const RETAINED = getRetained(GEOTYPE);

const LOW_ZOOM = 3;
const HIGH_ZOOM = 8;


/****** Setup ******/

const STARTING_GEOJSON_FEATURE_COUNT = geojson_feature_count;

// set an array of feature thresholds
for (let i = LOW_ZOOM; i <= HIGH_ZOOM; i++) {
  threshold.push({ count: parseInt((geojson_feature_count * RETAINED[i]), 10), zoom: i });
}

const DESIRED_NUMBER_FEATURES = parseInt((geojson_feature_count * RETAINED[LOW_ZOOM]), 10);
const REDUCTIONS_NEEDED = STARTING_GEOJSON_FEATURE_COUNT - DESIRED_NUMBER_FEATURES;

let can_still_simplify = true;


/****** Do this is in a loop ******/

while ((geojson_feature_count > DESIRED_NUMBER_FEATURES) && can_still_simplify) {

  // a zoom level threshold has been reached.  save that zoomlevel.
  threshold.forEach(obj => {
    if (geojson_feature_count === obj.count) {
      // convert keyed geojson back to array
      const geojson_array = Object.keys(keyed_geojson).map(feature => {
        return keyed_geojson[feature];
      });
      console.log('writing zoomlevel: ' + obj.zoom);
      fs.writeFileSync(`./aggregated-geojson/${GEOTYPE}_${YEAR}_${obj.zoom}.json`, JSON.stringify(turf.featureCollection(geojson_array)), 'utf8');
    }
  });

  if (geojson_feature_count % 10 === 0) {
    const progress = ((STARTING_GEOJSON_FEATURE_COUNT - geojson_feature_count) / REDUCTIONS_NEEDED) * 100;
    console.log(`compute progress ${GEOTYPE} ${YEAR}: ${progress.toFixed(2)} %`);
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
    const area_a = turf.area(keyed_geojson[a_match[0]]);
    const area_b = turf.area(keyed_geojson[a_match[1]]);
    const prop_a = properties_a.GEOID;
    const prop_b = properties_b.GEOID;
    const geo_division = properties_a.GEOID.slice(0, SLICE);
    const larger_geoid = (area_a > area_b) ? properties_a.GEOID : properties_b.GEOID;
    const larger_name = (area_a > area_b) ? properties_a.NAME : properties_b.NAME;

    const combined = turf.union(keyed_geojson[a_match[0]], keyed_geojson[a_match[1]]);

    // overwrite properties with geoid of larger feature
    // AA property is a flag for aggregated area
    combined.properties = {
      GEOID: larger_geoid,
      NAME: larger_name,
      AA: true
    };

    // delete old features that were combined
    delete keyed_geojson[a_match[0]];
    delete keyed_geojson[a_match[1]];

    // create new combined feature
    keyed_geojson[larger_geoid] = combined;

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

// presumably the lowest zoom level doesn't get reached since the loop terminates just before the count hits the target
// so it is saved here, at the end of the program.
fs.writeFileSync(`./aggregated-geojson/${GEOTYPE}_${YEAR}_${LOW_ZOOM}.json`, JSON.stringify(turf.featureCollection(geojson_array)), 'utf8');
console.log(present() - total_time);


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

function getRetained(geo) {
  if (geo === 'bg') {
    return {
      '3': .02,
      '4': .06,
      '5': .12,
      '6': .24,
      '7': .36,
      '8': .48
    };
  }
  else if (geo === 'place') {
    return {
      '3': .46,
      '4': .47,
      '5': .48,
      '6': .50,
      '7': .65,
      '8': .80
    };
  }
  else if (geo === 'tract') {
    return {
      '3': .06,
      '4': .12,
      '5': .24,
      '6': .40,
      '7': .60,
      '8': .80
    };
  }
  else {
    console.log('unknown geo: ' + geo);
    process.exit();
  }
}
