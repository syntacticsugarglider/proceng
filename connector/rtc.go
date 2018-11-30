package connector

import (
	"encoding/base64"

	"github.com/pions/webrtc/pkg/ice"

	"github.com/pions/webrtc"
)

//MaxStreamChunkSize is the maximum size of a stream chunk
const MaxStreamChunkSize = 16384

func rtcConnect(descriptor string, connected func(*webrtc.RTCDataChannel), disconnected func(*webrtc.RTCDataChannel), updateChannelConnected func(*webrtc.RTCDataChannel, *webrtc.RTCDataChannel)) (string, error) {
	config := webrtc.RTCConfiguration{
		IceServers: []webrtc.RTCIceServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
		},
	}
	channel := &webrtc.RTCDataChannel{}
	peerConnection, err := webrtc.New(config)
	if err != nil {
		return "", err
	}
	peerConnection.OnICEConnectionStateChange(func(i ice.ConnectionState) {
		if i == ice.ConnectionStateClosed || i == ice.ConnectionStateDisconnected {
			disconnected(channel)
		}
	})
	peerConnection.OnDataChannel(func(d *webrtc.RTCDataChannel) {
		if d.Label == "data" {
			channel = d
			connected(d)
		}
		if d.Label == "ud" {
			updateChannelConnected(channel, d)
		}
	})

	offer := webrtc.RTCSessionDescription{
		Type: webrtc.RTCSdpTypeOffer,
		Sdp:  string(descriptor),
	}

	err = peerConnection.SetRemoteDescription(offer)
	if err != nil {
		return "", err
	}

	answer, err := peerConnection.CreateAnswer(nil)
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString([]byte(answer.Sdp)), nil

}
