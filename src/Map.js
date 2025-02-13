
import * as THREE from 'three';
import { Planet } from './planet/Planet.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { PanController } from './controls/PanController.js';
import { RotateController } from './controls/RotateController.js';
import { ZoomController } from './controls/ZoomController.js';
import { SelectController } from './controls/SelectController.js';
import { LayerManager } from './layers/LayerManager.js';
import { PostShader } from './PostShader.js';
import { VideoPostShader } from './VideoPostShader.js';
import { MapNavigator } from "./MapNavigator.js";
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import opticalDepth from './images/optical_depth.png';
import water1 from './images/Water_1_M_Normal.jpg';
import water2 from './images/Water_2_M_Normal.jpg';
import perlin from './images/noise2.png';
import { Controller } from "./controls/Controller.js";
import { getSunPosition } from "./Sun";
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { CSMHelper } from 'three/examples/jsm/csm/CSMHelper.js';
import ringsPalette from './images/ringsPalette.png';
import stars from './images/stars.png';
import nebula from './images/nebula2.png';
import nebulaPalette from './images/paletteNebula.png';
import { cartesianToLlhFastSFCT, llhToCartesianFastSFCT } from "./GeoUtils.js";
import { ultraClock } from './controls/clock';
import { PositionBufferShaderMaterial } from "./materials/PositionBufferShaderMaterial.js";
import { cameraEase, getCameraLLHYawPitchRoll } from "./utils/CameraHelper.js"
import { FXAA } from './utils/FXAA.js'


// reused variables
const tempClearColor = new THREE.Color();
const splatsClearColor = new THREE.Color(1, 1, 1);
const depths = new Uint8Array(4);
const depth24 = new THREE.Vector3();
const unpacker = new THREE.Vector3(1, 1 / 256, 1 / (256 * 256));
const A = new THREE.Vector3();
const B = new THREE.Vector3();
const loader = new THREE.TextureLoader();
const degreeToRadians = Math.PI / 180;

const cycle = 0.04; // a cycle of a flow map phase
const halfCycle = cycle * 0.5;
const waterScale = 1000;

const clock = new THREE.Clock();
const flowSpeed = 0.01;
class Map {

    /**
    * @param {Object} properties 
    * @param {String} properties.divID A div ID.
    * @param {Boolean} [properties.debug=false] Display debug information.
    * @param {Boolean} [properties.shadows=false] Display sunlight and shadows.
    * @param {THREE.Vector3} [properties.atmosphere=new THREE.Vector3(0.1, 0.4, 1.0)] An atmosphere color. By thefault a blueish atmosphere is displayed.
    * @param {Number} [properties.atmosphereDensity=1.0] An atmosphere density.
    * @param {Boolean|Object} [properties.clock = false] add a clock.
    * @param {THREE.Vector3|Boolean} [properties.sun=true] A sun color, defaults to a yelowish sun. Only taken into account when shadows is true. An explicitely "false" value switches the sun for a black hole (queue theremin music).
    * @param {Boolean|THREE.Vector3} [properties.ocean=false] if true displays a blue ocean but a specific ocean color can be specified.
    * @param {THREE.DataTexture} [properties.globalElevation=false] A texture representing the global elevation (equidistant cylindrical projection) used for post processing effects.
    * @param {Boolean|Object} [properties.rings = false] Rings properties, if undefined, no rings are drawn 
    * @param {Number} [properties.detailMultiplier = 1.0] multiplier for loading terrain and 2D maps, a higher number loads higher detail data
    * @param {Number} [properties.tileSize = 32] mesh resolution per tile.
    * @param {Number} [properties.targetFPS] target FPS: defaults to 60 for desktop and 30 for mobile (FPS may not be precisely respected depending on monitor refresh rate)
    * @param {Number} [properties.tileImagerySize = 256] Resolution of imagery per tile.
    * @param {Boolean} [properties.loadOutsideView = false] loads higher LOD tiles outside view so that they are already loaded when the camera pans and turns
    * @param {Boolean|Object|THREE.Color} [properties.space = true] if undefined, a default space backgound is drawn. Space can also be a single opaque color as a THREE.Color
    * @param {number|boolean} [properties.minHeightAboveGround = 5.0] minimum camera height above ground. set to false to disable feature
    * @param {boolean} [properties.splatsOver = false] render splats over everything else.
    * @param {Boolean} [properties.clock.timezone = false] add time-zone select widget.
    * @param {Boolean} [properties.clock.dateTimePicker = false] add date picker widget.
    * @param {THREE.Vector3} [properties.rings.origin=new THREE.Vector3()] the center point of the rings
    * @param {THREE.Vector3} [properties.rings.normal=new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize()] the orientation of the rings plane
    * @param {Number} [properties.rings.innerRadius=6378137.0 * (1.1+Math.random())] the rings inner radius
    * @param {Number} [properties.rings.outerRadius=this.rings.innerRadius+(0.1+Math.random())*6378137.0] the rings outer radius
    * @param {Number} [properties.rings.colorMap=Math.random()] a modulation on the ring colors
    * @param {Number} [properties.rings.colorMapDisplace=Math.random()] rings displacement in a loop
    * @param {Number} [properties.space.starsIntensity=0.75] The intensity of stars
    * @param {Number} [properties.space.gasCloudsIntensity=0.25] the intensity of nebula like gasClouds
    * @param {Number} [properties.space.colorMap=Math.random()] a modulation on gas cloud colors
    * @param {Number} [properties.space.texRotation1= Math.random()*Math.PI] a texture rotation to avoid obvious repetition.
    * @param {Number} [properties.space.texRotation2 = Math.random()*Math.PI] a texture rotation to avoid obvious repetition.
    * 
    */
    constructor(properties) {

        const self = this;
        self.isMobile = _isMobileDevice();
        self.positionBufferMaterial = PositionBufferShaderMaterial();
        this.planetHidden = false;
        this.previousCameraPosition = new THREE.Vector3();
        this.previousCameraRotation = new THREE.Euler();
        this.loadOutsideView = properties.loadOutsideView ? properties.loadOutsideView : false;
        this.splatsOver = properties.splatsOver ? true : false;
        if (properties.targetFPS) {
            self.targetFPS = properties.targetFPS;
        } else {
            self.targetFPS = self.isMobile ? 31 : 61;
        }
        self.tileSize = properties.tileSize ? properties.tileSize : 32;
        self.tileImagerySize = properties.tileImagerySize ? properties.tileImagerySize : 256;

        this.ambientLight;
        this.detailMultiplier = properties.detailMultiplier ? properties.detailMultiplier : 1.0;
        this.layerManager = new LayerManager();
        this.layerManager.addListener("mapEnvLayerListener", this._layersChangedListener());
        this.debug = properties.debug;
        this.shadows = false;
        this.rings = properties.rings;
        this.postCamera = new THREE.OrthographicCamera(- 1, 1, 1, - 1, 0, 1);
        if (this.rings) {
            if (!(typeof this.rings === 'object' && Array.isArray(this.rings))) this.rings = {};
            if (!this.rings.origin) this.rings.origin = new THREE.Vector3();
            if (!this.rings.normal) this.rings.normal = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            if (!this.rings.innerRadius) this.rings.innerRadius = 6378137.0 * (1.1 + Math.random());
            if (!this.rings.outerRadius) this.rings.outerRadius = this.rings.innerRadius + (0.1 + Math.random()) * 6378137.0;
            if (!this.rings.colorMap) this.rings.colorMap = Math.random();
            if (!this.rings.colorMapDisplace) this.rings.colorMapDisplace = Math.random();
        }

        this.minHeightAboveGround = properties.minHeightAboveGround != undefined ? properties.minHeightAboveGround : 5;


        this.globalElevation = properties.globalElevation;
        if (!!properties.domContainer) {
            this.domContainer = properties.domContainer;
        } else if (!!properties.divID) {
            this.domContainer = document.getElementById(properties.divID);
        } else {
            throw "cannot create Map without a domContainer or divID"
        }
        this.camera = !!properties.camera ? properties.camera : this._initCamera();
        this.camera.layers.enable(31);
        this.renderCamera = this.camera.clone();

        this.ultraClock = ultraClock(properties.clock);
        this.ultraClock.addListener(date => self._setDate(date));


        this.ocean = properties.ocean;
        this.atmosphere = properties.atmosphere;
        if (!!this.atmosphere && !this.atmosphere.isVector3) this.atmosphere = new THREE.Vector3(0.1, 0.4, 1.0);
        this.atmosphereDensity = properties.atmosphereDensity ? properties.atmosphereDensity : 1.0;
        this.sunColor = properties.sun;

        this._initRenderer();
        this.scene = !!properties.scene ? properties.scene : this._initScene(properties.shadows);
        this.splatsScene = this._initSplatsScene();

        if (properties.space && properties.space.isColor) {
            this.space = false;
            this.scene.background = properties.space;
        } else {
            this.space = properties.space;
            if (this.space) {
                if (!(typeof this.space === 'object' && Array.isArray(this.space))) this.space = {};
                if (!this.space.starsIntensity) this.space.starsIntensity = 0.75;
                if (!this.space.gasCloudsIntensity) this.space.gasCloudsIntensity = 0.5;//Math.random();
                if (!this.space.colorMap) this.space.colorMap = Math.random();
                if (!this.space.texRotation1) this.space.texRotation1 = Math.random() * Math.PI;
                if (!this.space.texRotation2) this.space.texRotation2 = Math.random() * Math.PI;
            }
        }

        this._resetLogDepthBuffer();

        if (properties.debug) {
            this._initStats();
            const axesHelper = new THREE.AxesHelper(50000000);
            this.scene.add(axesHelper);
        }






        this._initLabelRenderer();

        this._initPlanet();
        this._initController();
        this.scene.add(this.planet);
        this._setupRenderTarget();
        this._setupPostScene();
        this._setupSplatsComposeMaterial();
        this._setupFXAAMaterial();


        this._setupDepthPassMaterial();
        this._setupVideoPassMaterial();


        this._startAnimation();
        this.mapNavigator = new MapNavigator(this);

        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 10;
        this.raycaster.params.Line.threshold = 10;

        this.selection = {};



    }

    hidePlanet() {
        this.planetHidden = true;
        this.planet._pauseRendering();
        this.scene.remove(this.planet);
    }
    showPlanet() {
        this.planetHidden = false;
        this.planet._resumeRendering();
        this.scene.add(this.planet);
    }

    _updateFlow() {

        const delta = clock.getDelta();
        const config = this.postMaterial.uniforms['waterConfig'];

        config.value.x += flowSpeed * delta; // flowMapOffset0
        config.value.y = config.value.x + halfCycle; // flowMapOffset1

        // Important: The distance between offsets should be always the value of "halfCycle".
        // Moreover, both offsets should be in the range of [ 0, cycle ].
        // This approach ensures a smooth water flow and avoids "reset" effects.

        if (config.value.x >= cycle) {

            config.value.x = 0;
            config.value.y = halfCycle;

        } else if (config.value.y >= cycle) {

            config.value.y = config.value.y - cycle;

        }

    }

    /**
     * Set the date (sun position)
     * @param {Date} date 
     */
    _setDate(date) {
        this.sunPosition = getSunPosition(date);
        if (this.csm) {
            this.csm.lightDirection.copy(this.sunPosition).negate();
        }
    }

    /**
     * Sets the given layer at the given index disposing of any layer previously at that index.
     * @param {Layer} layer 
     * @param {Number} index 
     */
    setLayer(layer, index) {
        this._prepareLayer(layer)
        this.layerManager.setLayer(layer, index);
    }

    _prepareLayer(layer) {
        layer._setMap(this);
        layer._addToScene(this.scene);

        if (layer.isI3SLayer) {
            layer.addToScene(this.scene, this.camera);
        }
        if (layer.isTracksLayer) {
            layer.addToScene(this.scene, this.camera);
        }
        if (layer.isSplats) {
            layer._addToSplatsScene(this.splatsScene);
        }
    }

    /**
     * appends the layer to the end of the list of layers, replacing any layer already at that position.
     * @param {Layer} layer 
     * @param {Number} index 
     */
    addLayer(layer) {
        this._prepareLayer(layer)
        return this.layerManager.addLayer(layer);
    }

    /**
     * removes the layer at the specific index optionally "disposing" of any resources the layer is using.
     * @param {Number} index 
     * @param {Boolean} dispose 
     */
    removeLayer(index, dispose = true) {
        this.layerManager.removeLayer(index, dispose);
    }

    /**
     * Returns an array of layers currently loaded on the map
     * @returns {Layer[]} the list of layers
     */
    getLayers() {
        return this.layerManager.getLayers();
    }

    /**
     * Fetches a specific layer by ID.
     * @param {Number|String} id 
     * @returns {Layer} the layer with given ID if any
     */
    getLayerByID(id) {
        return this.layerManager.getLayerByID(id);
    }



    _layersChangedListener() {
        const self = this;
        return (event, layer) => {
            let cloudsLayerEncountered = false;
            self.layerManager.getLayers().forEach(layer => {

                if (layer.isCloudsLayer && !cloudsLayerEncountered) {
                    if (layer.visible) {
                        cloudsLayerEncountered = true;
                        if (!self.cloudsLayer || self.cloudsLayer != layer) {
                            self.cloudsLayer = layer;
                            if (!layer.isInitialized) self.cloudsLayer._init(self);
                        }
                    }


                }

                if (layer.isProjectedLayer && !layer.map) {
                    layer._init(self);

                }
                if (!cloudsLayerEncountered) {
                    self.cloudsLayer = undefined;
                }
            })
        }

    }
    _initSplatsScene() {
        return new THREE.Scene();
    }

    _initCSM() {
        this.sunPosition = getSunPosition(new Date())
        const csmSplits = [];
        for (let i = 0; i < 8; i++) {
            if (i == 0) csmSplits.push(1);
            else {
                csmSplits.push(csmSplits[i - 1] * 3.2);
            }
        }
        for (let i = 0; i < csmSplits.length; i++) {
            csmSplits[i] /= csmSplits[csmSplits.length - 1];
        }
        this.csm = new CSM({
            maxFar: 500000,
            cascades: csmSplits.length,
            mode: "custom",
            customSplitsCallback: (cascadeCount, nearDistance, farDistance, target) => {
                target.push(...csmSplits);
            },
            fade: true,
            parent: this.scene,
            shadowMapSize: this.isMobile ? 1024 : 2048,
            lightIntensity: 3.5,
            lightDirection: this.sunPosition.clone().negate(),
            lightMargin: 500000,
            shadowBias: -0.000001,
            //noLastCascadeCutOff: true,
            //shadowNormalBias : -5000,
            camera: this.camera
        });
        this.csm.csmSplits = csmSplits;

        for (let i = 0; i < this.csm.lights.length; i++) {
            this.csm.lights[i].shadow.bias = 0.00025 * csmSplits[i];
            this.csm.lights[i].shadow.normalBias = 0.1;
            this.csm.lights[i].shadow.camera.near = 1;
            this.csm.lights[i].shadow.camera.updateProjectionMatrix();
            this.csm.lights[i].shadow.camera.far = this.csm.lightMargin + this.csm.maxFar * 2 * csmSplits[i];
            this.csm.lights[i].shadow.needsUpdate = true;
        }

        if (this.debug) {
            this.csmHelper = new CSMHelper(this.csm);
            this.csmHelper.visible = true;
            this.scene.add(this.csmHelper);
            const self = this;
            document.addEventListener('keyup', (e) => {
                if (e.key === 'u') {
                    console.log("csmHelper update");
                    self.csmHelper.update();
                }
            });

            document.addEventListener('keyup', (e) => {
                if (e.key === 'a') {
                    for (let i = 0; i < this.csm.lights.length; i++) {
                        this.csm.lights[i].shadow.normalBias *= 2;
                        this.csm.lights[i].shadow.needsUpdate = true;
                    }
                }
                if (e.key === 'q') {
                    for (let i = 0; i < this.csm.lights.length; i++) {
                        this.csm.lights[i].shadow.normalBias *= 0.5;
                        this.csm.lights[i].shadow.needsUpdate = true;
                    }
                    console.log("normalBiasDown " + this.csm.lights[0].shadow.normalBias);
                }
                if (e.key === 'z') {
                    for (let i = 0; i < this.csm.lights.length; i++) {
                        this.csm.lights[i].shadow.bias *= 2;
                        this.csm.lights[i].shadow.needsUpdate = true;
                    }
                }
                if (e.key === 's') {
                    for (let i = 0; i < this.csm.lights.length; i++) {
                        this.csm.lights[i].shadow.bias *= 0.5;
                        this.csm.lights[i].shadow.needsUpdate = true;
                    }
                    console.log("BiasDown " + this.csm.lights[0].shadow.bias);
                }
            });
        }
    }
    /**
     * Display shading and shadows
     */
    showShadows() {
        if (this.shadows == true) return;
        for (let i = 0; i < this.csm.lights.length; i++) {

            this.csm.parent.add(this.csm.lights[i].target);
            this.csm.parent.add(this.csm.lights[i]);

        }
        this.ambientLight.intensity = 0.8;
        this.shadows = true;
        this.renderer.shadowMap.enabled = true;
        this._disposePostMaterial();
        this._setupPostMaterial();

        if(this.cloudsLayer){
            this.cloudsLayer._setShadows();
        }
        
    }
    /**
     * Remove shading and shadows
     */
    hideShadows() {
        if (this.shadows == false) return;
        for (let i = 0; i < this.csm.lights.length; i++) {

            this.csm.parent.remove(this.csm.lights[i].target);
            this.csm.parent.remove(this.csm.lights[i]);

        }
        this.ambientLight.intensity = 3.0;
        this.shadows = false;
        this.renderer.shadowMap.enabled = false;
        this._disposePostMaterial();
        this._setupPostMaterial();
        if(this.cloudsLayer){
            this.cloudsLayer._setNoShadows();
        }
    }
    _initScene(shadowsOn) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this._initCSM();
        this.ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.8);
        this.scene.add(this.ambientLight);
        this.shadows = true;
        if (!shadowsOn) {
            this.hideShadows();
        } else {
            this.renderer.shadowMap.enabled = true;
            this._setupPostMaterial();
        }

        return this.scene;
    }

    _setupRenderTarget() {

        if (this.target) this.target.dispose();

        this.target = new THREE.WebGLRenderTarget(this.domContainer.offsetWidth, this.domContainer.offsetHeight);
        this.target.texture.format = THREE.RGBAFormat;
        this.target.texture.colorSpace = THREE.SRGBColorSpace;
        this.target.texture.minFilter = THREE.LinearFilter;
        this.target.texture.magFilter = THREE.LinearFilter;
        this.target.texture.premultiplyAlpha = true;
        this.target.texture.generateMipmaps = false;
        this.target.stencilBuffer = false;
        this.target.depthBuffer = true;
        this.target.depthTexture = new THREE.DepthTexture();
        this.target.depthTexture.format = THREE.DepthFormat;
        this.target.depthTexture.type = THREE.FloatType;
        this.target.samples = 1;

        // the depth render target is used to render depth to the main texture so that it can read retrieved on the CPU
        if (this.depthTarget) this.depthTarget.dispose();

        this.depthTarget = new THREE.WebGLRenderTarget(this.domContainer.offsetWidth, this.domContainer.offsetHeight);
        this.depthTarget.texture.format = THREE.RGBAFormat;
        this.depthTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
        this.depthTarget.texture.minFilter = THREE.NearestFilter;
        this.depthTarget.texture.magFilter = THREE.NearestFilter;
        this.depthTarget.texture.generateMipmaps = false;
        this.depthTarget.stencilBuffer = false;
        this.depthTarget.depthBuffer = false;

        if (this.target2) this.target2.dispose();

        this.target2 = new THREE.WebGLRenderTarget(this.domContainer.offsetWidth, this.domContainer.offsetHeight);
        this.target2.texture.format = THREE.RGBAFormat;
        this.target2.texture.colorSpace = THREE.SRGBColorSpace;
        this.target2.texture.minFilter = THREE.NearestFilter;
        this.target2.texture.magFilter = THREE.NearestFilter;
        this.target2.texture.premultiplyAlpha = true;
        this.target2.texture.generateMipmaps = false;
        this.target2.stencilBuffer = false;
        this.target2.depthBuffer = true;
        this.target2.depthTexture = new THREE.DepthTexture();
        this.target2.depthTexture.format = THREE.DepthFormat;
        this.target2.depthTexture.type = THREE.FloatType;
        this.target2.samples = 1;


        if (this.targetWorld) this.targetWorld.dispose();

        this.targetWorld = new THREE.WebGLRenderTarget(this.domContainer.offsetWidth, this.domContainer.offsetHeight);
        this.targetWorld.texture.format = THREE.RGBAFormat;
        this.targetWorld.texture.type = THREE.FloatType;
        this.targetWorld.texture.colorSpace = THREE.NoColorSpace;
        this.targetWorld.texture.minFilter = THREE.NearestFilter;
        this.targetWorld.texture.magFilter = THREE.NearestFilter;
        this.targetWorld.texture.premultiplyAlpha = false;
        this.targetWorld.texture.generateMipmaps = false;
        this.targetWorld.stencilBuffer = false;
        this.targetWorld.depthBuffer = true;
        this.targetWorld.depthTexture = new THREE.DepthTexture();
        this.targetWorld.depthTexture.format = THREE.DepthFormat;
        this.targetWorld.depthTexture.type = THREE.FloatType;

        if (this.targetSplats) this.targetSplats.dispose();
        this.targetSplats = new THREE.WebGLRenderTarget(this.domContainer.offsetWidth, this.domContainer.offsetHeight);
        this.targetSplats.texture.format = THREE.RGBAFormat;
        this.targetSplats.texture.colorSpace = THREE.NoColorSpace;
        this.targetSplats.texture.minFilter = THREE.NearestFilter;
        this.targetSplats.texture.magFilter = THREE.NearestFilter;
        this.targetSplats.texture.premultiplyAlpha = false;
        this.targetSplats.texture.generateMipmaps = false;
        this.targetSplats.stencilBuffer = false;
        this.targetSplats.depthBuffer = false;

        if (this.targetSplatsDepth) this.targetSplatsDepth.dispose();
        this.targetSplatsDepth = new THREE.WebGLRenderTarget(this.domContainer.offsetWidth, this.domContainer.offsetHeight, { count: 1 });

        this.targetSplatsDepth.texture.format = THREE.RedFormat;
        this.targetSplatsDepth.texture.type = THREE.FloatType;
        this.targetSplatsDepth.texture.colorSpace = THREE.NoColorSpace;
        this.targetSplatsDepth.texture.minFilter = THREE.NearestFilter;
        this.targetSplatsDepth.texture.magFilter = THREE.NearestFilter;
        this.targetSplatsDepth.texture.premultiplyAlpha = false;
        this.targetSplatsDepth.texture.generateMipmaps = false;
        /* this.targetSplatsDepth.textures[0].format = THREE.RedFormat;
        this.targetSplatsDepth.textures[0].type = THREE.FloatType;
        this.targetSplatsDepth.textures[0].colorSpace = THREE.NoColorSpace;
        this.targetSplatsDepth.textures[0].minFilter = THREE.NearestFilter;
        this.targetSplatsDepth.textures[0].magFilter = THREE.NearestFilter;
        this.targetSplatsDepth.textures[0].premultiplyAlpha = false;
        this.targetSplatsDepth.textures[0].generateMipmaps = false;

        this.targetSplatsDepth.textures[1].format = THREE.RedFormat;
        this.targetSplatsDepth.textures[1].type = THREE.HalfFloatType;
        this.targetSplatsDepth.textures[1].colorSpace = THREE.NoColorSpace;
        this.targetSplatsDepth.textures[1].minFilter = THREE.NearestFilter;
        this.targetSplatsDepth.textures[1].magFilter = THREE.NearestFilter;
        this.targetSplatsDepth.textures[1].premultiplyAlpha = false;
        this.targetSplatsDepth.textures[1].generateMipmaps = false; */

        this.targetSplatsDepth.stencilBuffer = false;
        this.targetSplatsDepth.depthBuffer = false;

        if (this.targetSplatsCompose) this.targetSplatsCompose.dispose();
        this.targetSplatsCompose = new THREE.WebGLRenderTarget(this.domContainer.offsetWidth, this.domContainer.offsetHeight, { count: 2 });
        this.targetSplatsCompose.textures[0].format = THREE.RGBAFormat;
        this.targetSplatsCompose.textures[0].type = THREE.UnsignedByteType;
        this.targetSplatsCompose.textures[0].colorSpace = THREE.NoColorSpace;
        this.targetSplatsCompose.textures[0].minFilter = THREE.NearestFilter;
        this.targetSplatsCompose.textures[0].magFilter = THREE.NearestFilter;
        this.targetSplatsCompose.textures[0].premultiplyAlpha = false;

        this.targetSplatsCompose.textures[1].format = THREE.RedFormat;
        this.targetSplatsCompose.textures[1].type = THREE.FloatType;
        this.targetSplatsCompose.textures[1].colorSpace = THREE.NoColorSpace;
        this.targetSplatsCompose.textures[1].minFilter = THREE.NearestFilter;
        this.targetSplatsCompose.textures[1].magFilter = THREE.NearestFilter;
        this.targetSplatsCompose.textures[1].premultiplyAlpha = false;

        this.targetSplatsCompose.texture.generateMipmaps = false;
        this.targetSplatsCompose.stencilBuffer = false;
        this.targetSplatsCompose.depthBuffer = false;
    }



    _setupBlurMaterials() {


    }
    _setupSplatsComposeMaterial() {
        this.splatsComposeMaterial = new THREE.ShaderMaterial({
            vertexShader: this._splatsDepthComposeVertexShader(),
            fragmentShader: this._splatsDepthComposeFragmentShader(),
            uniforms: {
                splatsTexture: { value: undefined },
                otherTexture: { value: undefined },
                splatsDepthTexture: { value: undefined },
                otherDepthTexture: { value: undefined },

                splatsOver: { value: this.splatsOver }
            },
            transparent: false,
            side: THREE.FrontSide,
            depthTest: false,
            depthWrite: false,
            glslVersion: THREE.GLSL3
        });

    }

    _setupPostScene() {
        const postPlane = new THREE.PlaneGeometry(2, 2);
        this.postQuad = new THREE.Mesh(postPlane);
        this.postScene = new THREE.Scene();
        this.postScene.add(this.postQuad);
        this.postScene.matrixAutoUpdate = false;
        this.postQuad.matrixAutoUpdate = false;
    }

    /**
     * set rings
     * @param {Boolean|Object} [rings = false] Rings properties, if undefined, no rings are drawn, if "true", random rings are drawn
     * - param {THREE.Vector3} [rings.origin=new THREE.Vector3()] the center point of the rings
     * - param {THREE.Vector3} [rings.normal=new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize()] the orientation of the rings plane
     * - param {Number} [rings.innerRadius=6378137.0 * (1.1+Math.random())] the rings inner radius
     * - param {Number} [rings.outerRadius=this.rings.innerRadius+(0.1+Math.random())*6378137.0] the rings outer radius
     * - param {Number} [rings.colorMap=Math.random()] a modulation on the ring colors
     * - param {Number} [rings.colorMapDisplace=Math.random()] rings displacement in a loop
     */
    setRings(rings) {
        if (this.rings != rings) {
            this.rings = rings;
            if (this.rings) {
                if (!(typeof this.rings === 'object' && Array.isArray(this.rings))) this.rings = {};
                if (!this.rings.origin) this.rings.origin = new THREE.Vector3();
                if (!this.rings.normal) this.rings.normal = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                if (!this.rings.innerRadius) this.rings.innerRadius = 6378137.0 * (1.1 + Math.random());
                if (!this.rings.outerRadius) this.rings.outerRadius = this.rings.innerRadius + (0.1 + Math.random()) * 6378137.0;
                if (!this.rings.colorMap) this.rings.colorMap = Math.random();
                if (!this.rings.colorMapDisplace) this.rings.colorMapDisplace = Math.random();
            }
            this._disposePostMaterial();
            this._setupPostMaterial();
        }
    }
    /**
     * set space background
    * @param {Boolean|Object|THREE.Color} [space = true] if undefined, a default space backgound is drawn. Space can also be a single opaque color as a THREE.Color or a properties object
    * - param {Number} [space.starsIntensity=0.75] The intensity of stars
    * - param {Number} [space.gasCloudsIntensity=0.25] the intensity of nebula like gasClouds
    * - param {Number} [space.colorMap=Math.random()] a modulation on gas cloud colors
    * - param {Number} [space.texRotation1= Math.random()*Math.PI] a texture rotation to avoid obvious repetition.
    * - param {Number} [space.texRotation2 = Math.random()*Math.PI] a texture rotation to avoid obvious repetition.
    */
    setSpace(space) {

        if (this.space != space) {
            if (space && space.isColor) {
                this.space = false;
                this.scene.background = space;
            } else {
                this.space = space;
                if (this.space) {
                    if (!(typeof this.space === 'object' && Array.isArray(this.space))) this.space = {};
                    if (!this.space.starsIntensity) this.space.starsIntensity = 0.75;
                    if (!this.space.gasCloudsIntensity) this.space.gasCloudsIntensity = 0.5;//Math.random();
                    if (!this.space.colorMap) this.space.colorMap = Math.random();
                    if (!this.space.texRotation1) this.space.texRotation1 = Math.random() * Math.PI;
                    if (!this.space.texRotation2) this.space.texRotation2 = Math.random() * Math.PI;
                }
            }
            this._disposePostMaterial();
            this._setupPostMaterial();
        }
    }
    _disposePostMaterial() {
        if (this.postMaterial) {
            if (this.postMaterial.uniforms.opticalDepth.value) {
                this.postMaterial.uniforms.opticalDepth.value.dispose();
            }
            if (this.postMaterial.uniforms.ringsPalette.value) {
                this.postMaterial.uniforms.ringsPalette.value.dispose();
            }
            if (this.postMaterial.uniforms.water1.value) {
                this.postMaterial.uniforms.water1.value.dispose();
            }
            if (this.postMaterial.uniforms.water2.value) {
                this.postMaterial.uniforms.water2.value.dispose();
            }
            if (this.postMaterial.uniforms.perlin.value) {
                this.postMaterial.uniforms.perlin.value.dispose();
            }
            if (this.postMaterial.uniforms.starsTexture.value) {
                this.postMaterial.uniforms.starsTexture.value.dispose();
            }
            if (this.postMaterial.uniforms.nebulaTexture.value) {
                this.postMaterial.uniforms.nebulaTexture.value.dispose();
            }
            if (this.postMaterial.uniforms.nebulaPalette.value) {
                this.postMaterial.uniforms.nebulaPalette.value.dispose();
            }
            this.postMaterial.dispose();
            this.postMaterial = undefined;
        }

    }
    _setupPostMaterial() {

        // Setup post processing stage
        const self = this;

        this.postMaterial = new THREE.ShaderMaterial({
            vertexShader: PostShader.vertexShader(),
            fragmentShader: self.shadows ? PostShader.fragmentShaderShadows(self.atmosphere, self.ocean, self.sunColor, !!self.globalElevation, self.rings, self.space, true) : PostShader.fragmentShader(self.atmosphere, self.ocean, self.rings, self.space, true),
            uniforms: {
                cameraNear: { value: this.camera.near },
                cameraFar: { value: this.camera.far },
                tDiffuse: { value: null },
                tDepth: { value: null },
                radius: { value: 0 },
                mobile: { value: this.isMobile },
                xfov: { value: 0 },
                yfov: { value: 0 },
                planetPosition: { value: new THREE.Vector3(0, 0, 0) },
                nonPostCameraPosition: { value: new THREE.Vector3(0, 0, 0) },
                viewCenterFar: { value: new THREE.Vector3(0, 0, 0) },
                viewCenterNear: { value: new THREE.Vector3(0, 0, 0) },
                up: { value: new THREE.Vector3(0, 0, 0) },
                right: { value: new THREE.Vector3(0, 0, 0) },
                heightAboveSeaLevel: { value: 0 },
                opticalDepth: { value: null },
                perlin: { value: null },
                water1: { value: null },
                water2: { value: null },
                waterConfig: { value: new THREE.Vector4(0, halfCycle, halfCycle, waterScale) },
                ldf: { value: 0 },
                sunLocation: { value: new THREE.Vector3(0, 0, 0) },
                projMatrixInv: { value: new THREE.Matrix4() },
                viewMatrixInv: { value: new THREE.Matrix4() },
                ringsPalette: { value: null },
                starsTexture: { value: null },
                nebulaTexture: { value: null },
                nebulaPalette: { value: null },
                tClouds: { value: null },
                tCloudsDepth: { value: null },
                time: { value: 0.0 },
                atmosphereDensity: { value: this.atmosphereDensity }
            },
            depthTest: false,
            depthWrite: false
        });
        if (self.globalElevation) {
            self.postMaterial.uniforms.globalElevation = { type: "t", value: self.globalElevation };
        };


        loader.load(
            // resource URL
            opticalDepth,

            // onLoad callback
            function (texture) {
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.magFilter = THREE.LinearFilter;
                texture.minFilter = THREE.LinearFilter;
                self.postMaterial.uniforms.opticalDepth.value = texture;
            },
            undefined,
            function (err) {
                console.error('An error happened: ' + err);
            }
        );

        loader.load(
            // resource URL
            ringsPalette,

            // onLoad callback
            function (texture) {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.magFilter = THREE.LinearFilter;
                texture.minFilter = THREE.LinearFilter;
                self.postMaterial.uniforms.ringsPalette.value = texture;
            },
            undefined,
            function (err) {
                console.error('An error happened: ' + err);
            }
        );

        if (this.shadows && this.ocean) {
            loader.load(
                // resource URL
                water1,

                // onLoad callback
                function (texture) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.magFilter = THREE.LinearFilter;
                    texture.minFilter = THREE.LinearFilter;
                    self.postMaterial.uniforms.water1.value = texture;
                },
                undefined,
                function (err) {
                    console.error('An error happened: ' + err);
                }
            );
            loader.load(
                water2,
                function (texture) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.magFilter = THREE.LinearFilter;
                    texture.minFilter = THREE.LinearFilter;
                    self.postMaterial.uniforms.water2.value = texture;
                },
                undefined,
                function (err) {
                    console.error('An error happened: ' + err);
                }
            );

        }


        if (self.space) {
            loader.load(
                perlin,
                function (texture) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.magFilter = THREE.LinearFilter;
                    texture.minFilter = THREE.LinearFilter;
                    self.postMaterial.uniforms.perlin.value = texture;
                },
                undefined,
                function (err) {
                    console.error('An error happened: ' + err);
                }
            );
        }
        if (this.space) {

            loader.load(
                stars,
                function (texture) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.magFilter = THREE.LinearFilter;
                    texture.minFilter = THREE.LinearFilter;
                    self.postMaterial.uniforms.starsTexture.value = texture;
                },
                undefined,
                function (err) {
                    console.error('An error happened: ' + err);
                }
            );
            loader.load(
                nebula,
                function (texture) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.magFilter = THREE.LinearFilter;
                    texture.minFilter = THREE.LinearFilter;
                    self.postMaterial.uniforms.nebulaTexture.value = texture;
                },
                undefined,
                function (err) {
                    console.error('An error happened: ' + err);
                }
            );
            loader.load(
                nebulaPalette,
                function (texture) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.magFilter = THREE.LinearFilter;
                    texture.minFilter = THREE.LinearFilter;
                    self.postMaterial.uniforms.nebulaPalette.value = texture;
                },
                undefined,
                function (err) {
                    console.error('An error happened: ' + err);
                }
            );
        }



    }

    _setupFXAAMaterial() {
        this.fxaaMaterial = new THREE.ShaderMaterial({
            vertexShader: FXAA.vertexShader,
            fragmentShader: FXAA.fragmentShader,
            uniforms: FXAA.uniforms,
            depthTest: false,
            depthWrite: false
        });
    }

    _setupDepthPassMaterial() {
        this.depthPassMaterial = new THREE.ShaderMaterial({
            vertexShader: PostShader.vertexShader(),
            fragmentShader: PostShader.depthPassFragmentShader(),
            uniforms: {
                cameraNear: { value: this.camera.near },
                cameraFar: { value: this.camera.far },
                tDepth: { value: null },
                ldf: { value: 0 },
            }
        });

    }

    _setupVideoPassMaterial() {
        this.videoPassMaterial = new THREE.ShaderMaterial({
            vertexShader: VideoPostShader.vertexShader(),
            fragmentShader: VideoPostShader.fragmentShader(),
            uniforms: {
                tColor: { value: null },
                tWorld: { value: null },
                tVideoColor: { value: null },
                tVideoWorld: { value: null },
                videoProjectionMatrix: { value: new THREE.Matrix4() },
                videoViewMatrix: { value: new THREE.Matrix4() },
                depthTest: { value: true },
                chromaKeying: { value: false },
                chromaKey: { value: null },
                chromaKeyTolerance: { value: 0.2 }
            },
            depthTest: false,
            depthWrite: false,
            precision: "highp"
        });

    }

    _initRenderer() {
        let self = this;
        self.renderer = new THREE.WebGLRenderer({ antialias: false, maxSamples: 1, logarithmicDepthBuffer: true, stencil: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
        //self.renderer.getContext().getProgramInfoLog= function() { return '' }
        //self.renderer.debug.checkShaderErrors = false;
        if (self.isMobile) {
            self.renderer.shadowMap.type = THREE.PCFShadowMap;
        } else {
            self.renderer.shadowMap.type = THREE.PCFShadowMap;
        }

        self.renderer.setPixelRatio(1)
        self.renderer.setSize(this.domContainer.offsetWidth, this.domContainer.offsetHeight);

        self.renderer.outputColorSpace = THREE.SRGBColorSpace;
        self.renderer.autoClear = false;
        THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
            'vec3 CustomToneMapping( vec3 color ) { return color; }',
            `#define Uncharted2Helper( x ) max( ( ( x * ( 0.15 * x + 0.10 * 0.50 ) + 0.20 * 0.02 ) / ( x * ( 0.15 * x + 0.50 ) + 0.20 * 0.30 ) ) - 0.02 / 0.30, vec3( 0.0 ) )
            float toneMappingWhitePoint = 1.0;
            vec3 CustomToneMapping( vec3 color ) {
                color *= toneMappingExposure;
                return saturate( Uncharted2Helper( color ) / Uncharted2Helper( vec3( toneMappingWhitePoint ) ) );
            }`
        );
        self.renderer.toneMapping = THREE.CustomToneMapping;
        self.renderer.toneMappingExposure = 0.2;
        self.renderer.domElement.style.overflow = "hidden";
        self.domContainer.appendChild(self.renderer.domElement);

        window.addEventListener('resize', onWindowResize);
        function onWindowResize() {

            const aspect = self.domContainer.offsetWidth / self.domContainer.offsetHeight;
            self.camera.aspect = aspect;
            self.camera.updateProjectionMatrix();


            self.target.setSize(self.domContainer.offsetWidth, self.domContainer.offsetHeight);
            self.depthTarget.setSize(self.domContainer.offsetWidth, self.domContainer.offsetHeight);
            self.target2.setSize(self.domContainer.offsetWidth, self.domContainer.offsetHeight);
            if (self.cloudsLayer) {
                self.cloudsLayer.changeSize(self.domContainer);

            }

            self.renderer.setSize(self.domContainer.offsetWidth, self.domContainer.offsetHeight);
            self.labelRenderer.setSize(self.domContainer.offsetWidth, self.domContainer.offsetHeight);
        }
        setTimeout(onWindowResize, 1000);

        if (self.debug) {
            const gl = self.renderer.getContext(); // Get the underlying WebGL context

            // WebGL provides a few parameters that can help us infer depth precision
            // Although not directly specifying the depth buffer precision, these can offer some insights
            const depthBits = gl.getParameter(gl.DEPTH_BITS);
            console.log(`Depth Bits: ${depthBits}`);

            // Additionally, you can check for the presence of certain WebGL extensions
            const depthTextureExtension = gl.getExtension('WEBGL_depth_texture');
            if (depthTextureExtension) {
                console.log('Depth texture extension supported.');
            } else {
                console.log('Depth texture extension not supported.');
            }
        }

    }

    _initLabelRenderer() {
        this.labelRenderer = new CSS3DRenderer();
        this.labelRenderer.setSize(this.domContainer.offsetWidth, this.domContainer.offsetHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        document.body.appendChild(this.labelRenderer.domElement);
    }

    _initStats() {
        this.stats = new Stats();
        this.domContainer.appendChild(this.stats.dom);
    }


    _initCamera() {
        const camera = new THREE.PerspectiveCamera(40, this.domContainer.offsetWidth / this.domContainer.offsetHeight, 0.01, 50000000);
        camera.position.set(40000000, 0, 0);
        camera.up.set(0, 0, 1)
        camera.lookAt(new THREE.Vector3(-0, 0, 10000));
        camera.updateProjectionMatrix();

        return camera;
    }



    _initPlanet() {

        this.planet = new Planet({
            camera: this.renderCamera,
            center: new THREE.Vector3(0, 0, 0),
            shadows: this.csm,
            layerManager: this.layerManager,
            renderer: this.renderer,
            detailMultiplier: this.detailMultiplier,
            tileSize: this.tileSize,
            tileImagerySize: this.tileImagerySize,
            loadOutsideView: this.loadOutsideView
        });
        this.resetCameraNearFar();
    }


    _initController() {
        const self = this;
        self.controller = new Controller(self.camera, self.domContainer, self);
        //self.controller.append(new SelectController(self.camera, self.domContainer, self));
        self.controller.append(new PanController(self.camera, self.domContainer, self));
        self.controller.append(new RotateController(self.camera, self.domContainer, self));
        self.controller.append(new ZoomController(self.camera, self.domContainer, self));
        self.controller.append(new SelectController(self.camera, self.domContainer, self));

        self.domContainer.addEventListener('mousedown', (e) => {
            if (!!self.controller && !self.pause) self.controller.event('mousedown', e);
        }, false);
        self.domContainer.addEventListener('mouseup', (e) => {
            if (!!self.controller && !self.pause) self.controller.event('mouseup', e);
        }, false);
        self.domContainer.addEventListener('mousemove', (e) => {
            if (!!self.controller && !self.pause) self.controller.event('mousemove', e);
        }, false);
        self.domContainer.addEventListener('wheel', (e) => {
            if (!!self.controller && !self.pause) self.controller.event('mousewheel', e);
        }, false);
        self.domContainer.addEventListener('touchstart', (e) => {
            if (!!self.controller && !self.pause) self.controller.event('touchstart', e);
        }, false);
        self.domContainer.addEventListener('touchmove', (e) => {
            if (!!self.controller && !self.pause) self.controller.event('touchmove', e);
        }, false);
        self.domContainer.addEventListener('touchcancel', (e) => {
            if (!!self.controller && !self.pause) self.controller.event('touchcancel', e);
        }, false);
        self.domContainer.addEventListener('touchend', (e) => {
            if (!!self.controller && !self.pause) self.controller.event('touchend', e);
        }, false);
        document.addEventListener('keydown', (e) => {
            if (!!self.controller && !self.pause) self.controller.event('keydown', e);
        }, false);
        document.addEventListener('keyup', (e) => {
            if (!!self.controller && !self.pause) self.controller.event('keyup', e);
        }, false);

        document.addEventListener("mouseleave", function (event) {

            if (event.clientY <= 0 || event.clientX <= 0 || (event.clientX >= self.domContainer.offsetWidth || event.clientY >= self.domContainer.offsetHeight)) {

                self.controller.event('mouseup', { which: "all" });

            }
        });

    }

    /**
     * Pauses the rendering of all the layers.
     */
    pauseRendering() {
        this.pause = true;
        this.planet._pauseRendering();
        this.layerManager._pauseRendering();
    }
    /**
     * Resumes the rendering of all the layers
     */
    resumeRendering() {
        this.pause = false;
        this.planet._resumeRendering();
        this.layerManager._resumeRendering();
    }

    _startAnimation() {
        var self = this;





        let lastTime = performance.now();
        function animate() {
            requestAnimationFrame(animate);
            //console.log("up : " +self.camera.up.x+" "+self.camera.up.y+" "+self.camera.up.z)
            //console.log(new THREE.Vector3(0,1,0).applyQuaternion(self.camera.quaternion).normalize())
            const delta = performance.now() - lastTime;

            //console.log(delta);
            self.planet.update();

            if (delta < 1000 / self.targetFPS) {
                return;
            }
            lastTime = performance.now();




            if (!self.pause) {
                self.controller.update();
                const cameraOffset = self.renderCamera.position.length();
                if (cameraOffset > 1000) {
                    self.scene.position.set(-self.camera.position.x, -self.camera.position.y, -self.camera.position.z);
                    self.scene.updateMatrix();
                    self.scene.updateMatrixWorld(true);
                    self.splatsScene.position.set(-self.camera.position.x, -self.camera.position.y, -self.camera.position.z);
                    self.splatsScene.updateMatrix();
                    self.splatsScene.updateMatrixWorld(true);
                    self.layerManager.getLayers().forEach((layer) => {

                        if (layer.isOGC3DTilesLayer) {
                            layer._updateMatrices();
                        }
                        if (layer.isObjectLayer) {
                            layer._updateMatrices();
                        }
                    });
                    self.planet._setOffset(self.scene.position);
                }

                self.renderCamera.copy(self.camera, true);
                self.renderCamera.position.add(self.scene.position)
                self.renderCamera.updateMatrix();
                self.renderCamera.updateMatrixWorld(true);
                self.renderCamera.updateProjectionMatrix();
                if (self.shadows) {
                    self.csm.update(self.renderCamera.matrix);

                }

                let hasVideo = false;
                let hasSplats = false;
                self.layerManager.getLayers().forEach(layer => {
                    if (layer.isOGC3DTilesLayer) {

                        layer.update(self.renderCamera);
                        if (layer.isSplats && layer.visible) {
                            hasSplats = true;
                        }
                    }
                    if (layer.isTracksLayer) {
                        layer.update(clock);
                    }
                    if (layer.isProjectedLayer && layer.visible && layer.isReady()) {
                        hasVideo = true;
                    }
                })
                //self.controller.update();
                //frustum.setFromProjectionMatrix(mat.multiplyMatrices(self.camera.projectionMatrix, self.camera.matrixWorldInverse));


                //self.camera.updateMatrixWorld();

                /// render
                self.renderer.setRenderTarget(self.target);
                self.renderer.render(self.scene, self.renderCamera);

                let renderDepth = self.target.depthTexture;
                let renderTexture = self.target.texture;

                /// render splats
                if (hasSplats) {
                    self.renderer.setRenderTarget(self.targetSplats);
                    self.renderer.setClearColor(splatsClearColor, 0.0);
                    self.renderer.clearColor();
                    self.renderer.render(self.splatsScene, self.renderCamera);
                    self.layerManager.getLayers().forEach(layer => {
                        if (layer.isOGC3DTilesLayer) {
                            if (layer.isSplats) {
                                layer.setDepthMaterial(self.renderCamera);
                            }
                        }
                    });

                    self.renderer.setRenderTarget(self.targetSplatsDepth);
                    self.renderer.getClearColor(tempClearColor);
                    const tempAlpha = self.renderer.getClearAlpha();
                    self.renderer.setClearColor(splatsClearColor, 1.0);
                    self.renderer.clearColor();
                    self.renderer.render(self.splatsScene, self.renderCamera);
                    self.renderer.setClearColor(tempClearColor, tempAlpha);

                    self.layerManager.getLayers().forEach(layer => {
                        if (layer.isOGC3DTilesLayer) {
                            if (layer.isSplats) {
                                layer.setRenderMaterial();
                            }
                        }
                    });
                    /// compose depth


                    self.splatsComposeMaterial.uniforms.splatsTexture.value = self.targetSplats.texture;
                    self.splatsComposeMaterial.uniforms.otherTexture.value = renderTexture;
                    self.splatsComposeMaterial.uniforms.splatsDepthTexture.value = self.targetSplatsDepth.texture;
                    self.splatsComposeMaterial.uniforms.otherDepthTexture.value = renderDepth;
                    self.splatsComposeMaterial.uniforms.splatsOver.value = self.splatsOver;

                    self.renderer.setRenderTarget(self.targetSplatsCompose);

                    self.renderer.clearColor();
                    self.postQuad.material = self.splatsComposeMaterial;
                    self.renderer.render(self.postScene, self.postCamera);


                    //renderTexture = self.targetSplatsDepth.texture;
                    //renderDepth = self.targetSplatsDepth.texture;
                    renderTexture = self.targetSplatsCompose.textures[0];//self.targetSplatsCompose.textures[0];

                    renderDepth = self.targetSplatsCompose.textures[1];
                    //renderTexture = self.targetSplatsDepth.texture;
                }


                /// depth
                self.depthPassMaterial.uniforms.tDepth.value = renderDepth;
                self.depthPassMaterial.uniforms.cameraNear.value = self.camera.near;
                self.depthPassMaterial.uniforms.cameraFar.value = self.camera.far;
                self.depthPassMaterial.uniforms.ldf.value = self.logDepthBufFC;

                self.renderer.setRenderTarget(self.depthTarget);
                self.postQuad.material = self.depthPassMaterial;
                self.renderer.render(self.postScene, self.postCamera);

                // compute values for post
                self.postMaterial.uniforms.cameraNear.value = self.camera.near;
                self.postMaterial.uniforms.cameraFar.value = self.camera.far;
                self.postMaterial.uniforms.xfov.value = 2 * Math.atan(Math.tan(self.camera.fov * Math.PI / 180 / 2) * self.camera.aspect) * 180 / Math.PI;
                self.postMaterial.uniforms.yfov.value = self.camera.fov;
                self.postMaterial.uniforms.nonPostCameraPosition.value = self.camera.position;
                self.postMaterial.uniforms.ldf.value = self.logDepthBufFC;

                self.camera.getWorldDirection(self.postMaterial.uniforms.viewCenterFar.value).normalize();
                self.postMaterial.uniforms.viewCenterNear.value.copy(self.postMaterial.uniforms.viewCenterFar.value);
                self.postMaterial.uniforms.up.value = self.camera.up.normalize();
                self.postMaterial.uniforms.right.value.crossVectors(self.camera.up, self.postMaterial.uniforms.viewCenterFar.value);
                self.postMaterial.uniforms.viewCenterFar.value.multiplyScalar(self.camera.far).add(self.camera.position);
                self.postMaterial.uniforms.viewCenterNear.value.multiplyScalar(self.camera.near).add(self.camera.position);



                /// video


                //self.camera.updateProjectionMatrix()

                if (hasVideo) {

                    let t1 = self.target;
                    let t2 = self.target2;

                    let videoLayerCount = 0;

                    self.renderer.setRenderTarget(self.targetWorld);
                    //self.renderer.clearDepth();
                    self.scene.overrideMaterial = self.positionBufferMaterial;
                    self.renderer.render(self.scene, self.renderCamera);


                    // copy main camera params to video post shader



                    self.layerManager.getLayers().forEach(layer => {
                        if (layer.isProjectedLayer && layer.visible && layer.isReady()) {
                            if (true) {
                                layer.projectionRenderCamera.copy(layer.projectionCamera, true);
                                layer.projectionRenderCamera.position.add(self.scene.position);
                                layer.projectionRenderCamera.updateMatrix();
                                layer.projectionRenderCamera.updateMatrixWorld(true);
                                layer.projectionRenderCamera.updateProjectionMatrix();
                                self.renderer.setRenderTarget(layer.renderTarget);
                                //self.renderer.setClearColor(0xff0000, 1); // Set a clear color
                                //self.renderer.clear(true, true, true);
                                self.renderer.render(self.scene, layer.projectionRenderCamera);

                                self.videoPassMaterial.uniforms.tColor.value = videoLayerCount == 0 ? renderTexture : t1.texture;
                                videoLayerCount++;
                                self.videoPassMaterial.uniforms.tWorld.value = self.targetWorld.texture;
                                self.videoPassMaterial.uniforms.tVideoColor.value = layer.texture;
                                self.videoPassMaterial.uniforms.tVideoWorld.value = layer.renderTarget.texture;
                                self.videoPassMaterial.uniforms.depthTest.value = layer.depthTest;
                                self.videoPassMaterial.uniforms.chromaKeying.value = layer.chromaKeying;
                                self.videoPassMaterial.uniforms.chromaKey.value = layer.chromaKey;
                                self.videoPassMaterial.uniforms.chromaKeyTolerance.value = layer.chromaKeyTolerance;

                                self.videoPassMaterial.uniforms.videoProjectionMatrix.value.copy(layer.projectionRenderCamera.projectionMatrix);
                                self.videoPassMaterial.uniforms.videoViewMatrix.value.copy(layer.projectionRenderCamera.matrixWorldInverse);








                                self.postQuad.material = self.videoPassMaterial;

                                self.renderer.setRenderTarget(t2);
                                //self.renderer.clear(true, true, true);
                                self.renderer.render(self.postScene, self.postCamera);

                                let temp = t2;
                                t2 = t1;
                                t1 = temp;
                            }

                        }
                    })

                    if (videoLayerCount > 0) {
                        renderTexture = t1.texture;
                    }
                    self.scene.overrideMaterial = null;
                }





                /// clouds
                if (self.cloudsLayer) {
                    self.cloudsLayer.updateUniforms(self);
                    self.cloudsLayer.render(self);
                    self.postMaterial.uniforms.tClouds.value = self.cloudsLayer.getOutputTexture();
                    self.postMaterial.uniforms.tCloudsDepth.value = self.cloudsLayer.getOutputDepthTexture();
                } else {
                    self.postMaterial.uniforms.tClouds.value = undefined;
                    self.postMaterial.uniforms.tCloudsDepth.value = undefined;
                }

                /// post final
                self.postMaterial.uniforms.tDiffuse.value = renderTexture;
                self.postMaterial.uniforms.tDepth.value = renderDepth;
                self.postMaterial.uniforms.radius.value = self.planet.radius;

                self.postMaterial.uniforms.planetPosition.value = self.planet.position;


                self.postMaterial.uniforms.projMatrixInv.value.copy(self.camera.projectionMatrixInverse);

                self.postMaterial.uniforms.viewMatrixInv.value.copy(self.camera.matrixWorld);
                if (self.shadows) {
                    self.postMaterial.uniforms.sunLocation.value.copy(self.sunPosition);
                }



                self.postMaterial.uniforms.heightAboveSeaLevel.value = self.camera.position.length() - self.planet.radius;

                //water
                self._updateFlow();
                self.postMaterial.uniforms.time.value = clock.elapsedTime;



                self.renderer.setRenderTarget(self.target);
                self.postQuad.material = self.postMaterial;
                self.renderer.render(self.postScene, self.postCamera);

                self.fxaaMaterial.uniforms.tDiffuse.value = self.target.texture;
                self.fxaaMaterial.uniforms.resolution.value = new THREE.Vector2(1 / self.target.width, 1 / self.target.height);
                self.postQuad.material = self.fxaaMaterial;
                self.renderer.setRenderTarget(null);
                self.renderer.render(self.postScene, self.postCamera);

                self.labelRenderer.render(self.scene, self.camera);


            }

            if (self.stats) {
                self.stats.update();
            }

        }
        animate();
    }

    /**
     * When moving the map.camera manually, you may want to call this method to correctly set the camera near and far to limit z-fighting artefacts.
     */
    resetCameraNearFar() {

        A.copy(this.camera.position);
        cartesianToLlhFastSFCT(A);
        const heightAboveEllipsoid = A.z;

        this.camera.near = 0.001;
        const distanceToHorizon = Math.sqrt(2 * this.planet.radius * Math.abs(heightAboveEllipsoid) + heightAboveEllipsoid * heightAboveEllipsoid); // estimation
        this.camera.far = Math.max(200000, distanceToHorizon * 2.0);
        //console.log(distanceToHorizon)
        this.camera.updateProjectionMatrix();
        this._resetLogDepthBuffer();

        if (this.csm) {
            this.csm.maxFar = Math.min(500000, this.camera.far);
            for (let i = 0; i < this.csm.lights.length; i++) {
                this.csm.lights[i].shadow.bias = 0.00025 * this.csm.csmSplits[i];
                this.csm.lights[i].shadow.normalBias = 0.1;
                this.csm.lights[i].shadow.camera.near = 1;
                this.csm.lights[i].shadow.camera.updateProjectionMatrix();
                this.csm.lights[i].shadow.camera.far = this.csm.lightMargin + this.csm.maxFar * 2 * this.csm.csmSplits[i];
                this.csm.lights[i].shadow.needsUpdate = true;
            }

            this.csm.updateFrustums()
        }

    }

    _resetLogDepthBuffer() {
        this.logDepthBufFC = 2.0 / (Math.log(this.camera.far + 1.0) / Math.LN2);

    }

    /**
     * Moves the camera above the ground.
     */
    moveCameraAboveSurface(camera = this.camera) {
        let min = this.minHeightAboveGround;
        let geodeticCameraPosition = this.planet.llhToCartesian.inverse(camera.position);
        B.set(geodeticCameraPosition.x * degreeToRadians, geodeticCameraPosition.y * degreeToRadians);


        this.distToGround = geodeticCameraPosition.z - this.planet.getTerrainElevation(B);
        if (min === false) {
            return;
        }
        if (min === true) min = 5;
        try {

            if (this.distToGround < this.minHeightAboveGround) {
                geodeticCameraPosition.z += (this.minHeightAboveGround - this.distToGround);
                geodeticCameraPosition = this.planet.llhToCartesian.forward(geodeticCameraPosition);
                camera.position.set(geodeticCameraPosition.x, geodeticCameraPosition.y, geodeticCameraPosition.z);
            }
        } catch (e) { }




    }

    /**
     * reset the camera up so that the camera roll alligns with the horizon
     */
    setCameraUp(camera = this.camera) {
        camera.getWorldDirection(A).normalize();
        B.crossVectors(camera.position, A);
        camera.up.crossVectors(A, B).normalize();

    }

    /**
     * Moves the camera to a location in lon lat height and looks at another location in lon lat height.
     * 
     * @param {Object} cameraPosition an object representing the camera desired location in lon lat height (according to WGS84 coordinates)
     * @param {Number} cameraPosition.x longitude
     * @param {Number} cameraPosition.y latitude
     * @param {Number} cameraPosition.z height
     * @param {Object} cameraAim an object representing the camera desired target in lon lat height (according to WGS84 coordinates)
     * @param {Number} cameraAim.x longitude
     * @param {Number} cameraAim.y latitude
     * @param {Number} cameraAim.z height
     * @param {Object} [ease = undefined] ease function params
     *   - [ease.time = 2000] ease total time in ms
     *   - [ease.function = undefined] defaults to a quadratic ease-in-out function. specify your own function that accepts a number between 0 and 1 and returns a number between 0 and 1.
     *   - [ease.callback = undefined] callback called with no parameter when the camera movement is finished.
     */
    moveAndLookAt(cameraPosition, cameraAim, ease = undefined) {
        const self = this;
        if (!ease) {
            self.camera.position.copy(self.planet.llhToCartesian.forward(cameraPosition));
            const target = self.planet.llhToCartesian.forward(cameraAim);
            self.camera.up.copy(self.camera.position).normalize()
            self.camera.lookAt(target.x, target.y, target.z);
            self.moveCameraAboveSurface();
            self.resetCameraNearFar();
            self.setCameraUp();
        }
        else {
            // first infer yaw pitch roll and camera lon lat height
            const targetCamera = self.camera.clone();
            targetCamera.position.copy(self.planet.llhToCartesian.forward(cameraPosition));
            const target = self.planet.llhToCartesian.forward(cameraAim);
            targetCamera.up.copy(targetCamera.position).normalize()
            targetCamera.lookAt(target.x, target.y, target.z);
            self.moveCameraAboveSurface(targetCamera);
            self.setCameraUp(targetCamera);

            cameraEase(self.camera, getCameraLLHYawPitchRoll(self.camera), getCameraLLHYawPitchRoll(targetCamera), ease.time, ease.function, (aCamera) => {
                self.moveCameraAboveSurface();
                self.resetCameraNearFar();
                self.setCameraUp();
            }, ease.callback);
        }

    }


    /**
     * Get the hit location of a ray going from the camera through a pixel on screen or undefined if the ray does not hit anything.
     * @param {Number} x a screen pixel x coordinate
     * @param {Number} y a screen pixel y coordinate
     * @param {THREE.Vector3} sideEffect a THREE.Vector3 that will be moved to the ray hit location
     * @returns {THREE.Vector3} the sideEffect object.
     */
    screenPixelRayCast(x, y, sideEffect) {
        this.renderer.readRenderTargetPixels(this.depthTarget, x - this.domContainer.offsetLeft, (this.domContainer.offsetHeight - (y - this.domContainer.offsetTop)), 1, 1, depths);

        depth24.set(depths[0], depths[1], depths[2]);
        let z = depth24.dot(unpacker);
        z = (z * 0.00390630960555428397039749752041);
        if (z <= 0 || z >= 1) {
            sideEffect.copy(this.camera.position);
            return;
        }
        z = -(Math.pow(2, z * Math.log2(this.camera.far + 1.0)) - 1.0);
        z = this._viewZToPerspectiveDepth(z, this.camera.near, this.camera.far);
        z = z * 2 - 1;

        x = ((x - this.domContainer.offsetLeft) / this.domContainer.offsetWidth) * 2 - 1;
        y = (1 - ((y - this.domContainer.offsetTop) / this.domContainer.offsetHeight)) * 2 - 1;

        sideEffect.set(x, y, z).unproject(this.camera);
        return sideEffect;

    }

    /**
     * raycast only on terrain
     * @param {THREE.Raycaster} mapRaycaster 
     * @returns {THREE.Vector3} the nearest point along the raycaster ray in lon lat height
     */
    raycastTerrain(raycaster) {
        let revert = false;
        if (!raycaster.layers.isEnabled(0)) {
            raycaster.layers.enable(0);
            revert = true;
        }
        const visibleTiles = [];
        this.planet.traverse(o => {
            if (o.isPlanetTile) {
                visibleTiles.push(o);
            }
        });
        const r = raycaster.intersectObjects(visibleTiles, false);
        if (r.length > 0) {
            r[0].point.sub(this.scene.position);
            cartesianToLlhFastSFCT(r[0].point)
            return r[0].point;
        }

    }

    _viewZToPerspectiveDepth(viewZ, near, far) {
        return ((near + viewZ) * far) / ((far - near) * viewZ);
    }

    /**
     * Transforms a lon lat height point (degrees) to cartesian coordinates (EPSG:4978).
     * The transform is slightly inaccurate compared to proj4 but it's 3 times faster
     * @param {THREE.Vector3} llh
     */
    llhToCartesianFastSFCT(llh) {
        llhToCartesianFastSFCT(llh);
    }

    /**
     * Transforms a xyz point (degrees) to llh coordinates (EPSG:4326).
     * The transform is slightly inaccurate compared to proj4 but it's 2.5 times faster
     * @param {THREE.Vector3} llh
     */
    cartesianToLlhFastSFCT(xyz) {
        cartesianToLlhFastSFCT(xyz);
    }

    /**
     * Set an elevation exageration factor
     * @param {Number} elevationExageration 
     */
    setElevationExageration(elevationExageration) {
        this.elevationExageration = elevationExageration;
        this.planet.setElevationExageration(this.elevationExageration);
    }
    addSelectionListener(calback) {
        if (!this.selectionListeners) this.selectionListeners = [];
        this.selectionListeners.push(calback);
    }
    removeSelectionListener(callback) {
        if (this.selectionListeners) this.selectionListeners.filter(f => f !== callback);
    }
    /**
     * select action at a particular location on this map (normalized between -1 and 1)
     * @param {THREE.Vector2} screenLocation 
     * @param {Number} type 0(Add), 1(Remove) or 2(Replace)
     */
    select(screenLocation, type) {

        this.raycaster.setFromCamera(screenLocation, this.renderCamera);
        const selectedObjects = [];
        const layers = this.layerManager.getLayers();
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            if (layer) {
                const selection = layer.raycast(this.raycaster);
                if (selection != undefined) selectedObjects.push(...selection);

            }
        }

        const uniqueSelectedObjects = [];
        const seenUuids = new Set();

        selectedObjects.forEach(obj => {
            if (!seenUuids.has(obj.uuid)) {
                uniqueSelectedObjects.push(obj);
                seenUuids.add(obj.uuid);
            }
        });

        const selected = [];
        const unselected = [];
        if (type == 0) {
            uniqueSelectedObjects.forEach(object => {
                if (!this.selection[object.layer.id]) {
                    this.selection[object.layer.id] = [];
                }

                if (!this.selection[object.layer.id].some(obj => obj.uuid === object.uuid)) {
                    this.selection[object.layer.id].push(object);
                    selected.push(object);
                }
            });
        } else if (type == 1) {
            uniqueSelectedObjects.forEach(object => {
                if (this.selection[object.layer.id] && this.selection[object.layer.id].some(obj => obj.uuid === object.uuid)) {
                    this.selection[object.layer.id] = this.selection[object.layer.id].filter(o => o.uuid !== object.uuid);
                    if (!this.selection[object.layer.id].length) delete this.selection[object.layer.id];
                    unselected.push(object);
                }
            });
        } else if (type == 2) {
            // unselect everything
            for (const key in this.selection) {
                while (this.selection[key].length) unselected.push(this.selection[key].shift());
            }
            this.selection = {};
            // select first object
            if (uniqueSelectedObjects.length > 0) {
                const object = uniqueSelectedObjects[0];
                if (!this.selection[object.layer.id]) {
                    this.selection[object.layer.id] = [];
                }

                if (!unselected.some(obj => obj.uuid === object.uuid)) {
                    this.selection[object.layer.id].push(object);
                    selected.push(object);
                    unselected.filter(o => o !== object);
                }
            }
        }

        const selections = {
            selection: this.selection,
            selected: selected,
            unselected: unselected,
        }
        if (this.selectionListeners) this.selectionListeners.forEach(callback => callback(selections))
        return selections;
    }

    _createCloudsDebugPanel() {
        const self = this;
        // Create panel element
        const panel = document.createElement('div');
        panel.style.position = 'fixed';
        panel.style.top = '0';
        panel.style.right = '0';
        panel.style.backgroundColor = '#f0f0f0';
        panel.style.padding = '10px';
        panel.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
        panel.style.maxWidth = '300px';

        // Define labels and ranges
        const elements = [
            { label: 'density', min: 0, max: 10, value: self.clouds.density, step: 0.1, action: (val) => { self.clouds.density = val; } },
            { label: 'sun strength', min: 0, max: 10, value: self.clouds.luminance, step: 0.01, action: (val) => { self.clouds.luminance = val; } },
            { label: 'coverage', min: 0, max: 1, value: self.clouds.coverage, step: 0.01, action: (val) => { self.clouds.coverage = val; } },
            { label: 'r', min: 0, max: 1, value: self.clouds.color.x, step: 0.01, action: (val) => { self.clouds.color.x = val; } },
            { label: 'g', min: 0, max: 1, value: self.clouds.color.y, step: 0.01, action: (val) => { self.clouds.color.y = val; } },
            { label: 'b', min: 0, max: 1, value: self.clouds.color.z, step: 0.01, action: (val) => { self.clouds.color.z = val; } },
            { label: 'wind speed', min: 0, max: 1, value: self.clouds.windSpeed, step: 0.01, action: (val) => { self.clouds.windSpeed = val; } }

        ];


        elements.forEach(element => {
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'space-between';
            container.style.marginBottom = '10px';

            const label = document.createElement('label');
            label.textContent = element.label;
            label.style.marginRight = '10px';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = element.min;
            slider.max = element.max;
            slider.step = element.step;
            slider.value = element.value;

            const valueDisplay = document.createElement('span');
            valueDisplay.style.minWidth = '50px';
            valueDisplay.style.textAlign = 'right';
            valueDisplay.textContent = slider.value.toString();

            slider.oninput = () => {
                valueDisplay.textContent = slider.value.toString();
                element.action(slider.value);
            };

            container.appendChild(label);
            container.appendChild(slider);
            container.appendChild(valueDisplay);
            panel.appendChild(container);
        });

        //// Clouds min max height
        const lowClouds = document.createElement('div');
        lowClouds.style.display = 'flex';
        lowClouds.style.alignItems = 'center';
        lowClouds.style.justifyContent = 'space-between';
        lowClouds.style.marginBottom = '10px';

        const lowCloudsLabel = document.createElement('label');
        lowCloudsLabel.textContent = "clouds Radius Start";
        lowCloudsLabel.style.marginRight = '10px';

        const lowCloudsSlider = document.createElement('input');
        lowCloudsSlider.type = 'range';
        lowCloudsSlider.min = 1.0;
        lowCloudsSlider.max = 1.1;
        lowCloudsSlider.step = 0.001;
        lowCloudsSlider.value = self.clouds.startRadius;

        const lowCloudsValueDisplay = document.createElement('span');
        lowCloudsValueDisplay.style.minWidth = '50px';
        lowCloudsValueDisplay.style.textAlign = 'right';
        lowCloudsValueDisplay.textContent = lowCloudsSlider.value.toString();

        lowClouds.appendChild(lowCloudsLabel);
        lowClouds.appendChild(lowCloudsSlider);
        lowClouds.appendChild(lowCloudsValueDisplay);
        panel.appendChild(lowClouds);

        const highClouds = document.createElement('div');
        highClouds.style.display = 'flex';
        highClouds.style.alignItems = 'center';
        highClouds.style.justifyContent = 'space-between';
        highClouds.style.marginBottom = '10px';

        const highCloudsLabel = document.createElement('label');
        highCloudsLabel.textContent = "clouds Radius End";
        highCloudsLabel.style.marginRight = '10px';

        const highCloudsSlider = document.createElement('input');
        highCloudsSlider.type = 'range';
        highCloudsSlider.min = 1.0;
        highCloudsSlider.max = 1.1;
        highCloudsSlider.step = 0.001;
        highCloudsSlider.value = self.clouds.endRadius;

        const highCloudsValueDisplay = document.createElement('span');
        highCloudsValueDisplay.style.minWidth = '50px';
        highCloudsValueDisplay.style.textAlign = 'right';
        highCloudsValueDisplay.textContent = highCloudsSlider.value.toString();

        highClouds.appendChild(highCloudsLabel);
        highClouds.appendChild(highCloudsSlider);
        highClouds.appendChild(highCloudsValueDisplay);
        panel.appendChild(highClouds);

        lowCloudsSlider.oninput = () => {
            lowCloudsValueDisplay.textContent = lowCloudsSlider.value.toString();
            this.clouds.startRadius = lowCloudsSlider.value;
            this.clouds.endRadius = Math.max(this.clouds.endRadius, lowCloudsSlider.value);
            highCloudsSlider.value = this.clouds.endRadius;
            highCloudsValueDisplay.textContent = highCloudsSlider.value.toString();
        };
        highCloudsSlider.oninput = () => {
            highCloudsValueDisplay.textContent = highCloudsSlider.value.toString();
            this.clouds.endRadius = highCloudsSlider.value;
            this.clouds.startRadius = Math.min(this.clouds.startRadius, highCloudsSlider.value);
            lowCloudsSlider.value = this.clouds.startRadius;
            lowCloudsValueDisplay.textContent = lowCloudsSlider.value.toString();
        };



        document.body.appendChild(panel);

    }

    _splatsDepthComposeVertexShader() {
        return `
    
    precision highp float;
    
        out vec2 vUv;
        
    
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    
        }`
    };

    _splatsDepthComposeFragmentShader() {
        return `
    precision highp float;
    precision highp sampler2D;

    #include <packing>
    
    layout(location = 0) out vec4 color;
    layout(location = 1) out vec4 depth;

    uniform sampler2D splatsTexture;
    uniform sampler2D otherTexture;
    uniform sampler2D splatsDepthTexture;
    uniform sampler2D otherDepthTexture;
    uniform bool splatsOver;
    in vec2 vUv;
    
    

    void main() {
        float baseDepth = texture(otherDepthTexture, vUv).x;
        float splatsDepth = texture(splatsDepthTexture, vUv).x;
        //splatsDepth = mix(splatsDepth, 1.0, step(0.95, splatsDepth));

        vec4 splatsColor = texture(splatsTexture, vUv);
        vec4 baseColor = texture(otherTexture, vUv);
        
        if((splatsOver && splatsDepth<1.0) || splatsDepth<baseDepth){
            float alpha = splatsColor.w + baseColor.w * (1.0-splatsColor.w );
            float red = (splatsColor.r*splatsColor.w + baseColor.r*baseColor.w*(1.0-splatsColor.w))/alpha;
            float green = (splatsColor.g*splatsColor.w + baseColor.g*baseColor.w*(1.0-splatsColor.w))/alpha;
            float blue = (splatsColor.b*splatsColor.w + baseColor.b*baseColor.w*(1.0-splatsColor.w))/alpha;
            color = vec4(red, green, blue, alpha);
            depth = vec4((splatsDepth*splatsColor.w + baseDepth*baseColor.w*(1.0-splatsColor.w))/alpha);
            if(splatsColor.w<0.8){
                depth = vec4(baseDepth);
            }else{
                depth = vec4((splatsDepth*splatsColor.w + baseDepth*baseColor.w*(1.0-splatsColor.w))/alpha);
            }
        }else {
            float alpha = baseColor.w + splatsColor.w * (1.0-baseColor.w );
            float red = (baseColor.r*baseColor.w + splatsColor.r*splatsColor.w*(1.0-baseColor.w))/alpha;
            float green = (baseColor.g*baseColor.w + splatsColor.g*splatsColor.w*(1.0-baseColor.w))/alpha;
            float blue = (baseColor.b*baseColor.w + splatsColor.b*splatsColor.w*(1.0-baseColor.w))/alpha;
            color = vec4(red, green, blue, alpha);
            depth = vec4((baseDepth*baseColor.w + splatsDepth*splatsColor.w*(1.0-baseColor.w))/alpha);
        }
    }`
    };
}


function _perspectiveDepthToViewZ(invClipZ, near, far) {
    return (near * far) / ((far - near) * invClipZ - far);


}

function _isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
};

export { Map };
