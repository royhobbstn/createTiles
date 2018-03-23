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

const SLICE = getGeoidSlice(GEOTYPE);

const geojson_file = require(`./merged-geojson/${GEOTYPE}.json`);

const STARTING_GEOJSON_FEATURE_COUNT = geojson_file.features.length;
let geojson_feature_count = STARTING_GEOJSON_FEATURE_COUNT;

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
const REDUCTIONS_NEEDED = STARTING_GEOJSON_FEATURE_COUNT - DESIRED_NUMBER_FEATURES;

/*** Mutable Globals ***/

let matches = {};

const ordered_obj = {};

let counter = 0;
const keyed_geojson = {};


/*** Initial index creation and calculation ***/

const geojsonRbush = require('geojson-rbush').default;
const tree = geojsonRbush();
tree.load(geojson_file);

const start_index_time = present();
let total_bbox = 0;
let total_trse = 0;
let total_nf = 0;
let total_bm = 0;
let total_in_order = 0;
let total_actual_intersect = 0;

geojson_file.features.forEach((feature, index) => {
  if (index % 100 === 0) {
    const index_time = present() - start_index_time;
    console.log('index progress (1/2) ' + ((index / geojson_feature_count) * 100).toFixed(2) + '%');
    console.log(`   - bbox calc: ${total_bbox / index_time}`);
    console.log(`   - tree search: ${total_trse / index_time}`);
    console.log(`   - nearby filtered: ${total_nf / index_time}`);
    console.log(`   - intersection: ${total_bm / index_time}`);
    console.log(`   -   actual inter: ${total_actual_intersect / index_time}`);
    console.log(`   - push to ordered array: ${total_in_order / index_time}`);
    console.log('');
  }

  keyed_geojson[feature.properties.GEOID] = feature;
  computeFeature(feature);
});


/****** Setup ******/


let can_still_simplify = true;

const initial = present();
let total_sort = 0;
let total_filter = 0;
let total_compute_features = 0;
let total_union = 0;
let tree_operations = 0;
let total_find_lowest = 0;
let total_find_match = 0;
let total_start = 0;
let add_remove = 0;
let total_convert = 0;

total_in_order = 0;
total_bbox = 0;
total_trse = 0;
total_nf = 0;
total_bm = 0;


/****** Do this is in a loop ******/

while ((geojson_feature_count > DESIRED_NUMBER_FEATURES) && can_still_simplify) {

  const ii1 = present();

  if (geojson_feature_count % 10 === 0) {
    const current_time = present() - initial;
    const progress = ((STARTING_GEOJSON_FEATURE_COUNT - geojson_feature_count) / REDUCTIONS_NEEDED) * 100;
    console.log('compute progress (2/2) ' + progress.toFixed(2) + '%');
    console.log(`start / console: ${total_start / current_time}`);
    console.log(`lowest: ${total_sort / current_time}`);
    console.log(` - find lowest: ${total_find_lowest / current_time}`);
    console.log(`   - convert: ${total_convert / current_time}`);
    console.log(` - find match: ${total_find_match / current_time}`);

    console.log(`union: ${total_union / current_time}`);
    console.log(`add_remove geojson: ${add_remove / current_time}`);
    console.log(`filter: ${total_filter / current_time}`);
    console.log(`tree operations: ${tree_operations / current_time}`);

    console.log(`compute features: ${total_compute_features / current_time}`);
    console.log(`   - bbox calc: ${total_bbox / current_time}`);
    console.log(`   - tree search: ${total_trse / current_time}`);
    console.log(`   - nearby filtered: ${total_nf / current_time}`);
    console.log(`   - intersection: ${total_bm / current_time}`);
    console.log(`   - push to ordered array: ${total_in_order / current_time}`);

    console.log('');
  }

  const ii2 = present();
  total_start = total_start + (ii2 - ii1);

  // error check this for nothing left in coalesced_scores array
  const m1 = present();

  let a_match;

  let lowest = { key: '', value: Infinity };

  const fl1 = present();

  //   best_match.coalescability = coalescability;
  // best_match.c_counter = c_counter;
  // best_match.match = [feature.properties.GEOID, near_feature.properties.GEOID];
  // best_match.geo_division = geo_division;

  // loop through the array of sorted keys, find lowest
  Object.keys(ordered_obj).forEach(geodiv => {

    // nothing left, early exit
    if (!ordered_obj[geodiv].length) {
      delete ordered_obj[geodiv];
      return;
    }
    const gg1 = present();
    const value = ordered_obj[geodiv][0].coalescability;
    const counter = ordered_obj[geodiv][0].c_counter;
    const gg2 = present();
    total_convert = total_convert + (gg2 - gg1);


    if (value < lowest.value) {
      lowest.key = geodiv;
      lowest.value = value;
      lowest.count = counter;
    }
  });
  const fl2 = present();
  total_find_lowest = total_find_lowest + (fl2 - fl1);

  if (!lowest.key) {
    // exhausted all features eligible for combining
    a_match = false;
  }
  else {

    const fm1 = present();
    // lowest found, now grab it
    const a_next_lowest = ordered_obj[lowest.key].shift();

    // loop through all matches to find where match resides
    Object.keys(matches[lowest.key]).forEach(sm => {
      if (sm === a_next_lowest.coalescability + a_next_lowest.c_counter) {
        a_match = matches[lowest.key][sm];
      }
    });

    const fm2 = present();
    total_find_match = total_find_match + (fm2 - fm1);
  }


  const m2 = present();
  total_sort = total_sort + (m2 - m1);


  // are there still a pool of features remaining that can be simplified?
  // sometimes constraints such as making sure features are not combined
  // across county lines creates situations where we exhaust the pool of
  // features able to be combined for low (zoomed out) zoom levels
  if (!a_match) {
    console.log('AAHHAHHAHA');
    can_still_simplify = false;
  }
  else {
    const tu1 = present();

    // we only use GEOID.  new geoid is just old geoids concatenated with _
    const properties_a = keyed_geojson[a_match[0]].properties;
    const properties_b = keyed_geojson[a_match[1]].properties;
    const prop_a = properties_a.GEOID;
    const prop_b = properties_b.GEOID;
    const geo_division = properties_a.GEOID.slice(0, SLICE);
    const combined_geoid = properties_a.GEOID + '_' + properties_b.GEOID;

    const combined = turf.union(keyed_geojson[a_match[0]], keyed_geojson[a_match[1]]);
    const tu2 = present();
    total_union = total_union + (tu2 - tu1);

    const add1 = present();
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

    const add2 = present();
    add_remove = add_remove + (add2 - add1);

    // TODO something wrong starting here maybe?
    const f1 = present();
    // go back through all features and recompute everything that was affected by the above transformation
    Object.keys(matches[geo_division]).forEach(key => {
      const geoid_array = matches[geo_division][key];
      if (geoid_array[0] === prop_a || geoid_array[0] === prop_b || geoid_array[1] === prop_a || geoid_array[1] === prop_b) {
        delete matches[geo_division][key];
        console.log(key);
        //removeAnElement(ordered_obj[geo_division], key);
      }
    });
    const f2 = present();
    total_filter = total_filter + (f2 - f1);

    const ts1 = present();
    // update index (remove previous)
    const options = tree.search(combined);

    options.features.forEach(option => {
      if (option.properties.GEOID === properties_a.GEOID || option.properties.GEOID === properties_b.GEOID) {
        tree.remove(option);
      }
    });

    // update index (add new)
    tree.insert(combined);
    const ts2 = present();
    tree_operations = tree_operations + (ts2 - ts1);

    // recompute features
    const cf1 = present();
    computeFeature(combined);
    const cf2 = present();
    total_compute_features = total_compute_features + (cf2 - cf1);

  }

}

// convert keyed geojson back to array
const geojson_array = Object.keys(keyed_geojson).map(feature => {
  return keyed_geojson[feature];
});

// save combined geojson to file
fs.writeFileSync(`./aggregated-geojson/${GEOTYPE}_${ZOOMLEVEL}.json`, JSON.stringify(turf.featureCollection(geojson_array)), 'utf8');


/*** Functions ***/

function computeFeature(feature) {

  const bb1 = present();
  const bbox = turf.bbox(feature);
  const bb2 = present();
  total_bbox = total_bbox + (bb2 - bb1);

  const trs1 = present();
  const nearby = tree.search(bbox);
  const trs2 = present();
  total_trse = total_trse + (trs2 - trs1);


  const nf1 = present();
  const nearby_filtered = nearby.features.filter(d => {
    // ignore self
    const not_self = d.properties.GEOID !== feature.properties.GEOID;
    // ignore geoids in different state/county/tract
    const geo_slice_a = d.properties.GEOID.slice(0, SLICE);
    const geo_slice_b = feature.properties.GEOID.slice(0, SLICE);
    const not_different_geo = geo_slice_a === geo_slice_b;
    return (not_self && not_different_geo);
  });
  const nf2 = present();
  total_nf = total_nf + (nf2 - nf1);


  const bm1 = present();
  const best_match = {
    coalescability: Infinity,
    match: [],
    geo_division: ''
  };

  nearby_filtered.forEach(near_feature => {

    const ai1 = present();
    const line1 = turf.polygonToLine(feature);
    const line2 = turf.polygonToLine(near_feature);
    const intersection = turf.lineOverlap(line1, line2);
    const ai2 = present();
    total_actual_intersect = total_actual_intersect + (ai2 - ai1);

    // potentially could be within bbox but not intersecting
    if (intersection) {

      const l1 = turf.length(intersection, { units: 'kilometers' });
      const l2 = turf.length(feature, { units: 'kilometers' });
      const area = turf.area(feature);
      const matching_feature_area = turf.area(near_feature);

      const inverse_shared_edge = 1 - (l1 / l2);
      const combined_area = area + matching_feature_area;
      const geo_division = near_feature.properties.GEOID.slice(0, SLICE);

      counter++;

      const coalescability = inverse_shared_edge * combined_area;
      const c_counter = `_${counter}`;

      // we only care about registering the best match; coalescibility will
      // be recalculated as soon as a feature is joined to another,
      // rendering lesser matches useless
      if (coalescability < best_match.coalescability) {
        best_match.coalescability = coalescability;
        best_match.c_counter = c_counter;
        best_match.match = [feature.properties.GEOID, near_feature.properties.GEOID];
        best_match.geo_division = geo_division;
      }
    }

  });
  const bm2 = present();
  total_bm = total_bm + (bm2 - bm1);


  const or1 = present();
  if (best_match.match.length) {

    if (!ordered_obj[best_match.geo_division]) {
      ordered_obj[best_match.geo_division] = [];
    }

    inOrder(ordered_obj[best_match.geo_division], best_match);


    if (!matches[best_match.geo_division]) {
      matches[best_match.geo_division] = {};
    }
    matches[best_match.geo_division][best_match.coalescability + best_match.c_counter] = best_match.match;
  }
  const or2 = present();
  total_in_order = total_in_order + (or2 - or1);

}

// https://stackoverflow.com/a/43427151/8896489
function inOrder(arr, item) {
  /* Insert item into arr keeping low to high order */

  let ix = 0;
  while (ix < arr.length) {
    if (item.coalescability < arr[ix].coalescability) { break; }
    ix++;
  }

  arr.splice(ix, 0, item);
}


function removeAnElement(array, item) {
  var index = array.indexOf(item);
  if (-1 !== index) {
    array.splice(index, 1);
  }
}

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
