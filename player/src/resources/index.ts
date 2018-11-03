import * as THREE from 'three';
import Proto from '../proto';
import RTC from '@/connector';
import { BufferGeometry, MeshStandardMaterial } from 'three';
export interface Material {
  color: string;
  textureID: number;
  emissive: string;
  metalness: number;
  side: number;
  type: number;
  roughness: number;
  wireframe: boolean;
  dashSize: number;
  gapSize: number;
  scale: number;
  flatShaded: boolean;
}
interface Response {
  texture: {
    data: ArrayBuffer;
    size: number;
  };
  parts: number;
  part: number;
  meshData: Uint8Array;
  material: Material;
  type: number;
  id: number;
}
class IncompleteTexture {
  private buffer: ArrayBuffer[];
  private items: number;
  constructor(a: Response) {
    this.buffer = new Array(a.parts);
    this.buffer[a.part] = a.texture.data;
    this.items = 1;
  }
  public full = () => {
    return this.buffer.length === this.items;
  }
  public add = (a: Response) => {
    if (typeof this.buffer[a.part] === 'undefined') {
      this.items++;
    }
    this.buffer[a.part] = a.texture.data;
  }
  public get = () => {
    return this.buffer;
  }
}
class IncompleteMesh {
  private buffer: Uint8Array[];
  private items: number;
  constructor(a: Response) {
    this.buffer = new Array(a.parts);
    this.buffer[a.part] = a.meshData;
    this.items = 1;
  }
  public full = () => {
    return this.buffer.length === this.items;
  }
  public add = (a: Response) => {
    if (typeof this.buffer[a.part] === 'undefined') {
      this.items++;
    }
    this.buffer[a.part] = a.meshData;
  }
  public get = () => {
    return this.buffer;
  }
}

export interface Mesh {
  vertices: number[];
  faces: Array<{ a: number; b: number; c: number }>;
}

export interface MeshCallback {
  cb: (m: Mesh, b: any) => void;
  bd: any;
}

export class Manager {
  private textures: Map<number, THREE.Texture>;
  private meshes: Map<number, Mesh>;
  private materials: Map<number, THREE.Material>;
  private incompleteTextures: Map<number, IncompleteTexture>;
  private incompleteMeshes: Map<number, IncompleteMesh>;
  private materialCallbacks: Map<number, Array<(m: THREE.Material) => void>>;
  private meshCallbacks: Map<number, MeshCallback[]>;
  private antiCallDuplicateMaterials: Map<number, boolean>;
  private antiCallDuplicateMeshes: Map<number, boolean>;
  private proto: Proto;
  private rtc: RTC;
  constructor(p: Proto, r: RTC) {
    this.materials = new Map<number, THREE.Material>();
    this.rtc = r;
    this.proto = p;
    this.materialCallbacks = new Map<
      number,
      Array<(m: THREE.Material) => void>
    >();
    this.meshCallbacks = new Map<number, MeshCallback[]>();
    this.textures = new Map<number, THREE.Texture>();
    this.antiCallDuplicateMaterials = new Map<number, boolean>();
    this.antiCallDuplicateMeshes = new Map<number, boolean>();
    this.incompleteTextures = new Map<number, IncompleteTexture>();
    this.incompleteMeshes = new Map<number, IncompleteMesh>();
    this.meshes = new Map<number, Mesh>();
  }
  public getTexture = (id: number) => {
    id = id || 0;
    if (this.textures.has(id)) {
      return this.textures.get(id);
    }
    const texture = new THREE.Texture();
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    this.textures.set(id, texture);
    this.rtc.sendMessage(
      this.proto
        .Response!.encode(
          this.proto.Response!.fromObject({
            id
          })
        )
        .finish()
    );
    return texture;
  }
  public getMesh = (
    id: number,
    bodyData: any,
    callback: (m: Mesh, bd: any) => void
  ) => {
    id = id || 0;
    if (this.meshes.has(id)) {
      callback(this.meshes.get(id)!, bodyData);
      return;
    }
    if (!this.meshCallbacks.has(id)) {
      this.meshCallbacks.set(id, []);
    }
    this.meshCallbacks.get(id)!.push({ cb: callback, bd: bodyData });
    if (!this.antiCallDuplicateMeshes.has(id)) {
      this.rtc.sendMessage(
        this.proto
          .Response!.encode(
            this.proto.Response!.fromObject({
              type: 3,
              id
            })
          )
          .finish()
      );
    }
    this.antiCallDuplicateMeshes.set(id, true);
  }
  public getMaterial = (id: number, callback: (m: THREE.Material) => void) => {
    id = id || 0;
    if (this.materials.has(id)) {
      callback(this.materials.get(id)!);
      return;
    }
    if (!this.materialCallbacks.has(id)) {
      this.materialCallbacks.set(id, []);
    }
    this.materialCallbacks.get(id)!.push(callback);
    if (!this.antiCallDuplicateMaterials.has(id)) {
      this.rtc.sendMessage(
        this.proto
          .Response!.encode(
            this.proto.Response!.fromObject({
              type: 2,
              id
            })
          )
          .finish()
      );
    }
    this.antiCallDuplicateMaterials.set(id, true);
  }
  public handleRequestResponse = (message: Response) => {
    switch (message.type) {
      case 4:
        if (!message.parts) {
          const mesh = (this.proto.Mesh!.decode(
            message.meshData
          ) as unknown) as Mesh;
          this.meshes.set(message.id, mesh);
          this.meshCallbacks.get(message.id)!.forEach((d) => d.cb(mesh, d.bd));
          this.meshCallbacks.delete(message.id);
        } else {
          if (this.incompleteMeshes.has(message.id)) {
            this.incompleteMeshes.get(message.id)!.add(message);
          } else {
            this.incompleteMeshes.set(message.id, new IncompleteMesh(message));
          }
          if (this.incompleteMeshes.get(message.id)!.full()) {
            const data = this.incompleteMeshes.get(message.id)!.get();
            let tlen: number = 0;
            data.forEach((buffer) => {
              tlen = tlen + buffer.byteLength;
            });
            const tmp = new Uint8Array(tlen);
            let offset: number = 0;
            data.forEach((buffer) => {
              tmp.set(new Uint8Array(buffer), offset);
              offset = offset + buffer.byteLength;
            });
            const mesh = (this.proto.Mesh!.decode(tmp) as unknown) as Mesh;
            this.meshes.set(message.id, mesh);
            this.meshCallbacks.get(message.id)!.forEach((d) => d.cb(mesh, d.bd));
            this.meshCallbacks.delete(message.id);
          }
        }
        break;
      case 3:
        const material = message.material;
        const matconfig = {
          map: material.textureID
            ? this.getTexture(material.textureID)
            : undefined,
          color: material.color,
          emissive: material.emissive,
          roughness: material.roughness,
          metalness: material.metalness,
          wireframe: !!material.wireframe,
          side: THREE.FrontSide,
          dashSize: material.dashSize,
          gapSize: material.gapSize,
          scale: material.scale
        };
        switch (material.side) {
          case 2:
            matconfig.side = THREE.DoubleSide;
            break;
          case 1:
            matconfig.side = THREE.BackSide;
            break;
        }
        let m: THREE.Material;
        switch (material.type) {
          case 5:
            m = new THREE.LineDashedMaterial(matconfig);
          case 4:
            m = new THREE.LineBasicMaterial(matconfig);
            break;
          case 3:
            m = new THREE.MeshStandardMaterial(matconfig);
            break;
          case 1:
            m = new THREE.MeshBasicMaterial(matconfig);
            break;
          default:
            m = new THREE.MeshLambertMaterial(matconfig);
        }
        m.flatShading = !!material.flatShaded;
        this.materials.set(message.id, m);
        this.materialCallbacks.get(message.id)!.forEach((callback) => {
          callback(m);
        });
        this.materialCallbacks.delete(message.id);
        break;
      default:
        if (!message.parts) {
          const imageBlob = new Blob([message.texture.data], {
            type: 'image/png'
          });
          createImageBitmap(imageBlob).then((imageBitmap) => {
            this.textures.get(message.id)!.image = imageBitmap;
            this.textures.get(message.id)!.needsUpdate = true;
          });
        } else {
          if (this.incompleteTextures.has(message.id)) {
            this.incompleteTextures.get(message.id)!.add(message);
          } else {
            this.incompleteTextures.set(
              message.id,
              new IncompleteTexture(message)
            );
          }
          if (this.incompleteTextures.get(message.id)!.full()) {
            const data = this.incompleteTextures.get(message.id)!.get();
            const imageBlob = new Blob(data, {
              type: 'image/png'
            });
            createImageBitmap(imageBlob).then((imageBitmap) => {
              this.textures.get(message.id)!.image = imageBitmap;
              this.textures.get(message.id)!.needsUpdate = true;
              this.incompleteTextures.delete(message.id);
            });
          }
        }
    }
  }
}
