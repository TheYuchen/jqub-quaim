OPENQASM 3.0;
include "stdgates.inc";
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate rccx _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  t _gate_q_2;
  cx _gate_q_1, _gate_q_2;
  tdg _gate_q_2;
  cx _gate_q_0, _gate_q_2;
  t _gate_q_2;
  cx _gate_q_1, _gate_q_2;
  tdg _gate_q_2;
  h _gate_q_2;
}
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
qubit[8] q;
ecr q[2], q[0];
rzz(4.434687606483029) q[1], q[3];
ccx q[4], q[5], q[6];
U(5.6703370182379125, 3.9569036154476196, 1.4040773558826962) q[7];
cp(1.3394352148831148) q[1], q[6];
cswap q[4], q[0], q[3];
cswap q[5], q[7], q[2];
csdg q[0], q[7];
ccz q[6], q[5], q[3];
cswap q[2], q[1], q[4];
csx q[4], q[7];
cs q[0], q[5];
ccx q[1], q[6], q[2];
sxdg q[3];
rccx q[7], q[0], q[3];
rccx q[1], q[4], q[5];
cu1(4.854950525242607) q[6], q[2];
rccx q[1], q[6], q[7];
ccz q[0], q[4], q[3];
rz(0.4316711824482107) q[2];
ccz q[3], q[4], q[0];
cy q[2], q[5];
cswap q[7], q[6], q[1];
U(4.82849681525439, 0.863637961008623, 4.908706003943211) q[5];
ccz q[1], q[3], q[4];
cswap q[0], q[2], q[6];
