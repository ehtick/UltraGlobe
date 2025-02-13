import { RasterLayer } from './RasterLayer.js';
const IMAGERY_TRANSPARENCY_CHANGE = "imagery_transparency-change";
/**
 * Base layer for imagery.
 * @class
 * @extends RasterLayer
 */
class ImageryLayer extends RasterLayer{
    /**
     * Base constructor for all Imagery layers.
     * @param {Object} properties 
     * @param {String|Number} properties.id layer id should be unique
     * @param {String} properties.name the name can be anything you want and is intended for labeling
     * @param {Number} [properties.transparency = 0] the layer's transparency (0 to 1)
     * @param {Number[]} [properties.bounds=[-180, -90, 180, 90]]  min longitude, min latitude, max longitude, max latitude in degrees
     * @param {Boolean} [properties.visible = true] layer will be rendered if true (true by default)
     */
    constructor(properties) {
        super(properties);
        this.transparency = properties.transparency?properties.transparency:0;
        this.isImageryLayer = true;
    }

    /**
     * Fetches the nearest loaded LOD (texture, uvBounds and reference) and adds a callback for the ideal LOD if not yet available
     * @param {PlanetTile} tile the requestor 
     * @param {Function} callbackSuccess the callback to be called when correct LOD is available with an object containing texture and uvBounds
     * @param {Function} callbackFailure called on exception
     * @returns {Object} the nearest already loaded LOD texture and uv bounds for the requestor: {texture: THREE.Texture, uvBounds:THREE.Box2, reference:String}
     */
     _getMap(tile, callbackSuccess, callbackFailure) {

     }

     setTransparency(transparency) {
        this.transparency = transparency;
        for (const element in this.listeners) {
            this.listeners[element](this, IMAGERY_TRANSPARENCY_CHANGE);
        }
    }

    
}

export{ImageryLayer, IMAGERY_TRANSPARENCY_CHANGE}