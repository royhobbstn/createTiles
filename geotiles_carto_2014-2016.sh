# This is a bash script to create tiles folders using tippecanoe and upload to s3.
# Runs from Amazon Linux (ruby and unzip already installed)

# assumes named buckets have already been created (clusters bucket is standard bucket name + _cl)

# install tippecanoe for creating tiles
brew install tippecanoe
brew upgrade tippecanoe

# install the npm shapefile and mapshaper packages
npm install -g shapefile
npm install -g mapshaper

# array of unique state and territory fips codes
declare -a state_fips=('01' '02' '04' '05' '06' '08' '09' '10' '11' '12' '13' '15' '16' '17' '18' '19' '20' '21' '22' '23' '24' '25' '26' '27' '28' '29' '30' '31' '32' '33' '34' '35' '36' '37' '38' '39' '40' '41' '42' '44' '45' '46' '47' '48' '49' '50' '51' '53' '54' '55' '56' '60' '66' '69' '72' '78');

# clean old (just in case) and create temporary directories
rm -rf ./downloads ./geojson ./tiles ./cluster-tiles ./unzipped ./merged-geojson ./aggregated-geojson ./tiled-aggregated ./aggregated-geojson ./cl_processed
mkdir ./downloads ./geojson ./tiles ./cluster-tiles ./unzipped ./merged-geojson ./aggregated-geojson ./tiled-aggregated ./aggregated-geojson ./mbtiles ./cl_processed

numberargs=$#

if [ $numberargs -lt 2 ] || [ $numberargs -gt 2 ] ; then 
    echo "incorrect.  use format: bash geotiles_carto_2014-2016.sh geolayer year"
    echo "where geolayer is one of: county, state, tract, bg, place"
    echo "where year is one of: 2014 2015 2016.  perhaps beyond."
    exit 1;
fi

geolayer=$1
year=$2

echo "Creating "$geolayer"_"$year" tileset."

if [ "$geolayer" == "county" ] || [ "$geolayer" == "state" ] ;
then
    # download county or state shapefile and convert to geojson
    wget -P ./downloads/ https://www2.census.gov/geo/tiger/GENZ"$year"/shp/cb_"$year"_us_"$geolayer"_500k.zip
    unzip ./downloads/cb_"$year"_us_"$geolayer"_500k.zip -d ./unzipped
    shp2json ./unzipped/cb_"$year"_us_"$geolayer"_500k.shp > ./geojson/cb_"$year"_us_"$geolayer"_500k.geojson

    # cluster unique GEOIDs in each zoom level.
    node --max_old_space_size=8192 cluster-plain.js "$geolayer" "$year"
    
    # create county or state tiles
    tippecanoe -e ./tiles/"$geolayer"_"$year" -l main -pt -ab -z9 -Z3 -y GEOID -y NAME ./geojson/cb_"$year"_us_"$geolayer"_500k.geojson
    tippecanoe -e ./mbtiles/"$geolayer"_"$year".mbtiles -l main -pt -ab -z9 -Z3 -y GEOID -y NAME ./geojson/cb_"$year"_us_"$geolayer"_500k.geojson
    
    # tippecanoe the hull cluster
    tippecanoe -e ./cluster-tiles/"$geolayer"_"$year"_cl -l main -aL -D8 -z9 -Z3 ./cl_processed/*.json
    tippecanoe -o ./mbtiles/"$geolayer"_"$year"_cl.mbtiles -l main -aL -D10 -z9 -Z3 ./cl_processed/*.json

fi

if [ "$geolayer" == "place" ] || [ "$geolayer" == "tract" ] || [ "$geolayer" == "bg" ] ;
then
    # download place, tract, or bg shapefile and convert to geojson
    for state in "${state_fips[@]}"
    do
        wget -P ./downloads/ https://www2.census.gov/geo/tiger/GENZ"$year"/shp/cb_"$year"_"$state"_"$geolayer"_500k.zip
        unzip ./downloads/cb_"$year"_"$state"_"$geolayer"_500k.zip -d ./unzipped
        shp2json ./unzipped/cb_"$year"_"$state"_"$geolayer"_500k.shp > ./geojson/cb_"$year"_"$state"_"$geolayer"_500k.geojson
    done
    
    # include NAME field only for place geography
    NM=""
    if [ "$geolayer" == "place" ]
    then
    NM=" -y NAME "
    fi
    
    # combine all state geojson into a single file
    mapshaper -i ./geojson/*.geojson combine-files -merge-layers -o ./merged-geojson/"$geolayer"_"$year".json 
  
    # aggregate shapes when zoomed out.  aggregation level scales with zoom.
    node --max_old_space_size=8192 aggregate.js "$geolayer" "$year"
    
    # cluster unique GEOIDs in each zoom level.
    node --max_old_space_size=8192 cluster-aggregated.js "$geolayer" "$year"

    # create tilesets for each individual zoomlevel
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_3.mbtiles -l main -ab -pt -D10 -d10 -z3 -Z3 -y GEOID `echo $NM` -M 250000 ./aggregated-geojson/"$geolayer"_"$year"_3.json
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_4.mbtiles -l main -ab -pt -D10 -d10 -z4 -Z4 -y GEOID `echo $NM` -M 250000 ./aggregated-geojson/"$geolayer"_"$year"_4.json
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_5.mbtiles -l main -ab -pt -D10 -d10 -z5 -Z5 -y GEOID `echo $NM` -M 250000 ./aggregated-geojson/"$geolayer"_"$year"_5.json
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_6.mbtiles -l main -ab -pt -D10 -d10 -z6 -Z6 -y GEOID `echo $NM` -M 250000 ./aggregated-geojson/"$geolayer"_"$year"_6.json
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_7.mbtiles -l main -ab -pt -D10 -d10 -z7 -Z7 -y GEOID `echo $NM` -M 250000 ./aggregated-geojson/"$geolayer"_"$year"_7.json
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_8.mbtiles -l main -ab -pt -D10 -d10 -z8 -Z8 -y GEOID `echo $NM` -M 250000 ./aggregated-geojson/"$geolayer"_"$year"_8.json
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_9.mbtiles -l main -ab -pt -z9 -Z9 -y GEOID `echo $NM` -M 250000 ./merged-geojson/"$geolayer"_"$year".json
    
    # tippecanoe the hull-cluster_geojson
    tippecanoe -e ./cluster-tiles/"$geolayer"_"$year"_cl -l main -aL -D10 -z9 -Z3 ./cl_processed/*.json
    tippecanoe -o ./mbtiles/"$geolayer"_"$year"_cl.mbtiles -l main -aL -D10 -z9 -Z3 ./cl_processed/*.json
    
    # join all individual zoom level tiles together
    tile-join -e ./tiles/"$geolayer"_"$year" ./tiled-aggregated/"$geolayer"_"$year"_*.mbtiles
    tile-join -o ./mbtiles/"$geolayer"_"$year".mbtiles ./tiled-aggregated/"$geolayer"_"$year"_*.mbtiles
fi

    # Upload directory to s3
    aws s3 sync ./tiles/"$geolayer"_"$year" s3://v2-geography-tiles/"$geolayer"_"$year" --content-encoding gzip --delete
    aws s3 sync ./cluster-tiles/"$geolayer"_"$year" s3://v2-cluster-tiles/"$geolayer"_"$year"_cl --content-encoding gzip --delete

    echo "Done creating "$geolayer"_"$year" tilesets."

    
# clean up
rm -rf ./downloads ./geojson ./tiles ./cluster-tiles ./unzipped ./merged-geojson ./aggregated-geojson ./tiled-aggregated ./aggregated-geojson ./cl_processed