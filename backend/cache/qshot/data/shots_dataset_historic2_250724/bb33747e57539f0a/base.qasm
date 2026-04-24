OPENQASM 3.0;
include "stdgates.inc";
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
qubit[5] q;
ecr q[2], q[1];
z q[4];
sxdg q[3];
id q[0];
sdg q[1];
s q[3];
U(2.976443499878436, 0.6835313290515692, 2.6623522118883347) q[4];
rz(0.8865326558328331) q[0];
sdg q[2];
ry(0.8305244600341031) q[2];
s q[4];
r(5.562079369226557, 5.236552026668308) q[3];
u3(0.25803537976401364, 2.550399478381439, 2.928524685201924) q[1];
h q[0];
