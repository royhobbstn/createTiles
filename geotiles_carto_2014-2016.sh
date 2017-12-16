
# This is a bash script to create tiles folders using tippecanoe and upload to s3.
# Runs from Amazon Linux (ruby and unzip already installed)

# assumes named bucket has already been created

# install package to convert shapefile to geojson
npm install shapefile -g

# array of unique state and territory fips codes
declare -a state_fips=('01' '02' '04' '05' '06' '08' '09' '10' '11' '12' '13' '15' '16' '17' '18' '19' '20' '21' '22' '23' '24' '25' '26' '27' '28' '29' '30' '31' '32' '33' '34' '35' '36' '37' '38' '39' '40' '41' '42' '44' '45' '46' '47' '48' '49' '50' '51' '53' '54' '55' '56' '60' '66' '69' '72' '78');

# clean old (just in case) and create temporary directories
rm -rf ./downloads ./geojson ./tiles ./unzipped
mkdir ./downloads ./geojson ./tiles ./unzipped

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

if [ "$geolayer" == "county" ] || [ "$geolayer" == "state" ] ;
then
    echo "Creating "$geolayer"_"$year" tileset."
    
    # download county shapefile and convert to geojson
    wget -P ./downloads/ https://www2.census.gov/geo/tiger/GENZ"$year"/shp/cb_"$year"_us_"$geolayer"_500k.zip
    unzip ./downloads/cb_"$year"_us_"$geolayer"_500k.zip -d ./unzipped
    shp2json ./unzipped/cb_"$year"_us_"$geolayer"_500k.shp > ./geojson/cb_"$year"_us_"$geolayer"_500k.geojson

    # create county tiles
    tippecanoe -e ./tiles/"$geolayer"_"$year" -l main -pC -z 10 -Z 4 -pf -pk -y GEOID ./geojson/cb_"$year"_us_"$geolayer"_500k.geojson

    # Upload directory to s3
    aws s3 sync ./tiles/"$geolayer"_"$year" s3://"$bucket"/"$geolayer"_"$year" --delete
    
    echo "Done creating "$geolayer"_"$year" tileset."
fi

if [ "$geolayer" == "place" ] || [ "$geolayer" == "tract" ] || [ "$geolayer" == "bg" ] ;
then
    echo "Creating "$geolayer"_"$year" tileset." # todo left off here

    for state in "${state_fips[@]}"
    do
        wget -P ./downloads/ https://www2.census.gov/geo/tiger/GENZ"$year"/shp/cb_"$year"_"$state"_"$geolayer"_500k.zip
        unzip ./downloads/cb_"$year"_"$state"_"$geolayer"_500k.zip -d ./unzipped
        shp2json ./unzipped/cb_"$year"_"$state"_"$geolayer"_500k.shp > ./geojson/cb_"$year"_"$state"_"$geolayer"_500k.geojson
    done

    # create county tiles
    tippecanoe -e ./tiles/"$geolayer"_"$year" -l main -pC -z 12 -Z 4 -pf -pk -y GEOID ./geojson/*.geojson

    # Upload directory to s3
    aws s3 sync ./tiles/"$geolayer"_"$year" s3://"$bucket"/"$geolayer"_"$year" --delete
    
    echo "Done creating "$geolayer"_"$year" tileset."
fi

# clean up
rm -rf ./downloads ./geojson ./tiles ./unzipped