const turf = require('@turf/turf');
const randomPointsOnPolygon = require('random-points-on-polygon');

const Promise = require('bluebird');
const fs = require('fs');

const geojson = JSON.parse(fs.readFileSync('./cl_dissolved/test.geojson', 'utf8'));

let point_collection = [];

turf.featureEach(geojson, function(currentFeature, featureIndex) {
    //=currentFeature
    //=featureIndex

    var number_points = parseInt((turf.area(currentFeature) / 100000000), 10) || 1;


    const points = randomPointsOnPolygon(number_points, currentFeature, { cluster: currentFeature.properties.c });

    console.log(((featureIndex / geojson.features.length) * 100).toFixed(2) + "%");


    points.forEach(point => {
        point_collection.push(point);
    });



});

const collection = turf.featureCollection(point_collection);

const bbox = turf.bbox(collection);

const triangles = turf.voronoi(collection, { bbox });

const voronoi = turf.dissolve(triangles, { propertyName: 'cluster' });

fs.writeFileSync('./voronoi.geojson', JSON.stringify(voronoi), 'utf8');
