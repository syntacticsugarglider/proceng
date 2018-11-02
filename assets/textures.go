package assets

var textureIDMap = map[uint64]string{
	1: "stone",
}

//Texture represents the texture identifiers
var Texture = struct {
	Stone uint64
	ByID  func(uint64) string
}{
	Stone: 1,
	ByID: func(id uint64) string {
		return textureIDMap[id]
	},
}
