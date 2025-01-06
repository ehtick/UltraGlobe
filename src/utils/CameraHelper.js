import * as THREE from 'three';
import { llhToCartesianFastSFCT, cartesianToLlhFastSFCT, haversineDistance, rhumbDistance, interpolateGreatCircle, interpolateRhumbLine } from '../GeoUtils.js';

const cartesianLocation = new THREE.Vector3();
const Up = new THREE.Vector3();
const East = new THREE.Vector3();
const North = new THREE.Vector3();
const globalNorth = new THREE.Vector3(0,0,1);
const quaternionToEarthNormalOrientation = new THREE.Quaternion();
const quaternionSelfRotation = new THREE.Quaternion();
const rotationMatrix = new THREE.Matrix4();
const rotation = new THREE.Euler(0,0,0, "ZYX");
/**
 * Gets the camera's Longitude, Latitude, Height, Yaw, Pitch, and Roll from its position and orientation.
 *
 * @param {THREE.PerspectiveCamera} camera - The camera to extract parameters from.
 * @returns {Object} An object containing:
 *   - llh: A Vector3 where:
 *    - x = Longitude in degrees
 *    - y = Latitude in degrees
 *    - z = Height in meters
 *   - yaw: Yaw angle in degrees
 *   - pitch: Pitch angle in degrees
 *   - roll: Roll angle in degrees
 */
export function getCameraLLHYawPitchRoll(camera) {
    cartesianLocation.copy(camera.position);
    Up.copy(cartesianLocation).normalize();
    cartesianToLlhFastSFCT(cartesianLocation);
    East.crossVectors(globalNorth, Up).normalize();
    if (East.lengthSq() === 0) {
        East.set(1, 0, 0);
    }
    North.crossVectors(East, Up).normalize();

    rotationMatrix.makeBasis(East, Up, North);

    quaternionToEarthNormalOrientation.setFromRotationMatrix(rotationMatrix).conjugate();
    quaternionToEarthNormalOrientation.multiply(camera.quaternion);

    // Adjusting the Euler interpretation
    rotation.setFromQuaternion(quaternionToEarthNormalOrientation, 'YXZ');

    return {
        llh: cartesianLocation.clone(),
        yaw: THREE.MathUtils.radToDeg(rotation.y), // Convert from radians to degrees
        pitch: THREE.MathUtils.radToDeg(rotation.x), // Convert from radians to degrees
        roll: THREE.MathUtils.radToDeg(rotation.z) // Convert from radians to degrees
    };
}

/**
  * Sets the video camera's position and orientation based on Longitude, Latitude, Height, Yaw, Pitch, Roll, and FOV.
  *
  * @param {THREE.Vector3} llh - A Vector3 where:
  *   - x = Longitude in degrees
  *   - y = Latitude in degrees
  *   - z = Height in meters
  * @param {number} yaw - Yaw angle in degrees. (0 points north ccw rotation)
  * @param {number} pitch - Pitch angle in degrees (-90 to 90)
  * @param {number} roll - Roll angle in degrees.
  *   - Rotation around the Forward vector (local Y-axis).
  * @param {number} fov - The camera's vertical field of view in degrees.
  * @param {number} far - The max distance to project the texture.
  */
export function setCameraFromLLHYawPitchRollFov(camera, llh, yaw, pitch, roll, fov, far) {
    


    rotation.set(
        pitch * 0.0174533, yaw * 0.0174533, roll * 0.0174533, "ZYX");

    cartesianLocation.set(llh.x, llh.y, llh.z);
    llhToCartesianFastSFCT(cartesianLocation, false); // Convert LLH to Cartesian in-place

    Up.copy(cartesianLocation).normalize();
    East.crossVectors(globalNorth, Up).normalize();
    if (East.lengthSq() === 0) {
        East.set(1, 0, 0);
    }
    North.crossVectors(East, Up).normalize();


    rotationMatrix.makeBasis(East, Up, North);

    quaternionToEarthNormalOrientation.setFromRotationMatrix(rotationMatrix);

    quaternionSelfRotation.setFromEuler(rotation);
    camera.quaternion.copy(quaternionToEarthNormalOrientation).multiply(quaternionSelfRotation);
    camera.position.copy(cartesianLocation);


    // Step 12: Set FOV and update camera matrices
    if (fov) camera.fov = fov;
    if (far) camera.far = this._far;
    camera.matrixWorldNeedsUpdate = true;
    camera.updateMatrix();
    camera.updateMatrixWorld(true);
    if(fov || far)camera.updateProjectionMatrix();
}

function segmentPolyLine(coordinates, maxDistance, lineType = 0) { //line type 0 for great circle, 1 for constant bearing.
    if (!Array.isArray(coordinates) || coordinates.length === 0) return []
    if (lineType !== 1) lineType = 0
    const segmented = [coordinates[0]]
    for (let i = 0; i < coordinates.length - 1; i++) {
        const [lon1, lat1, h1] = coordinates[i]
        const [lon2, lat2, h2] = coordinates[i + 1]
        let distance = (lineType === 0) ? haversineDistance(lon1, lat1, lon2, lat2) : rhumbDistance(lon1, lat1, lon2, lat2)
        if (distance <= maxDistance) {
            segmented.push(coordinates[i + 1])
            continue
        }
        const segments = Math.ceil(distance / maxDistance)
        for (let s = 1; s <= segments; s++) {
            const fraction = s / segments
            const interp = (lineType === 0) ? interpolateGreatCircle(lon1, lat1, lon2, lat2, fraction) : interpolateRhumbLine(lon1, lat1, lon2, lat2, fraction)
            let height
            if (h1 !== undefined && h2 !== undefined) {
                height = h1 + (h2 - h1) * fraction
            } else if (h1 !== undefined) {
                height = h1 * (1 - fraction)
            } else if (h2 !== undefined) {
                height = h2 * fraction
            }
            const point = interp.longitude !== undefined && interp.latitude !== undefined
                ? [interp.longitude, interp.latitude, height !== undefined ? height : undefined]
                : [interp.longitude, interp.latitude]
            if (height !== undefined) point[2] = height
            segmented.push(point)
        }
    }
    return segmented
}
/**
* Ease the camera from/to the given llh and yaw pitch roll
*
* @param {THREE.PerspectiveCamera} camera - The camera to extract parameters from.
* @param {Object} start An object containing:
*   - llh: lon lat height in degrees
*   - yaw: Yaw angle in degrees
*   - pitch: Pitch angle in degrees
*   - roll: Roll angle in degrees
* @param {Object} end An object containing:
*   - llh: lon lat height in degrees
*   - yaw: Yaw angle in degrees
*   - pitch: Pitch angle in degrees
*   - roll: Roll angle in degrees
* @param {number} [time = 2000] ease time in millis
* @param {function} [easeFunction = undefined] ease function defaults to a quadratic ease-in-out function. specify a custom function that accepts a number between 0 and 1 and returns a number between 0 and 1
* @param {function} [callback = undefined] a callback function called with the camera as parameter each time it moves
*/
export function cameraEase(camera, start, end, time = 2000, easeFunction = undefined, onMoveCallback = undefined, onFinishCallback = undefined) {

    if(!easeFunction || typeof easeFunction !== 'function'){
        easeFunction = (t)=>{
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          }
    }

    let yaw = 0;
    let pitch = 0;
    let roll = 0;

    const h = Math.max(0,(haversineDistance(start.llh.x, start.llh.y, end.llh.x, end.llh.y)*1000)-Math.max(start.llh.z, end.llh.z));
    const coordinates = segmentPolyLine([[start.llh.x, start.llh.y, start.llh.z],[end.llh.x, end.llh.y, end.llh.z]], 1000, 0);
    const positions = [];
    for(let i = 0; i<coordinates.length; i++){

        const p = new THREE.Vector3(coordinates[i][0], coordinates[i][1], coordinates[i][2]+(h*Math.sin((i/(coordinates.length-1))*Math.PI)));
        console.log(h);
        llhToCartesianFastSFCT(p);
        positions.push(p);
    }
    /* coordinates.forEach(c=>{
        const p = new THREE.Vector3(c[0], c[1], c[2]);
        llhToCartesianFastSFCT(p);
        positions.push(p);
    }) */

    /* const startPoint = start.llh.clone();
    const endPoint = end.llh.clone();
    const startTop = start.llh.clone();
    const endTop = end.llh.clone();
    startTop.z+=d;
    endTop.z+=d;
    const hInter = (startTop.z+endTop.z)/2;
    llhToCartesianFastSFCT(startPoint);
    llhToCartesianFastSFCT(endPoint);
    llhToCartesianFastSFCT(startTop);
    llhToCartesianFastSFCT(endTop);

    const intermediate = startPoint.clone().lerp(endPoint, 0.5);
    cartesianToLlhFastSFCT(intermediate);
    intermediate.z = hInter;
    llhToCartesianFastSFCT(intermediate); */

    
    const positionCurve = new THREE.CatmullRomCurve3(positions);

    const clock = new THREE.Clock();
    clock.start();
    const animate = ()=>{
        let t = clock.getElapsedTime()*1000;
        t/=time;
        t = Math.min(1,t);
        if(t<1) requestAnimationFrame(animate);
        
        const tEase = easeFunction(t);
        positionCurve.getPoint(tEase, camera.position);
        yaw = lerp(start.yaw, end.yaw, t);
        pitch = lerp(start.pitch, end.pitch, t);
        pitch = lerp(pitch, -89, Math.sin(t*Math.PI))
        roll = lerp(start.roll, end.roll, t);
        roll = lerp(roll, 0, Math.sin(t*Math.PI))
        cartesianToLlhFastSFCT(camera.position);
        setCameraFromLLHYawPitchRollFov(camera, camera.position,yaw, pitch, roll);
        if(onMoveCallback) onMoveCallback(camera);
        if(t>=1 && onFinishCallback) onFinishCallback();
    }
    requestAnimationFrame(animate);

    
}

function lerp(a, b, k) {
    return a + (b - a) * k;
}