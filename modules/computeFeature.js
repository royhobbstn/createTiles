const turf = require('@turf/turf');

// passed by reference.  will mutate

exports.computeFeature = function(feature, tree, ordered_obj, counter, SLICE) {

  const bbox = turf.bbox(feature);
  const nearby = tree.search(bbox);

  const nearby_filtered = nearby.features.filter(d => {
    // ignore self
    const not_self = d.properties.GEOID !== feature.properties.GEOID;
    // ignore geoids in different state/county/tract
    const geo_slice_a = d.properties.GEOID.slice(0, SLICE);
    const geo_slice_b = feature.properties.GEOID.slice(0, SLICE);
    const not_different_geo = geo_slice_a === geo_slice_b;
    return (not_self && not_different_geo);
  });

  const best_match = {
    coalescability: Infinity,
    match: [],
    geo_division: ''
  };

  nearby_filtered.forEach(near_feature => {

    const line1 = turf.polygonToLine(feature);
    const line2 = turf.polygonToLine(near_feature);
    const intersection = turf.lineOverlap(line1, line2);

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
      // rendering a lesser match useless
      if (coalescability < best_match.coalescability) {
        best_match.coalescability = coalescability;
        best_match.c_counter = c_counter;
        best_match.match = [feature.properties.GEOID, near_feature.properties.GEOID];
        best_match.geo_division = geo_division;
      }
    }

  });


  if (best_match.match.length) {
    if (!ordered_obj[best_match.geo_division]) {
      ordered_obj[best_match.geo_division] = [];
    }
    inOrder(ordered_obj[best_match.geo_division], best_match);
  }

};

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
