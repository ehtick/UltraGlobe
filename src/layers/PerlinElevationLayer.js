import * as THREE from 'three';
import { ElevationLayer } from './ElevationLayer.js'
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { PerlinElevationWorker } from './workers/PerlinElevation.worker.js';

let id = 0;
let nextWorker = 0;
function getConcurency() {
    return 1;
    if ('hardwareConcurrency' in navigator) {
        return navigator.hardwareConcurrency;
    } else {
        return 4;
    }
}
const meshGeneratorWorkers = [];
const workerCallbacks = new Map();
const workerOnErrors = new Map();

const blob = new Blob([PerlinElevationWorker.getScript()], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);
for (let i = 0; i < getConcurency(); i++) {
    const elevationMesherWorker = new Worker(workerUrl);
    elevationMesherWorker.onmessage = handleWorkerResponse;
    elevationMesherWorker.onerror = handleWorkerError;
    meshGeneratorWorkers.push(elevationMesherWorker);
}

function sendWorkerTask(data, callback, onerror) {
    const messageID = id++;
    workerCallbacks.set(messageID, callback);
    workerOnErrors.set(messageID, onerror);
    nextWorker = (nextWorker + 1) % meshGeneratorWorkers.length;
    meshGeneratorWorkers[nextWorker].postMessage({ id: messageID, input: data });
}

function handleWorkerResponse(e) {
    if (e.data.error) {
        workerOnErrors.get(e.data.id)(e.data.error);
    } else {
        workerCallbacks.get(e.data.id)(e.data.result);
    }
    workerCallbacks.delete(e.data.id);
    workerOnErrors.delete(e.data.id);
}
function handleWorkerError(error) {
    console.error("uncaught elevation mesher worker error : " + error)
}




const perlin = new ImprovedNoise();
const rand = Math.random();
const halfPI = Math.PI * 0.5;
function noise(x, y, z) {
    return perlin.noise(x + rand, y + rand, z + rand) * 2;
}

/**
 * An elevation layer that generates on the fly elevation using a mixture of noise techniques
 * @class
 * @extends ElevationLayer
 */
class PerlinElevationLayer extends ElevationLayer {

    /**
     * Base constructor for elevation layers.
     * @param {Object} properties 
     * @param {String|Number} properties.id layer id should be unique
     * @param {String} properties.name the name can be anything you want and is intended for labeling
     * @param {Number} properties.minHeight min terrain height relative to sea level
     * @param {Number} properties.maxHeight max terrain height relative to sea level
     * @param {Number[]} [properties.bounds=[-180, -90, 180, 90]]  min longitude, min latitude, max longitude, max latitude in degrees
     * @param {Boolean} [properties.visible = true] layer will be rendered if true (true by default)
     */
    constructor(properties) {
        super(properties);
        this.min = properties.minHeight ? this.minHeight : -10000 - Math.random() * 10000;
        this.max = properties.maxHeight ? this.maxHeight : 10000 + Math.random() * 22000;
        this.maxOctaveSimplex = 3 + Math.random() * 3;
        this.gainSimplex = 0.2 + Math.random() * 0.3;//0.5 + Math.random() * 0.2;
        this.maxOctaveTurbulence = 3 + Math.random() * 2;
        this.gainTurbulence = 0.2 + Math.random() * 0.23;//0.7;//0.5 + Math.random() * 0.2;
        this.warpFactorMultiplier = Math.random() * 0.3 + 0.1;
        this.continentFrequency = 0.2 + Math.random() * 2;
        this.turbulenceUp = 0.25 + Math.random() * 0.5;
        this.freqSup = 0.5 + Math.random() * 1;
    }

    getElevation(bounds, width, height, geometry, skirtGeometry, maxOctaves = 13){
        const trim = super._trimEdges;
        return new Promise((resolve, reject) => {
            sendWorkerTask({ bounds: bounds, resolution: width, min: this.min, max:this.max, maxOctaveSimplex: this.maxOctaveSimplex,
                gainSimplex: this.gainSimplex, maxOctaveTurbulence: this.maxOctaveTurbulence, gainTurbulence: this.gainTurbulence,
                warpFactorMultiplier: this.warpFactorMultiplier, continentFrequency: this.continentFrequency, turbulenceUp: this.turbulenceUp, freqSup: this.freqSup, maxOctaves:maxOctaves},
                (response) => {
                    geometry.setIndex(new THREE.Uint32BufferAttribute(new Int32Array(response.indices),1));
                    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(response.vertices), 3));
                    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(response.normals), 3));
                    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(response.uvs), 2));

                    skirtGeometry.setIndex(new THREE.Uint32BufferAttribute(new Int32Array(response.skirtIndices),1));
                    skirtGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(response.skirts), 3));
                    skirtGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(response.skirtNormals), 3));
                    skirtGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(response.skirtUVs), 2));

                    geometry.computeBoundingSphere();
                    geometry.computeBoundingBox();
                    //geometry.computeVertexNormals();
                    skirtGeometry.computeBoundingSphere();
                    
                    resolve({
                        elevationArray: trim(new Float32Array(response.extendedElevationBuffer), width+2, height+2),
                        shift: new THREE.Vector3(response.shift.x, response.shift.y, response.shift.z),
                    });
                }, (error) => {
                    reject(error);
                });
        });
    }
    getElevation2(bounds, width, height, geometry, skirtGeometry, maxOctaves = 13) {
        const meshGeneration = super._simpleMeshFromElevation;
        const trim = super._trimEdges;
        return new Promise((resolve, reject) => {

            const extendedBounds = bounds.clone();
            extendedBounds.min.x -= (bounds.max.x - bounds.min.x) / (width - 1);
            extendedBounds.max.x += (bounds.max.x - bounds.min.x) / (width - 1);
            extendedBounds.min.y -= (bounds.max.y - bounds.min.y) / (height - 1);
            extendedBounds.max.y += (bounds.max.y - bounds.min.y) / (height - 1);

            const extendedWidth = width + 2;
            const extendedHeight = height + 2;


            const latStep = (extendedBounds.max.y - extendedBounds.min.y) / (extendedHeight - 1);
            const lonStep = (extendedBounds.max.x - extendedBounds.min.x) / (extendedWidth - 1);

            let baseLat = extendedBounds.min.y;
            let baseLon = extendedBounds.min.x;

            var extendedElevationArray = new Array(extendedWidth * extendedHeight).fill(0);


            let ampTotal = 0;
            let lat = baseLat;
            for (let y = 0; y < extendedHeight; y++, lat += latStep) {
                let lon = baseLon;
                for (let x = 0; x < extendedWidth; x++, lon += lonStep) {
                    let adjustedLon = lon;
                    let adjustedLat = lat;
                    if (adjustedLat > halfPI) {
                        adjustedLon -= Math.PI;
                        adjustedLat = halfPI - (adjustedLat - halfPI)
                    } else if (adjustedLat < -halfPI) {
                        adjustedLon -= Math.PI;
                        adjustedLat = -halfPI - (adjustedLat + halfPI)
                    }
                    if (adjustedLon > Math.PI) {
                        adjustedLon = -Math.PI + (adjustedLon % Math.PI);
                    }
                    else if (adjustedLon < -Math.PI) {
                        adjustedLon = Math.PI + (adjustedLon % Math.PI);
                    }
                    let a = Math.cos(adjustedLat) * Math.cos(adjustedLon);
                    let b = Math.cos(adjustedLat) * Math.sin(adjustedLon);
                    let c = Math.sin(adjustedLat);


                    const warpFactor = this.warpFactorMultiplier * noise(a, b, c);
                    const dx = warpFactor * noise(a + 0.57, b + 0.1248, c + 0.845);
                    const dy = warpFactor * noise(a + 0.1111, b + 0.744, c + 0.154);
                    const dz = warpFactor * noise(a + 0.287, b + 0.2678, c + 0.36698);

                    let p2 = 3 * (noise((a + 0.214) * this.continentFrequency, (b + 0.569) * this.continentFrequency, (c + 0.648) * this.continentFrequency));
                    let p1 = 3 * (noise((a + 0.878) * this.continentFrequency, (b + 0.2456) * this.continentFrequency, (c + 0.211) * this.continentFrequency));
                    //p1 = Math.sign(p1)*Math.sqrt(Math.abs(p1));
                    //p2 = Math.sign(p2)*Math.sqrt(Math.abs(p2));

                    const teracingMax = (1 + (noise((a + 0.456) * 10.0, (b + 0.678) * 10.0, (c + 0.125) * 10.0)));
                    const teracingMin = -(1 + (noise((a + 0.168) * 10.0, (b + 0.895) * 10.0, (c + 0.174) * 10.0)));
                    let previousTurbulence = 1;
                    for (let octave = 0; octave < maxOctaves; octave++) {
                        const freq = Math.pow(5, octave + 1 + this.freqSup);
                        const freqSimplex = freq * 0.02;
                        if (octave < this.maxOctaveSimplex) {
                            const ampSimplex = Math.pow(this.gainSimplex, octave + 1) * p2;
                            extendedElevationArray[extendedWidth * y + x] += Math.max(teracingMin, Math.min(teracingMax, noise((a + 0.187 + dx) * freqSimplex, (b + 0.289 + dy) * freqSimplex, (c + 0.247 + dz) * freqSimplex))) * ampSimplex;

                        }

                        if (octave < this.maxOctaveTurbulence) {
                            const ampTurbulence = Math.pow(this.gainTurbulence, octave + 1) * (p1) * 2;
                            //previousTurbulence = -(2.0 * (Math.max(teracingMin, Math.min(teracingMax, Math.abs(noise((a+0.966 + dx) * freq, (b+0.871 + dy) * freq, (c+0.498 + dz) * freq))))) - 1.0) * ampTurbulence * previousTurbulence;
                            previousTurbulence = Math.max(teracingMin, Math.min(teracingMax, Math.abs(noise((a + 0.966 + dx) * freq, (b + 0.871 + dy) * freq, (c + 0.498 + dz) * freq)) - this.turbulenceUp)) * ampTurbulence * previousTurbulence;
                            extendedElevationArray[extendedWidth * y + x] += previousTurbulence;
                        }
                    }
                }
            }
            for (let octave = 0; octave < 13; octave++) {
                if (octave < this.maxOctaveSimplex) {
                    ampTotal += Math.pow(this.gainSimplex, octave + 1);
                }
                if (octave < this.maxOctaveTurbulence) {
                    ampTotal += Math.pow(this.gainTurbulence, octave + 1);
                }
            }

            for (let x = 0; x < extendedWidth; x++) {
                for (let y = 0; y < extendedHeight; y++) {
                    extendedElevationArray[extendedWidth * y + x] = (((extendedElevationArray[extendedWidth * y + x] / ampTotal) + 1) * 0.5) * (this.max - this.min) + this.min /* + elevationMultiplierArray[width * y + x]*8000 */;
                }
            }

            let shift;
            if(geometry && skirtGeometry){
                shift = meshGeneration(bounds, width, height, extendedElevationArray, geometry, skirtGeometry);
            }
            

            resolve({
                elevationArray: trim(extendedElevationArray, width, height),
                shift: shift,
            });

        });

    }

    
    


}

export { PerlinElevationLayer };