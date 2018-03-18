// continually combine smaller features.  
// without aggregating across state or county lines
// note: this is beautiful

const present = require('present');

const fs = require('fs');
const turf = require('@turf/turf');

// node aggregate.js bg 3
// (geotype, zoomlevel)

console.log(`geotype: ${process.argv[2]}`);
console.log(`zoomlevel: ${process.argv[3]}`);

if (!process.argv[2] || !process.argv[3]) {
  console.log('missing arguments: (geotype, zoomlevel');
  console.log('run like: node aggregate.js bg 3');
  process.exit();
}

const GEOTYPE = process.argv[2];
const ZOOMLEVEL = process.argv[3];

const geojson_file = require(`./merged-geojson/${GEOTYPE}.json`);

const geojson_feature_count = geojson_file.features.length;

console.log(geojson_feature_count);

const zoom_features = {
  '3': .07,
  '4': .14,
  '5': .21,
  '6': .28,
  '7': .42,
  '8': .57
};

const pct_features_to_keep = zoom_features[ZOOMLEVEL];

if (!pct_features_to_keep) {
  console.log('not a valid zoomlevel.  use integers 3 to 8 only.');
  process.exit();
}

const DESIRED_NUMBER_FEATURES = parseInt((geojson_feature_count * pct_features_to_keep), 10);


/*** Mutable Globals ***/

let matches = {};
const ordered_match = [];
let counter = 0;
const keyed_geojson = {};
let number_features_remaining;

let building_index = true;

/*** Initial index creation and calculation ***/

const geojsonRbush = require('geojson-rbush').default;
const tree = geojsonRbush();
tree.load(geojson_file);

const total_records = geojson_file.features.length;

// get area of each
geojson_file.features.forEach((feature, index) => {

  if (index % 100 === 0) {
    console.log('index progress (1/2) ' + ((index / total_records) * 100).toFixed(2) + '%');
  }

  keyed_geojson[feature.properties.GEOID] = feature;

  computeFeature(feature);

});


/****** Do this is a loop ******/

building_index = false;

// sort all
ordered_match.sort((a, b) => {
  return Number(a.split('_')[0]) - Number(b.split('_')[0]);
});


const starting_number_features = Object.keys(keyed_geojson).length;
const reductions_needed = starting_number_features - DESIRED_NUMBER_FEATURES;

number_features_remaining = starting_number_features;
let can_still_simplify = true;

const initial = present();
let total_sort = 0;
let total_filter = 0;
let total_compute_features = 0;


while ((number_features_remaining > DESIRED_NUMBER_FEATURES) && can_still_simplify) {

  let total_reductions = starting_number_features - number_features_remaining;

  if (total_reductions % 10 === 0) {
    const current_time = present() - initial;
    console.log('compute progress (2/2) ' + ((total_reductions / reductions_needed) * 100).toFixed(2) + '%');
    console.log(`filter: ${total_filter / current_time}`);
    console.log(`compute features: ${total_compute_features / current_time}`);
    console.log('');
  }

  // error check this for nothing left in coalesced_scores array
  const m1 = present();
  let match;

  if (ordered_match.length) {
    const next_lowest = ordered_match.shift();
    match = matches[next_lowest];
  }
  else {
    match = false;
  }

  const m2 = present();
  total_sort = total_sort + (m2 - m1);


  // are there still a pool of features remaining that can be simplified?
  // sometimes constraints such as making sure features are not combined
  // across county lines creates situations where we exhaust the pool of
  // features able to be combined for low (zoomed out) zoom levels
  if (!match) {
    can_still_simplify = false;
  }
  else {

    // we only use GEOID.  new geoid is just old geoids concatenated with _
    const properties_a = keyed_geojson[match[0]].properties;
    const properties_b = keyed_geojson[match[1]].properties;
    const combined_geoid = properties_a.GEOID + '_' + properties_b.GEOID;

    const combined = turf.union(keyed_geojson[match[0]], keyed_geojson[match[1]]);

    // overwrite properties with new geoid
    combined.properties = {
      GEOID: combined_geoid
    };

    // create new combined feature
    keyed_geojson[combined_geoid] = combined;

    // delete old features that were combined
    delete keyed_geojson[match[0]];
    delete keyed_geojson[match[1]];

    const f1 = present();
    // go back through all features and recompute everything that was affected by the above transformation
    Object.keys(matches).forEach(key => {
      const geoid_array = matches[key];
      const prop_a = properties_a.GEOID;
      const prop_b = properties_b.GEOID;
      if (geoid_array[0] === prop_a || geoid_array[0] === prop_b || geoid_array[1] === prop_a || geoid_array[1] === prop_b) {
        delete matches[key];
        removeElement(ordered_match, key);
      }
    });
    const f2 = present();
    total_filter = total_filter + (f2 - f1);

    //update index (remove previous)
    const options = tree.search(combined);

    options.features.forEach(option => {
      if (option.properties.GEOID === properties_a.GEOID || option.properties.GEOID === properties_b.GEOID) {
        tree.remove(option);
      }
    });

    // update index (add new)
    tree.insert(combined);

    // recompute features
    const cf1 = present();
    computeFeature(combined);
    const cf2 = present();
    total_compute_features = total_compute_features + (cf2 - cf1);

  }

  number_features_remaining = Object.keys(keyed_geojson).length;
}

// convert keyed geojson back to array
const geojson_array = Object.keys(keyed_geojson).map(feature => {
  return keyed_geojson[feature];
});

// save combined geojson to file
fs.writeFileSync(`./aggregated-geojson/${GEOTYPE}_${ZOOMLEVEL}.json`, JSON.stringify(turf.featureCollection(geojson_array)), 'utf8');


/*** Functions ***/

function computeFeature(feature) {

  const geoid = feature.properties.GEOID;

  // here
  const area = turf.area(feature);

  // here
  const bbox = turf.bbox(feature);

  // here
  const nearby = tree.search(bbox);

  // here
  const nearby_filtered = nearby.features.filter(d => {
    // ignore self
    const not_self = d.properties.GEOID !== geoid;

    if (GEOTYPE === 'bg' || GEOTYPE === 'tract') {
      // ignore geoids in different state/county
      const county_a = d.properties.GEOID.slice(0, 5);
      const county_b = feature.properties.GEOID.slice(0, 5);
      const not_different_county = county_a === county_b;
      return (not_self && not_different_county);
    }
    else {
      // place
      // ignore geoids in different state
      const state_a = d.properties.GEOID.slice(0, 2);
      const state_b = feature.properties.GEOID.slice(0, 2);
      const not_different_state = state_a === state_b;
      return (not_self && not_different_state);
    }

  });

  nearby_filtered.forEach(near_feature => {
    let intersection;
    try {
      intersection = turf.intersect(feature, near_feature);
    }
    catch (e) {
      // console.log('intersect');
      // console.log(e);
      // console.log('########');
      // console.log(JSON.stringify(feature));
      // console.log(',');
      // console.log(JSON.stringify(near_feature));
      intersection = null; // problems with turf.intersect on seemingly good geo
    }
    // potentially could be within bbox but not intersecting
    if (intersection) {
      const l1 = turf.length(intersection, { units: 'kilometers' });
      const l2 = turf.length(feature, { units: 'kilometers' });
      const matching_feature_area = turf.area(near_feature);

      const inverse_shared_edge = 1 - (l1 / l2);
      const combined_area = area + matching_feature_area;

      counter++;

      const coalescability = String(inverse_shared_edge * combined_area) + `_${counter}`;

      matches[coalescability] = [geoid, near_feature.properties.GEOID];

      if (building_index) {
        ordered_match.push(coalescability);
      }
      else {
        inOrder(ordered_match, coalescability);
      }

    }

  });

}

// https://stackoverflow.com/a/43427151/8896489
function inOrder(arr, item) {
  /* Insert item into arr keeping low to high order */

  let ix = 0;
  while (ix < arr.length) {
    if (Number(item.split('_')[0]) < Number(arr[ix].split('_')[0])) { break; }
    ix++;
  }

  arr.splice(ix, 0, item);
}

// https://stackoverflow.com/a/3774149/8896489
function removeElement(array, item) {
  var index = array.indexOf(item);
  if (-1 !== index) {
    array.splice(index, 1);
  }
}
