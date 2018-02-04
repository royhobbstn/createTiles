const turf = require('@turf/turf');
const Promise = require('bluebird');
const fs = require('fs');
const AWS = require('aws-sdk');
const rp = require('request-promise');

const CLUSTER = 'c500';
const CLUSTER_BUCKET = 'small-tiles';

// read file in the ./combined directory to get year and geo

fs.readdir('./combined', (err, filenames) => {
    if (err) {
        console.log(err);
        process.exit();
    }

    const YEAR = filenames[0].split('_')[1];
    const GEO = filenames[0].split('_')[2];

    // process files one at a time
    Promise.all([readGeoJSON(filenames[0]), readClusterFile(YEAR, GEO)])
        .then(data => {
            console.log('done');
        })
        .catch(err => {
            console.log(err);
        });

});





// TODO assign cluster to each feature

// TODO dissolve on cluster

// TODO save to directory


// read combined GeoJSON file
function readGeoJSON(filename) {

    return new Promise((resolve, reject) => {
        console.log(`reading ${filename}`);
        fs.readFile(`./combined/${filename}`, 'utf-8', function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            }
            const features = JSON.parse(data).features;

            console.log(`${filename} had ${features.length} features.`);
            resolve(features);
        });
    });
}


// read a cluster file
function readClusterFile(year, geo) {

    return rp({
            method: 'get',
            uri: `https://s3-us-west-2.amazonaws.com/${CLUSTER_BUCKET}/clusters_${year}_${geo}.json`,
            headers: {
                'Accept-Encoding': 'gzip',
            },
            gzip: true,
            json: true,
            fullResponse: false
        })
        .then(data => {
            console.log(`found ${Object.keys(data[CLUSTER]).length} keys in cluster file!`);
            return data[CLUSTER];
        });

}
