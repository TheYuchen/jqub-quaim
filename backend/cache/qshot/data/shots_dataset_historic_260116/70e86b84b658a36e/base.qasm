OPENQASM 3.0;
include "stdgates.inc";
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p2 + 0.5*p1) _gate_q_0;
  p(0.5*p2 - 0.5*p1) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate rxx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_0;
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
  h _gate_q_0;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
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
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
}
qubit[8] q;
ccx q[0], q[4], q[3];
cu3(0.2302086425978044, 4.0311826268419555, 1.2685946554220433) q[1], q[5];
dcx q[7], q[6];
rx(3.8067184925244133) q[2];
rxx(4.072365944109344) q[4], q[6];
csdg q[3], q[7];
rzz(4.386271565119501) q[5], q[1];
ecr q[2], q[0];
csx q[6], q[0];
csdg q[3], q[5];
crz(4.244821487448874) q[4], q[7];
sdg q[2];
rccx q[6], q[2], q[3];
csx q[7], q[4];
cu3(1.194058492172361, 3.4915837872785644, 0.8482154763723248) q[1], q[0];
s q[5];
cp(2.7096964284212786) q[4], q[2];
cz q[7], q[5];
cy q[1], q[6];
p(4.867428847984462) q[3];
rzz(1.8135270214128083) q[5], q[1];
cswap q[4], q[3], q[2];
dcx q[7], q[6];
ccx q[3], q[6], q[1];
crz(2.2817430591817587) q[4], q[7];
cx q[5], q[2];
iswap q[4], q[2];
u2(1.1430913492530814, 2.3649021245921755) q[6];
r(2.8950454289464522, 0.4832480043697622) q[1];
cswap q[5], q[3], q[7];
crz(3.8933943709623757) q[5], q[0];
ryy(4.215354917535427) q[3], q[2];
ryy(6.06071990573731) q[7], q[4];
ch q[6], q[1];
cu3(2.7160814470013515, 3.4648298667689277, 1.904037422844169) q[1], q[7];
cy q[4], q[0];
cp(5.041262617378169) q[5], q[6];
