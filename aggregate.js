// continually combine smaller features.  
// without aggregating across state or county lines
// note: this is beautiful


const fs = require('fs');
const turf = require('@turf/turf');
const colorado = require('./test.json');

const COMBINE = 3000;

/*** Mutable Globals ***/

let matches = [];
const keyed_geojson = {};

/*** Initial index creation and calculation ***/

// spatially index shapes
const geojsonRbush = require('geojson-rbush').default;
const tree = geojsonRbush();
tree.load(colorado);

const total_records = colorado.features.length;

// get area of each
colorado.features.forEach((feature, index) => {

  if (index % 100 === 0) {
    console.log('index progress (1/2) ' + ((index / total_records) * 100).toFixed(2) + '%');
  }

  keyed_geojson[feature.properties.GEOID] = feature;
  computeFeature(feature);
});


/****** Do this is a loop ******/

for (let i = 0; i < COMBINE; i++) {

  if (i % 10 === 0) {
    console.log('compute progress (2/2) ' + ((i / COMBINE) * 100).toFixed(2) + '%');
  }

  matches.sort((a, b) => {
    return a.coalescability - b.coalescability;
  });

  const match = matches[1];

  // we only use GEOID.  new geoid is just old geoids concatenated with _
  const properties_a = keyed_geojson[match.features[0]].properties;
  const properties_b = keyed_geojson[match.features[1]].properties;
  const combined_geoid = properties_a.GEOID + '_' + properties_b.GEOID;

  const combined = turf.union(keyed_geojson[match.features[0]], keyed_geojson[match.features[1]]);
  // overwrite properties with new geoid
  combined.properties = {
    GEOID: combined_geoid
  };

  // create new combined feature
  keyed_geojson[combined_geoid] = combined;

  // delete old features that were combined
  delete keyed_geojson[match.features[0]];
  delete keyed_geojson[match.features[1]];

  // go back through all features and recompute everything that was affected by the above transformation
  matches = matches.filter(d => {
    const match_a = d.features[0] === properties_a.GEOID;
    const match_b = d.features[1] === properties_a.GEOID;
    const match_c = d.features[0] === properties_b.GEOID;
    const match_d = d.features[1] === properties_b.GEOID;
    const match_any = (match_a || match_b || match_c || match_d);
    return !match_any;
  });

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
  computeFeature(combined);
}

// convert keyed geojson back to array
const geojson_array = Object.keys(keyed_geojson).map(feature => {
  return keyed_geojson[feature];
});

// save combined geojson to file
fs.writeFileSync('./combined.json', JSON.stringify(turf.featureCollection(geojson_array)), 'utf8');



function computeFeature(feature) {

  const geoid = feature.properties.GEOID;
  const area = turf.area(feature);
  const bbox = turf.bbox(feature);
  const nearby = tree.search(bbox);

  nearby.features.filter(d => {
    // ignore self &&
    // ignore geoids in different county

    const county_a = d.properties.GEOID.slice(0, 5);
    const county_b = feature.properties.GEOID.slice(0, 5);

    const not_different_county = county_a === county_b;
    const not_self = d.properties.GEOID !== geoid;

    return (not_self && not_different_county);

  }).forEach(near_feature => {
    const intersection = turf.intersect(feature, near_feature);

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
