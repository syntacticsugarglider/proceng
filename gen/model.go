package model

import (
	"goworld/pb"

	"github.com/fogleman/fauxgl"
)

//Box creates a box
func Box(x, y, z float64) (vertices []float64, faces []*pb.Body_Face) {
	c := fauxgl.NewCube()
	c.Transform(fauxgl.Scale(fauxgl.Vector{
		X: x,
		Y: y,
		Z: z,
	}))
	return convertMesh(c)
}

func convertMesh(m *fauxgl.Mesh) (vertices []float64, faces []*pb.Body_Face) {
	vertices = []float64{}
	vmap := map[[3]float64]uint64{}
	for _, t := range m.Triangles {
		vmap[[3]float64{t.V1.Position.X, t.V1.Position.Y, t.V1.Position.Z}] = 0
		vmap[[3]float64{t.V2.Position.X, t.V2.Position.Y, t.V2.Position.Z}] = 0
		vmap[[3]float64{t.V3.Position.X, t.V3.Position.Y, t.V3.Position.Z}] = 0
	}
	for k := range vmap {
		vertices = append(vertices, k[0], k[1], k[2])
		vmap[k] = uint64((len(vertices) / 3) - 1)
	}
	for _, t := range m.Triangles {
		faces = append(faces, &pb.Body_Face{
			A: vmap[[3]float64{t.V1.Position.X, t.V1.Position.Y, t.V1.Position.Z}],
			B: vmap[[3]float64{t.V2.Position.X, t.V2.Position.Y, t.V2.Position.Z}],
			C: vmap[[3]float64{t.V3.Position.X, t.V3.Position.Y, t.V3.Position.Z}],
		})
	}
	return
}
