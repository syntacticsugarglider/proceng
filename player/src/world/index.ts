import * as resources from '../resources';
import Proto from '../proto';
import RTC from '../connector';
import * as THREE from 'three';
import { assignUVs, Update } from './util';

interface Chunk {
  entities: any[];
  location: {
    x: number;
    y: number;
    z: number;
  };
}
interface Entity {}
interface EData {
  velocity: {
    x: number;
    y: number;
    z: number;
  };
  angularVelocity: {
    x: number;
    y: number;
    z: number;
  };
}
class Chunk {}
class EData {
  public velocity: {
    x: number;
    y: number;
    z: number;
  };
  public angularVelocity: {
    x: number;
    y: number;
    z: number;
  };
  constructor() {
    this.velocity = {
      x: 0,
      y: 0,
      z: 0
    };
    this.angularVelocity = {
      x: 0,
      y: 0,
      z: 0
    };
  }
}

export default class World {
  public resources: resources.Manager;
  private chunks: Map<
    number,
    Map<number, Map<number, [Chunk, Map<number, [Entity, EData]>]>>
  >;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private currentLocation: [number, number, number];
  private proto: Proto;
  private rtc: RTC;
  constructor(s: THREE.Scene, c: THREE.Camera, p: Proto, r: RTC) {
    this.chunks = new Map<
      number,
      Map<number, Map<number, [Chunk, Map<number, [Entity, EData]>]>>
    >();
    this.currentLocation = [0, 0, 0];
    this.scene = s;
    this.proto = p;
    this.rtc = r;
    this.camera = c;
    this.resources = new resources.Manager(this.proto, this.rtc);
  }
  public animate(delta: number) {
    const ents = this.retrieveCurrentChunk()![1];
    ents.forEach((ent) => {
      (ent[0] as THREE.Object3D).position.x += ent[1].velocity.x * delta;
      (ent[0] as THREE.Object3D).position.y += ent[1].velocity.y * delta;
      (ent[0] as THREE.Object3D).position.z += ent[1].velocity.z * delta;
      (ent[0] as THREE.Object3D).rotation.x += ent[1].angularVelocity.x * delta;
      (ent[0] as THREE.Object3D).rotation.y += ent[1].angularVelocity.y * delta;
      (ent[0] as THREE.Object3D).rotation.z += ent[1].angularVelocity.z * delta;
    });
  }
  public assignChunk = (c: Chunk) => {
    const x = c.location.x || 0;
    const y = c.location.y || 0;
    const z = c.location.z || 0;
    if (!this.chunks.has(x)) {
      this.chunks.set(
        x,
        new Map<number, Map<number, [Chunk, Map<number, [Entity, EData]>]>>()
      );
    }
    const xs = this.chunks.get(x)!;
    if (!xs.has(y)) {
      xs.set(y, new Map<number, [Chunk, Map<number, [Entity, EData]>]>());
    }
    xs.get(y)!.set(z, [c, new Map<number, [Entity, EData]>()]);
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
      this.chunks.set(
        x,
        new Map<number, Map<number, [Chunk, Map<number, [Entity, EData]>]>>()
      );
    }
    const xs = this.chunks.get(x)!;
    if (!xs.has(y)) {
      xs.set(y, new Map<number, [Chunk, Map<number, [Entity, EData]>]>());
    }
    const ys = xs.get(y)!;
    if (!ys.has(z)) {
      ys.set(z, [new Chunk(), new Map<number, [Entity, EData]>()]);
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
  public update = (u: Update) => {
    const ent = this.retrieveCurrentChunk()![1].get(
      u.entity.id || 0
    )![0] as THREE.Object3D;
    const data = this.retrieveCurrentChunk()![1].get(u.entity.id || 0)![1];
    ent.position.x = u.position.x;
    ent.position.y = u.position.y;
    ent.position.z = u.position.z;
    ent.rotation.setFromQuaternion(
      new THREE.Quaternion(
        u.rotation.x,
        u.rotation.y,
        u.rotation.z,
        u.rotation.w
      )
    );
    data.velocity.x = u.velocity.x;
    data.velocity.y = u.velocity.y;
    data.velocity.z = u.velocity.z;
    data.angularVelocity.x = u.rotationalVelocity.x;
    data.angularVelocity.y = u.rotationalVelocity.y;
    data.angularVelocity.z = u.rotationalVelocity.z;
  }
  private updateScene = () => {
    const c = this.retrieveCurrentChunk();
    c![0].entities.forEach((entity) => {
      const e = new THREE.Object3D();
      entity.bodies.forEach((body: any) => {
        let geometry: THREE.BufferGeometry;
        switch (body.type) {
          case 1:
            geometry = new THREE.BoxBufferGeometry(...body.data);
            break;
          case 2:
            geometry = new THREE.SphereBufferGeometry(...body.data);
            break;
          default:
            this.resources.getMesh(
              body.meshID,
              body,
              (m: resources.Mesh, body: any) => {
                const pregeo = new THREE.Geometry();
                for (let i = 0; i < m.vertices.length; i += 3) {
                  pregeo.vertices.push(
                    new THREE.Vector3(
                      m.vertices[i],
                      m.vertices[i + 1],
                      m.vertices[i + 2]
                    )
                  );
                }
                const uvs: any[][] = [[]];
                let hasUvs = true;
                if (m.faces && m.faces.length > 0) {
                  m.faces.forEach((face: any) => {
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
                  mesh.setRotationFromQuaternion(
                    new THREE.Quaternion(
                      body.rotation.x,
                      body.rotation.y,
                      body.rotation.z,
                      body.rotation.w
                    )
                  );
                }
                this.resources.getMaterial(
                  body.material,
                  (m: THREE.Material) => {
                    mesh.material = m;
                  }
                );
                e.add(mesh);
              }
            );
            return;
        }
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({ color: '#000' })
        );
        if (body.offset) {
          mesh.position.x = body.offset.x;
          mesh.position.y = body.offset.y;
          mesh.position.z = body.offset.z;
        }
        if (body.rotation) {
          mesh.setRotationFromQuaternion(
            new THREE.Quaternion(
              body.rotation.x,
              body.rotation.y,
              body.rotation.z,
              body.rotation.w
            )
          );
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
            l.setRotationFromQuaternion(
              new THREE.Quaternion(
                light.rotation.x,
                light.rotation.y,
                light.rotation.z,
                light.rotation.w
              )
            );
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
        e.setRotationFromQuaternion(
          new THREE.Quaternion(
            entity.rotation.x,
            entity.rotation.y,
            entity.rotation.z,
            entity.rotation.w
          )
        );
      }
      c![1].set(entity.id || 0, [e, new EData()]);
      this.scene.add(e);
    });
  }
}
