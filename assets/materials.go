package assets

import (
	"goworld/pb"
)

//MaterialPhysicalProperties contains the physical properties of a material
type MaterialPhysicalProperties struct {
	Density float64
}

var physicalPropertiesIDMap = map[uint64]MaterialPhysicalProperties{
	1: MaterialPhysicalProperties{
		Density: 1,
	},
}

var materialIDMap = map[uint64]*pb.Material{
	1: &pb.Material{
		FlatShaded: true,
		Side:       pb.Material_DOUBLE_SIDE,
		TextureID:  1,
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
