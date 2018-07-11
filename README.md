# createTiles

Automate creation of Census [cartographic boundary file](https://www.census.gov/geo/maps-data/data/tiger-cart-boundary.html) vector tile datasets, and upload to s3 buckets.

The created tilesets are purposefully incomplete at zoom levels less than 9 (for tract, bg and place) to cut down on the displayed number of vertices (and thereby improve performance).  To accomplish this, an algorithm combining small features into larger has been implemented which respects logical geographic boundaries (so that features are not combined across County or State boundaries).

Additionally, features in each tile zoom level are assigned to geographic k-means clusters.  Map panning and zooming queries the geojson cluster layer instead of rendered features (as the traditional approach using queryRenderedFeatures would do).  The benefit of this is being able to pre-emptively load data without waiting for the base tiles to render first.  It also will also gather information for features outside the view area, so panning or zooming doesnt result in a temporary flash of blank features.

**Supported Geographies:**

State, Place, County, Tract, Block Group

**Supported Years**

2014, 2015, 2016

**Notes**

Running from an Amazon Linux EC2 instance is highly recommended for performance reasons (and is the only environment I've tested in).

This script requires linuxbrew or homebrew to run tippecanoe.  Here's how I installed linuxbrew:

```
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Linuxbrew/install/master/install)" < /dev/null
echo 'export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"' >>~/.bash_profile
echo 'export MANPATH="/home/linuxbrew/.linuxbrew/share/man:$MANPATH"' >>~/.bash_profile
echo 'export INFOPATH="/home/linuxbrew/.linuxbrew/share/info:$INFOPATH"' >>~/.bash_profile
source ~/.bash_profile
```

You'll also need to install nodeJS.  Here's my favorite way:

```
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads
nvm install node
```

### Before Starting ###


**Note:** *This script assumes your buckets have already been created.*

Assuming bucket names of:

```
geo-metadata: list what GEOIDs are in each cluster
v2-cluster-json: geographic representation of each cluster
v2-geography-tiles: the tileset that will be loaded by the map
```


### Installation

Clone the repository:

```
sudo yum install git
git clone https://github.com/royhobbstn/createTiles.git
cd createTiles
npm install
```


**Running**

```
bash geotiles_carto_2014-2016.sh geolayer year
```

where ```geolayer``` is one of: county, state, tract, bg, place

where ```year``` is one of: 2014 2015 2016.  perhaps beyond.