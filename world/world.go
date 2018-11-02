package world

import (
	"goworld/assets"
	"goworld/connector"
	"goworld/gen"
	"goworld/logging"
	"goworld/pb"
	"goworld/simulation"
	"log"
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
}

//Chunk represents a Chunk
type Chunk struct {
	Entities  []*pb.Entity
	SEntities []*simulation.Entity
	Players   map[*connector.Peer]*Player
}

var playersMutex = new(sync.Mutex)

//Voxel creates a voxel
func (w *World) Voxel() *pb.Entity {
	v, f := model.Cylinder()
	return &pb.Entity{
		Location: &pb.RelativeLocation{
			X: 0,
			Y: 0,
			Z: 0,
		},
		Bodies: []*pb.Body{{
			Type:        pb.Body_MESH,
			Vertices:    v,
			Faces:       f,
			Material:    assets.Material.Stone,
			FlatNormals: true,
		}},
		Lights: []*pb.Light{{
			Color:     "#fff",
			Intensity: 1,
			Position: &pb.RelativeLocation{
				X: -3,
				Y: 10,
				Z: 10,
			},
		}, {
			Type:      pb.Light_AMBIENT_LIGHT,
			Color:     "#fff",
			Intensity: 0.5,
		}},
	}
}

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
	w.ChunkSize = 500
	w.loadChunk(0, 0, 0).addEntity(w.Voxel())
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
	go func() {
		for {
			select {
			case <-simtick.C:
				w.Simulation.Step()
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
	w.assignChunk(x, y, z, c)
}

func (w *World) parseUpdate(d []byte, p *Player) {
	u := new(pb.Update)
	proto.Unmarshal(d, u)
	log.Println(u)
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
