package main

import (
	"goworld/connector"
	"goworld/logging"
	"goworld/world"
)

func main() {
	c := connector.Init()
	logging.L("HTTP listening on :8081")
	logging.Green()
	w := world.New()
	c.OnPeerConnected(func(p *connector.Peer) {
		w.AddPlayer(p)
	})
	c.OnPeerDisconnected(func(p *connector.Peer) {
		w.RemovePlayer(p)
	})
	c.Wait()
}
