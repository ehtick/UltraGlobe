import { Layer } from "./Layer";
import { OGC3DTile, TileLoader } from "@jdultra/threedtiles";
import * as THREE from 'three';
import { llhToCartesianFastSFCT } from '../GeoUtils.js';
import { splatsVertexShader } from "@jdultra/threedtiles";
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';


const tileLoaders = [];

const cartesianLocation = new THREE.Vector3();
const Up = new THREE.Vector3();
const East = new THREE.Vector3();
const North = new THREE.Vector3();
const globalNorth = new THREE.Vector3(0, 0, 1);
const quaternionToEarthNormalOrientation = new THREE.Quaternion();
const quaternionSelfRotation = new THREE.Quaternion();
const rotationMatrix = new THREE.Matrix4();
const rotation = new THREE.Euler(0, 0, 0, "ZYX");



/**
 * A layer for loading a OGC3DTiles tileset. 
 * @class
 * @extends Layer
 */
class OGC3DTilesLayer extends Layer {
    /**
     *
     * @param {Object} properties
     * @param {string|number} properties.id layer id should be unique
     * @param {string} properties.name the name can be anything you want and is intended for labeling
     * @param {string} properties.url url of the root tileset.json
     * @param {boolean} [properties.displayCopyright = false] (optional) display copyright information when present in tiles by concatenating all copyright info for all displayed tiles
     * @param {boolean} [properties.displayErrors = false] (optional) display loading errors
     * @param {boolean} [properties.splats = false] (optional) specify true when the tileset contains gaussian splats for correct rendering.
     * @param {boolean} [properties.proxy = undefined] (optional) the url to a proxy service. Instead of fetching tiles via a GET request, a POST will be sent to the proxy url with the real tile address in the body of the request.
     * @param {boolean} [properties.queryParams = undefined] (optional) path params to add to individual tile urls (starts with "?").
     * @param {number} [properties.scaleX = 1] - scale on X axes.
     * @param {number} [properties.scaleY = 1] - scale on Y axes. defaults to the scaleX property if defined.
     * @param {number} [properties.scaleZ = 1] - scale on Z axes. defaults to the scaleX property if defined.
     * @param {number} [properties.yaw = 0] - Yaw angle in degrees. (0 means local z axis points north ccw rotation)
     * @param {number} [properties.pitch = 0] - Pitch angle in degrees (0 means the x-z plane alligns with the horizon )
     * @param {number} [properties.roll = 0] - Roll angle in degrees. (ccw rotation about the local z axis)
     * @param {number} [properties.geometricErrorMultiplier = 1] (optional) between 0 and infinity, defaults to 1. controls the level of detail.
     * @param {number} [properties.longitude = undefined] (optional) longitude of the model's center point in degrees.
     * @param {number} [properties.latitude = undefined] (optional) latitude of the model's center point in degrees.
     * @param {number} [properties.height = undefined] (optional) height in meters above sea level.
     * @param {boolean} [properties.loadOutsideView = false] (optional) if true, will load tiles outside the view at the lowest possible LOD.
     * @param {boolean} [properties.selectable = false] (optional) if true, the tileset can be selected.
     * @param {number[]} [properties.bounds=[-180, -90, 180, 90]]  min longitude, min latitude, max longitude, max latitude in degrees
     * @param {boolean} [properties.visible = true] layer will be rendered if true (true by default)
     * @param {string} [properties.loadingStrategy = "INCREMENTAL"] loading strategy, "INCREMENTAL" (default) or "IMMEDIATE". "IMMEDIATE" mode loads only the ideal LOD while "INCREMENTAL" loads intermediate LODs.
     * @param {Function} [properties.updateCallback = undefined] A callback called on every tileset update with a stats object indicating number of tiles loaded/visualized, max loaded LOD, and percentage of the tileset loaded
     * @param {Function} [properties.meshCallback = undefined] A callback called on every tileset update with a stats object indicating number of tiles loaded/visualized, max loaded LOD, and percentage of the tileset loaded
     * @param {Function} [properties.pointsCallback = undefined] A callback called on every tileset update with a stats object indicating number of tiles loaded/visualized, max loaded LOD, and percentage of the tileset loaded
     * @param {Number} [properties.cacheSize = 0] A callback called on every tileset update with a stats object indicating number of tiles loaded/visualized, max loaded LOD, and percentage of the tileset loaded
     * @param {Number} properties.splatsCropRadius a crop radius around the center of a splats tileset.
     * @param {boolean} [properties.receiveShadow = true] mesh receive shadows.
     * @param {boolean} [properties.castShadow = true] mesh casts shadows.
     *
     */
    constructor(properties) {

        if (!properties) {
            throw "Bad instanciation, OGC3DTilesLayer requires properties."
        }
        super(properties);
        if (properties.splatsCropRadius) this.splatsCropRadius = properties.splatsCropRadius;
        this.meshCallback = properties.meshCallback;
        this.pointsCallback = properties.pointsCallback;
        this.receiveShadow = properties.receiveShadow == undefined?true:properties.receiveShadow;
        this.castShadow = properties.castShadow == undefined?true:properties.castShadow;
        this.cacheSize = properties.cacheSize ? properties.cacheSize : 0;
        this.isOGC3DTilesLayer = true;
        this.isSplats = properties.splats;
        const self = this;
        self.properties = properties;
        self.displayCopyright = properties.displayCopyright;
        self.displayErrors = properties.displayErrors;
        self.proxy = properties.proxy;
        self.queryParams = properties.queryParams;

        this.move(properties.longitude, properties.latitude, properties.height, properties.yaw, properties.pitch, properties.roll, properties.scaleX, properties.scaleY, properties.scaleZ);



        this.geometricErrorMultiplier = !!properties.geometricErrorMultiplier ? properties.geometricErrorMultiplier : 1.0;
        this.loadingStrategy = !!properties.loadingStrategy ? properties.loadingStrategy : "INCREMENTAL";
        this.updateCallback = !!properties.updateCallback ? properties.updateCallback : undefined;


        this.url = properties.url;
        this.loadOutsideView = !!properties.loadOutsideView ? properties.loadOutsideView : false;



        this.selected = false;
        this.selectable = !!properties.selectable;

        if (this.isSplats) {
            const vertShader = splatsVertexShader();
            this.splatsDepthMaterial = new THREE.ShaderMaterial(
                {
                    uniforms: {
                        textureSize: { value: null },
                        numSlices: { value: null },
                        cov1Texture: { value: null },
                        cov2Texture: { value: null },
                        colorTexture: { value: null },
                        positionTexture: { value: null },
                        zUpToYUpMatrix3x3: { value: null },
                        sizeMultiplier: { value: 1 },
                        cropRadius: { value: Number.MAX_VALUE },
                        /* cameraNear: { value: undefined },
                        cameraFar: { value: undefined },
                        computeLinearDepth: { value: true } */
                    },
                    vertexShader: vertShader,
                    fragmentShader: splatsDepthFragmentShader(),
                    transparent: true,
                    side: THREE.FrontSide,
                    depthTest: false,
                    depthWrite: false,
                    //blending: THREE.AdditiveBlending,
                    glslVersion: THREE.GLSL3
                }
            );
        }
    }

    setSplatsCropRadius(radius) {
        this.splatsCropRadius = radius;
        if (this.tileset != undefined) {
            this.tileset.setSplatsCropRadius(radius);
        }
    }
    getCenter(sfct) {
        sfct.set(this._longitude, this._latitude, this._height);
    }
    getRadius() {
        return this.bounds.min.distanceTo(this.bounds.max);
    }
    getBaseHeight() {
        const bounds = this.tileset.boundingVolume;
        if (bounds) {
            if (bounds.halfDepth != undefined) {
                return - bounds.halfDepth;
            } else if (bounds.isSphere) {
                return - bounds.radius;
            }
        }
        return 0;
    }
    generateControlShapes(tileset) {
        if (tileset.json.boundingVolume.region) {

        } else if (tileset.json.boundingVolume.box) {

        } else if (tileset.json.boundingVolume.sphere) {

        }
        if (tileset.boundingVolume.halfWidth != undefined) {
            // box

            // TODO curved edges
            const shape = new THREE.Shape();
            shape.moveTo(tileset.boundingVolume.center.x + tileset.boundingVolume.halfWidth + tileset.boundingVolume.halfWidth * 0.1, tileset.boundingVolume.center.y + tileset.boundingVolume.halfHeight + tileset.boundingVolume.halfWidth * 0.1);
            shape.lineTo(tileset.boundingVolume.center.x + tileset.boundingVolume.halfWidth + tileset.boundingVolume.halfWidth * 0.1, tileset.boundingVolume.center.y - tileset.boundingVolume.halfHeight - tileset.boundingVolume.halfWidth * 0.1);
            shape.lineTo(tileset.boundingVolume.center.x - tileset.boundingVolume.halfWidth - tileset.boundingVolume.halfWidth * 0.1, tileset.boundingVolume.center.y - tileset.boundingVolume.halfHeight - tileset.boundingVolume.halfWidth * 0.1);
            shape.lineTo(tileset.boundingVolume.center.x - tileset.boundingVolume.halfWidth - tileset.boundingVolume.halfWidth * 0.1, tileset.boundingVolume.center.y + tileset.boundingVolume.halfHeight + tileset.boundingVolume.halfWidth * 0.1);
            shape.lineTo(tileset.boundingVolume.center.x + tileset.boundingVolume.halfWidth + tileset.boundingVolume.halfWidth * 0.1, tileset.boundingVolume.center.y + tileset.boundingVolume.halfHeight + tileset.boundingVolume.halfWidth * 0.1);

            const hole = new THREE.Shape();
            hole.moveTo(tileset.boundingVolume.center.x + tileset.boundingVolume.halfWidth + tileset.boundingVolume.halfWidth * 0.0, tileset.boundingVolume.center.y + tileset.boundingVolume.halfHeight + tileset.boundingVolume.halfWidth * 0.0);
            hole.lineTo(tileset.boundingVolume.center.x + tileset.boundingVolume.halfWidth + tileset.boundingVolume.halfWidth * 0.0, tileset.boundingVolume.center.y - tileset.boundingVolume.halfHeight - tileset.boundingVolume.halfWidth * 0.0);
            hole.lineTo(tileset.boundingVolume.center.x - tileset.boundingVolume.halfWidth - tileset.boundingVolume.halfWidth * 0.0, tileset.boundingVolume.center.y - tileset.boundingVolume.halfHeight - tileset.boundingVolume.halfWidth * 0.0);
            hole.lineTo(tileset.boundingVolume.center.x - tileset.boundingVolume.halfWidth - tileset.boundingVolume.halfWidth * 0.0, tileset.boundingVolume.center.y + tileset.boundingVolume.halfHeight + tileset.boundingVolume.halfWidth * 0.0);
            hole.lineTo(tileset.boundingVolume.center.x + tileset.boundingVolume.halfWidth + tileset.boundingVolume.halfWidth * 0.0, tileset.boundingVolume.center.y + tileset.boundingVolume.halfHeight + tileset.boundingVolume.halfWidth * 0.0);

            shape.holes.push(hole);
            const geometry = new THREE.ShapeGeometry(shape);
            geometry.translate(0, 0, -tileset.boundingVolume.halfDepth);

            const matrix = new THREE.Matrix4();
            matrix.setFromMatrix3(tileset.boundingVolume.matrixToOBBCoordinateSystem);
            geometry.applyMatrix4(matrix);
            geometry.translate(tileset.boundingVolume.center.x, tileset.boundingVolume.center.y, tileset.boundingVolume.center.z);

            this.selectionMesh = new THREE.Mesh(geometry,
                new THREE.MeshBasicMaterial(
                    {
                        color: 0xFFB24E,
                        transparent: true,
                        opacity: 0.5,
                        depthWrite: true,
                        side: THREE.DoubleSide,
                        depthTest: true
                    }
                )
            );

            const geometry2 = new THREE.BoxGeometry(tileset.boundingVolume.halfWidth * 2, tileset.boundingVolume.halfHeight * 2, tileset.boundingVolume.halfDepth * 2);
            geometry2.applyMatrix4(matrix);
            geometry2.translate(tileset.boundingVolume.center.x, tileset.boundingVolume.center.y, tileset.boundingVolume.center.z);

            this.boundingMesh = new THREE.Mesh(geometry2, new THREE.MeshBasicMaterial({
                color: 0xFFB24E,
                transparent: true,
                opacity: 0.3,
                depthWrite: true,
                side: THREE.DoubleSide,
                depthTest: true
            }));
            this.boundingMeshOutline = new THREE.BoxHelper(this.boundingMesh, 0xFFB24E);




        } else if (tileset.boundingVolume instanceof THREE.Sphere) {
            //sphere
            const geometry = new THREE.SphereGeometry(tileset.boundingVolume.radius, 32, 16)
            geometry.translate(tileset.boundingVolume.center.x, tileset.boundingVolume.center.y, tileset.boundingVolume.center.z);
            this.boundingMesh = new THREE.Mesh(geometry,
                new THREE.MeshBasicMaterial(
                    {
                        color: 0x04E7FF,
                        transparent: true,
                        opacity: 0.3,
                        depthWrite: true,
                        side: THREE.DoubleSide,
                        depthTest: true
                    }
                ));
            this.selectionMesh = this.boundingMesh.clone();
        } else if (tile.boundingVolume instanceof THREE.Box3) {
            // Region
            // Region not supported
            console.error("Region bounding volume not supported");
            return;
        }
        this.boundingMesh.layer = this;
        this.update();
    }

    _setMap(map) {
        const self = this;

        var tileLoader = !!self.properties.tileLoader ? self.properties.tileLoader : new TileLoader({
            renderer: map.renderer,
            maxCachedItems: self.cacheSize,
            meshCallback: (mesh, geometricError) => {
                mesh.material.flatShading = self.properties.flatShading;
                //mesh.material = new THREE.MeshLambertMaterial({color: new THREE.Color("rgb("+(Math.floor(Math.random()*256))+", "+(Math.floor(Math.random()*256))+", "+(Math.floor(Math.random()*256))+")")});
                if (mesh.material.isMeshBasicMaterial) {
                    const newMat = new THREE.MeshStandardMaterial();
                    newMat.map = mesh.material.map;
                    mesh.material = newMat;
                }
                /* mesh.material.color.copy(new THREE.Color("rgb("+(Math.floor(Math.random()*256))+", "+(Math.floor(Math.random()*256))+", "+(Math.floor(Math.random()*256))+"))+"));
                mesh.material.needsUpdate = true */
                if (mesh.material.map) {
                    mesh.material.map.colorSpace = THREE.LinearSRGBColorSpace;
                }
                mesh.material.wireframe = false;
                mesh.material.side = THREE.DoubleSide;
                if (!mesh.geometry.getAttribute('normal')) {
                    mesh.geometry.computeVertexNormals();
                }
                
                if (map.csm) {
                    mesh.material.side = THREE.FrontSide;
                    mesh.castShadow = self.castShadow
                    mesh.receiveShadow = self.receiveShadow;
                    mesh.parent.castShadow = self.castShadow
                    mesh.parent.receiveShadow = self.receiveShadow;

                    mesh.material.shadowSide = THREE.BackSide;
                    map.csm.setupMaterial(mesh.material);
                }


                if (!!self.meshCallback) {
                    self.meshCallback(mesh, geometricError);
                }

            },
            pointsCallback: (points, geometricError) => {

                points.material.size = 1 * Math.max(1.0, 0.1 * Math.sqrt(geometricError));
                points.material.sizeAttenuation = true;
                points.material.receiveShadow = false;
                points.material.castShadow = false;
                if (!!self.pointsCallback) {
                    self.pointsCallback(points, geometricError);
                }
            }
        });
        this.tileset = new OGC3DTile({
            url: this.url,
            geometricErrorMultiplier: this.geometricErrorMultiplier,
            loadOutsideView: this.loadOutsideView,
            tileLoader: tileLoader,
            renderer: map.renderer,
            proxy: self.proxy,
            static: false,
            queryParams: self.queryParams,
            displayErrors: self.displayErrors,
            displayCopyright: self.displayCopyright,
            centerModel: self.centerModel,
            loadingStrategy: self.loadingStrategy
        });
        if (this.splatsCropRadius != undefined) {
            this.tileset.setSplatsCropRadius(1e+2);
        }

        this.object3D = new THREE.Object3D();
        this.object3D.matrixAutoUpdate = false;
        this.object3D.add(this.tileset);
        this.object3D.updateMatrix();
        this.object3D.updateMatrixWorld(true);




    }


    _addToScene(scene) {
        if (this.isSplats) return;
        this.scene = scene;
        scene.add(this.object3D);
        this.move(this._longitude, this._latitude, this._height, this._yaw, this._pitch, this._roll, this._scaleX, this._scaleY, this._scaleZ);
    }
    _addToSplatsScene(splatsScene) {
        if (!this.isSplats) return;
        this.scene = splatsScene;
        splatsScene.add(this.object3D);
        this.move(this._longitude, this._latitude, this._height, this._yaw, this._pitch, this._roll, this._scaleX, this._scaleY, this._scaleZ);
    }

    update(camera) {
        if (!this.paused && this.visible) {
            const stats = this.tileset.update(camera);
            if (!!this.updateCallback) {
                this.updateCallback(stats);
            }
            try {
                this.tileset.tileLoader.update();
            } catch (error) {
                //silence
            }


        }

    }

    setRenderMaterial() {
        if (this.isSplats && this.splatsRenderMaterial) {
            if (this.tileset.splatsMesh) {
                this.tileset.splatsMesh.material = this.splatsRenderMaterial;
            }
            this.tileset.splatsMesh.material.depthWrite = false;
            this.tileset.splatsMesh.material.depthTest = false;
        }
    }
    setDepthMaterial(camera) {
        if (this.isSplats) {
            if (this.tileset.splatsMesh) {
                this.splatsRenderMaterial = this.tileset.splatsMesh.material;
                this.splatsDepthMaterial.uniforms.textureSize.value = this.splatsRenderMaterial.uniforms.textureSize.value;
                this.splatsDepthMaterial.uniforms.numSlices.value = this.splatsRenderMaterial.uniforms.numSlices.value;
                this.splatsDepthMaterial.uniforms.cov1Texture.value = this.splatsRenderMaterial.uniforms.cov1Texture.value;
                this.splatsDepthMaterial.uniforms.cov2Texture.value = this.splatsRenderMaterial.uniforms.cov2Texture.value;
                this.splatsDepthMaterial.uniforms.colorTexture.value = this.splatsRenderMaterial.uniforms.colorTexture.value;
                this.splatsDepthMaterial.uniforms.positionTexture.value = this.splatsRenderMaterial.uniforms.positionTexture.value;
                this.splatsDepthMaterial.uniforms.zUpToYUpMatrix3x3.value = this.splatsRenderMaterial.uniforms.zUpToYUpMatrix3x3.value;
                this.splatsDepthMaterial.uniforms.sizeMultiplier.value = this.splatsRenderMaterial.uniforms.sizeMultiplier.value;
                this.splatsDepthMaterial.uniforms.cropRadius.value = this.splatsRenderMaterial.uniforms.cropRadius.value;
                /*this.splatsDepthMaterial.uniforms.cameraNear.value = camera.near;
                this.splatsDepthMaterial.uniforms.cameraFar.value = camera.far;
                this.splatsDepthMaterial.uniforms.computeLinearDepth.value = true; */
                this.tileset.splatsMesh.material = this.splatsDepthMaterial;
            }
        }
    }

    /**
    * Sets the object position and orientation based on Longitude, Latitude, Height, Yaw, Pitch, Roll
    * Does nothing if longitude latitude are undefined
    *
    * @param {number} [longitude = undefined] - a longitude in degrees
    * @param {number} [latitude = undefined] - a latitude in degrees
    * @param {number} [height = 0] - a height in meters above WGS 84 sea level
    * @param {number} [yaw = 0] - Yaw angle in degrees. (0 points north ccw rotation)
    * @param {number} [pitch = 0] - Pitch angle in degrees (-90 to 90)
    * @param {number} [roll = 0] - Roll angle in degrees.
    * @param {number} [scaleX = 1] - scale on X axes.
    * @param {number} [scaleY = 1] - scale on Y axes. defaults to the scaleX property if defined.
    * @param {number} [scaleZ = 1] - scale on Z axes. defaults to the scaleX property if defined.
    */
    move(longitude, latitude, height = 0, yaw = 0, pitch = 0, roll = 0, scaleX = 1, scaleY = 1, scaleZ = 1) {

        if (longitude == undefined || latitude == undefined) return;
        this._longitude = longitude;
        this._latitude = latitude;
        this._height = height;
        this._yaw = yaw;
        this._pitch = pitch;
        this._roll = roll;
        this._scaleX = scaleX;
        this._scaleY = scaleY;
        this._scaleZ = scaleZ;
        if (!this.scene) return;

        rotation.set(
            pitch * 0.0174533, yaw * 0.0174533, roll * 0.0174533, "ZYX");

        cartesianLocation.set(longitude, latitude, height);
        llhToCartesianFastSFCT(cartesianLocation, false); // Convert LLH to Cartesian in-place

        Up.copy(cartesianLocation).normalize();
        East.crossVectors(Up, globalNorth).normalize();
        if (East.lengthSq() === 0) {
            East.set(1, 0, 0);
        }

        North.crossVectors(East, Up).normalize();


        rotationMatrix.makeBasis(East, Up, North);

        quaternionToEarthNormalOrientation.setFromRotationMatrix(rotationMatrix);

        quaternionSelfRotation.setFromEuler(rotation);
        this.object3D.quaternion.copy(quaternionToEarthNormalOrientation).multiply(quaternionSelfRotation);
        this.object3D.position.copy(cartesianLocation);
        this.object3D.scale.set(scaleX, scaleY, scaleZ);


        this._updateMatrices();
    }
    _updateMatrices() {
        this.object3D.updateMatrix();
        this.object3D.updateMatrixWorld(true);
        this.tileset.updateMatrices();
    }

    dispose() {
        this.scene.remove(this.object3D);
        this.tileset.dispose();
    }

    getSelectableObjects() {
        const selectable = [];
        if (this.boundingMesh) selectable.push(this.boundingMesh);
        return selectable;
    }

    select(objects) {
        if (objects && objects.length && objects[0].layer == this && this.selectable) {
            this.selected = true;
            this.scene.add(this.selectionMesh);
            this.scene.add(this.boundingMesh);
            if (this.boundingMeshOutline) this.scene.add(this.boundingMeshOutline);
        }

    }
    unselect(objects) {
        if (objects && objects.length && objects[0].layer == this && this.selectable) {
            this.selected = false;
            this.scene.remove(this.selectionMesh);
            this.scene.remove(this.boundingMesh);
            if (this.boundingMeshOutline) this.scene.remove(this.boundingMeshOutline);
        }

    }
}
function splatsDepthFragmentShader() {
    return `
precision highp float;

layout(location = 0) out vec4 depth;
//layout(location = 1) out vec4 alphaAccumulation;

in vec4 color;
in vec2 vUv;
in vec3 splatPositionWorld;
in vec3 splatPositionModel;
in float splatDepth;
in float splatCrop;
uniform float textureSize;
uniform float cropRadius;

void main() {
    
    if(length(splatPositionModel)>cropRadius) discard;
    float l = length(vUv);
    
    // Early discard for pixels outside the radius
    if (l > splatCrop) {
        discard;
    };
    
    vec2 p = vUv * 4.0;
    float alpha = pow(exp(-dot(p, p)),1.8)*color.w;
    //if(alpha<0.5) discard;

    depth = vec4(splatDepth,splatDepth,splatDepth,alpha);
    
    //depthMultipliedByAlpha = vec4(orthographicDepth*alpha); 
    //alphaAccumulation = vec4(alpha); 
    
}`
};


export { OGC3DTilesLayer }