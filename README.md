# U L T R A G L O B E  :  http://www.jdultra.com/

![image](https://github.com/ebeaufay/UltraGlobe/assets/16924300/80af2644-fa32-48c4-b0d7-3c33a590718d)
![image](https://github.com/ebeaufay/UltraGlobe/assets/16924300/83c5d224-d417-42b4-87d6-ef41823b6133)

Displays the earth in threeJS with level of detail, imagery, elevation and connection to OGC web services.

The earth model is wgs 84.

Support for WMS and OGC 3DTiles.

Partial I3S support.

## Demos

[Google Map Tile API](https://www.jdultra.com/mapTiles/index.html)

[3DTiles](https://ebeaufay.github.io/UltraGlobeDemo/)

[Berlin (3 km²)](https://www.jdultra.com/berlin/index.html)

[Geoid](https://storage.googleapis.com/jdultra.com/geoid/index.html)

[Elevation and WMS imagery](https://storage.googleapis.com/jdultra.com/elevation/index.html)

[I3S Points (new york trees) and blue marble](https://storage.googleapis.com/jdultra.com/i3s/index.html)

[Controls (including mobile)](https://storage.googleapis.com/jdultra.com/controllers/index.html)

[More controls for selecting and moving 3DTiles tilesets](https://storage.googleapis.com/jdultra.com/tilesetplacement/index.html)

[Random planet](https://www.jdultra.com/planet/index.html)

## API

In your HTML, have a div with a specific id.

````html
<body>
  <div id="screen" oncontextmenu="return false;" style="position: absolute; height:100%; width:100%; left: 0px; top:0px;"></div>
</body>
````

in your main javascript file, insert the following:

````js
import { Map } from './Map.js';

let map = new Map({ divID: 'screen' });
````

At this point, you'll only see a white sphere as no data has yet been loaded.

### Loading imagery

We'll first add a WMSLayer that connects to an OGC WMS service in order to display maps at multiple levels of detail

````js
import { Map } from './Map.js';
import { WMSLayer } from './layers/WMSLayer.js';

let map = new Map({ divID: 'screen' });

var wmsLayer = new WMSLayer({
    id: 0,
    name: "WMS",
    bounds: [-180, -90, 180, 90],
    url: "https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv",
    layer: "gebco_latest_2",
    epsg: "EPSG:4326",
    version: "1.1.1",
    visible:true
})

//add a layer at index 0
map.setLayer(wmsLayer, 0);
````

Right now, only WMS and a custom imagery service are supported. You may look at the WMSLayer class to create your own layer.

### Loading elevation

Currently, only a custom service for elevation is supported. You can implement your own ElevationLayer. 
Here we'll use the SimpleElevationLayer class to add some sinusoidal terrain to the map:

````js
import { Map } from './Map.js';
import { WMSLayer } from './layers/WMSLayer.js';

let map = new Map({ divID: 'screen' });

var wmsLayer = new WMSLayer({
    id: 0,
    name: "WMS",
    bounds: [-180, -90, 180, 90],
    url: "https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv",
    layer: "gebco_latest_2",
    epsg: "EPSG:4326",
    version: "1.1.1",
    visible:true
})

map.setLayer(imageryLayer, 0);

var simpleElevation = new SimpleElevationLayer({
    id: 1,
    name: "ultraElevation",
    bounds: [-180, -90, 180, 90],
    visible:false
});

map.setLayer(simpleElevation, 1);
````

### Loading OGC 3DTiles

An OGC3DTiles tileset can be added as a layer.

````js
import { Map } from './Map.js';
import { OGC3DTilesLayer } from './layers/OGC3DTilesLayer';

var ogc3dTiles = new OGC3DTilesLayer({
    id: 6,
    name: "OGC 3DTiles",
    visible: true,
    url: "https://storage.googleapis.com/ogc-3d-tiles/ayutthaya/tileset.json",
    zUp: false,
    longitude: 100.5877 * 0.01745329251994329576923690768489,
    latitude: 14.3692 * 0.01745329251994329576923690768489,
    height: 16,
    rotationY: 0.5,
    scale: 1,
    geometricErrorMultiplier: 1.5,
    loadOutsideView:true
});
map.setLayer(ogc3dTiles, 2);
````

In the case of a tileset that is already georeferenced (region bounding volume) you should omit the properties related to tileset positioning and scaling :

````js
var ogc3dTiles = new OGC3DTilesLayer({
    id: 6,
    name: "OGC 3DTiles",
    visible: true,
    url: "path/to/georeferenced/tileset.json",
    geometricErrorMultiplier: 1.5,
    loadOutsideView:true
});
map.setLayer(ogc3dTiles, 2);
````


Only B3DM tilesets are supported right now (meshes). Point-cloud will be comming eventually, you can follow the progress of the 3DTiles implementation here: https://github.com/ebeaufay/3DTilesViewer

I also have a project to convert meshes to 3DTiles. I'm keeping that code private but I'm working on a web-service that I'll make free for small meshes.
Feel free to contact me at emeric.beaufays@jdultra.com if you want a specific model converted and check out the demo website : www.jdultra.com.

### Atmosphere
atmosphere is on by default, and there shouldn't be anything to do there.

