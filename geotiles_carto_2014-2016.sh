# This is a bash script to create tiles folders using tippecanoe and upload to s3.
# Runs from Amazon Linux (ruby and unzip already installed)

# assumes named bucket has already been created

# install tippecanoe for creating tiles
brew install tippecanoe
brew upgrade tippecanoe

# install the npm shapefile and mapshaper packages
npm install -g shapefile
npm install -g mapshaper

# array of unique state and territory fips codes
declare -a state_fips=('01' '02' '04' '05' '06' '08' '09' '10' '11' '12' '13' '15' '16' '17' '18' '19' '20' '21' '22' '23' '24' '25' '26' '27' '28' '29' '30' '31' '32' '33' '34' '35' '36' '37' '38' '39' '40' '41' '42' '44' '45' '46' '47' '48' '49' '50' '51' '53' '54' '55' '56' '60' '66' '69' '72' '78');

# clean old (just in case) and create temporary directories
rm -rf ./downloads ./geojson ./tiles ./unzipped ./merged-geojson ./aggregated-geojson ./tiled-aggregated ./aggregated-geojson ./aggregated-cleaned ./indexed ./aggregated-metadata
mkdir ./downloads ./geojson ./tiles ./unzipped ./merged-geojson ./aggregated-geojson ./tiled-aggregated ./aggregated-geojson ./aggregated-cleaned ./indexed ./aggregated-metadata

numberargs=$#

if [ $numberargs -lt 3 ] || [ $numberargs -gt 3 ] ; then 
    echo "incorrect.  use format: bash geotiles_carto_2014-2016.sh bucketname geolayer year"
    echo "where geolayer is one of: county, state, tract, bg, place"
    echo "where year is one of: 2014 2015 2016.  perhaps beyond."
    exit 1;
fi

bucket=$1
geolayer=$2
year=$3

echo "Creating "$geolayer"_"$year" tileset."

if [ "$geolayer" == "county" ] || [ "$geolayer" == "state" ] ;
then
    # download county or state shapefile and convert to geojson
    wget -P ./downloads/ https://www2.census.gov/geo/tiger/GENZ"$year"/shp/cb_"$year"_us_"$geolayer"_500k.zip
    unzip ./downloads/cb_"$year"_us_"$geolayer"_500k.zip -d ./unzipped
    shp2json ./unzipped/cb_"$year"_us_"$geolayer"_500k.shp > ./geojson/cb_"$year"_us_"$geolayer"_500k.geojson

    # create county or state tiles
    tippecanoe -e ./tiles/"$geolayer"_"$year" -l main -pt -ab -z9 -Z3 -y GEOID -y NAME ./geojson/cb_"$year"_us_"$geolayer"_500k.geojson
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
    # level 9 is full detail.  do not aggregate.
    
    # in turn loop through all files and create metadata
    # convert GEOID_GEOID_GEOID to single lookup key and save to metadata bucket
    node --max_old_space_size=8192 cleanAggregatedFiles.js "$geolayer" "$year"
    
    #TODO upload metadata to bucket
    
    # create tilesets for each individual zoomlevel
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_3.mbtiles -l main -ab -pt -z3 -Z3 -y GEOID `echo $NM` -M 250000 ./aggregated-cleaned/"$geolayer"_"$year"_3.json
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_4.mbtiles -l main -ab -pt -z4 -Z4 -y GEOID `echo $NM` -M 250000 ./aggregated-cleaned/"$geolayer"_"$year"_4.json
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_5.mbtiles -l main -ab -pt -z5 -Z5 -y GEOID `echo $NM` -M 250000 ./aggregated-cleaned/"$geolayer"_"$year"_5.json
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_6.mbtiles -l main -ab -pt -z6 -Z6 -y GEOID `echo $NM` -M 250000 ./aggregated-cleaned/"$geolayer"_"$year"_6.json
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_7.mbtiles -l main -ab -pt -z7 -Z7 -y GEOID `echo $NM` -M 250000 ./aggregated-cleaned/"$geolayer"_"$year"_7.json
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_8.mbtiles -l main -ab -pt -z8 -Z8 -y GEOID `echo $NM` -M 250000 ./aggregated-cleaned/"$geolayer"_"$year"_8.json
    tippecanoe -o ./tiled-aggregated/"$geolayer"_"$year"_9.mbtiles -l main -ab -pt -z9 -Z9 -y GEOID `echo $NM` -M 250000 ./merged-geojson/"$geolayer"_"$year".json
    
    # join all individual zoom level tiles together
    # tile-join -e ./tiles/"$geolayer"_"$year" ./tiled-aggregated/"$geolayer"_*.mbtiles
    tile-join -o ./tiles/"$geolayer"_"$year".mbtiles ./tiled-aggregated/"$geolayer"_"$year"_*.mbtiles
fi

    # Upload directory to s3
    # aws s3 sync ./tiles/"$geolayer"_"$year" s3://"$bucket"/"$geolayer"_"$year" --content-encoding gzip --delete
    # aws s3 sync ./tiles/ s3://geography-tiles
    
    echo "Done creating "$geolayer"_"$year" tileset."

    
# clean up
# rm -rf ./downloads ./geojson ./tiles ./unzipped ./merged-geojson ./aggregated-geojson ./tiled-aggregated ./aggregated-geojson ./aggregated-cleaned ./indexed ./aggregated-metadata