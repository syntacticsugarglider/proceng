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
	body  ode.Body
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
}

//Add adds a body to the simulation
func (s *Simulation) Add() {

}
