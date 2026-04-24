OPENQASM 3.0;
include "stdgates.inc";
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
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
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
gate xx_minus_yy(p0, p1) _gate_q_0, _gate_q_1 {
  rz(-p1) _gate_q_1;
  sdg _gate_q_0;
  sx _gate_q_0;
  s _gate_q_0;
  s _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  ry(0.5*p0) _gate_q_0;
  ry((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sdg _gate_q_1;
  sdg _gate_q_0;
  sxdg _gate_q_0;
  s _gate_q_0;
  rz(p1) _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
qubit[7] q;
u2(2.844194381820765, 5.47956191350629) q[3];
ccz q[6], q[4], q[5];
rccx q[0], q[2], q[1];
h q[5];
rz(4.463355834622218) q[0];
ryy(0.8557643533181031) q[4], q[3];
u2(6.197741700549473, 0.8118605811784998) q[6];
u1(1.5574769264928923) q[1];
id q[2];
p(1.0227875256958374) q[0];
p(2.672275608100464) q[1];
p(1.6925460165542132) q[4];
cu1(0.4905966241143061) q[3], q[5];
ch q[2], q[6];
rx(4.885525248874738) q[4];
s q[3];
xx_minus_yy(1.2141305806607936, 5.069296383811682) q[0], q[1];
p(3.2204979864619747) q[2];
sxdg q[5];
rz(4.2694365617286785) q[0];
ry(4.447025981740923) q[1];
ccx q[3], q[4], q[2];
sdg q[6];
sx q[5];
p(1.8371367205942164) q[5];
u1(3.2172601895186568) q[4];
iswap q[2], q[3];
rzx(5.177713327258197) q[6], q[1];
p(0.5522259154897031) q[0];
cu1(0.44903048605666107) q[6], q[5];
sx q[0];
u1(4.836602532358425) q[2];
cp(0.5350408593240457) q[3], q[1];
ccz q[6], q[3], q[2];
U(2.448570331862643, 0.7517450729413793, 5.433614606036423) q[0];
swap q[5], q[1];
cu3(3.5364672276739273, 0.685301493148657, 3.2759386854993093) q[1], q[6];
cswap q[2], q[5], q[3];
cs q[4], q[0];
x q[2];
ccz q[1], q[0], q[4];
cswap q[6], q[3], q[5];
