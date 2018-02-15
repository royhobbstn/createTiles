const turf = require('@turf/turf');
const randomPointsOnPolygon = require('random-points-on-polygon');

const fs = require('fs');

const geojson = JSON.parse(fs.readFileSync('./cl_dissolved/test.geojson', 'utf8'));

let point_collection = [];

turf.featureEach(geojson, function(currentFeature, featureIndex) {

    const number_points = parseInt((turf.area(currentFeature) / 1000000000), 10) || 1;
    const points = randomPointsOnPolygon(number_points, currentFeature, { cluster: currentFeature.properties.c });

    console.log(((featureIndex / geojson.features.length) * 100).toFixed(2) + "%");

    points.forEach(point => {
        point_collection.push(point);
    });

});

const collection = turf.featureCollection(point_collection);

const bbox = turf.bbox(collection);

const triangles = turf.voronoi(collection, { bbox });

const collected = turf.collect(triangles, collection, 'cluster', 'cluster');


const joined = [];

turf.featureEach(collected, function(currentFeature, featureIndex) {
    const new_properties = { properties: { cluster: currentFeature.properties.cluster[0] } };
    const updated = Object.assign({}, currentFeature, new_properties);
    joined.push(updated);
});

const refactored = turf.featureCollection(joined);



const voronoi = turf.dissolve(refactored, { propertyName: 'cluster' });

const again = turf.dissolve(voronoi, { propertyName: 'cluster' });

const again2 = turf.dissolve(again, { propertyName: 'cluster' });

const again3 = turf.dissolve(again2, { propertyName: 'cluster' });

const again4 = turf.dissolve(again3, { propertyName: 'cluster' });

fs.writeFileSync('./clusters.geojson', JSON.stringify(again4), 'utf8');
