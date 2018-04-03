const fs = require('fs');
const turf = require('@turf/turf');
const clustersKmeans = require('./modules/modKMeans.js');

const CLUSTER_SIZE = 200;

console.log(`geotype: ${process.argv[2]}`);
console.log(`year: ${process.argv[3]}`);

if (!process.argv[2] || !process.argv[3]) {
  console.log('missing arguments: (geotype, year');
  console.log('run like: node --max_old_space_size=8192 explore.js bg 2016');
  process.exit();
}

const GEOTYPE = process.argv[2];
const YEAR = process.argv[3];

const tr3 = require(`./aggregated-geojson/${GEOTYPE}_${YEAR}_3.json`);
const tr4 = require(`./aggregated-geojson/${GEOTYPE}_${YEAR}_4.json`);
const tr5 = require(`./aggregated-geojson/${GEOTYPE}_${YEAR}_5.json`);
const tr6 = require(`./aggregated-geojson/${GEOTYPE}_${YEAR}_6.json`);
const tr7 = require(`./aggregated-geojson/${GEOTYPE}_${YEAR}_7.json`);
const tr8 = require(`./aggregated-geojson/${GEOTYPE}_${YEAR}_8.json`);
const tr9 = require(`./merged-geojson/${GEOTYPE}_${YEAR}.json`);

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


// convert to point files

[{ feature_array: tr3.features, zoom: 3 },
  { feature_array: filtered_tr4, zoom: 4 },
  { feature_array: filtered_tr5, zoom: 5 },
  { feature_array: filtered_tr6, zoom: 6 },
  { feature_array: filtered_tr7, zoom: 7 },
  { feature_array: filtered_tr8, zoom: 8 },
  { feature_array: filtered_tr9, zoom: 9 }
].forEach(obj => {

  const count = obj.feature_array.length;

  console.log(`counted ${count} features`);

  const point_array = obj.feature_array.map(feature => {
    return turf.centroid(feature.geometry, feature.properties);
  });

  var point_layer = turf.featureCollection(point_array);

  // Cluster the point files
  console.log(`clustering @ ${CLUSTER_SIZE}`);
  const clustered = clustersKmeans(point_layer, { numberOfClusters: parseInt(count / CLUSTER_SIZE, 10) || 1 });

  console.log('done clustering');

  const cluster_obj = {};

  clustered.features.forEach(feature => {
    cluster_obj[feature.properties.GEOID] = `${obj.zoom}_${feature.properties.cluster}`;
  });

  const updated_features = obj.feature_array.map(feature => {
    const properties = Object.assign({}, feature.properties, { cluster: cluster_obj[feature.properties.GEOID] });
    return Object.assign(feature, { properties: properties });
  }).filter(feature => {
    // filter out null geography
    return feature.geometry;
  });

  // save feature collection
  const clustered_geojson = { "type": "FeatureCollection", "features": updated_features };

  fs.writeFile(`./cl_processed/clustered_${GEOTYPE}_${YEAR}_${obj.zoom}.json`, JSON.stringify(clustered_geojson), 'utf8', function(err) {

    if (err) {
      return console.log(err);
    }
    console.log(`saved at ./cl_processed/clustered_${GEOTYPE}_${YEAR}_${obj.zoom}.json`);
  });


  // TODO don't save these intermediate files above.  Turn into Hull for each cluster


  // get list of all clusters in this file

  // for each cluster in the above list

  // create layer for each cluster

  // create hull for each layer

  // save hull into a cluster file on disk?  (in memory?)

  // combine all hull's into single geojson

  // Create tile layer

  // Write file of which GEOIDs are in each cluster.  WAY above.  cluster_obj.

});
