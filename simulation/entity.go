package simulation

import (
	"goworld/pb"

	"github.com/nobonobo/ode"
)

type entity struct {
	VEnt     *pb.Entity
	Body     ode.Body
	Collider ode.Geom
}

//AddFromVEnt creates a new Entity from a visual entity
func (s *Simulation) AddFromVEnt(pe *pb.Entity) {
	e := new(entity)
	e.Body = s.world.NewBody()
	e.VEnt = pe
	e.Body.SetPosition(ode.V3(pe.Location.X, pe.Location.Y, pe.Location.Z))
	mass := ode.NewMass()
	mass.SetBox(1, ode.V3(1, 1, 1))
	mass.Adjust(1)
	e.Body.SetMass(mass)
	e.Collider = s.space.NewBox(ode.V3(1, 1, 1))
	s.ents = append(s.ents, e)
}
