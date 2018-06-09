# createTiles

Automate creation of *clustered Census [cartographic boundary file](https://www.census.gov/geo/maps-data/data/tiger-cart-boundary.html) vector tile datasets, and upload to s3 buckets.

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


**Note:** *This script assumes your bucket has already been created.*

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