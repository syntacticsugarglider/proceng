package world

import (
	"goworld/connector"
	"goworld/gen"
	"goworld/logging"
	"goworld/pb"
	"goworld/simulation"
	"sync"
	"time"

	"github.com/golang/protobuf/proto"
)

//World represents a world
type World struct {
	Chunks       map[int64]map[int64]map[int64]*Chunk
	LoadedChunks [][3]int64
	ChunkSize    int32
	UnitScale    float64
	Players      map[*connector.Peer]*Player
	Simulation   *simulation.Simulation
	Meshes       map[uint64]*pb.Mesh
}

//Chunk represents a Chunk
type Chunk struct {
	Entities     []*pb.Entity
	Players      map[*connector.Peer]*Player
	PlayersMutex *sync.Mutex
}

var playersMutex = new(sync.Mutex)

func (w *World) streamChunk(x int64, y int64, z int64) ([]byte, error) {
	c := w.loadChunk(x, y, z)
	return proto.Marshal(&pb.Response{
		Chunk: &pb.Chunk{
			Location: &pb.AbsoluteLocation{
				X: x,
				Y: y,
				Z: z,
			},
			Entities: c.Entities,
		},
		Type: pb.Response_CHUNK,
	})
}

//New returns a new World
func New() *World {
	w := new(World)
	w.Chunks = make(map[int64]map[int64]map[int64]*Chunk)
	w.Players = make(map[*connector.Peer]*Player)
	w.Meshes = make(map[uint64]*pb.Mesh)
	boxv, boxf := model.Box(1, 1, 1)
	w.Meshes[1] = &pb.Mesh{
		Vertices: boxv,
		Faces:    boxf,
	}
	w.ChunkSize = 500
	w.loadChunk(0, 0, 0)
	ticker := time.NewTicker(time.Minute * 5)
	go func() {
		for {
			select {
			case <-ticker.C:
				invalidateCache()
			}
		}
	}()
	w.Simulation = simulation.InitializeSimulation()
	simtick := time.NewTicker(time.Second / 60)
	w.CreateEntity()
	go func() {
		for {
			select {
			case <-simtick.C:
				w.Simulation.Step()
				w.sendUpdates()
			}
		}
	}()
	return w
}

func (w *World) assignChunk(x int64, y int64, z int64, c *Chunk) {
	if w.Chunks[x] == nil {
		w.Chunks[x] = make(map[int64]map[int64]*Chunk)
	}
	if w.Chunks[x][y] == nil {
		w.Chunks[x][y] = make(map[int64]*Chunk)
	}
	w.Chunks[x][y][z] = c
}

func (w *World) loadChunk(x int64, y int64, z int64) *Chunk {
	if w.Chunks[x] == nil {
		w.Chunks[x] = make(map[int64]map[int64]*Chunk)
	}
	if w.Chunks[x][y] == nil {
		w.Chunks[x][y] = make(map[int64]*Chunk)
	}
	if w.Chunks[x][y][z] == nil {
		w.createChunk(x, y, z)
	}
	w.LoadedChunks = append(w.LoadedChunks, [3]int64{x, y, z})
	return w.Chunks[x][y][z]
}

func (c *Chunk) addEntity(e *pb.Entity) {
	c.Entities = append(c.Entities, e)
}

func (w *World) createChunk(x int64, y int64, z int64) {
	c := new(Chunk)
	c.PlayersMutex = &sync.Mutex{}
	c.Players = make(map[*connector.Peer]*Player)
	w.assignChunk(x, y, z, c)
}

func (w *World) parseUpdate(d []byte, p *Player) {
	u := new(pb.Update)
	proto.Unmarshal(d, u)
}

func (w *World) parseRequest(d []byte, p *Player) {
	m := new(pb.Request)
	err := proto.Unmarshal(d, m)
	if err != nil {
		logging.Error(err)
		return
	}
	if m.Type == pb.Request_TEXTURE {
		for _, m := range w.streamTexture(m.Id) {
			p.Peer.SendMessage(m)
		}
		return
	}
	if m.Type == pb.Request_MATERIAL {
		p.Peer.SendMessage(w.streamMaterial(m.Id))
		return
	}
	if m.Type == pb.Request_MESH {
		for _, m := range w.streamMesh(m.Id, w.Meshes) {
			p.Peer.SendMessage(m)
		}
		return
	}
}

//AddPlayer adds a new player to the world
func (w *World) AddPlayer(p *connector.Peer) {
	logging.L("Player connected")
	k := NewPlayer(p)
	k.Peer = p
	go func() {
		playersMutex.Lock()
		defer playersMutex.Unlock()
		w.Players[p] = k
	}()
	k.AbsoluteX = 0
	k.AbsoluteY = 0
	k.AbsoluteZ = 0
	c := w.loadChunk(0, 0, 0)
	c.PlayersMutex.Lock()
	defer c.PlayersMutex.Unlock()
	c.Players[k.Peer] = k
	l, err := w.streamChunk(0, 0, 0)
	if err == nil {
		p.SendMessage(l)
	} else {
		logging.Error(err)
	}
	p.OnMessage(func(d []byte) {
		w.parseRequest(d, k)
	})
	p.OnUpdate(func(d []byte) {
		w.parseUpdate(d, k)
	})
}

//RemovePlayer adds a new player to the world
func (w *World) RemovePlayer(p *connector.Peer) {
	logging.L("Player disconnected")
	go func() {
		playersMutex.Lock()
		defer playersMutex.Unlock()
		delete(w.Chunks[w.Players[p].AbsoluteX][w.Players[p].AbsoluteY][w.Players[p].AbsoluteZ].Players, w.Players[p].Peer)
		delete(w.Players, p)
	}()
}

//CreateEntity creates an entity
func (w *World) CreateEntity() {
	p := &pb.Entity{
		Location:           &pb.RelativeLocation{X: 0, Y: 0, Z: 0},
		Velocity:           &pb.Velocity{X: 0, Y: 0, Z: 0},
		Rotation:           &pb.Rotation{X: 0, Y: 0, Z: 0, W: 0},
		RotationalVelocity: &pb.Velocity{X: 0, Y: 0, Z: 0},
		Bodies: []*pb.Body{{
			MeshID:      1,
			Material:    1,
			FlatNormals: true,
		}},
		Lights: []*pb.Light{{
			Position: &pb.RelativeLocation{
				X: 2,
				Y: -2,
				Z: 2,
			},
			Intensity: 0.6,
			Type:      pb.Light_POINT_LIGHT,
		}, {
			Position: &pb.RelativeLocation{
				X: -2,
				Y: -2,
				Z: 2,
			},
			Intensity: 0.8,
			Type:      pb.Light_POINT_LIGHT,
		}, {
			Type:      pb.Light_AMBIENT_LIGHT,
			Intensity: 0.25,
		}},
	}
	w.Chunks[0][0][0].addEntity(p)
	w.Simulation.AddFromVEnt(p)
}

func (w *World) sendUpdates() {
	for _, c := range w.LoadedChunks {
		chunk := w.Chunks[c[0]][c[1]][c[2]]
		updates := [][]byte{}
		for _, e := range chunk.Entities {
			b, _ := proto.Marshal(&pb.Update{
				Position: e.Location,
				Rotation: e.Rotation,
			})
			updates = append(updates, b)
		}
		for _, p := range chunk.Players {
			for _, u := range updates {
				go func(k []byte) {
					p.Peer.SendUpdate(k)
				}(u)
			}
		}
	}
}
