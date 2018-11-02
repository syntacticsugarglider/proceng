import { Message } from 'protobufjs';

export default class RTC {
  private pc: RTCPeerConnection;
  private sc: RTCDataChannel;
  private uc: RTCDataChannel;
  private sd: string;
  private readyCallback: (descriptor: string) => void;
  constructor() {
    this.pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
        }
      ]
    });
    this.sd = '';
    this.readyCallback = (descriptor: string) => {};
    this.sc = this.pc.createDataChannel('data');
    this.uc = this.pc.createDataChannel('ud');
    this.sc.onmessage = (e) => {};
    this.uc.onmessage = (e) => {};
    this.pc.onicecandidate = (event) => {
      if (event.candidate === null) {
        this.sd = btoa(this.pc.localDescription!.sdp);
        this.readyCallback(this.sd);
      }
    };
    this.pc.onnegotiationneeded = (e) =>
      this.pc.createOffer().then((d) => this.pc.setLocalDescription(d));
  }
  public sendMessage = (message: Uint8Array) => {
    this.sc.send(message);
  }
  public sendUpdate = (message: Uint8Array) => {
    this.uc.send(message);
  }
  public startSession = (descriptor: string) => {
    try {
      this.pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: atob(descriptor) })
      );
    } catch (e) {
      alert(e);
    }
  }
  public onReady = (callback: (descriptor: string) => void) => {
    this.readyCallback = callback;
  }
  public onMessage = (callback: (message: MessageEvent) => void) => {
    this.sc.onmessage = callback;
  }
  public onUpdate = (callback: (message: MessageEvent) => void) => {
    this.uc.onmessage = callback;
  }
}
