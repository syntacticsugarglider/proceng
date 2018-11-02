import * as resources from '../resources';
import Proto from '../proto';
import RTC from '../connector';
import * as THREE from 'three';
import { assignUVs, Update } from './util';

interface Chunk {
  entities: any[];
}
class Chunk {}

export default class World {
  public resources: resources.Manager;
  private chunks: Map<number, Map<number, Map<number, Chunk>>>;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private currentLocation: [number, number, number];
  private proto: Proto;
  private rtc: RTC;
  constructor(s: THREE.Scene, c: THREE.Camera, p: Proto, r: RTC) {
    this.chunks = new Map<number, Map<number, Map<number, Chunk>>>();
    this.currentLocation = [0, 0, 0];
    this.scene = s;
    this.proto = p;
    this.rtc = r;
    this.camera = c;
    this.resources = new resources.Manager(this.proto, this.rtc);
  }
  public assignChunk = (c: any) => {
    const x = c.location.Y || 0;
    const y = c.location.Y || 0;
    const z = c.location.Z || 0;
    if (!this.chunks.has(x)) {
      this.chunks.set(x, new Map<number, Map<number, Chunk>>());
    }
    const xs = this.chunks.get(x)!;
    if (!xs.has(y)) {
      xs.set(y, new Map<number, Chunk>());
    }
    xs.get(y)!.set(z, c);
    if (
      x === this.currentLocation[0] &&
      y === this.currentLocation[1] &&
      z === this.currentLocation[2]
    ) {
      this.updateScene();
    }
  }
  public setLocation = (x: number, y: number, z: number) => {
    this.currentLocation = [x, y, z];
  }
  public retrieveChunk = (x: number, y: number, z: number) => {
    if (!this.chunks.has(x)) {
      this.chunks.set(x, new Map<number, Map<number, Chunk>>());
    }
    const xs = this.chunks.get(x)!;
    if (!xs.has(y)) {
      xs.set(y, new Map<number, Chunk>());
    }
    const ys = xs.get(y)!;
    if (!ys.has(z)) {
      ys.set(z, new Chunk());
    }
    return ys.get(z);
  }
  public retrieveCurrentChunk = () => {
    return this.retrieveChunk(
      this.currentLocation[0],
      this.currentLocation[1],
      this.currentLocation[2]
    );
  }
  public update = (u: Update) => {};
  private updateScene = () => {
    const c = this.retrieveCurrentChunk();
    c!.entities.forEach((entity) => {
      const e = new THREE.Object3D();
      entity.bodies.forEach((body: any) => {
        let geometry: THREE.BufferGeometry;
        switch (body.type) {
          case 1:
            geometry = new THREE.BoxBufferGeometry(...body.vertices);
            break;
          case 2:
            geometry = new THREE.SphereBufferGeometry(...body.vertices);
            break;
          default:
            const pregeo = new THREE.Geometry();
            for (let i = 0; i < body.vertices.length; i += 3) {
              pregeo.vertices.push(
                new THREE.Vector3(
                  body.vertices[i],
                  body.vertices[i + 1],
                  body.vertices[i + 2]
                )
              );
            }
            const uvs: any[][] = [[]];
            let hasUvs = true;
            if (body.faces && body.faces.length > 0) {
              body.faces.forEach((face: any) => {
                pregeo.faces.push(new THREE.Face3(face.a, face.b, face.c));
                if (face.uvs && face.uvs.length > 0) {
                  const k = [];
                  for (let i = 0; i < face.uvs.length; i += 2) {
                    k.push(new THREE.Vector2(face.uvs[i], face.uvs[i + 1]));
                  }
                  uvs[0].push(k);
                } else {
                  hasUvs = false;
                }
              });
            } else {
              return;
            }
            if (hasUvs) {
              pregeo.faceVertexUvs = uvs;
              pregeo.uvsNeedUpdate = true;
            } else {
              assignUVs(pregeo);
            }
            pregeo.computeFaceNormals();
            if (body.flatNormals) {
              pregeo.computeFlatVertexNormals();
            } else {
              pregeo.computeVertexNormals();
            }
            geometry = new THREE.BufferGeometry().fromGeometry(pregeo);
        }
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({ color: '#fff' })
        );
        if (body.offset) {
          mesh.position.x = body.offset.x;
          mesh.position.y = body.offset.y;
          mesh.position.z = body.offset.z;
        }
        if (body.rotation) {
          mesh.rotation.x = body.rotation.x;
          mesh.rotation.y = body.rotation.y;
          mesh.rotation.z = body.rotation.z;
        }
        this.resources.getMaterial(body.material, (m: THREE.Material) => {
          mesh.material = m;
        });
        e.add(mesh);
      });
      if (entity.lights) {
        entity.lights.forEach((light: any) => {
          let l: THREE.Light;
          switch (light.type) {
            case 3:
              l = new THREE.AmbientLight(light.color, light.intensity);
              break;
            default:
              l = new THREE.PointLight(
                light.color,
                light.intensity,
                light.distance,
                light.decay
              );
          }
          if (light.position) {
            l.position.x = light.position.x;
            l.position.y = light.position.y;
            l.position.z = light.position.z;
          }
          if (light.rotation) {
            l.rotation.x = light.rotation.x;
            l.rotation.y = light.rotation.y;
            l.rotation.z = light.rotation.z;
          }
          e.add(l);
        });
      }
      if (entity.location) {
        e.position.x = entity.location.x;
        e.position.y = entity.location.y;
        e.position.z = entity.location.z;
      }
      if (entity.rotation) {
        e.rotation.x = entity.rotation.x;
        e.rotation.y = entity.rotation.y;
        e.rotation.z = entity.rotation.z;
      }
      this.scene.add(e);
    });
  }
}
