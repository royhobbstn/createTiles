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

let matches = [];
const keyed_geojson = {};
let number_features_remaining;


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

const starting_number_features = Object.keys(keyed_geojson).length;
const reductions_needed = starting_number_features - DESIRED_NUMBER_FEATURES;

number_features_remaining = starting_number_features;
let can_still_simplify = true;

const initial = present();
let total_sort = 0;
let total_union = 0;
let total_filter = 0;
let total_tree_search = 0;
let total_tree_remove = 0;
let total_tree_insert = 0;
let total_compute_features = 0;

while ((number_features_remaining > DESIRED_NUMBER_FEATURES) && can_still_simplify) {

  let total_reductions = starting_number_features - number_features_remaining;

  if (total_reductions % 10 === 0) {
    const current_time = present() - initial;
    console.log('compute progress (2/2) ' + ((total_reductions / reductions_needed) * 100).toFixed(2) + '%');
    console.log(`matches.sort: ${total_sort / current_time}`);
    console.log(`union: ${total_union / current_time}`);
    console.log(`filter: ${total_filter / current_time}`);
    console.log(`tree search: ${total_tree_search / current_time}`);
    console.log(`tree remove: ${total_tree_remove / current_time}`);
    console.log(`tree insert: ${total_tree_insert / current_time}`);
    console.log(`compute features: ${total_compute_features / current_time}`);
    console.log('');
  }

  // here


  const m1 = present();
  matches.sort((a, b) => {
    return a.coalescability - b.coalescability;
  });
  const m2 = present();
  total_sort = total_sort + (m2 - m1);


  const match = matches[0];


  // are there still a pool of features remaining that can be simplified?
  // sometimes constraints such as making sure features are not combined
  // across county lines creates situations where we exhaust the pool of
  // features able to be combined for low (zoomed out) zoom levels
  if (!match) {
    can_still_simplify = false;
  }
  else {

    // we only use GEOID.  new geoid is just old geoids concatenated with _
    const properties_a = keyed_geojson[match.features[0]].properties;
    const properties_b = keyed_geojson[match.features[1]].properties;
    const combined_geoid = properties_a.GEOID + '_' + properties_b.GEOID;

    // here
    const u1 = present();
    const combined = turf.union(keyed_geojson[match.features[0]], keyed_geojson[match.features[1]]);
    const u2 = present();
    total_union = total_union + (u2 - u1);

    // overwrite properties with new geoid
    combined.properties = {
      GEOID: combined_geoid
    };

    // create new combined feature
    keyed_geojson[combined_geoid] = combined;

    // delete old features that were combined
    delete keyed_geojson[match.features[0]];
    delete keyed_geojson[match.features[1]];

    // here
    const f1 = present();
    // go back through all features and recompute everything that was affected by the above transformation
    const new_matches = matches.filter(d => {
      const match_a = d.features[0] === properties_a.GEOID;
      const match_b = d.features[1] === properties_a.GEOID;
      const match_c = d.features[0] === properties_b.GEOID;
      const match_d = d.features[1] === properties_b.GEOID;
      const match_any = (match_a || match_b || match_c || match_d);
      if (match_any) {
        console.log('removed');
      }
      return !match_any;
    });
    matches = new_matches;

    const f2 = present();
    total_filter = total_filter + (f2 - f1);

    // here
    //update index (remove previous)
    const ts1 = present();
    const options = tree.search(combined);
    const ts2 = present();
    total_tree_search = total_tree_search + (ts2 - ts1);

    // here
    const tr1 = present();
    options.features.forEach(option => {
      if (option.properties.GEOID === properties_a.GEOID || option.properties.GEOID === properties_b.GEOID) {
        tree.remove(option);
      }
    });
    const tr2 = present();
    total_tree_remove = total_tree_remove + (tr2 - tr1);

    // here
    // update index (add new)
    const ti1 = present();
    tree.insert(combined);
    const ti2 = present();
    total_tree_insert = total_tree_insert + (ti2 - ti1);

    // here
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

  // here
  nearby_filtered.forEach(near_feature => {
    let intersection;
    try {
      intersection = turf.intersect(feature, near_feature);
    }
    catch (e) {
      console.log('intersect');
      console.log(e);
      console.log(intersection);
      console.log('########');
      console.log(JSON.stringify(feature));
      console.log(',');
      console.log(JSON.stringify(near_feature));
      intersection = null; // problems with turf.intersect on seemingly good geo
    }
    // potentially could be within bbox but not intersecting
    if (intersection) {
      const l1 = turf.length(intersection, { units: 'kilometers' });
      const l2 = turf.length(feature, { units: 'kilometers' });
      const matching_feature_area = turf.area(near_feature);

      const inverse_shared_edge = 1 - (l1 / l2);
      const combined_area = area + matching_feature_area;

      matches.push({
        coalescability: inverse_shared_edge * combined_area,
        features: [geoid, near_feature.properties.GEOID]
      });

    }

  });

}
