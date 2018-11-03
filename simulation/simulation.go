package simulation

import (
	"github.com/nobonobo/ode"
)

var stepSize = float64(1) / float64(60)

//Simulation represents the simulation
type Simulation struct {
	world ode.World
	space ode.Space
	cgrp  ode.JointGroup
	cb    func(data interface{}, obj1, obj2 ode.Geom)
	ents  []*entity
}

//InitializeSimulation initializes the simulation
func InitializeSimulation() *Simulation {
	s := new(Simulation)
	ode.Init(0, ode.AllAFlag)
	s.world = ode.NewWorld()
	s.space = ode.NilSpace().NewSimpleSpace()
	s.cgrp = ode.NewJointGroup(1000000)
	s.cb = s.makeCallback()
	return s
}

//Destroy destroys a simulation
func (s *Simulation) Destroy() {
	s.world.Destroy()
}

//Step steps the simulation
func (s *Simulation) Step() {
	s.space.Collide(0, s.cb)
	s.world.QuickStep(stepSize)
	s.cgrp.Empty()
	for _, e := range s.ents {
		p := e.Body.Position()
		e.VEnt.Location.X = p[0]
		e.VEnt.Location.Y = p[1]
		e.VEnt.Location.Z = p[2]
		lv := e.Body.LinearVelocity()
		e.VEnt.Velocity.X = float32(lv[0])
		e.VEnt.Velocity.Y = float32(lv[1])
		e.VEnt.Velocity.Z = float32(lv[2])
		av := e.Body.AngularVel()
		e.VEnt.RotationalVelocity.X = float32(av[0])
		e.VEnt.RotationalVelocity.Y = float32(av[1])
		e.VEnt.RotationalVelocity.Z = float32(av[2])
		q := e.Body.Quaternion()
		e.VEnt.Rotation.X = float32(q[0])
		e.VEnt.Rotation.Y = float32(q[1])
		e.VEnt.Rotation.Z = float32(q[2])
		e.VEnt.Rotation.W = float32(q[3])
	}
}
