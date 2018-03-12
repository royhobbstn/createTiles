const fs = require('fs');
const turf = require('@turf/turf');
const colorado = require('./test.json');

// spatially index shapes
const geojsonRbush = require('geojson-rbush').default;
const tree = geojsonRbush();
tree.load(colorado);

const matches = [];

const keyed_geojson = {};

const total_records = colorado.features.length;

// get area of each
colorado.features.forEach((feature, index) => {

  if (index % 100 === 0) {
    console.log('in progress ' + ((index / total_records) * 100).toFixed(2) + '%');
  }

  keyed_geojson[feature.properties.GEOID] = feature;

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

});


matches.sort((a, b) => {
  return a.coalescability - b.coalescability;
});


//console.log(JSON.stringify(matches.slice(0, 100)));

matches.forEach(match => {
  console.log(match);

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

  // TODO go back through all features and recompute everything that was affected by the above transformation

  process.exit();
});


// after aggregating, you can go back through and update each one after it is aggregated
// rather than recalculating everything

// but you're going to need to put the geojson into a temporary keyed lookup
// else you'll be looping through the entire array repeatedly
