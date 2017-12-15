
# This is a bash script to create tiles folders using tippecanoe and upload to s3.
# Runs from Amazon Linux (ruby and unzip already installed)

# assumes bucket named static-tiles

# clean old (just in case) and create temporary directories
rm -rf ./downloads ./geojson ./tiles ./unzipped
mkdir ./downloads ./geojson ./tiles ./unzipped


# install linuxbrew
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Linuxbrew/install/master/install)" < /dev/null

echo 'export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"' >>~/.bash_profile

echo 'export MANPATH="/home/linuxbrew/.linuxbrew/share/man:$MANPATH"' >>~/.bash_profile

echo 'export INFOPATH="/home/linuxbrew/.linuxbrew/share/info:$INFOPATH"' >>~/.bash_profile

source ~/.bash_profile

# install tippecanoe for creating tiles
brew install tippecanoe


# install nodejs and npm
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
nvm install node

# install package to convert shapefile to geojson
npm install shapefile -g

# download county shapefile and convert to geojson
wget -P ./downloads/ https://www2.census.gov/geo/tiger/GENZ2014/shp/cb_2014_us_county_500k.zip

unzip ./downloads/cb_2014_us_county_500k.zip -d ./unzipped

shp2json ./unzipped/cb_2014_us_county_500k.shp > ./geojson/cb_2014_us_county_500k.geojson

# create county tiles
tippecanoe -e ./tiles/county2014 -l county -z 10 -Z 4 -pf -pk -y GEOID ./geojson/cb_2014_us_county_500k.geojson

# Upload directory to s3
aws s3 sync ./tiles/county2014 s3://static-tiles/county2014 --delete

# clean up
rm -rf ./downloads ./geojson ./tiles ./unzipped

# todo.  specify bucket name as parameter

# todo.  accept command line parameter for geo.