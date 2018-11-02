package world

import "goworld/connector"

//Player represents a Player
type Player struct {
	Peer      *connector.Peer
	AbsoluteX int64
	AbsoluteY int64
	AbsoluteZ int64
}

//NewPlayer returns a new Player
func NewPlayer(c *connector.Peer) *Player {
	p := new(Player)
	p.Peer = c
	return p
}
