# createTiles

Automate creation of Census [cartographic boundary file](https://www.census.gov/geo/maps-data/data/tiger-cart-boundary.html) vector tile datasets, and upload to s3 buckets.

**Supported Geographies:**

State, Place, County, Tract, Block Group

**Supported Years**

2014, 2015, 2016

**Notes**

Running from an EC2 instance is highly recommended for performance reasons (and is the only environment I've tested in).  If you choose a different environment you'll probably also need to install ```ruby```, ```unzip```, and the [s3 command line](http://docs.aws.amazon.com/cli/latest/userguide/installing.html) tools.  


### Before Starting ###

**IMPORTANT:** [Configure AWS Credentials](http://docs.aws.amazon.com/cli/latest/userguide/cli-config-files.html)

Setting up ```~/.aws/credentials``` is probably the easiest option.

**Create a bucket for your tiles**

Use an existing bucket or:
```
aws s3 mb s3://bucket-name
```

Then download the repository:

```
sudo yum install git
git clone https://github.com/royhobbstn/createTiles.git
cd createTiles
```


**Running**
```bash geotiles_carto_2014-2016.sh yourbucketname county 2015```

**Note:** *This script assumes your bucket has already been created.*


### How do I use this in a GL Map? ###

```
map.addSource('tiles', {
  "type": "vector",
  "tiles": [`https://s3-us-west-2.amazonaws.com/BUCKET/GEO_YEAR/{z}/{x}/{y}.pbf`]
});

map.addLayer({
  'id': 'tiles-polygons',
  'type': 'fill',
  'source': 'tiles',
  'source-layer': 'main',
  'paint': {
    'fill-color': 'green',
    'fill-opacity': 0.75
  }
});
```

Where ```BUCKET``` is the name of the bucket you loaded the tiles into

and ```GEO``` is one of: ```state```, ```place```, ```county```, ```tract```, ```bg```

and ```YEAR``` is one of: 2014, 2015, 2016.

**Note:**  *You'll most likely need to change the AWS Region* ```s3-us-west-2.amazonaws.com``` *to whichever region your bucket is in.*


**ERRORS**

If you can't get your tiles to show on your map, you're likely running into issues with bucket permissions, or CORS.