package world

import (
	"fmt"
	"goworld/assets"
	"goworld/connector"
	"goworld/logging"
	"goworld/pb"
	"io/ioutil"
	"path"
	"sync"
	"time"

	"github.com/golang/protobuf/proto"
)

func byteCountBinary(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(b)/float64(div), "KMGTPE"[exp])
}

var unloadAge = float64(30)

type cacheData struct {
	LastRead time.Time
	Data     []byte
}

var cacheSize = int64(0)

var pathCache = map[string]*cacheData{}
var cacheMutex = new(sync.Mutex)

func invalidateCache() {
	cacheMutex.Lock()
	clen := len(pathCache)
	mSize := int64(0)
	defer cacheMutex.Unlock()
	cleaned := 0
	for k, v := range pathCache {
		if time.Since(v.LastRead).Minutes() > unloadAge {
			mSize += int64(len(v.Data))
			delete(pathCache, k)
			cleaned++
		}
	}
	logging.L(fmt.Sprintf("Cache invalidation pruned %d (%s) of %d (%s) resources", cleaned, byteCountBinary(mSize), clen, byteCountBinary(cacheSize)))
	cacheSize -= mSize
}

func min(a, b int) int {
	if a <= b {
		return a
	}
	return b
}

func (w *World) streamTexture(id uint64) [][]byte {
	var b []byte
	var e error
	p := path.Join("./assets/textures", fmt.Sprintf("%s.png", assets.Texture.ByID(id)))
	cacheMutex.Lock()
	if v, ok := pathCache[p]; ok {
		b = v.Data
		v.LastRead = time.Now()
	} else {
		b, e = ioutil.ReadFile(p)
		if e != nil {
			return [][]byte{}
		}
		pathCache[p] = &cacheData{
			Data:     b,
			LastRead: time.Now(),
		}
		cacheSize += int64(len(b))
	}
	cacheMutex.Unlock()
	if len(b) > connector.MaxStreamChunkSize {
		ks := [][]byte{}
		kt := uint64(len(b) / connector.MaxStreamChunkSize)
		if len(b)%connector.MaxStreamChunkSize > 0 {
			kt++
		}
		for i := 0; i < len(b); i += connector.MaxStreamChunkSize {
			batch := b[i:min(i+connector.MaxStreamChunkSize, len(b))]
			p, e := proto.Marshal(&pb.Response{
				Type: pb.Response_TEXTURE,
				Texture: &pb.Texture{
					Data:  batch,
					Parts: kt,
					Part:  uint64(i / connector.MaxStreamChunkSize),
				},
				Id: id,
			})
			if e == nil {
				ks = append(ks, p)
			}
		}
		return ks
	}
	k, _ := proto.Marshal(&pb.Response{
		Type: pb.Response_TEXTURE,
		Texture: &pb.Texture{
			Data: b,
		},
		Id: id,
	})
	return [][]byte{k}
}

func (w *World) streamMaterial(id uint64) []byte {
	k, _ := proto.Marshal(&pb.Response{Id: id, Type: pb.Response_MATERIAL, Material: assets.Material.ByID(id)})
	return k
}
