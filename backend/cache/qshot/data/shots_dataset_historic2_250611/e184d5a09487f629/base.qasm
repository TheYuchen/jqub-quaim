OPENQASM 3.0;
include "stdgates.inc";
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate xx_plus_yy(p0, p1) _gate_q_0, _gate_q_1 {
  rz(p1) _gate_q_0;
  sdg _gate_q_1;
  sx _gate_q_1;
  s _gate_q_1;
  s _gate_q_0;
  cx _gate_q_1, _gate_q_0;
  ry((-0.5)*p0) _gate_q_1;
  ry((-0.5)*p0) _gate_q_0;
  cx _gate_q_1, _gate_q_0;
  sdg _gate_q_0;
  sdg _gate_q_1;
  sxdg _gate_q_1;
  s _gate_q_1;
  rz(-p1) _gate_q_0;
}
qubit[5] q;
cu3(5.26624161876846, 3.412645368092009, 3.2755257556636583) q[4], q[0];
cswap q[1], q[2], q[3];
cswap q[3], q[1], q[4];
t q[0];
cswap q[2], q[3], q[4];
crz(2.693137994491595) q[1], q[0];
xx_plus_yy(6.234512908022821, 2.719692638261775) q[3], q[1];
cry(4.424624648841263) q[0], q[4];
U(3.6699326629841753, 3.313073562101126, 2.7722931942570366) q[2];
tdg q[3];
ccx q[4], q[1], q[0];
