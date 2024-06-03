import * as THREE from 'three';
import { PlanetTile } from './PlanetTile.js';
import { Object3D } from 'three/src/core/Object3D';
import { LAYERS_CHANGED } from '../layers/LayerManager.js';
import * as TRANSFORM from '../transform/Transformer.js';

const frustum = new THREE.Frustum();
const mat = new THREE.Matrix4();

/**
 * @private
 */
class Planet extends Object3D {

    
    /**
     * 
     * @param {Object} properties 
     * @param {THREE.WebGLRenderer} properties.renderer main renderer
     * @param {THREE.Camera} properties.camera main camera
     * @param {CSM} properties.shadows cascade shadow map object
     * @param {THREE.Vector3} properties.center (optional) planet center in world space. defaults to 0,0,0
     * @param {LayerManager} properties.layerManager manages layers
     * @param {Number} properties.detailMultiplier a multiplier for terrain and 2D map detail
     * @param {Number} properties.tileSize terrain tile resolution
     * @param {Number} properties.tileImagerySize imagery tile resolution
     */
    constructor(properties) {
        super();
        this.frustumCulled = true;
        this.elevationExageration = 1;
        this.renderer = properties.renderer;
        const self = this;

        if (!properties.camera) {
            throw ("A camera is required in order to refine the planet's levels of detail.")
        }
        self.llhToCartesian = TRANSFORM.transform("EPSG:4326", 'EPSG:4978');
        self.camera = properties.camera;

        /* self.a = 6378137.0;
        self.w = 7292115E-11;
        self.f = 0.00335281066;
        self.GM = 3.986004418E14;
 */

        if (!!properties.center) {
            self.center = properties.center;
        } else {
            self.center = new THREE.Vector3(0, 0, 0);
        }

        self.radius = 6378137.0;
        self.layerManager = properties.layerManager;

        this.add(new PlanetTile({
            bounds: new THREE.Box2(new THREE.Vector2(-Math.PI, -Math.PI * 0.5), new THREE.Vector2(0, Math.PI * 0.5)),
            layerManager: self.layerManager, planet: this, level: 0, shadows: properties.shadows, detailMultiplier:properties.detailMultiplier,
            tileSize: properties.tileSize, tileImagerySize: properties.tileImagerySize
        }));
        this.add(new PlanetTile({
            bounds: new THREE.Box2(new THREE.Vector2(0, -Math.PI * 0.5), new THREE.Vector2(Math.PI, Math.PI * 0.5)),
            layerManager: self.layerManager, planet: this, level: 0, shadows: properties.shadows, detailMultiplier:properties.detailMultiplier,
            tileSize: properties.tileSize, tileImagerySize: properties.tileImagerySize
        }));

        self.matrixAutoUpdate = false;
        this.lastUpdateIndex = 0;
        this.tilesToUpdate;
        

        
    }

    update(){
        const self = this;
        if (!self.pause) {
            let startTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
            
            frustum.setFromProjectionMatrix(mat.multiplyMatrices(self.camera.projectionMatrix, self.camera.matrixWorldInverse));

            if(!self.tilesToUpdate || self.lastUpdateIndex>= self.tilesToUpdate.length){
                self.tilesToUpdate = [];
                self.lastUpdateIndex = 0;
                self.traverse(o=>{
                    if(o.isPlanetTile){
                        self.tilesToUpdate.push(o);
                    }
                });
                self.tilesToUpdate.sort((a,b)=>b.level - a.level);
            }
            while(self.lastUpdateIndex<self.tilesToUpdate.length){
                self.tilesToUpdate[self.lastUpdateIndex].update(self.camera, frustum, self.renderer);
                self.lastUpdateIndex++;
                if(self.lastUpdateIndex>=self.tilesToUpdate.length){
                    
                    self.tilesToUpdate = undefined;
                    break;
                }
                const timeSpent = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now())-startTime
                if(timeSpent>=0.5){ // spend no more than a millisecond on this before freeing up the CPU
                    break;
                }
            }
        }
        PlanetTile.planetTileUpdate();
    }
    /**
     * this method returns all the leaf tiles that interact with the given lon/lat bounds
     */
    interactsWith(bounds) {
        var interactingTiles = [];
        this.children.forEach(child => {
            interactingTiles = interactingTiles.concat(child.interactsWith(bounds));
        });
        return interactingTiles;
    }

    cull(frustum) {
        this.children.forEach(child => {
            child.cull(frustum);
        });
    }

    /**
     * Returns the terrain height at the given longitude and latitude
     * @param {Vector2} lonlat in radians 
     */
    getTerrainElevation(lonLat) {
        let elevation = 0;
        this.children.every(child => {
            if (child.bounds.containsPoint(lonLat)) {
                elevation = child.getTerrainElevation(lonLat);
                return false;
            }
            return true;
        })
        if (elevation === false) {
            return 0;
        }
        return elevation * this.elevationExageration;
    }
    _pauseRendering() {
        this.pause = true;
    }
    _resumeRendering() {
        this.pause = false;
    }

    setElevationExageration(elevationExageration) {
        this.elevationExageration = elevationExageration;
        this.children.forEach(planetTile => planetTile.setElevationExageration());
    }



    /**
     * Transforms a lon lat height point (degrees) to cartesian coordinates (EPSG:4978).
     * The transform is slightly inaccurate compared to proj4 but it's 3 times faster
     * @param {THREE.Vector3} llh
     */
    llhToCartesianFastSFCT(llh, radians = false) {
        const lon = radians ? llh.x : 0.017453292519 * llh.x;
        const lat = radians ? llh.y : 0.017453292519 * llh.y;
        const N = 6378137.0 / (Math.sqrt(1.0 - (0.006694379990141316 * Math.pow(Math.sin(lat), 2.0))));
        const cosLat = Math.cos(lat);
        const cosLon = Math.cos(lon);
        const sinLat = Math.sin(lat);
        const sinLon = Math.sin(lon);
        const nPh = (N + llh.z);

        llh.set(nPh * cosLat * cosLon, nPh * cosLat * sinLon, (0.993305620009858684 * N + llh.z) * sinLat);
    }

    /**
     * Transforms a xyz point (degrees) to llh coordinates (EPSG:4326).
     * The transform is slightly inaccurate compared to proj4 but it's 2.5 times faster
     * @param {THREE.Vector3} llh
     */
    cartesianToLlhFastSFCT(xyz) {
        const a = 6378137.0;
        const b = 6356752.314245179;
        const e2 = 0.006694379990141316;
        const p = Math.sqrt(xyz.x * xyz.x + xyz.y * xyz.y);
        const th = Math.atan2(a * xyz.z, b * p);
        const sinTh = Math.sin(th);
        const cosTh = Math.cos(th);
        const lat = Math.atan2(xyz.z + 42841.3115133135658 * sinTh * sinTh * sinTh, p - 42697.672707179 * cosTh * cosTh * cosTh);
        const sinLat = Math.sin(lat);
        const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);

        xyz.x = Math.atan2(xyz.y, xyz.x) * 57.29577951308232;
        xyz.y = lat * 57.29577951308232;
        xyz.z = p / Math.cos(lat) - N;
    }
}


export { Planet };