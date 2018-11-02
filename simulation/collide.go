package simulation

import "github.com/nobonobo/ode"

func (s *Simulation) makeCallback() func(data interface{}, obj1, obj2 ode.Geom) {
	return func(data interface{}, obj1, obj2 ode.Geom) {
		contact := ode.NewContact()
		body1, body2 := obj1.Body(), obj2.Body()
		if body1 != 0 && body2 != 0 && body1.Connected(body2) {
			return
		}
		contact.Surface.Mode = 0
		contact.Surface.Mu = 0.1
		contact.Surface.Mu2 = 0
		cts := obj1.Collide(obj2, 1, 0)
		if len(cts) > 0 {
			contact.Geom = cts[0]
			ct := s.world.NewContactJoint(s.cgrp, contact)
			ct.Attach(body1, body2)
		}
	}
}
