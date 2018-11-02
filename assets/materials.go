package assets

import (
	"goworld/pb"
)

var materialIDMap = map[uint64]*pb.Material{
	1: &pb.Material{
		FlatShaded: true,
		Color:      "#aaa",
		Side:       pb.Material_DOUBLE_SIDE,
	},
}

//Material represents the material identifiers
var Material = struct {
	Stone uint64
	ByID  func(uint64) *pb.Material
}{
	Stone: 1,
	ByID: func(id uint64) *pb.Material {
		return materialIDMap[id]
	},
}
