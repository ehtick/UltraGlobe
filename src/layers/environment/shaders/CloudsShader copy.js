import * as THREE from 'three';
import Worley from './Worley';
import Perlin from './Perlin2';
//import perlinWorleyTexture from "./../images/perlinWorley.bin"

let defaultSampleDensityFunction = `
float sampleDensity(vec3 samplePosition){

	vec3 samplePositionNormalized = normalize(samplePosition);
	vec2 lonlatSample = vec2(atan(samplePositionNormalized.y, samplePositionNormalized.x),asin(samplePositionNormalized.z));
	float localRadius = getEarthRadiusAtLatitude(lonlatSample.y);
	float height = (length(samplePosition)-localRadius-startRadius) / (endRadius-startRadius);

    float theta = time*windSpeed*0.01;
    vec3 offsetPosition = vec3( samplePosition.x * cos(theta) - samplePosition.y * sin(theta), samplePosition.x * sin(theta) + samplePosition.y * cos(theta), samplePosition.z);
            
    float sm= smoothstep(0.0,0.2,height) * (smoothstep(1.0,0.8,height));
    vec3 offset = vec3((texture(perlinWorley, samplePosition*1e-8).r), texture(perlinWorley, (offsetPosition+vec3(435.6,-875.157,69775.419))*1e-8).r, texture(perlinWorley, (offsetPosition+vec3(75358.1287,42247.563,189963.4772))*1e-8).r);
    float localDensity = pow(max(0.0,texture(perlinWorley, offsetPosition*1e-7+offset*0.8).r-0.4-(1.0-sm)),3.0);
    if(localDensity<=0.0) return -1.0;
    localDensity *= pow(max(0.0,texture(perlinWorley, offsetPosition*1e-6).r-0.4-(1.0-sm)),1.0);
    if(localDensity<=0.0) return -1.0;
    localDensity *= pow(max(0.0,texture(perlinWorley, offsetPosition*5e-6).r-(1.0-sm)),1.0);
    if(localDensity<=0.0) return -1.0;
    localDensity *= 50.0;
    return localDensity;
}`;

function common(densityFunction) {
	const rot1 = Math.random() * 3.1416 * 2;
	const rot2 = Math.random() * 3.1416 * 2;
	const cos1 = Math.cos(rot1).toFixed(5);
	const sin1 = Math.sin(rot1).toFixed(5);

	const cos2 = Math.cos(rot2).toFixed(5);
	const sin2 = Math.sin(rot2).toFixed(5);

	let code = `
		mat2 texRotation1 = mat2(
            `+ cos1 + `, ` + (-sin1) + `,
            `+ sin1 + `, ` + cos1 + `
        );
            
        mat2 texRotation2 = mat2(
            `+ cos2 + `, ` + (-sin2) + `,
            `+ sin2 + `, ` + cos2 + `
        );

		float a = 6378137.0;
		float b = 6356752.3142451794975639665996337;
		float e2 = 0.006694379990; // earth First eccentricity squared

		
		float getEarthRadiusAtLatitude(float latitude){
			float sinLat = sin(latitude);
			float cosLat = cos(latitude);

    		
			return sqrt((pow(40680631590769.0*cosLat,2.0)+pow(40408295989504.0*sinLat,2.0))/(pow(6378137.0*cosLat,2.0)+pow(6356752.0*sinLat,2.0)));
		}

		vec4 blendBackToFront(vec4 back, vec4 front) {
			float alpha = 1.0 - (1.0 - front.a) * (1.0 - back.a); // Combined alpha
			vec3 color;
			if (alpha == 0.0) {
				color = vec3(0.0); // Completely transparent; color is irrelevant
			} else {
				color = (front.rgb * front.a + back.rgb * back.a * (1.0 - front.a)) / alpha;
			}
			return vec4(color, alpha);
		}
		

		float remap(float x, float a, float b, float c, float d)
		{
    		return (((x - a) / (b - a)) * (d - c)) + c;
		}

		`;
		
		if(densityFunction){
			code+=densityFunction
		}else{
			code+=defaultSampleDensityFunction;
		}
		
		code+=`


		
		
		
		vec2 shift(in vec2 shift, in vec2 lonlat){
			vec2 lonlatShifted = vec2(shift.x+lonlat.x, shift.y+lonlat.y);
			if (lonlatShifted.y > 1.57080) {
				lonlatShifted.x -= 3.14159;
				lonlatShifted.y = 3.14159 - lonlatShifted.y;
			} else if (lonlatShifted.y < -1.57080) {
				lonlatShifted.x -= 3.14159;
				lonlatShifted.y = -3.14159 - lonlatShifted.y;
			}
			
			// Wrap longitude
			lonlatShifted.x = mod(lonlatShifted.x + 3.14159, 2.0 * 3.14159) - 3.14159;
			return lonlatShifted;
		}
		vec2 rotate90(vec2 longLat) {
			
			// Convert to Cartesian coordinates
			vec3 cart = vec3(sin(longLat.y), cos(longLat.y) * sin(longLat.x), -cos(longLat.y) * cos(longLat.x));
			return vec2(atan(cart.x, cart.y), asin(cart.z));
		}

		vec2 raySphereIntersection(
			in vec3 sphereOrigin, in float sphereRadius,
			in vec3 rayOrigin, in vec3 rayDirection
		) {
			vec3 distSphereToRayOrigin = sphereOrigin - rayOrigin;
			float t = dot(distSphereToRayOrigin, rayDirection);
			vec3 P = rayDirection * t + rayOrigin;
			float y = length(sphereOrigin-P);

			if(y > sphereRadius){ // no impact
				return vec2(-1.0);
			}
			float x = sqrt(sphereRadius*sphereRadius - y*y);
			return vec2(t-x, t+x);
		}

		vec2 rayEllipsoidIntersection(
			in vec3 ellipsoidCenter, in vec3 rayOrigin, in vec3 normalizedRayDir, in float a, in float b, in float c
		) {
			vec3 translatedRayOrigin = rayOrigin - ellipsoidCenter;
			vec3 rescale = vec3(1.0 / a, 1.0 / b, 1.0 / c);
			vec3 newRayOrigin = translatedRayOrigin * rescale;
			vec3 newRayDir = normalize(normalizedRayDir * rescale);
			
			vec2 tValues = raySphereIntersection(vec3(0,0,0), 1.0, newRayOrigin, newRayDir);
			if(tValues.x>0.0){
				vec3 impact = newRayOrigin+(newRayDir*tValues.x);
				impact/=rescale;
				tValues.x = length(translatedRayOrigin-impact);
			}
			if(tValues.y>0.0){
				vec3 impact = newRayOrigin+(newRayDir*tValues.y);
				impact/=rescale;
				tValues.y = length(translatedRayOrigin-impact);
			}
			/* tValues /= length(newRayOrigin);
			tValues*= length(translatedRayOrigin); */
			/* tValues.x /= length(rescale);
			tValues.y /= length(rescale); */
			return tValues;
		}

		void rayEllipsoidForwardSurfaceIntersection(
			in vec3 ellipsoidCenter, in vec3 rayOrigin, in vec3 rayDirection,
			in float a, in float b, in float c,
			out vec3 surfaceLocation1, out vec3 surfaceLocation2,
			out bool intersect1, out bool intersect2
		) {
			intersect1 = false;
			intersect2 = false;
		
			// Normalize the ray direction
			vec3 normalizedRayDir = normalize(rayDirection);
		
			// Get the t-values for intersections
			
			vec2 tValues = rayEllipsoidIntersection(ellipsoidCenter, rayOrigin, normalizedRayDir, a, b, c);
		
			// Check if there are any intersections
			if (tValues.x > 0.0) {
				// Calculate the first intersection point if it is in the forward direction of the ray
				surfaceLocation1 = rayOrigin + tValues.x * normalizedRayDir;
				intersect1 = true;
			}
		
			if (tValues.y > 0.0 && tValues.y != tValues.x) {
				// Calculate the second intersection point if it is in the forward direction and not at the same point as the first
				surfaceLocation2 = rayOrigin + tValues.y * normalizedRayDir;
				intersect2 = true;
			}
		}

		void raySphereForwardSurfaceIntersection(
			in vec3 sphereOrigin, in float sphereRadius,
			in vec3 rayOrigin, in vec3 rayDirection, 
			out vec3 surfaceLocation1, out vec3 surfaceLocation2,
			out bool intersect1, out bool intersect2
		) {
			
			intersect1 = false;
			intersect2 = false;

			vec3 distSphereToRayOrigin = sphereOrigin - rayOrigin;
			float t = dot(distSphereToRayOrigin, rayDirection);
			vec3 P = rayDirection * t + rayOrigin;
			float y = length(sphereOrigin-P);

			if(y < sphereRadius){ //  impact
				
				float x = sqrt(sphereRadius*sphereRadius - y*y);
			
				if(t-x>0.0){
					surfaceLocation1.xyz = rayDirection;
					surfaceLocation1.xyz *= t-x;
					surfaceLocation1.xyz += rayOrigin;
					intersect1 = true;
				}
				if(t+x>0.0){
					surfaceLocation2.xyz = rayDirection;
					surfaceLocation2.xyz *= t+x;
					surfaceLocation2.xyz += rayOrigin;
					intersect2 = true;
				}
			}
			
		}
		
		

		  float readDepth( sampler2D depthSampler, vec2 coord ) {
			vec4 fragCoord = texture2D( depthSampler, coord );
			//float logDepthBufFC = 2.0 / ( log( cameraFar + 1.0 ) / log(2.0) );
			float viewZ = exp2(fragCoord.x / (ldf * 0.5)) - 1.0;
			return viewZToOrthographicDepth( -viewZ, cameraNear, cameraFar );
		  }

		
		

		

		float biScattering(float g, float k, float cosTheta, float lightIn){
			float g2 = g*g;
			float phaseFactor = mix((1.0 - g2) / pow(1.0 + g2 - 2.0 * g * -cosTheta, 1.5), (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5), k);
			phaseFactor /= 4.0 * 3.14159265;
			return lightIn * phaseFactor;
		}

		float beerPowder(float lightIn, float density, float distance ){
			return lightIn * (exp(-distance * density) * (1.0-exp(-2.0*distance*density)));
		}

		float beer(float lightIn, float density, float distance){
			return lightIn * exp(-distance * density);
		}

		float multiOctaveBeer(float lightIn, float density, float distance, float g, float k, float cosTheta){
			float attenuation = 0.2;
			float contribution = 0.4;
			float phaseAttenuation = 0.1;

			float a = 1.0;
			float b = 1.0;
			float c = 1.0;

			float luminance = 0.0;

			for(float i = 0.0; i<4.0; i++){
				float phase = biScattering(g, k, cosTheta, c);
				float beers = exp(-density * distance * 0.1 * a);

				luminance += b * phase * beers;

				a*= attenuation;
				b*= contribution;
				c*= (1.0 - phaseAttenuation);
			}
			return lightIn * luminance;
		}

		vec3 rotateVectorAroundAxis(vec3 dir, vec3 axis, float angle) {
			float cosTheta = cos(angle);
			float sinTheta = sin(angle);
			return dir * cosTheta + cross(axis, dir) * sinTheta + axis * dot(axis, dir) * (1.0 - cosTheta);
		}
		vec3 randomDirectionInCone(vec3 originalDirection, float coneAngle, float rand1, float rand2) {
			// Generating a random axis within the cone
			float randomAngleAroundOriginalDir = rand1 * 2.0 * 3.14159265; // Full circle
			vec3 perpendicularAxis = normalize(cross(originalDirection, vec3(0, 1, 0)));
			if (length(perpendicularAxis) < 0.001) {
				perpendicularAxis = normalize(cross(originalDirection, vec3(1, 0, 0)));
			}
			vec3 randomAxis = rotateVectorAroundAxis(perpendicularAxis, originalDirection, randomAngleAroundOriginalDir);
		
			// Random angle within the cone
			float angleWithinCone = rand2 * coneAngle;
		
			// Rotate the vector
			vec3 newDirection = rotateVectorAroundAxis(originalDirection, randomAxis, angleWithinCone);
		
			return normalize(newDirection);
		}

		vec3 Pack24(float val) {
			float sclaedVal = val * 0.9999847412109375;
			vec4 encode = fract(sclaedVal * vec4(1.0, 256.0, 65536.0, 16777216.0));
			return encode.xyz - encode.yzw / 256.0 + 0.001953125;
			
		}

		float scaleRandom(float length, float random) {
			// Ensure that the minimum output is 1.0
			float minOutput = 1.0;
		
			// Adjust the skew factor based on the input length.
			// The skew factor increases as the input length increases,
			// making the output more likely to be closer to 1.
			float skewFactor = log(length + 1.0);
		
			// Apply the skew to the random value
			float skewedRandom = pow(random, skewFactor);
		
			// Scale the skewed random value between minOutput and length
			float scaledRandom = minOutput + (skewedRandom * (length - minOutput));
		
			// Ensure the output is at least minOutput and at most the input length
			return clamp(scaledRandom, minOutput, length);
		}

		vec3 cartesianLlhShift(vec3 cartesianPosition, vec3 cartesianPositionNormalized, vec3 llhShift){
			vec3 sampleLonLatHeight = vec3(
				atan(cartesianPositionNormalized.y, cartesianPositionNormalized.x) + llhShift.x,
				asin(cartesianPositionNormalized.z)+llhShift.y, 
				length(cartesianPosition) - radius + llhShift.z
				);
			float cosLat = cos(sampleLonLatHeight.z);
			return vec3(
				(radius + sampleLonLatHeight.z) * cosLat * cos(sampleLonLatHeight.x),
				(radius + sampleLonLatHeight.z) * cosLat * sin(sampleLonLatHeight.x),
				(radius + sampleLonLatHeight.z) * sin(sampleLonLatHeight.y)
				);
		}

	`;
	return code;
}
const CloudsShader = {
	vertexShader: () =>/* glsl */`
	
	precision highp sampler3D;
	precision highp float;
	precision highp int;

	varying vec2 vUv;
	varying vec3 farPlanePosition;
	varying vec3 nearPlanePosition;
	uniform vec3 viewCenterFar;
	uniform vec3 viewCenterNear;
    uniform vec3 up;
    uniform vec3 right;
	uniform float xfov;
	uniform float yfov;
	uniform float cameraNear;
	uniform float cameraFar;

	

	void main() {
		vUv = uv;
		float x = (uv.x-0.5)*2.0;
		float y = (uv.y-0.5)*2.0;
		farPlanePosition = viewCenterFar;
		float distX = ( x * (tan(radians(xfov*0.5))*cameraFar));
		float distY = ( y * (tan(radians(yfov*0.5))*cameraFar));
		farPlanePosition -= right * distX;
		farPlanePosition += up * distY;

		nearPlanePosition = viewCenterNear;
		distX = ( x * (tan(radians(xfov*0.5))*cameraNear));
		distY = ( y * (tan(radians(yfov*0.5))*cameraNear));
		nearPlanePosition -= right * distX;
		nearPlanePosition += up * distY;

		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}`,

	fragmentShader: (ocean, atmosphere, sunColor, sampleDensityFunction, extraUniforms) => {

		
		//ocean = false;
		let code = /* glsl */`
		precision highp sampler3D;
		precision highp float;
		precision highp int;

		#include <packing>
		
		varying vec2 vUv;
		uniform sampler2D tDepth;
		uniform sampler3D perlinWorley;
		uniform sampler2D noise2D;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform float radius;
		uniform vec3 planetPosition;
		uniform vec3 nonPostCameraPosition;
		varying vec3 farPlanePosition;
		varying vec3 nearPlanePosition;
		uniform float ldf;
		uniform float time;
		uniform float numSamples;
		uniform float numSamplesToLight;

		uniform float lengthMultiplier;
		uniform float sunlight;
		
		uniform vec3 color;
		uniform float startRadius;
		uniform float endRadius;
		uniform float windSpeed;
		`;

		if(extraUniforms){
			Object.entries(extraUniforms).forEach(([key, value]) => {
				switch(typeof value){
					case "number": code+=`uniform float ${key};`; break;
					case "boolean": code+=`uniform bool ${key};`; break;
					default: {
						if(value.isData3DTexture){
							code+=`uniform sampler3D ${key};`; break;
						}
						else if(value.isDataArrayTexture){
							code+=`uniform sampler2DArray ${key};`; break;
						}
						else if(value.isTexture){
							code+=`uniform sampler2D ${key};`; break;
						}else if(value.isVector2){
							code+=`uniform vec2 ${key};`; break;
						}else if(value.isVector3){
							code+=`uniform vec3 ${key};`; break;
						}else if(value.isVector4){
							code+=`uniform vec4 ${key};`; break;
						}else if(value.isMatrix3){
							code+=`uniform mat3 ${key};`; break;
						}
					}
				}
			});
		}

		code += common(sampleDensityFunction);
		code += `
			
	
		
		void main() {
			float sunIntensity = 20.0;
			float depth = readDepth( tDepth, vUv );
			vec3 worldDir = normalize(farPlanePosition-nonPostCameraPosition);
			vec2 lonlat = vec2(atan(worldDir.y, worldDir.x),asin(worldDir.z));
			vec4 random = texture(noise2D, (vUv)*4.0);
			

			vec3 impact = mix(nearPlanePosition, farPlanePosition, depth);
			float lengthToEarthImpact = length(impact-nonPostCameraPosition);
			
			
			
			
			float cloudsDepthMeters = endRadius - startRadius;
			
			vec3 cloudImpactsStartIn = vec3(0.0);
			vec3 cloudImpactsStartOut = vec3(0.0);
			vec3 cloudImpactsEndIn = vec3(0.0);
			vec3 cloudImpactsEndOut = vec3(0.0);
			bool inEndHits;
			bool outEndHits;
			bool inStartHits;
			bool outStartHits;

			
			rayEllipsoidForwardSurfaceIntersection(planetPosition, nonPostCameraPosition, worldDir, a+endRadius, a+endRadius, b+endRadius, cloudImpactsEndIn, cloudImpactsEndOut, inEndHits, outEndHits);
			rayEllipsoidForwardSurfaceIntersection(planetPosition, nonPostCameraPosition, worldDir, a+startRadius, a+startRadius, b+startRadius, cloudImpactsStartIn, cloudImpactsStartOut, inStartHits, outStartHits);
			
			

			if(!inEndHits  && !outEndHits) {
				pc_fragColor = vec4(vec3(1.0),0.0);
				
				return; // no cloud hit
			}
			vec3 traverse1Entry;
			vec3 traverse1Exit;
			
			bool secondTraverse = false;
			vec3 traverse2Entry;
			vec3 traverse2Exit;

			
			if(inEndHits){ // camera outside clouds looking in
				
				traverse1Entry = cloudImpactsEndIn;
				if(inStartHits){ //ray penetrates inner radius
					traverse1Exit = cloudImpactsStartIn;
					
					secondTraverse = true;
					traverse2Entry = cloudImpactsStartOut;
					traverse2Exit = cloudImpactsEndOut;
				}else{ // ray doesn't penetrate clouds inner radius
					traverse1Exit = cloudImpactsEndOut;
					
				}
			}else { // camera inside outer radius

				if(inStartHits){ //camera outside inner radius looking in
					traverse1Entry = nonPostCameraPosition;
					traverse1Exit = cloudImpactsStartIn;
					secondTraverse = true;
					traverse2Entry = cloudImpactsStartOut;
					traverse2Exit = cloudImpactsEndOut;
					
				}
				else if(outStartHits){ // camera inside inner radius
					traverse1Entry = cloudImpactsStartOut;
					traverse1Exit = cloudImpactsEndOut;
				}else{
					traverse1Entry = nonPostCameraPosition;
					traverse1Exit = cloudImpactsEndOut;
				}
			}


			// depth check
			`;
		// ocean check
		if (ocean) {
			code += `
				if(depth>0.9999){
					
					vec2 rayEllipsoid = rayEllipsoidIntersection(planetPosition, nonPostCameraPosition, worldDir, a, a, b);
					float hasImpact = step(0.0, rayEllipsoid.x); // returns 1 if rayEllipsoid.x >= 0.0, else 0
					lengthToEarthImpact = mix(lengthToEarthImpact, rayEllipsoid.x, hasImpact);
					depth = mix(depth, 0.5, hasImpact);
				}
				`;
		}

		code += `

			if(depth<0.9999){
				if( lengthToEarthImpact < length(traverse1Entry-nonPostCameraPosition)) {
					pc_fragColor = vec4(vec3(1.0,0.0,0.0),0.0);
					return;
				}
				if( lengthToEarthImpact < length(traverse1Exit-nonPostCameraPosition)) {
					traverse1Exit = impact;
					secondTraverse = false;
				}
				if(secondTraverse && lengthToEarthImpact < length(traverse2Entry-nonPostCameraPosition)){
					secondTraverse = false;
					
				}
				if(secondTraverse && lengthToEarthImpact < length(traverse2Exit-nonPostCameraPosition)){
					traverse2Exit = nonPostCameraPosition;
				}
				
			}

			/// First deal with traverse1 (nearer to the camera) and only deal with traverse 2 if opacity is less than 100%
			

				
			float rand = random.b;//0.45+random.b*0.1;

			
			float density1 = 0.0;
			float density2 = 0.0;
			

			vec3 light1 = vec3(0.0);
			vec3 light2 = vec3(0.0);



			
			float length1 = length(traverse1Entry-traverse1Exit)/cloudsDepthMeters;
			//float numSamplesForLength = floor(numSamples*length1);
			float numSamplesLocal = floor(numSamples*length1+(random.r-0.5)*max(4.0,numSamples*0.5));
			for(float i = 0.0; i<numSamplesLocal; i++){
				float fraction = (i+rand)/numSamplesLocal;
				vec3 samplePosition = mix(traverse1Entry,traverse1Exit,fraction);
				vec3 samplePositionNormalized = normalize(samplePosition);
				
				
				float localDensity = sampleDensity(samplePosition);
				if(localDensity<=0.0) continue;
				
				
				density1 += localDensity;
				

				///// compute light to sample
				vec2 lonlatSample = vec2(atan(samplePositionNormalized.y, samplePositionNormalized.x),asin(samplePositionNormalized.z));
				float localRadius = getEarthRadiusAtLatitude(lonlatSample.y);
				vec3 lightExit = samplePositionNormalized*(endRadius+localRadius);

				float lengthToLight = length(lightExit-samplePosition)/cloudsDepthMeters;
				float densityToLight = 0.0;
				
				
				for(float j = 0.0; j<numSamplesToLight; j++){
					float fractionToLight = (j+0.5)/numSamplesToLight;
					
					vec3 secondSamplePosition = mix(samplePosition,lightExit,fractionToLight);
					float localDensityToLight = sampleDensity(secondSamplePosition);
					if(localDensityToLight<=0.0) continue;
					densityToLight +=localDensityToLight;
				}
				
				float biScatteringKappa = 0.75;
				float scatterCoef = 0.75;
				float lightToSample = multiOctaveBeer(sunlight*0.017,(densityToLight/numSamplesToLight)*lengthToLight, lengthMultiplier*100.0, 
					scatterCoef, biScatteringKappa, 1.0)/numSamplesToLight;
				lightToSample*= 25.0;

				float lengthToCamera = length(traverse1Entry-samplePosition)/cloudsDepthMeters;
				lightToSample = beer(lightToSample, (density1/(i+1.0))*lengthToCamera, lengthMultiplier*100.0)/numSamples;
				lightToSample*= 350.0;

				

				light1 += vec3(min(1.0,lightToSample*localDensity));
			}
			light1 = (light1/numSamplesLocal)*(numSamples*length1);
			density1/=numSamples;
			float length2 = 0.0;
			if(secondTraverse && density1<1.0){
				length2 = length(traverse2Entry-traverse2Exit)/cloudsDepthMeters;
				float numSamplesLocal = numSamples*length2+(random.r-0.5)*numSamples*0.5;
				for(float i = 0.0; i< numSamplesLocal; i++){
					float fraction = (i+rand)/numSamplesLocal;
					vec3 samplePosition = mix(traverse2Entry,traverse2Exit,fraction);
					vec3 samplePositionNormalized = normalize(samplePosition);
				
					float localDensity = sampleDensity(samplePosition);
					if(localDensity<=0.0) continue;

					density2 += localDensity;
					
				
					///// compute light to sample
					vec2 lonlatSample = vec2(atan(samplePositionNormalized.y, samplePositionNormalized.x),asin(samplePositionNormalized.z));
					float localRadius = getEarthRadiusAtLatitude(lonlatSample.y);
					vec3 lightExit = samplePositionNormalized*(endRadius+localRadius);

					float lengthToLight = length(lightExit-samplePosition)/cloudsDepthMeters;
					float densityToLight = 0.0;

					for(float j = 0.0; j<numSamplesToLight; j++){
						float fractionToLight = (j+0.5)/numSamplesToLight;
					
						vec3 secondSamplePosition = mix(samplePosition,lightExit,fractionToLight);
						
						
						float localDensityToLight = sampleDensity(secondSamplePosition);
						if(localDensityToLight<=0.0) continue;
						densityToLight +=localDensityToLight;
					}
					
					float biScatteringKappa = 0.75;
					float scatterCoef = 0.75;
					float lightToSample = multiOctaveBeer(sunlight*0.017,(densityToLight/numSamplesToLight)*lengthToLight, lengthMultiplier*100.0, 
					scatterCoef, biScatteringKappa, 1.0)/numSamplesToLight;
					lightToSample*= 25.0;

					float lengthToCamera = length(traverse2Entry-samplePosition)/cloudsDepthMeters;
					lightToSample = beer(lightToSample, (density2/(i+1.0))*lengthToCamera, lengthMultiplier*100.0)/numSamples;
					lightToSample*= 350.0;

					light2 += vec3(min(1.0,lightToSample));


					
				}
				density2/= numSamples;
			}
			density1 = min(1.0, density1*100.0);
			density2 = min(1.0, density2*100.0);
			
			float dotLight = 1.0;
			vec3 fullDarkColor = vec3(`+atmosphere.x.toFixed(2)+`,`+atmosphere.y.toFixed(2)+`,`+atmosphere.z.toFixed(2)+`) * dotLight*0.25;
			vec3 fullLightColor = color;

			pc_fragColor = blendBackToFront(vec4(light2, density2), vec4(light1, density1));
			pc_fragColor = vec4(fullDarkColor + pc_fragColor.rgb * (vec3(2.0) - fullDarkColor) / vec3(1.0),pc_fragColor.a);



	}`;




		return code;
	},

	fragmentShaderShadows: (ocean, atmosphere, sunColor, densityFunction, extraUniforms) => {
		let code = /* glsl */`
		

		precision highp sampler3D;
		precision highp float;
		precision highp int;

		#include <packing>
		
			varying vec2 vUv;
			uniform sampler2D tDepth;
			uniform sampler3D perlinWorley;
			uniform sampler2D noise2D;
			uniform float cameraNear;
			uniform float cameraFar;
			uniform float radius;
			uniform vec3 planetPosition;
			uniform vec3 nonPostCameraPosition;
			varying vec3 farPlanePosition;
			varying vec3 nearPlanePosition;
			uniform float ldf;
			uniform float time;
			uniform float numSamples;
			uniform float numSamplesToLight;

			uniform float lengthMultiplier;
			uniform float sunlight;
			uniform vec3 sunLocation;
			
			uniform vec3 color;
			uniform float startRadius;
            uniform float endRadius;
            uniform float windSpeed;
			`;

			if(extraUniforms){
				Object.entries(extraUniforms).forEach(([key, value]) => {
					switch(typeof value){
						case "number": code+=`uniform float ${key};`; break;
						case "boolean": code+=`uniform bool ${key};`; break;
						default: {
							if(value.isData3DTexture){
								code+=`uniform sampler3D ${key};`; break;
							}
							else if(value.isDataArrayTexture){
								code+=`uniform sampler2DArray ${key};`; break;
							}
							else if(value.isTexture){
								code+=`uniform sampler2D ${key};`; break;
							}else if(value.isVector2){
								code+=`uniform vec2 ${key};`; break;
							}else if(value.isVector3){
								code+=`uniform vec3 ${key};`; break;
							}else if(value.isVector4){
								code+=`uniform vec4 ${key};`; break;
							}else if(value.isMatrix3){
								code+=`uniform mat3 ${key};`; break;
							}
						}
					}
				});
			}


		code += common(densityFunction);
		code += `
			
		
			
			void main() {
				float sunIntensity = 20.0;
				float depth = readDepth( tDepth, vUv );
				vec3 worldDir = normalize(farPlanePosition-nonPostCameraPosition);
				vec2 lonlat = vec2(atan(worldDir.y, worldDir.x),asin(worldDir.z));
				vec4 random = texture(noise2D, (lonlat)*10.0);
				
				//worldDir = randomDirectionInCone(worldDir, 0.01, random.z, random.w);

				//worldDir= normalize(worldDir+rand1*0.4);
				vec3 impact = mix(nearPlanePosition, farPlanePosition, depth);
				float lengthToEarthImpact = length(impact-nonPostCameraPosition);
				
				//float localRadius = getEarthRadiusAtLatitude(lonlat.y);
			
				//float endRadiusMeters = (max(startRadius+0.001,endRadius)-1.0)*radius+localRadius;

				float cloudsDepthMeters = endRadius - startRadius;
				
				vec3 cloudImpactsStartIn = vec3(0.0);
				vec3 cloudImpactsStartOut = vec3(0.0);
				vec3 cloudImpactsEndIn = vec3(0.0);
				vec3 cloudImpactsEndOut = vec3(0.0);
				bool inEndHits;
				bool outEndHits;
				bool inStartHits;
				bool outStartHits;

				rayEllipsoidForwardSurfaceIntersection(planetPosition, nonPostCameraPosition, worldDir, a+endRadius, a+endRadius, b+endRadius, cloudImpactsEndIn, cloudImpactsEndOut, inEndHits, outEndHits);
				rayEllipsoidForwardSurfaceIntersection(planetPosition, nonPostCameraPosition, worldDir, a+startRadius, a+startRadius, b+startRadius, cloudImpactsStartIn, cloudImpactsStartOut, inStartHits, outStartHits);
			
				
				if(!inEndHits  && !outEndHits) { // doesn't even traverse clouds
					pc_fragColor = vec4(vec3(1.0),0.0);
					
					return; // no cloud hit
				}
				vec3 traverse1Entry;
				vec3 traverse1Exit;
				
				bool secondTraverse = false;
				vec3 traverse2Entry;
				vec3 traverse2Exit;

				
				if(inEndHits){ // camera outside clouds looking in
					
					traverse1Entry = cloudImpactsEndIn;
					if(inStartHits){ //ray penetrates inner radius
						traverse1Exit = cloudImpactsStartIn;
						
						secondTraverse = true;
						traverse2Entry = cloudImpactsStartOut;
						traverse2Exit = cloudImpactsEndOut;
					}else{ // ray doesn't penetrate clouds inner radius
						traverse1Exit = cloudImpactsEndOut;
						
					}
				}else { // camera inside outer radius

					if(inStartHits){ //camera outside inner radius looking in
						traverse1Entry = nonPostCameraPosition;
						traverse1Exit = cloudImpactsStartIn;
						secondTraverse = true;
						traverse2Entry = cloudImpactsStartOut;
						traverse2Exit = cloudImpactsEndOut;
						
					}
					else if(outStartHits){ // camera inside inner radius
						traverse1Entry = cloudImpactsStartOut;
						traverse1Exit = cloudImpactsEndOut;
					}else{
						traverse1Entry = nonPostCameraPosition;
						traverse1Exit = cloudImpactsEndOut;
					}
				}


				// depth check
				`;
		// ocean check
		if (ocean) {
			code += `
				if(depth>0.9999){
					
					vec2 rayEllipsoid = rayEllipsoidIntersection(planetPosition, nonPostCameraPosition, worldDir, a, a, b);
					float hasImpact = step(0.0, rayEllipsoid.x); // returns 1 if rayEllipsoid.x >= 0.0, else 0
					lengthToEarthImpact = mix(lengthToEarthImpact, rayEllipsoid.x, hasImpact);
					depth = mix(depth, 0.5, hasImpact);
				}
				`;
		}

		code += `

				if(depth<0.9999){ // hits object before clouds
					if( lengthToEarthImpact < length(traverse1Entry-nonPostCameraPosition)) {
						pc_fragColor = vec4(vec3(1.0),0.0);
						return;
					}
					if( lengthToEarthImpact < length(traverse1Exit-nonPostCameraPosition)) {
						traverse1Exit = impact;
						secondTraverse = false;
					}
					if(secondTraverse && lengthToEarthImpact < length(traverse2Entry-nonPostCameraPosition)){
						secondTraverse = false;
						
					}
					if(secondTraverse && lengthToEarthImpact < length(traverse2Exit-nonPostCameraPosition)){
						traverse2Exit = nonPostCameraPosition;
					}
					
				}

				/// First deal with traverse1 (nearer to the camera) and only deal with traverse 2 if opacity is less than 100%
				

					
				float rand =random.b;
				//float rand = 0.5;
				
				float density1 = 0.0;
				float density2 = 0.0;
				

				vec3 light1 = vec3(0.0);
				vec3 light2 = vec3(0.0);


				float length1 = length(traverse1Entry-traverse1Exit)/cloudsDepthMeters;
				float numSamplesLocal = numSamples*length1+(random.r-0.5)*numSamples*0.5;
				for(float i = 0.0; i<numSamplesLocal; i++){
					float fraction = (i+rand)/numSamplesLocal;
					vec3 samplePosition = mix(traverse1Entry,traverse1Exit,fraction);
					vec3 samplePositionNormalized = normalize(samplePosition);
					
					float localDensity = sampleDensity(samplePosition);
					if(localDensity<=0.0) continue;
					
					
					density1 += localDensity;
					
					
					///// compute light to sample
					float dotLight = dot(sunLocation, samplePositionNormalized);
					if(rayEllipsoidIntersection(planetPosition, samplePosition, sunLocation,a,a,b).x>=0.0) continue;
					vec3 lightExit = samplePosition + (sunLocation)*rayEllipsoidIntersection(planetPosition, samplePosition, sunLocation, a+endRadius, a+endRadius, b+endRadius).y;

					float lengthToLight = length(lightExit-samplePosition)/cloudsDepthMeters;
					float densityToLight = 0.0;
					for(float j = 0.0; j<numSamplesToLight; j++){
						float fractionToLight = (j+0.5)/numSamplesToLight;
						
						vec3 secondSamplePosition = mix(samplePosition,lightExit,fractionToLight);
						float localDensityToLight = sampleDensity(secondSamplePosition);
						if(localDensityToLight<=0.0) continue;
						densityToLight +=localDensityToLight;
					}
					float biScatteringKappa = 0.75;
					float scatterCoef = 0.75;
					float lightToSample = multiOctaveBeer(sunlight*2.0,(densityToLight/numSamplesToLight)*lengthToLight, lengthMultiplier*100.0, 
						scatterCoef, biScatteringKappa, dot(sunLocation, worldDir))/numSamplesToLight;
					lightToSample*= 25.0;

					float lengthToCamera = length(traverse1Entry-samplePosition)/cloudsDepthMeters;
					lightToSample = beer(lightToSample, (density1/(i+1.0))*lengthToCamera, lengthMultiplier*100.0)/numSamples;
					lightToSample*= 350.0;
						lightToSample*= localDensity;

					// light1 += vec3(min(1.0,`+Math.pow(atmosphere.x,0.2).toFixed(2)+`*lightToSample*max(dotLight,0.0)), min(1.0,`+Math.pow(atmosphere.y,0.2).toFixed(2)+`*lightToSample*pow(max(dotLight,0.0),1.2)), min(1.0,`+Math.pow(atmosphere.z,0.2).toFixed(2)+`*lightToSample*pow(max(dotLight,0.0),1.4)));
					light1 += vec3(min(1.0,pow(color.x,0.5)*lightToSample*max(dotLight,0.0)), min(1.0,pow(color.y,0.5)*lightToSample*pow(max(dotLight,0.0),1.2)), min(1.0,pow(color.z,0.5)*lightToSample*pow(max(dotLight,0.0),1.4)));
				}
				density1/=numSamples;
				float length2 = 0.0;
				if(secondTraverse && density1<1.0){
					length2 = length(traverse2Entry-traverse2Exit)/cloudsDepthMeters;
					float numSamplesLocal = numSamples*length2+(random.r-0.5)*numSamples*0.5;
					for(float i = 0.0; i< numSamplesLocal; i++){
						float fraction = (i+rand)/numSamplesLocal;
						vec3 samplePosition = mix(traverse2Entry,traverse2Exit,fraction);
						vec3 samplePositionNormalized = normalize(samplePosition);
					
						float localDensity = sampleDensity(samplePosition);
						if(localDensity<=0.0) continue;
						density2 += localDensity;
						
					
						///// compute light to sample
						float dotLight = dot(sunLocation, samplePositionNormalized);
						if(rayEllipsoidIntersection(planetPosition, samplePosition, sunLocation, a, a, b).x>=0.0) continue;
						vec3 lightExit = samplePosition + (sunLocation)*rayEllipsoidIntersection(planetPosition, samplePosition, sunLocation, a+endRadius, a+endRadius, b+endRadius).y;

						float lengthToLight = length(lightExit-samplePosition)/cloudsDepthMeters;
						float densityToLight = 0.0;
						

						for(float j = 0.0; j<numSamplesToLight; j++){
							float fractionToLight = (j+0.5)/numSamplesToLight;
						
							vec3 secondSamplePosition = mix(samplePosition,lightExit,fractionToLight);
							float localDensityToLight = sampleDensity(secondSamplePosition);
							if(localDensityToLight<=0.0) continue;
							densityToLight +=localDensityToLight;
						}
						

						float biScatteringKappa = 0.75;
						float scatterCoef = 0.75;
						float lightToSample = multiOctaveBeer(sunlight*2.0,(densityToLight/numSamplesToLight)*lengthToLight, lengthMultiplier*100.0, 
						scatterCoef, biScatteringKappa, dot(sunLocation, worldDir))/numSamplesToLight;
						lightToSample*= 25.0;

						float lengthToCamera = length(traverse2Entry-samplePosition)/cloudsDepthMeters;
						lightToSample = beer(lightToSample, (density2/(i+1.0))*lengthToCamera, lengthMultiplier*100.0)/numSamples;
						lightToSample*= 350.0;
						lightToSample*= localDensity;
						

						

						light2 += vec3(min(1.0,pow(color.x,0.5)*lightToSample*max(dotLight,0.0)), min(1.0,pow(color.y,0.5)*lightToSample*pow(max(dotLight,0.0),1.2)), min(1.0,pow(color.z,0.5)*lightToSample*pow(max(dotLight,0.0),1.4)));

					}
					density2/= numSamples;
				}
				density1 = min(1.0, density1*100.0);
				density2 = min(1.0, density2*100.0);
				
				float dotLight = clamp(dot(sunLocation, normalize(traverse1Entry+traverse1Exit))+0.5,0.0,1.0);
				vec3 fullDarkColor = vec3(`+Math.pow(atmosphere.x,0.5).toFixed(2)+`,`+Math.pow(atmosphere.y,0.5).toFixed(2)+`,`+Math.pow(atmosphere.z,0.5).toFixed(2)+`) * dotLight*0.5;
				vec3 fullLightColor = color;

				pc_fragColor = blendBackToFront(vec4(light2, density2), vec4(light1, density1));
				pc_fragColor = vec4(fullDarkColor + pc_fragColor.rgb * (vec3(2.0) - fullDarkColor) / vec3(1.0),pc_fragColor.a);

		}`;




		return code;
	},
	loadPerlinWorley : (url) => {
		return fetch(url)
        .then(response => response.arrayBuffer())
        .then(buffer => {
            const data = new Uint8Array(buffer);
            const texture = new THREE.Data3DTexture(data, 128, 128, 128);
            texture.format = THREE.RGFormat;
            texture.type = THREE.UnsignedByteType;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.wrapR = THREE.RepeatWrapping;
            texture.unpackAlignment = 1;
            texture.needsUpdate = true;
            return texture;
        })
        .catch(error => console.error('Error loading binary file:', error));
	},
	generatePerlinWorleyTexture: () => {

		function remap(x, a, b, c, d) {
			return (((x - a) / (b - a)) * (d - c)) + c;
		}
		const perlin = new Perlin(40);
		const worley3D = new Worley();
		const size = 128;
		const dataFloatW = new Float32Array(size * size * size);
		const dataFloatP = new Float32Array(size * size * size);
		const data = new Uint8Array(size * size * size*2);
		let i = 0;
		const vector = new THREE.Vector3();

		let minW = 10000;
		let maxW = -10000;
		let minP = 10000;
		let maxP = -10000;
		for (let z = 0; z < size; z++) {

			for (let y = 0; y < size; y++) {

				for (let x = 0; x < size; x++) {

					
					vector.set(x, y, z).divideScalar(size);
					let F = 10;
					let perlinFBM = perlin.noise((x/size)*F, (y/size)*F, (z/size)*F, F)  * 0.65
						+ perlin.noise((x/size) * F*2, (y/size) * F*2, (z/size)*F*2, F*2) * 0.25
						+ perlin.noise((x/size) * F*4, (y/size) * F*4, (z/size)*F*4, F*4) * 0.1; 
					perlinFBM+=0.5;
					//perlinFBM = Math.abs(perlinFBM * 2 - 1);


					
					let worleyFBM4 = 1-(worley3D.noise({ x: (x/size)*F, y: (y/size)*F, z: (z/size)*F }, Worley.EuclideanDistance, F , F , F )[0]*0.65+ 
					worley3D.noise({ x: (x/size)*F*2, y: (y/size)*F*2, z: (z/size)*F*2 }, Worley.EuclideanDistance, F*2 , F*2 , F*2 )[0]*0.25+
					worley3D.noise({ x: (x/size)*F*4, y: (y/size)*F*4, z: (z/size)*F*4 }, Worley.EuclideanDistance, F*4 , F*4 , F*4 )[0]*0.1);

					//let perlinWorley = remap(perlinFBM, 0, 1, worleyFBM4, 1);
					
					
					if(worleyFBM4<minW) minW = worleyFBM4;
					if(worleyFBM4>maxW) maxW = worleyFBM4;
					
					dataFloatW[i] = worleyFBM4;

					if(perlinFBM<minP) minP = perlinFBM;
					if(perlinFBM>maxP) maxP = perlinFBM;
					
					dataFloatP[i++] = perlinFBM;

				}

			}

		}

		
		for(let i = 0; i<size * size * size; i++){
			const perlinNorm = ((dataFloatP[i]/(maxP-minP))-minP);
			const worleyNorm = ((dataFloatW[i]/(maxP-minP))-minP);
			data[i*2] = remap(perlinNorm, 0, 1, worleyNorm, 1)*256;
			data[i*2+1] = worleyNorm*256;
		}

		saveDataToBinFile(data, "test.bin")

		const texture = new THREE.Data3DTexture(data, size, size, size);
		texture.format = THREE.RGFormat;
		texture.type = THREE.UnsignedByteType;
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.wrapR = THREE.RepeatWrapping;
		texture.unpackAlignment = 1;
		texture.needsUpdate = true;

		return Promise.resolve(texture);
		
	},
	generatePerlin3D: () => {

		function remap(x, a, b, c, d) {
			return (((x - a) / (b - a)) * (d - c)) + c;
		}
		const perlin = new Perlin(40);
		const worley3D = new Worley();
		const size = 128;
		const dataFloat = new Float32Array(size * size * size);
		const data = new Uint8Array(size * size * size);
		let i = 0;
		const vector = new THREE.Vector3();

		let min = 10000;
		let max = -10000;
		for (let z = 0; z < size; z++) {

			for (let y = 0; y < size; y++) {

				for (let x = 0; x < size; x++) {

					vector.set(x, y, z).divideScalar(size);

					let perlinFBM = perlin.noise((x + 0.1579) * 1, (y + 0.7432) * 1, (z + 0.4699) * 1, size) * 0.6
						+ perlin.noise((x + 0.1579) * 1.75, (y + 0.7432) * 1.75, (z + 0.4699) * 1.75, size) * 0.3
						+ perlin.noise((x + 0.1579) * 5.125, (y + 0.7432) * 5.125, (z + 0.4699) * 5.125, size) * 0.1;

				
					if(perlinFBM<min) min = perlinFBM;
					if(perlinFBM>max) max = perlinFBM;
					
					//clouds = 1 - (clouds * 2 - 1);
					//const cloud = Math.max(0.0, Math.min(1.0, remap(perlinFBM, clouds - 1, 1, 0, 1) + 0.5));
					dataFloat[i++] = perlinFBM;//(Math.pow(clouds,0.5)/2+0.5) * 256;

				}

			}

		}

		
		for(let i = 0; i<size * size * size; i++){
			data[i] = ((dataFloat[i]/(max-min))-min)*256;
		}

		//saveDataToBinFile(dataFloat, "test.bin")

		const texture = new THREE.Data3DTexture(data, size, size, size);
		texture.format = THREE.RedFormat;
		texture.type = THREE.UnsignedByteType;
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.wrapR = THREE.RepeatWrapping;
		texture.unpackAlignment = 1;
		texture.needsUpdate = true;

		return Promise.resolve(texture);
		
	}
}
export { CloudsShader };

function saveDataToBinFile(data, filename) {
	const blob = new Blob([data], { type: 'application/octet-stream' });
	const url = URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	URL.revokeObjectURL(url);
}

function remap(x, a, b, c, d) {
	return (((x - a) / (b - a)) * (d - c)) + c;
}

