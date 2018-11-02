package connector

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"sync"

	"github.com/pions/webrtc"
	"github.com/pions/webrtc/pkg/datachannel"
)

//Peer represents a connection peer
type Peer struct {
	channelPtr        *webrtc.RTCDataChannel
	updateChannelPtr  *webrtc.RTCDataChannel
	onMessageCallback func([]byte)
	onUpdateCallback  func([]byte)
}

//Connector represents the client connector
type Connector struct {
	shutdown             chan interface{}
	peers                map[*webrtc.RTCDataChannel]*Peer
	connectedCallback    func(*Peer)
	disconnectedCallback func(*Peer)
	peersMutex           *sync.Mutex
}

type httpHandler struct {
	connector *Connector
}

func (h *httpHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if len(r.URL.Path) < 2 {
		fmt.Fprint(w, "error")
		return
	}
	s, err := base64.URLEncoding.DecodeString(r.URL.Path[1:])
	if err != nil {
		fmt.Fprint(w, "error")
		return
	}
	code, err := rtcConnect(string(s), h.connector.connected, h.connector.disconnected, h.connector.updateChannelConnected)
	if err != nil {
		fmt.Fprint(w, "error")
		return
	}
	fmt.Fprint(w, code)
}

//Init serves the player provision HTTP endpoint and waits for connections
func Init() *Connector {
	c := new(Connector)
	c.peers = make(map[*webrtc.RTCDataChannel]*Peer)
	c.shutdown = make(chan interface{})
	c.connectedCallback = func(*Peer) {}
	c.disconnectedCallback = func(*Peer) {}
	c.peersMutex = new(sync.Mutex)
	h := new(httpHandler)
	h.connector = c
	go http.ListenAndServe(":8081", h)
	return c
}

//Wait waits on the connector
func (c *Connector) Wait() {
	<-c.shutdown
}

//Close closes the connector
func (c *Connector) Close() {
	c.shutdown <- struct{}{}
}

func (c *Connector) connected(channel *webrtc.RTCDataChannel) {
	channel.Lock()
	defer channel.Unlock()

	channel.OnOpen = func() {
		c.peersMutex.Lock()
		m, ok := c.peers[channel]
		if !ok {
			m = new(Peer)
			c.peers[channel] = m
		}
		m.onMessageCallback = func([]byte) {}
		m.channelPtr = channel
		c.connectedCallback(c.peers[channel])
		c.peersMutex.Unlock()
	}

	channel.Onmessage = func(payload datachannel.Payload) {
		switch p := payload.(type) {
		case *datachannel.PayloadBinary:
			c.peers[channel].onMessageCallback(p.Data)
		}
	}
}

func (c *Connector) updateChannelConnected(peerChannel *webrtc.RTCDataChannel, updateChannel *webrtc.RTCDataChannel) {
	updateChannel.Lock()
	defer updateChannel.Unlock()
	updateChannel.OnOpen = func() {
		go func() {
			c.peersMutex.Lock()
			defer c.peersMutex.Unlock()
			_, ok := c.peers[peerChannel]
			if !ok {
				c.peers[peerChannel] = new(Peer)
			}
			c.peers[peerChannel].updateChannelPtr = updateChannel
			c.peers[peerChannel].onUpdateCallback = func([]byte) {}
		}()
	}
	updateChannel.Onmessage = func(payload datachannel.Payload) {
		switch p := payload.(type) {
		case *datachannel.PayloadBinary:
			c.peers[peerChannel].onUpdateCallback(p.Data)
		}
	}
}

func (c *Connector) disconnected(channel *webrtc.RTCDataChannel) {
	c.disconnectedCallback(c.peers[channel])
	channel.Lock()
	defer channel.Unlock()
	delete(c.peers, channel)
}

//OnPeerConnected registers a peer connection callback
func (c *Connector) OnPeerConnected(callback func(*Peer)) {
	c.connectedCallback = callback
}

//OnPeerDisconnected registers a peer disconnection callback
func (c *Connector) OnPeerDisconnected(callback func(*Peer)) {
	c.disconnectedCallback = callback
}

//OnMessage registers a peer message callback
func (p *Peer) OnMessage(callback func([]byte)) {
	p.onMessageCallback = callback
}

//OnUpdate registers a peer update callback
func (p *Peer) OnUpdate(callback func([]byte)) {
	p.onUpdateCallback = callback
}

//SendMessage sends a message to a peer
func (p *Peer) SendMessage(data []byte) {
	p.channelPtr.Send(datachannel.PayloadBinary{
		Data: data,
	})
}

//SendUpdate sends an update to a peer
func (p *Peer) SendUpdate(data []byte) {
	p.updateChannelPtr.Send(datachannel.PayloadBinary{
		Data: data,
	})
}
