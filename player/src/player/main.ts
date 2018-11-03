import * as THREE from 'three';

import RTC from '../connector';

import World from '../world';

import * as resources from '../resources';
import Proto from '../proto';
const PI_2 = Math.PI / 2;

export default class Player {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private world: World | undefined;
  private cameraPitch: THREE.Object3D;
  private cameraYaw: THREE.Object3D;
  private locked: boolean;
  private lookchange: boolean;
  private inputs: any;
  private atmoColor: THREE.Color;
  private atmoNear: number;
  private atmoFar: number;
  private atmo: boolean;
  private proto: Proto;
  private connection: RTC | undefined;
  constructor() {
    this.scene = new THREE.Scene();
    this.atmoColor = new THREE.Color(0xffffff);
    this.atmoNear = 0.0025;
    this.atmoFar = 200;
    this.atmo = false;

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.cameraPitch = new THREE.Object3D();
    this.cameraPitch.add(this.camera);
    this.cameraYaw = new THREE.Object3D();
    this.cameraYaw.add(this.cameraPitch);
    this.cameraYaw.position.z = 5;
    this.locked = false;
    this.lookchange = false;
    this.scene.add(this.cameraYaw);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true
    });
    this.inputs = {};
    window.onkeyup = (e) => {
      this.inputs[e.keyCode] = false;
    };
    window.onkeydown = (e) => {
      this.inputs[e.keyCode] = true;
    };
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', this.onWindowResize, false);
    document.body.appendChild(this.renderer.domElement);
    this.renderer.domElement.onclick = () => {
      (this.renderer.domElement as any).requestPointerLock();
      document.addEventListener('pointerlockchange', this.pointerLockChange);
      document.addEventListener('mousemove', this.mouseMove);
    };
    this.proto = new Proto(() => {
      this.connection = new RTC();
      this.world = new World(
        this.scene,
        this.camera,
        this.proto,
        this.connection
      );
      this.world.setLocation(0, 0, 0);
      this.connection.onReady(this.connect);
    });
  }
  public setAtmo = (e: boolean) => {
    this.atmo = e;
    if (e) {
      this.scene.fog = new THREE.Fog(
        this.atmoColor.getHex(),
        this.atmoNear,
        this.atmoFar
      );
    } else {
      this.scene.fog = new THREE.Fog(this.atmoColor.getHex(), this.atmoNear, 0);
    }
  }
  private connect = (descriptor: string) => {
    fetch(`http://${window.location.hostname}:8081/${descriptor}`)
      .then((rawdata) => {
        return rawdata.text();
      })
      .then((data) => {
        this.connection!.onMessage(this.recvData);
        this.connection!.onUpdate(this.recvUpdate);
        this.connection!.startSession(data);
      });
  }
  private animate = () => {
    requestAnimationFrame(this.animate);
    if (this.inputs[87]) {
      this.cameraYaw.translateZ(-0.1);
    }
    if (this.inputs[83]) {
      this.cameraYaw.translateZ(0.1);
    }
    if (this.inputs[65]) {
      this.cameraYaw.translateX(-0.1);
    }
    if (this.inputs[68]) {
      this.cameraYaw.translateX(0.1);
    }
    if (this.inputs[32]) {
      this.cameraYaw.translateY(0.1);
    }
    if (this.inputs[16]) {
      this.cameraYaw.translateY(-0.1);
    }
    if (this.lookchange) {
      this.connection!.sendUpdate(
        this.proto
          .Update!.encode(
            this.proto.Update!.fromObject({
              rotation: {
                x: this.cameraPitch.rotation.x,
                y: this.cameraYaw.rotation.y,
                z: 0
              }
            })
          )
          .finish()
      );
      this.lookchange = false;
    }
    this.renderer.render(this.scene, this.camera);
  }
  private recvData = (message: MessageEvent) => {
    const resp: any = this.proto.Response!.decode(new Uint8Array(message.data));
    console.log(resp);
    switch (resp.type) {
      case 2:
        this.world!.assignChunk(resp.chunk);
        this.animate();
        break;
      default:
        this.world!.resources.handleRequestResponse(resp);
    }
  }
  private recvUpdate = (message: MessageEvent) => {
    const ud: any = this.proto.Update!.decode(new Uint8Array(message.data));
    this.world!.update(ud);
  }
  private mouseMove = (e: MouseEvent) => {
    if (!this.locked) {
      return;
    }
    if (e.movementX !== 0 || e.movementY !== 0) {
      this.lookchange = true;
    }
    this.cameraYaw.rotation.y -= e.movementX * 0.003;
    this.cameraPitch.rotation.x -= e.movementY * 0.003;
    this.cameraPitch.rotation.x = Math.max(
      -PI_2,
      Math.min(PI_2, this.cameraPitch.rotation.x)
    );
  }
  private pointerLockChange = (e: any) => {
    this.locked =
      (document as any).pointerLockElement === this.renderer.domElement;
  }
  private onWindowResize = (e: any) => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
