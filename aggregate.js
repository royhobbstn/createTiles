const fs = require('fs');
const turf = require('@turf/turf');
const colorado = require('./test.json');

// spatially index shapes
var geojsonRbush = require('geojson-rbush').default;
var tree = geojsonRbush();
tree.load(colorado);



// get area of each
colorado.features.forEach(feature => {
  const geoid = feature.properties.GEOID;
  const area = turf.area(feature);
  const bbox = turf.bbox(feature);
  const hits = tree.search(bbox);
  console.log('----');

  hits.features.filter(d => {
    // ignore self
    return d.properties.GEOID !== geoid;
  }).forEach(nearby => {
    const intersection = turf.intersect(feature, nearby);

    // potentially could be within bbox but not intersecting
    if (intersection) {
      var length = turf.length(intersection, { units: 'kilometers' });
      const l2 = turf.length(feature, { units: 'kilometers' });
      console.log(length / l2);
    }

  });

});
