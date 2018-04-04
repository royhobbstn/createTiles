const fs = require('fs');
const turf = require('@turf/turf');
const zlib = require('zlib');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const clustersKmeans = require('./modules/modKMeans.js');

const GEO_METADATA_BUCKET = 'geo-metadata';
const CLUSTER_SIZE = 200;
const cluster_obj = {};
const hulls = [];

console.log(`geotype: ${process.argv[2]}`);
console.log(`year: ${process.argv[3]}`);

if (!process.argv[2] || !process.argv[3]) {
  console.log('missing arguments: (geotype, year');
  console.log('run like: node --max_old_space_size=8192 explore.js bg 2016');
  process.exit();
}

const GEOTYPE = process.argv[2];
const YEAR = process.argv[3];

const tr_raw = fs.readFileSync(`./geojson/cb_${YEAR}_us_${GEOTYPE}_500k.geojson`, 'utf8');
const tr = JSON.parse(tr_raw);

console.log(typeof tr);

console.log('all geojson has been loaded');


// convert to point files

const count = tr.features.length;

console.log(`counted ${count} features`);

const point_array = tr.features.map(feature => {
  return turf.centroid(feature.geometry, feature.properties);
});

var point_layer = turf.featureCollection(point_array);

// Cluster the point files
console.log(`clustering @ ${CLUSTER_SIZE}`);
const clustered = clustersKmeans(point_layer, { numberOfClusters: parseInt(count / CLUSTER_SIZE, 10) || 1 });

console.log('done clustering');

const all_clusters = new Set();

clustered.features.forEach(feature => {
  cluster_obj[feature.properties.GEOID] = feature.properties.cluster;
  all_clusters.add(feature.properties.cluster);
});

const updated_features = tr.features.map(feature => {
  const properties = Object.assign({}, feature.properties, { cluster: cluster_obj[feature.properties.GEOID] });
  return Object.assign(feature, { properties: properties });
}).filter(feature => {
  // filter out null geography
  return feature.geometry;
});


// for each cluster in the above list
all_clusters.forEach(cluster => {
  const c_geojson = updated_features.filter(feat => {
    return feat.properties.cluster === cluster;
  });
  const c_layer = turf.featureCollection(c_geojson);
  const hull = turf.convex(c_layer);
  hull.properties = { cluster };

  hulls.push(hull);
});


// save geoid-cluster lookup to s3
const key = `clusters_${YEAR}_${GEOTYPE}.json`;

zlib.gzip(JSON.stringify(cluster_obj), function(error, result) {
  if (error) throw error;

  const params = { Bucket: GEO_METADATA_BUCKET, Key: key, Body: result, ContentType: 'application/json', ContentEncoding: 'gzip' };
  s3.putObject(params, function(err, data) {
    if (err) {
      console.log(err);
    }
    else {
      console.log(`Successfully uploaded data to ${key}`);
    }
  });

});

// combine all into feature collection
const clustered_geojson = { "type": "FeatureCollection", "features": hulls };

fs.writeFile(`./cl_processed/hulls_${GEOTYPE}_${YEAR}.json`, JSON.stringify(clustered_geojson), 'utf8', function(err) {

  if (err) {
    return console.log(err);
  }
  console.log(`saved at ./cl_processed/hulls_${GEOTYPE}_${YEAR}.json`);
});
