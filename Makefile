all:
	go build
	./goworld
proto:
	protoc -I=./pb --go_out=pb ./pb/pb.proto