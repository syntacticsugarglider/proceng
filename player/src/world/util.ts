import * as THREE from 'three';

export function cartesian2polar(position: THREE.Vector3) {
  const r = Math.sqrt(
    position.x * position.x + position.z * position.z + position.y * position.y
  );
  return {
    r: r || undefined,
    phi: Math.acos(position.y / r),
    theta: Math.atan2(position.z, position.x)
  };
}
export function polar2canvas(polarPoint: {
  r: number | undefined;
  phi: number;
  theta: number;
}) {
  return {
    y: polarPoint.phi / Math.PI,
    x: (polarPoint.theta + Math.PI) / (2 * Math.PI)
  };
}
export function assignUVs(geometry: THREE.Geometry) {
  const polarVertices = geometry.vertices.map(cartesian2polar);

  geometry.faceVertexUvs[0] = [];
  geometry.faces.forEach(function(face: any) {
    const uvs = [];
    const ids = ['a', 'b', 'c'];

    for (let i = 0; i < ids.length; i++) {
      const vertexIndex = face[ids[i]];
      let vertex = polarVertices[vertexIndex];
      if (vertex.theta === 0 && (vertex.phi === 0 || vertex.phi === Math.PI)) {
        const alignedVertice = vertex.phi === 0 ? face.b : face.a;

        vertex = {
          r: undefined,
          phi: vertex.phi,
          theta: polarVertices[alignedVertice].theta
        };
      }
      if (
        vertex.theta === Math.PI &&
        cartesian2polar(face.normal).theta < Math.PI / 2
      ) {
        vertex.theta = -Math.PI;
      }

      const canvasPoint = polar2canvas(vertex);

      uvs.push(new THREE.Vector2(1 - canvasPoint.x, 1 - canvasPoint.y));
    }

    geometry.faceVertexUvs[0].push(uvs);
  });
  geometry.uvsNeedUpdate = true;
}
export interface Update {
  type: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
}
