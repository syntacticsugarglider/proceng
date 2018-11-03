import * as protobuf from 'protobufjs';

export default class Proto {
  public Request: protobuf.Type | undefined;
  public Update: protobuf.Type | undefined;
  public Response: protobuf.Type | undefined;
  public Mesh: protobuf.Type | undefined;
  private root: protobuf.Root | undefined;
  constructor(ready: () => void) {
    protobuf.load(require('../../../pb/pb.proto'), (err, root) => {
      if (!err) {
        this.root = root!;
        this.Request = this.root!.lookupType('pb.Request');
        this.Response = this.root!.lookupType('pb.Response');
        this.Update = this.root!.lookupType('pb.Update');
        this.Mesh = this.root!.lookupType('pb.Mesh');
        ready();
      }
    });
  }
}
